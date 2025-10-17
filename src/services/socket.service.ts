import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export class SocketService {
  private io: Server;
  private prisma: PrismaClient;
  private connectedUsers: Map<string, AuthenticatedSocket>;

  constructor(io: Server) {
    this.io = io;
    this.prisma = new PrismaClient();
    this.connectedUsers = new Map();
    this.setupMiddleware();
    this.setupConnectionHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware for socket connections
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        // Fetch user details from database
        const user = await this.prisma.user.findUnique({
          where: { id: decoded.userId },
          include: {
            employee: {
              include: {
                department: true
              }
            }
          }
        });

        if (!user || !user.employee) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = user.id;
        socket.userRole = user.role;
        
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupConnectionHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.userId} connected`);
      
      // Store the connected socket
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket);
        
        // Join user-specific rooms
        socket.join(`user-${socket.userId}`);
        
        // Join role-based rooms
        if (socket.userRole) {
          socket.join(`role-${socket.userRole}`);
        }

        // Send initial connection confirmation
        socket.emit('connected', {
          userId: socket.userId,
          timestamp: new Date(),
          onlineUsers: this.getOnlineUsersCount()
        });

        // Broadcast user online status to admins/hr
        if (socket.userRole === 'ADMIN' || socket.userRole === 'HR') {
          this.broadcastToRole(['ADMIN', 'HR'], 'user-online', {
            userId: socket.userId,
            timestamp: new Date(),
            totalOnline: this.getOnlineUsersCount()
          });
        }
      }

      // Handle real-time dashboard updates
      socket.on('subscribe-dashboard', () => {
        socket.join('dashboard-updates');
        console.log(`User ${socket.userId} subscribed to dashboard updates`);
      });

      socket.on('unsubscribe-dashboard', () => {
        socket.leave('dashboard-updates');
        console.log(`User ${socket.userId} unsubscribed from dashboard updates`);
      });

      // Handle real-time notifications
      socket.on('mark-notification-read', async (notificationId: string) => {
        try {
          await this.markNotificationAsRead(notificationId, socket.userId!);
          socket.emit('notification-updated', { notificationId, status: 'read' });
        } catch (error) {
          socket.emit('error', { message: 'Failed to mark notification as read' });
        }
      });

      // Handle real-time chat for HR support
      socket.on('join-support-chat', () => {
        socket.join('support-chat');
        console.log(`User ${socket.userId} joined support chat`);
      });

      socket.on('support-message', (data) => {
        this.handleSupportMessage(socket, data);
      });

      // Handle typing indicators
      socket.on('typing-start', (data) => {
        socket.broadcast.to('support-chat').emit('user-typing', {
          userId: socket.userId,
          timestamp: new Date()
        });
      });

      socket.on('typing-stop', (data) => {
        socket.broadcast.to('support-chat').emit('user-stopped-typing', {
          userId: socket.userId,
          timestamp: new Date()
        });
      });

      // Handle leave approval real-time updates
      socket.on('subscribe-leave-updates', () => {
        socket.join('leave-updates');
      });

      // Handle attendance real-time updates
      socket.on('subscribe-attendance-updates', () => {
        socket.join('attendance-updates');
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
          
          // Broadcast user offline status to admins/hr
          if (socket.userRole === 'ADMIN' || socket.userRole === 'HR') {
            this.broadcastToRole(['ADMIN', 'HR'], 'user-offline', {
              userId: socket.userId,
              timestamp: new Date(),
              totalOnline: this.getOnlineUsersCount()
            });
          }
        }
      });

      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.userId}:`, error);
      });
    });
  }

  // Real-time notification methods
  async sendNotificationToUser(userId: string, notification: any) {
    try {
      // Save notification to database
      const savedNotification = await this.prisma.notification.create({
        data: {
          userId,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          priority: notification.priority || 'MEDIUM',
          metadata: notification.metadata || {}
        }
      });

      // Send real-time notification
      this.io.to(`user-${userId}`).emit('new-notification', {
        id: savedNotification.id,
        title: savedNotification.title,
        message: savedNotification.message,
        type: savedNotification.type,
        priority: savedNotification.priority,
        timestamp: savedNotification.createdAt,
        metadata: savedNotification.metadata
      });

      return savedNotification;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  // Broadcast to multiple users
  async broadcastNotification(userIds: string[], notification: any) {
    const promises = userIds.map(userId => this.sendNotificationToUser(userId, notification));
    return Promise.all(promises);
  }

  // Broadcast to role-based users
  broadcastToRole(roles: string[], event: string, data: any) {
    roles.forEach(role => {
      this.io.to(`role-${role}`).emit(event, data);
    });
  }

  // Dashboard real-time updates
  broadcastDashboardUpdate(data: any) {
    this.io.to('dashboard-updates').emit('dashboard-update', {
      ...data,
      timestamp: new Date()
    });
  }

  // Leave approval notifications
  async notifyLeaveApproval(leaveId: string, status: 'APPROVED' | 'REJECTED', approvedBy: string) {
    try {
      const leave = await this.prisma.leave.findUnique({
        where: { id: leaveId },
        include: {
          employee: {
            include: {
              user: true,
              department: true
            }
          },
          leaveType: true
        }
      });

      if (!leave) return;

      const approver = await this.prisma.user.findUnique({
        where: { id: approvedBy },
        include: { employee: true }
      });

      // Notify the employee
      await this.sendNotificationToUser(leave.employee.userId, {
        title: `Leave Request ${status}`,
        message: `Your ${leave.leaveType.name} leave request from ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()} has been ${status.toLowerCase()} by ${approver?.employee?.firstName} ${approver?.employee?.lastName}`,
        type: status === 'APPROVED' ? 'SUCCESS' : 'WARNING',
        priority: 'HIGH',
        metadata: {
          leaveId: leave.id,
          status,
          approvedBy,
          leaveType: leave.leaveType.name,
          startDate: leave.startDate,
          endDate: leave.endDate
        }
      });

      // Broadcast to leave updates subscribers
      this.io.to('leave-updates').emit('leave-status-changed', {
        leaveId: leave.id,
        employeeId: leave.employeeId,
        status,
        approvedBy,
        timestamp: new Date()
      });

      // Update dashboard
      this.broadcastDashboardUpdate({
        type: 'leave-update',
        action: status,
        leaveId: leave.id,
        employeeName: `${leave.employee.firstName} ${leave.employee.lastName}`
      });

    } catch (error) {
      console.error('Error notifying leave approval:', error);
    }
  }

  // Attendance real-time updates
  broadcastAttendanceUpdate(employeeId: string, action: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END', data: any) {
    this.io.to('attendance-updates').emit('attendance-update', {
      employeeId,
      action,
      data,
      timestamp: new Date()
    });

    // Update dashboard
    this.broadcastDashboardUpdate({
      type: 'attendance-update',
      action,
      employeeId,
      data
    });
  }

  // Support chat handling
  private async handleSupportMessage(socket: AuthenticatedSocket, data: any) {
    try {
      const message = {
        id: `msg_${Date.now()}`,
        userId: socket.userId,
        message: data.message,
        timestamp: new Date(),
        type: data.type || 'text'
      };

      // Save to database (if needed)
      // await this.saveSupportMessage(message);

      // Broadcast to all support chat participants
      this.io.to('support-chat').emit('support-message', message);

      // Notify HR/Admin users if they're not in the chat
      this.broadcastToRole(['ADMIN', 'HR'], 'new-support-message', {
        message,
        urgent: data.urgent || false
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to send support message' });
    }
  }

  // Analytics real-time updates
  broadcastAnalyticsUpdate(type: string, data: any) {
    this.io.to('dashboard-updates').emit('analytics-update', {
      type,
      data,
      timestamp: new Date()
    });
  }

  // System announcements
  async broadcastSystemAnnouncement(announcement: {
    title: string;
    message: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    targetRoles?: string[];
    targetUsers?: string[];
  }) {
    try {
      const notificationData = {
        title: announcement.title,
        message: announcement.message,
        type: 'ANNOUNCEMENT',
        priority: announcement.priority,
        metadata: {
          isSystemAnnouncement: true,
          timestamp: new Date()
        }
      };

      if (announcement.targetUsers?.length) {
        // Send to specific users
        await this.broadcastNotification(announcement.targetUsers, notificationData);
      } else if (announcement.targetRoles?.length) {
        // Send to specific roles
        announcement.targetRoles.forEach(role => {
          this.io.to(`role-${role}`).emit('system-announcement', notificationData);
        });
      } else {
        // Broadcast to all connected users
        this.io.emit('system-announcement', notificationData);
      }

    } catch (error) {
      console.error('Error broadcasting system announcement:', error);
    }
  }

  // Emergency notifications
  async broadcastEmergencyAlert(alert: {
    title: string;
    message: string;
    actionRequired?: boolean;
    evacuationRequired?: boolean;
  }) {
    const alertData = {
      ...alert,
      type: 'EMERGENCY',
      priority: 'CRITICAL',
      timestamp: new Date(),
      id: `emergency_${Date.now()}`
    };

    // Broadcast to all connected users
    this.io.emit('emergency-alert', alertData);

    // Also send as high-priority notifications
    const connectedUserIds = Array.from(this.connectedUsers.keys());
    if (connectedUserIds.length > 0) {
      await this.broadcastNotification(connectedUserIds, {
        title: alert.title,
        message: alert.message,
        type: 'EMERGENCY',
        priority: 'CRITICAL',
        metadata: alert
      });
    }
  }

  // Utility methods
  private async markNotificationAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: userId
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
  }

  getOnlineUsersCount(): number {
    return this.connectedUsers.size;
  }

  getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Performance monitoring
  getSocketStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      totalSockets: this.io.sockets.sockets.size,
      rooms: Object.keys(this.io.sockets.adapter.rooms),
      timestamp: new Date()
    };
  }

  // Cleanup method
  async cleanup() {
    await this.prisma.$disconnect();
  }
}

export default SocketService; 