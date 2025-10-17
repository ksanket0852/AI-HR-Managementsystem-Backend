import { PayrollStatus } from "@prisma/client";

export interface AllowanceItem {
  name: string;
  amount: number;
  description?: string;
}

export interface DeductionItem {
  name: string;
  amount: number;
  description?: string;
}

export interface PayrollDto {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: AllowanceItem[];
  deductions: DeductionItem[];
  grossSalary: number;
  netSalary: number;
  taxAmount: number;
  status: PayrollStatus;
  generatedAt: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
}

export interface CreatePayrollDto {
  employeeId: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances?: AllowanceItem[];
  deductions?: DeductionItem[];
}

export interface UpdatePayrollDto {
  basicSalary?: number;
  allowances?: AllowanceItem[];
  deductions?: DeductionItem[];
  status?: PayrollStatus;
  paidAt?: Date;
}

export interface PayrollFilterDto {
  month?: number;
  year?: number;
  status?: PayrollStatus;
  employeeId?: string;
  departmentId?: string;
}

export interface TaxCalculationDto {
  annualSalary: number;
  taxableIncome: number;
  taxAmount: number;
  taxRate: number;
}

export interface PayrollReportDto {
  totalEmployees: number;
  totalPayroll: number;
  averageSalary: number;
  totalTax: number;
  totalAllowances: number;
  totalDeductions: number;
  payrollByDepartment?: {
    departmentName: string;
    employeeCount: number;
    totalSalary: number;
  }[];
}

export interface GeneratePayrollsDto {
  month: number;
  year: number;
  departmentId?: string;
}

export interface PayslipDto {
  payroll: PayrollDto;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    designation: string;
    department: {
      name: string;
    };
  };
  company: {
    name: string;
    address: string;
    logo?: string;
  };
} 