import { Response, Request } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { leaveService } from "../services/leave.service";
import { PrismaClient } from "@prisma/client";
import {
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
  CreateLeaveApplicationDto,
  UpdateLeaveApplicationDto,
  LeaveBalanceDto,
  CalendarQuery
} from "../types/leave.dto";

class LeaveController {
  private prisma = new PrismaClient();

  private async getEmployeeId(userId: string): Promise<string | null> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    return employee?.id || null;
  }

  // Leave Type Management
  public async createLeaveType(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const data: CreateLeaveTypeDto = req.body;
      const leaveType = await leaveService.createLeaveType(data);
      return res.status(201).json({ message: "Leave type created successfully", leaveType });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while creating leave type" });
    }
  }

  public async getLeaveTypes(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const leaveTypes = await leaveService.getLeaveTypes(req.query);
      return res.status(200).json(leaveTypes);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while fetching leave types" });
    }
  }

  public async getLeaveTypeById(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const leaveType = await leaveService.getLeaveTypeById(id);
      
      if (!leaveType) {
        return res.status(404).json({ message: "Leave type not found" });
      }
      
      return res.status(200).json(leaveType);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while fetching leave type" });
    }
  }

  public async updateLeaveType(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const data: UpdateLeaveTypeDto = req.body;
      
      const leaveType = await leaveService.updateLeaveType(id, data);
      return res.status(200).json({ message: "Leave type updated successfully", leaveType });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while updating leave type" });
    }
  }

  public async deleteLeaveType(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const result = await leaveService.deleteLeaveType(id);
      
      if (result.isActive === false) {
        return res.status(200).json({ 
          message: "Leave type has associated leave applications and was marked as inactive instead of being deleted" 
        });
      }
      
      return res.status(200).json({ message: "Leave type deleted successfully" });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while deleting leave type" });
    }
  }

  // Leave Application Management
  public async applyForLeave(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const employeeId = await this.getEmployeeId(userId);
      if (!employeeId) {
        return res.status(404).json({ message: "Employee profile not found for this user" });
      }

      const data: CreateLeaveApplicationDto = req.body;
      const leave = await leaveService.applyForLeave(employeeId, data);
      
      return res.status(201).json({ message: "Leave application submitted successfully", leave });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while applying for leave" });
    }
  }

  public async updateLeaveApplication(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const data: UpdateLeaveApplicationDto = req.body;
      const leave = await leaveService.updateLeaveApplication(id, userId, data);
      
      return res.status(200).json({ 
        message: `Leave application ${data.status?.toLowerCase()} successfully`, 
        leave 
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while updating leave application" });
    }
  }

  public async cancelLeaveApplication(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const employeeId = await this.getEmployeeId(userId);
      if (!employeeId) {
        return res.status(404).json({ message: "Employee profile not found for this user" });
      }
      
      const leave = await leaveService.cancelLeaveApplication(id, employeeId);
      
      return res.status(200).json({ message: "Leave application cancelled successfully", leave });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while cancelling leave application" });
    }
  }

  public async getLeaveApplications(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      // If user is not HR or admin, filter by their employee ID
      if (req.user?.role !== 'HR_ADMIN' && req.user?.role !== 'HR_MANAGER' && req.user?.role !== 'SUPER_ADMIN') {
        const employeeId = await this.getEmployeeId(req.user?.id || '');
        if (!employeeId) {
          return res.status(404).json({ message: "Employee profile not found for this user" });
        }
        req.query.employeeId = employeeId;
      }
      
      const leaves = await leaveService.getLeaveApplications(req.query);
      return res.status(200).json(leaves);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while fetching leave applications" });
    }
  }

  public async getLeaveApplicationById(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const leave = await leaveService.getLeaveApplicationById(id);
      
      if (!leave) {
        return res.status(404).json({ message: "Leave application not found" });
      }
      
      // Check if user has permission to view this leave application
      if (req.user?.role !== 'HR_ADMIN' && req.user?.role !== 'HR_MANAGER' && req.user?.role !== 'SUPER_ADMIN') {
        const employeeId = await this.getEmployeeId(req.user?.id || '');
        if (!employeeId || leave.employeeId !== employeeId) {
          return res.status(403).json({ message: "You don't have permission to view this leave application" });
        }
      }
      
      return res.status(200).json(leave);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while fetching leave application" });
    }
  }

  public async getEmployeeLeaveBalance(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      let { employeeId, year } = req.query;
      
      // If no employee ID is provided, use the current user's employee ID
      if (!employeeId && req.user) {
        const currentEmployeeId = await this.getEmployeeId(req.user.id);
        if (!currentEmployeeId) {
          return res.status(404).json({ message: "Employee profile not found for this user" });
        }
        employeeId = currentEmployeeId;
      }
      
      // If no year is provided, use the current year
      if (!year) {
        year = new Date().getFullYear().toString();
      }
      
      const balance = await leaveService.getEmployeeLeaveBalance(
        employeeId as string, 
        parseInt(year as string)
      );
      
      return res.status(200).json(balance);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while fetching leave balance" });
    }
  }

  // Calendar Integration
  public async getCalendarEvents(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const query: CalendarQuery = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        employeeId: req.query.employeeId as string,
        departmentId: req.query.departmentId as string,
        format: req.query.format as 'json' | 'ical'
      };
      
      // Validate required parameters
      if (!query.startDate || !query.endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      
      // If user is not HR or admin, restrict to viewing their own leaves
      if (req.user?.role !== 'HR_ADMIN' && req.user?.role !== 'HR_MANAGER' && req.user?.role !== 'SUPER_ADMIN') {
        const employeeId = await this.getEmployeeId(req.user?.id || '');
        if (!employeeId) {
          return res.status(404).json({ message: "Employee profile not found for this user" });
        }
        query.employeeId = employeeId;
      }
      
      const events = await leaveService.getCalendarEvents(query);
      
      if (query.format === 'ical') {
        // Return as iCal file
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', 'attachment; filename="leaves.ics"');
        return res.status(200).send(events);
      }
      
      return res.status(200).json(events);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while fetching calendar events" });
    }
  }
  
  public async generateCalendarLink(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { employeeId, departmentId } = req.query;
      
      // If user is not HR or admin, they can only generate links for themselves
      if (req.user?.role !== 'HR_ADMIN' && req.user?.role !== 'HR_MANAGER' && req.user?.role !== 'SUPER_ADMIN') {
        const userEmployeeId = await this.getEmployeeId(req.user?.id || '');
        if (!userEmployeeId) {
          return res.status(404).json({ message: "Employee profile not found for this user" });
        }
        
        // Only allow generating link for their own calendar
        if (employeeId && employeeId !== userEmployeeId) {
          return res.status(403).json({ 
            message: "You can only generate calendar links for yourself" 
          });
        }
        
        // Don't allow department-wide calendar links
        if (departmentId) {
          return res.status(403).json({ 
            message: "You don't have permission to generate department calendar links" 
          });
        }
      }
      
      const link = await leaveService.generateCalendarLink(
        employeeId as string, 
        departmentId as string
      );
      
      return res.status(200).json({ link });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while generating calendar link" });
    }
  }
  
  public async getSharedCalendar(req: Request, res: Response): Promise<Response> {
    try {
      // In a real implementation, you would validate the token here
      // For now, we'll just pass the query parameters to the service
      
      const query: CalendarQuery = {
        startDate: req.query.startDate as string || new Date().toISOString(),
        endDate: req.query.endDate as string || new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
        employeeId: req.query.employeeId as string,
        departmentId: req.query.departmentId as string,
        format: req.query.format as 'json' | 'ical' || 'ical'
      };
      
      const events = await leaveService.getCalendarEvents(query);
      
      if (query.format === 'ical') {
        // Return as iCal file
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', 'attachment; filename="leaves.ics"');
        return res.status(200).send(events);
      }
      
      return res.status(200).json(events);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while fetching shared calendar" });
    }
  }
}

export const leaveController = new LeaveController();
