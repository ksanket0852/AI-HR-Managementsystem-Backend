import { Response } from "express";
import { payrollService } from "../services/payroll.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { PrismaClient } from "@prisma/client";
import { 
  CreatePayrollDto, 
  UpdatePayrollDto, 
  PayrollFilterDto,
  GeneratePayrollsDto
} from "../types/payroll.dto";

class PayrollController {
  private prisma = new PrismaClient();

  private async getEmployeeId(userId: string): Promise<string | null> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    return employee?.id || null;
  }

  // Create a new payroll entry
  async createPayroll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const payrollData: CreatePayrollDto = req.body;
      const payroll = await payrollService.createPayroll(payrollData);
      res.status(201).json(payroll);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Get a specific payroll by ID
  async getPayrollById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const payroll = await payrollService.getPayrollById(id);
      
      if (!payroll) {
        res.status(404).json({ message: "Payroll not found" });
        return;
      }
      
      res.status(200).json(payroll);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Get payroll for current employee
  async getMyPayroll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const employeeId = await this.getEmployeeId(userId);
      if (!employeeId) {
        res.status(404).json({ message: "Employee profile not found" });
        return;
      }

      const { month, year } = req.query;
      
      if (!month || !year) {
        res.status(400).json({ message: "Month and year are required" });
        return;
      }

      const payroll = await payrollService.getPayrollByEmployeeAndPeriod(
        employeeId, 
        parseInt(month as string), 
        parseInt(year as string)
      );
      
      if (!payroll) {
        res.status(404).json({ message: "Payroll not found" });
        return;
      }
      
      res.status(200).json(payroll);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Get all payrolls with filtering and pagination
  async getAllPayrolls(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { month, year, status, employeeId, departmentId, page, limit } = req.query;
      
      const filters: PayrollFilterDto = {};
      
      if (month) filters.month = parseInt(month as string);
      if (year) filters.year = parseInt(year as string);
      if (status) filters.status = status as any;
      if (employeeId) filters.employeeId = employeeId as string;
      if (departmentId) filters.departmentId = departmentId as string;
      
      const pageNum = page ? parseInt(page as string) : 1;
      const limitNum = limit ? parseInt(limit as string) : 10;
      
      const result = await payrollService.getAllPayrolls(filters, pageNum, limitNum);
      
      res.status(200).json({
        payrolls: result.payrolls,
        total: result.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.total / limitNum)
      });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Update a payroll
  async updatePayroll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const payrollData: UpdatePayrollDto = req.body;
      
      const updatedPayroll = await payrollService.updatePayroll(id, payrollData);
      
      res.status(200).json(updatedPayroll);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Delete a payroll
  async deletePayroll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      await payrollService.deletePayroll(id);
      
      res.status(200).json({ message: "Payroll deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Generate payrolls for multiple employees
  async generatePayrolls(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const generateData: GeneratePayrollsDto = req.body;
      
      const result = await payrollService.generatePayrolls(generateData);
      
      res.status(200).json({
        message: `Successfully processed ${result.processed} payrolls`,
        processed: result.processed,
        errors: result.errors
      });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Approve a payroll
  async approvePayroll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const payroll = await payrollService.approvePayroll(id);
      
      res.status(200).json(payroll);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Mark a payroll as paid
  async markAsPaid(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const payroll = await payrollService.markAsPaid(id);
      
      res.status(200).json(payroll);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Generate payslip
  async generatePayslip(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const payslip = await payrollService.generatePayslip(id);
      
      res.status(200).json(payslip);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Get payroll report
  async getPayrollReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { month, year } = req.query;
      
      if (!month || !year) {
        res.status(400).json({ message: "Month and year are required" });
        return;
      }
      
      const report = await payrollService.getPayrollReport(
        parseInt(month as string),
        parseInt(year as string)
      );
      
      res.status(200).json(report);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }
}

export const payrollController = new PayrollController(); 