import { PrismaClient, Prisma, PayrollStatus } from "@prisma/client";
import { 
  PayrollDto, 
  CreatePayrollDto, 
  UpdatePayrollDto, 
  PayrollFilterDto,
  AllowanceItem,
  DeductionItem,
  TaxCalculationDto,
  PayrollReportDto,
  GeneratePayrollsDto,
  PayslipDto
} from "../types/payroll.dto";

class PayrollService {
  private prisma = new PrismaClient();

  async createPayroll(data: CreatePayrollDto): Promise<PayrollDto> {
    const { employeeId, month, year, basicSalary, allowances = [], deductions = [] } = data;
    
    // Check if payroll already exists for this employee in this month/year
    const existingPayroll = await this.prisma.payroll.findUnique({
      where: {
        employeeId_month_year: {
          employeeId,
          month,
          year
        }
      }
    });

    if (existingPayroll) {
      throw new Error(`Payroll for employee ${employeeId} already exists for ${month}/${year}`);
    }

    // Calculate gross salary (basic + allowances)
    const totalAllowances = allowances.reduce((sum, item) => sum + item.amount, 0);
    const grossSalary = basicSalary + totalAllowances;
    
    // Calculate deductions
    const totalDeductions = deductions.reduce((sum, item) => sum + item.amount, 0);
    
    // Calculate tax
    const taxCalculation = this.calculateTax(grossSalary);
    
    // Calculate net salary
    const netSalary = grossSalary - totalDeductions - taxCalculation.taxAmount;

    // Create payroll record
    const payroll = await this.prisma.payroll.create({
      data: {
        employeeId,
        month,
        year,
        basicSalary: new Prisma.Decimal(basicSalary),
        allowances: allowances as unknown as Prisma.JsonArray,
        deductions: deductions as unknown as Prisma.JsonArray,
        grossSalary: new Prisma.Decimal(grossSalary),
        netSalary: new Prisma.Decimal(netSalary),
        taxAmount: new Prisma.Decimal(taxCalculation.taxAmount),
        status: PayrollStatus.DRAFT
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    return this.mapPayrollToDto(payroll);
  }

  async getPayrollById(id: string): Promise<PayrollDto | null> {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    if (!payroll) return null;
    
    return this.mapPayrollToDto(payroll);
  }

  async getPayrollByEmployeeAndPeriod(employeeId: string, month: number, year: number): Promise<PayrollDto | null> {
    const payroll = await this.prisma.payroll.findUnique({
      where: {
        employeeId_month_year: {
          employeeId,
          month,
          year
        }
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    if (!payroll) return null;
    
    return this.mapPayrollToDto(payroll);
  }

  async getAllPayrolls(filters: PayrollFilterDto, page = 1, limit = 10): Promise<{ payrolls: PayrollDto[], total: number }> {
    const { month, year, status, employeeId, departmentId } = filters;
    
    // Build where clause based on filters
    const where: Prisma.PayrollWhereInput = {};
    
    if (month !== undefined) where.month = month;
    if (year !== undefined) where.year = year;
    if (status !== undefined) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    
    // Filter by department
    if (departmentId) {
      where.employee = {
        departmentId
      };
    }

    // Get total count
    const total = await this.prisma.payroll.count({ where });
    
    // Get paginated payrolls
    const payrolls = await this.prisma.payroll.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    return {
      payrolls: payrolls.map(payroll => this.mapPayrollToDto(payroll)),
      total
    };
  }

  async updatePayroll(id: string, data: UpdatePayrollDto): Promise<PayrollDto> {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        employee: true
      }
    });

    if (!payroll) {
      throw new Error(`Payroll with ID ${id} not found`);
    }

    // Extract current values from payroll
    const basicSalary = data.basicSalary !== undefined ? data.basicSalary : Number(payroll.basicSalary);
    const allowances = data.allowances || (payroll.allowances as unknown as AllowanceItem[] || []);
    const deductions = data.deductions || (payroll.deductions as unknown as DeductionItem[] || []);
    
    // Recalculate values
    const totalAllowances = allowances.reduce((sum, item) => sum + item.amount, 0);
    const grossSalary = basicSalary + totalAllowances;
    
    const totalDeductions = deductions.reduce((sum, item) => sum + item.amount, 0);
    
    // Calculate tax
    const taxCalculation = this.calculateTax(grossSalary);
    
    // Calculate net salary
    const netSalary = grossSalary - totalDeductions - taxCalculation.taxAmount;

    // Update payroll record
    const updatedPayroll = await this.prisma.payroll.update({
      where: { id },
      data: {
        basicSalary: data.basicSalary !== undefined ? new Prisma.Decimal(data.basicSalary) : undefined,
        allowances: data.allowances !== undefined ? data.allowances as unknown as Prisma.JsonArray : undefined,
        deductions: data.deductions !== undefined ? data.deductions as unknown as Prisma.JsonArray : undefined,
        grossSalary: new Prisma.Decimal(grossSalary),
        netSalary: new Prisma.Decimal(netSalary),
        taxAmount: new Prisma.Decimal(taxCalculation.taxAmount),
        status: data.status,
        paidAt: data.paidAt
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    return this.mapPayrollToDto(updatedPayroll);
  }

  async deletePayroll(id: string): Promise<void> {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id }
    });

    if (!payroll) {
      throw new Error(`Payroll with ID ${id} not found`);
    }

    await this.prisma.payroll.delete({
      where: { id }
    });
  }

  async generatePayrolls(data: GeneratePayrollsDto): Promise<{ processed: number, errors: string[] }> {
    const { month, year, departmentId } = data;
    const errors: string[] = [];
    let processed = 0;

    // Get employees to generate payrolls for
    const whereClause: Prisma.EmployeeWhereInput = {
      isActive: true
    };

    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    const employees = await this.prisma.employee.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        salary: true
      }
    });

    // Process each employee
    for (const employee of employees) {
      try {
        // Check if payroll already exists
        const existingPayroll = await this.prisma.payroll.findUnique({
          where: {
            employeeId_month_year: {
              employeeId: employee.id,
              month,
              year
            }
          }
        });

        if (existingPayroll) {
          errors.push(`Payroll for ${employee.firstName} ${employee.lastName} already exists for ${month}/${year}`);
          continue;
        }

        // Get employee's basic salary
        if (!employee.salary) {
          errors.push(`Employee ${employee.firstName} ${employee.lastName} has no salary configured`);
          continue;
        }

        const basicSalary = Number(employee.salary);

        // Generate default allowances and deductions
        // In a real system, these would be configured per employee
        const allowances: AllowanceItem[] = [
          { name: "Housing Allowance", amount: basicSalary * 0.1 },
          { name: "Transportation", amount: 200 }
        ];

        const deductions: DeductionItem[] = [
          { name: "Health Insurance", amount: basicSalary * 0.03 },
          { name: "Pension Fund", amount: basicSalary * 0.05 }
        ];

        // Calculate gross salary
        const totalAllowances = allowances.reduce((sum, item) => sum + item.amount, 0);
        const grossSalary = basicSalary + totalAllowances;
        
        // Calculate deductions
        const totalDeductions = deductions.reduce((sum, item) => sum + item.amount, 0);
        
        // Calculate tax
        const taxCalculation = this.calculateTax(grossSalary);
        
        // Calculate net salary
        const netSalary = grossSalary - totalDeductions - taxCalculation.taxAmount;

        // Create payroll record
        await this.prisma.payroll.create({
          data: {
            employeeId: employee.id,
            month,
            year,
            basicSalary: new Prisma.Decimal(basicSalary),
            allowances: allowances as unknown as Prisma.JsonArray,
            deductions: deductions as unknown as Prisma.JsonArray,
            grossSalary: new Prisma.Decimal(grossSalary),
            netSalary: new Prisma.Decimal(netSalary),
            taxAmount: new Prisma.Decimal(taxCalculation.taxAmount),
            status: PayrollStatus.DRAFT
          }
        });

        processed++;
      } catch (error) {
        errors.push(`Error processing payroll for ${employee.firstName} ${employee.lastName}: ${(error as Error).message}`);
      }
    }

    return { processed, errors };
  }

  async approvePayroll(id: string): Promise<PayrollDto> {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id }
    });

    if (!payroll) {
      throw new Error(`Payroll with ID ${id} not found`);
    }

    if (payroll.status === PayrollStatus.PAID) {
      throw new Error(`Payroll with ID ${id} is already paid and cannot be modified`);
    }

    const updatedPayroll = await this.prisma.payroll.update({
      where: { id },
      data: {
        status: PayrollStatus.APPROVED
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    return this.mapPayrollToDto(updatedPayroll);
  }

  async markAsPaid(id: string): Promise<PayrollDto> {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id }
    });

    if (!payroll) {
      throw new Error(`Payroll with ID ${id} not found`);
    }

    if (payroll.status !== PayrollStatus.APPROVED) {
      throw new Error(`Payroll with ID ${id} must be approved before marking as paid`);
    }

    const updatedPayroll = await this.prisma.payroll.update({
      where: { id },
      data: {
        status: PayrollStatus.PAID,
        paidAt: new Date()
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    return this.mapPayrollToDto(updatedPayroll);
  }

  async generatePayslip(payrollId: string): Promise<PayslipDto> {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            designation: true,
            department: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!payroll) {
      throw new Error(`Payroll with ID ${payrollId} not found`);
    }

    // Get company information (in a real app, this would be from configuration)
    const company = {
      name: "AI HRMS Inc.",
      address: "123 Tech Street, Silicon Valley, CA 94043",
      logo: "/uploads/company-logo.png"
    };

    return {
      payroll: this.mapPayrollToDto(payroll),
      employee: payroll.employee,
      company
    };
  }

  async getPayrollReport(month: number, year: number): Promise<PayrollReportDto> {
    // Get all payrolls for the specified month and year
    const payrolls = await this.prisma.payroll.findMany({
      where: {
        month,
        year
      },
      include: {
        employee: {
          select: {
            departmentId: true,
            department: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (payrolls.length === 0) {
      throw new Error(`No payrolls found for ${month}/${year}`);
    }

    // Calculate totals
    const totalEmployees = payrolls.length;
    const totalPayroll = payrolls.reduce((sum, p) => sum + Number(p.netSalary), 0);
    const averageSalary = totalPayroll / totalEmployees;
    const totalTax = payrolls.reduce((sum, p) => sum + Number(p.taxAmount), 0);
    
    // Calculate total allowances and deductions
    let totalAllowances = 0;
    let totalDeductions = 0;
    
    for (const payroll of payrolls) {
      const allowances = payroll.allowances as unknown as AllowanceItem[];
      const deductions = payroll.deductions as unknown as DeductionItem[];
      
      if (allowances && Array.isArray(allowances)) {
        totalAllowances += allowances.reduce((sum, item) => sum + item.amount, 0);
      }
      
      if (deductions && Array.isArray(deductions)) {
        totalDeductions += deductions.reduce((sum, item) => sum + item.amount, 0);
      }
    }

    // Group by department
    const departmentMap = new Map<string, { name: string, employeeCount: number, totalSalary: number }>();
    
    for (const payroll of payrolls) {
      const deptId = payroll.employee.departmentId;
      const deptName = payroll.employee.department.name;
      
      if (!departmentMap.has(deptId)) {
        departmentMap.set(deptId, {
          name: deptName,
          employeeCount: 0,
          totalSalary: 0
        });
      }
      
      const deptData = departmentMap.get(deptId)!;
      deptData.employeeCount += 1;
      deptData.totalSalary += Number(payroll.netSalary);
    }

    const payrollByDepartment = Array.from(departmentMap.values()).map(dept => ({
      departmentName: dept.name,
      employeeCount: dept.employeeCount,
      totalSalary: dept.totalSalary
    }));

    return {
      totalEmployees,
      totalPayroll,
      averageSalary,
      totalTax,
      totalAllowances,
      totalDeductions,
      payrollByDepartment
    };
  }

  // Helper method to calculate tax
  private calculateTax(grossSalary: number): TaxCalculationDto {
    // This is a simplified tax calculation
    // In a real system, this would be more complex and based on tax brackets
    const annualSalary = grossSalary * 12;
    let taxRate = 0;
    
    if (annualSalary <= 50000) {
      taxRate = 0.1; // 10%
    } else if (annualSalary <= 100000) {
      taxRate = 0.15; // 15%
    } else if (annualSalary <= 200000) {
      taxRate = 0.25; // 25%
    } else {
      taxRate = 0.3; // 30%
    }
    
    const taxableIncome = annualSalary;
    const annualTax = taxableIncome * taxRate;
    const monthlyTax = annualTax / 12;
    
    return {
      annualSalary,
      taxableIncome,
      taxAmount: monthlyTax,
      taxRate
    };
  }

  // Helper method to map Prisma Payroll to DTO
  private mapPayrollToDto(payroll: any): PayrollDto {
    return {
      ...payroll,
      basicSalary: Number(payroll.basicSalary),
      grossSalary: Number(payroll.grossSalary),
      netSalary: Number(payroll.netSalary),
      taxAmount: Number(payroll.taxAmount),
      allowances: payroll.allowances as AllowanceItem[],
      deductions: payroll.deductions as DeductionItem[]
    };
  }
}

export const payrollService = new PayrollService(); 