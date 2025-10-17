import { Response } from "express";
import { attendanceService } from "../services/attendance.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { PrismaClient } from "@prisma/client";
import { BreakTimeDto, AttendanceReportDto } from "../types/attendance.dto";

class AttendanceController {
  private prisma = new PrismaClient();

  private async getEmployeeId(userId: string): Promise<string | null> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    return employee?.id || null;
  }

  public async clockIn(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const employeeId = await this.getEmployeeId(userId);
      if (!employeeId) {
        return res.status(404).json({ message: "Employee profile not found for this user." });
      }

      const attendance = await attendanceService.clockIn(employeeId, req.body);
      return res.status(201).json({ message: "Successfully clocked in.", attendance });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error during clock-in." });
    }
  }

  public async clockOut(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const employeeId = await this.getEmployeeId(userId);
      if (!employeeId) {
        return res.status(404).json({ message: "Employee profile not found for this user." });
      }

      const attendance = await attendanceService.clockOut(employeeId, req.body);
      return res.status(200).json({ message: "Successfully clocked out.", attendance });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error during clock-out." });
    }
  }

  public async getAttendance(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const attendance = await attendanceService.getAttendance(req.query);
      return res.status(200).json(attendance);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while fetching attendance." });
    }
  }

  public async updateBreakTime(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const breakTimeData: BreakTimeDto = req.body;
      const attendance = await attendanceService.updateBreakTime(breakTimeData);
      return res.status(200).json({ message: "Break time updated successfully.", attendance });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while updating break time." });
    }
  }

  public async generateAttendanceReport(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const reportData: AttendanceReportDto = req.body;
      
      // If no employeeId is provided and user is not an admin, use the current user's employee ID
      if (!reportData.employeeId && req.user?.role !== 'HR_ADMIN' && req.user?.role !== 'HR_MANAGER' && req.user?.role !== 'SUPER_ADMIN') {
        const employeeId = await this.getEmployeeId(req.user?.id || '');
        if (!employeeId) {
          return res.status(404).json({ message: "Employee profile not found for this user." });
        }
        reportData.employeeId = employeeId;
      }
      
      const report = await attendanceService.generateAttendanceReport(reportData);
      return res.status(200).json(report);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while generating attendance report." });
    }
  }

  public async markAbsentees(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      // Check if user has admin privileges
      if (req.user?.role !== 'HR_ADMIN' && req.user?.role !== 'HR_MANAGER' && req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: "Unauthorized. Only HR staff can mark absentees." });
      }
      
      const result = await attendanceService.markAbsentees();
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Server error while marking absentees." });
    }
  }
}

export const attendanceController = new AttendanceController();