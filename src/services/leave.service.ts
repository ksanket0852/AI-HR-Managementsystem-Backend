import { PrismaClient, LeaveStatus, Prisma } from "@prisma/client";
import {
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
  LeaveTypeQuery,
  CreateLeaveApplicationDto,
  UpdateLeaveApplicationDto,
  LeaveApplicationQuery,
  LeaveBalanceDto,
  LeaveBalance,
  CalendarQuery,
  CalendarEvent
} from "../types/leave.dto";
import ical, { ICalEventStatus } from 'ical-generator';
import { v4 as uuidv4 } from 'uuid';
import SocketService from './socket.service';

class LeaveService {
  private prisma = new PrismaClient();
  private socketService?: SocketService;

  setSocketService(socketService: SocketService) {
    this.socketService = socketService;
  }

  // Leave Type Management
  public async createLeaveType(data: CreateLeaveTypeDto) {
    return this.prisma.leaveType.create({
      data: {
        name: data.name,
        description: data.description,
        maxDays: data.maxDays,
        carryForward: data.carryForward,
      },
    });
  }

  public async getLeaveTypes(query: LeaveTypeQuery = {}) {
    const where: any = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    return this.prisma.leaveType.findMany({
      where,
      orderBy: {
        name: "asc",
      },
    });
  }

  public async getLeaveTypeById(id: string) {
    return this.prisma.leaveType.findUnique({
      where: { id },
    });
  }

  public async updateLeaveType(id: string, data: UpdateLeaveTypeDto) {
    return this.prisma.leaveType.update({
      where: { id },
      data,
    });
  }

  public async deleteLeaveType(id: string) {
    // Check if the leave type is used in any leave applications
    const leavesCount = await this.prisma.leave.count({
      where: { leaveTypeId: id },
    });

    if (leavesCount > 0) {
      // Instead of deleting, mark as inactive if there are associated leaves
      return this.prisma.leaveType.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // If no associated leaves, delete the leave type
    return this.prisma.leaveType.delete({
      where: { id },
    });
  }

  // Leave Application Management
  public async applyForLeave(employeeId: string, data: CreateLeaveApplicationDto) {
    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate < startDate) {
      throw new Error("End date cannot be before start date");
    }

    // Calculate number of days (excluding weekends)
    const days = this.calculateBusinessDays(startDate, endDate);

    // Check if leave type exists
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: data.leaveTypeId },
    });

    if (!leaveType) {
      throw new Error("Leave type not found");
    }

    // Check leave balance
    const currentYear = new Date().getFullYear();
    const leaveBalance = await this.getEmployeeLeaveBalance(employeeId, currentYear);
    const leaveTypeBalance = leaveBalance.find(balance => balance.leaveTypeId === data.leaveTypeId);

    if (!leaveTypeBalance) {
      throw new Error("Leave type not available for this employee");
    }

    if (days > leaveTypeBalance.remaining) {
      throw new Error(`Insufficient leave balance. Available: ${leaveTypeBalance.remaining} days`);
    }

    // Create leave application
    return this.prisma.leave.create({
      data: {
        employee: { connect: { id: employeeId } },
        leaveType: { connect: { id: data.leaveTypeId } },
        startDate,
        endDate,
        days: new Prisma.Decimal(days),
        reason: data.reason,
        status: LeaveStatus.PENDING,
        appliedAt: new Date(),
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            managerId: true,
          },
        },
        leaveType: true,
      },
    });
  }

  public async updateLeaveApplication(id: string, userId: string, data: UpdateLeaveApplicationDto) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new Error("Leave application not found");
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new Error("Only pending leave applications can be updated");
    }

    const updateData: any = {};

    if (data.status) {
      updateData.status = data.status;
      
      if (data.status === LeaveStatus.APPROVED) {
        updateData.approvedBy = userId;
        updateData.approvedAt = new Date();
      }
      
      if (data.status === LeaveStatus.REJECTED && data.rejectedReason) {
        updateData.rejectedReason = data.rejectedReason;
      }
    }

    const updatedLeave = await this.prisma.leave.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            userId: true,
          },
        },
        leaveType: true,
        approver: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Send real-time notification if status changed and socket service is available
    if (data.status && this.socketService) {
      if (data.status === LeaveStatus.APPROVED || data.status === LeaveStatus.REJECTED) {
        await this.socketService.notifyLeaveApproval(id, data.status, userId);
      }
    }

    return updatedLeave;
  }

  public async cancelLeaveApplication(id: string, employeeId: string) {
    const leave = await this.prisma.leave.findUnique({
      where: { id },
    });

    if (!leave) {
      throw new Error("Leave application not found");
    }

    if (leave.employeeId !== employeeId) {
      throw new Error("You can only cancel your own leave applications");
    }

    if (leave.status !== LeaveStatus.PENDING && leave.status !== LeaveStatus.APPROVED) {
      throw new Error("Only pending or approved leaves can be cancelled");
    }

    // Check if leave has already started
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (leave.startDate < today) {
      throw new Error("Cannot cancel a leave that has already started");
    }

    return this.prisma.leave.update({
      where: { id },
      data: {
        status: LeaveStatus.CANCELLED,
      },
    });
  }

  public async getLeaveApplications(query: LeaveApplicationQuery = {}) {
    const where: any = {};

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate && query.endDate) {
      where.OR = [
        {
          // Leave starts within the range
          startDate: {
            gte: new Date(query.startDate),
            lte: new Date(query.endDate),
          },
        },
        {
          // Leave ends within the range
          endDate: {
            gte: new Date(query.startDate),
            lte: new Date(query.endDate),
          },
        },
        {
          // Leave spans the entire range
          AND: [
            {
              startDate: {
                lte: new Date(query.startDate),
              },
            },
            {
              endDate: {
                gte: new Date(query.endDate),
              },
            },
          ],
        },
      ];
    }

    return this.prisma.leave.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
        leaveType: true,
        approver: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        appliedAt: "desc",
      },
    });
  }

  public async getLeaveApplicationById(id: string) {
    return this.prisma.leave.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
        leaveType: true,
        approver: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  // Leave Balance Management
  public async getEmployeeLeaveBalance(employeeId: string, year: number): Promise<LeaveBalance[]> {
    // Get all active leave types
    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { isActive: true },
    });

    // Get all approved leaves for the employee in the given year
    const startDate = new Date(year, 0, 1); // January 1st
    const endDate = new Date(year, 11, 31); // December 31st

    const approvedLeaves = await this.prisma.leave.findMany({
      where: {
        employeeId,
        status: LeaveStatus.APPROVED,
        startDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get all pending leaves for the employee in the given year
    const pendingLeaves = await this.prisma.leave.findMany({
      where: {
        employeeId,
        status: LeaveStatus.PENDING,
        startDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculate balance for each leave type
    const balances: LeaveBalance[] = leaveTypes.map(leaveType => {
      // Calculate used days
      const usedDays = approvedLeaves
        .filter(leave => leave.leaveTypeId === leaveType.id)
        .reduce((total, leave) => total + Number(leave.days), 0);

      // Calculate pending days
      const pendingDays = pendingLeaves
        .filter(leave => leave.leaveTypeId === leaveType.id)
        .reduce((total, leave) => total + Number(leave.days), 0);

      // Calculate remaining days
      const remainingDays = Math.max(0, leaveType.maxDays - usedDays);

      return {
        leaveTypeId: leaveType.id,
        leaveTypeName: leaveType.name,
        maxDays: leaveType.maxDays,
        used: usedDays,
        remaining: remainingDays,
        pending: pendingDays,
      };
    });

    return balances;
  }

  // Calendar Integration
  public async getCalendarEvents(query: CalendarQuery): Promise<CalendarEvent[] | string> {
    const { startDate, endDate, employeeId, departmentId, format = 'json' } = query;
    
    const where: any = {
      startDate: { lte: new Date(endDate) },
      endDate: { gte: new Date(startDate) },
      status: { in: [LeaveStatus.APPROVED, LeaveStatus.PENDING] }
    };
    
    if (employeeId) {
      where.employeeId = employeeId;
    }
    
    if (departmentId) {
      where.employee = {
        departmentId
      };
    }
    
    const leaves = await this.prisma.leave.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        leaveType: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    });
    
    // Status color mapping
    const statusColors = {
      [LeaveStatus.PENDING]: '#FFA500', // Orange
      [LeaveStatus.APPROVED]: '#28A745', // Green
      [LeaveStatus.REJECTED]: '#DC3545', // Red
      [LeaveStatus.CANCELLED]: '#6C757D'  // Gray
    };
    
    if (format === 'json') {
      // Return JSON format for calendar integration
      return leaves.map(leave => {
        const employeeName = `${leave.employee.firstName} ${leave.employee.lastName}`;
        const title = `${employeeName} - ${leave.leaveType.name}`;
        
        return {
          id: leave.id,
          title,
          start: leave.startDate.toISOString(),
          end: leave.endDate.toISOString(),
          allDay: true,
          employeeId: leave.employeeId,
          employeeName,
          leaveType: leave.leaveType.name,
          status: leave.status,
          color: statusColors[leave.status]
        };
      });
    } else {
      // Return iCal format
      const calendar = ical({
        name: 'Leave Calendar',
        timezone: 'UTC'
      });
      
      leaves.forEach(leave => {
        const employeeName = `${leave.employee.firstName} ${leave.employee.lastName}`;
        const summary = `${employeeName} - ${leave.leaveType.name} (${leave.status})`;
        
        const event = calendar.createEvent({
          id: leave.id,
          start: leave.startDate,
          end: leave.endDate,
          summary,
          description: leave.reason,
          allDay: true
        });
        
        // Set the status separately
        event.status(leave.status === LeaveStatus.APPROVED ? ICalEventStatus.CONFIRMED : ICalEventStatus.TENTATIVE);
      });
      
      return calendar.toString();
    }
  }
  
  // Generate shareable calendar link
  public async generateCalendarLink(employeeId?: string, departmentId?: string): Promise<string> {
    // Generate a unique token for the calendar link
    const token = uuidv4();
    
    // In a real implementation, you would store this token in the database
    // associated with the employeeId or departmentId for later validation
    
    // For now, we'll just return a simulated link
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const params = new URLSearchParams();
    
    if (employeeId) {
      params.append('employeeId', employeeId);
    }
    
    if (departmentId) {
      params.append('departmentId', departmentId);
    }
    
    params.append('token', token);
    
    return `${baseUrl}/api/leaves/calendar/share?${params.toString()}`;
  }
  
  // Helper method to calculate business days between two dates (excluding weekends)
  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const curDate = new Date(startDate.getTime());
    
    while (curDate <= endDate) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      curDate.setDate(curDate.getDate() + 1);
    }
    
    return count;
  }
}

export const leaveService = new LeaveService(); 