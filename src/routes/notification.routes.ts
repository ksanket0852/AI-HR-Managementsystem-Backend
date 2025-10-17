import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { body, query, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get user notifications
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('unreadOnly').optional().isBoolean(),
  query('type').optional().isString()
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';
    const type = req.query.type as string;

    const skip = (page - 1) * limit;

    const whereClause: any = { userId };
    
    if (unreadOnly) {
      whereClause.isRead = false;
    }
    
    if (type) {
      whereClause.type = type;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.notification.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread notifications count
router.get('/unread-count', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    });

    return res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user!.id;

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: userId
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: { 
        isRead: true
      }
    });

    return res.json({ 
      message: 'Notification marked as read',
      notification: updatedNotification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await prisma.notification.updateMany({
      where: {
        userId: userId,
        isRead: false
      },
      data: { 
        isRead: true
      }
    });

    return res.json({ 
      message: 'All notifications marked as read',
      updatedCount: result.count
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete notification
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user!.id;

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: userId
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({
      where: { id: notificationId }
    });

    return res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create system announcement (Admin/HR only)
router.post('/system-announcement', [
  body('title').isString().notEmpty().trim(),
  body('message').isString().notEmpty().trim(),
  body('priority').isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  body('targetRoles').optional().isArray(),
  body('targetUsers').optional().isArray()
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user has permission to create system announcements
    if (!['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { title, message, priority, targetRoles, targetUsers } = req.body;

    // Get socket service instance (will need to inject this)
    // For now, we'll store the announcement and let the socket service handle it
    const announcement = {
      title,
      message,
      priority,
      targetRoles,
      targetUsers,
      createdBy: req.user!.id,
      createdAt: new Date()
    };

    // If socket service is available, broadcast the announcement
    if (req.app.locals.socketService) {
      await req.app.locals.socketService.broadcastSystemAnnouncement(announcement);
    }

    return res.json({ 
      message: 'System announcement sent successfully',
      announcement 
    });
  } catch (error) {
    console.error('Error creating system announcement:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Send emergency alert (Admin only)
router.post('/emergency-alert', [
  body('title').isString().notEmpty().trim(),
  body('message').isString().notEmpty().trim(),
  body('actionRequired').optional().isBoolean(),
  body('evacuationRequired').optional().isBoolean()
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user has permission to send emergency alerts
    if (!['SUPER_ADMIN', 'HR_ADMIN'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { title, message, actionRequired, evacuationRequired } = req.body;

    const alert = {
      title,
      message,
      actionRequired: actionRequired || false,
      evacuationRequired: evacuationRequired || false,
      createdBy: req.user!.id,
      createdAt: new Date()
    };

    // If socket service is available, broadcast the emergency alert
    if (req.app.locals.socketService) {
      await req.app.locals.socketService.broadcastEmergencyAlert(alert);
    }

    return res.json({ 
      message: 'Emergency alert sent successfully',
      alert 
    });
  } catch (error) {
    console.error('Error sending emergency alert:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notification statistics (for admins)
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user has permission to view stats
    if (!['SUPER_ADMIN', 'HR_ADMIN', 'HR_MANAGER'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const [
      totalNotifications,
      unreadNotifications,
      todayNotifications,
      weekNotifications,
      notificationsByType
    ] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: false } }),
      prisma.notification.count({ 
        where: { 
          createdAt: { gte: startOfDay } 
        } 
      }),
      prisma.notification.count({ 
        where: { 
          createdAt: { gte: startOfWeek } 
        } 
      }),
      prisma.notification.groupBy({
        by: ['type'],
        _count: true,
        orderBy: { _count: { type: 'desc' } }
      })
    ]);

    return res.json({
      totalNotifications,
      unreadNotifications,
      todayNotifications,
      weekNotifications,
      notificationsByType: notificationsByType.map(item => ({
        type: item.type,
        count: item._count
      }))
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 