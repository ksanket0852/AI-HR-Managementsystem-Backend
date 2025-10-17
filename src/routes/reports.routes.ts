import { Router, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const router = Router();
const prisma = new PrismaClient();

// Employee Attendance Report
router.get('/employees/attendance', [
  query('employeeId').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('format').optional().isIn(['json', 'excel', 'pdf'])
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employeeId, startDate, endDate, format: exportFormat } = req.query;
    
    const whereClause: any = {};
    if (employeeId) {
      whereClause.employeeId = employeeId;
    }
    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    if (req.user!.role === 'EMPLOYEE') {
      // Find employee record for this user
      const employee = await prisma.employee.findFirst({
        where: { userId: req.user!.id }
      });
      if (employee) {
        whereClause.employeeId = employee.id;
      }
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            user: true,
            department: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    const stats = {
      totalDays: attendanceRecords.length,
      presentDays: attendanceRecords.filter(a => a.status === 'PRESENT').length,
      absentDays: attendanceRecords.filter(a => a.status === 'ABSENT').length,
      lateDays: attendanceRecords.filter(a => a.status === 'LATE').length,
      totalHours: attendanceRecords.reduce((sum, a) => {
        if (a.clockIn && a.clockOut) {
          const hours = (new Date(a.clockOut).getTime() - new Date(a.clockIn).getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0),
      overtimeHours: 0 // Default to 0 since field doesn't exist in schema
    };

    const reportData = {
      title: 'Employee Attendance Report',
      statistics: stats,
      records: attendanceRecords.map(record => ({
        id: record.id,
        employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
        department: record.employee.department.name,
        date: record.date.toISOString().split('T')[0],
        clockIn: record.clockIn ? record.clockIn.toISOString().split('T')[1].substring(0, 5) : null,
        clockOut: record.clockOut ? record.clockOut.toISOString().split('T')[1].substring(0, 5) : null,
        status: record.status,
        totalHours: record.clockIn && record.clockOut ? 
          (new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / (1000 * 60 * 60) : 0,
        overtimeHours: 0, // Default to 0 since field doesn't exist
        isLate: false // Default to false since field doesn't exist
      }))
    };

    if (exportFormat === 'excel') {
      return await generateExcelReport(res, reportData, 'attendance');
    } else if (exportFormat === 'pdf') {
      return await generatePDFReport(res, reportData, 'attendance');
    }

    return res.json(reportData);
  } catch (error) {
    console.error('Error generating attendance report:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Employee Leave Report
router.get('/employees/leave', [
  query('employeeId').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('format').optional().isIn(['json', 'excel', 'pdf'])
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employeeId, startDate, endDate, format: exportFormat } = req.query;
    
    const whereClause: any = {};
    if (employeeId) {
      whereClause.employeeId = employeeId;
    }
    if (startDate && endDate) {
      whereClause.startDate = { gte: new Date(startDate as string) };
      whereClause.endDate = { lte: new Date(endDate as string) };
    }

    if (req.user!.role === 'EMPLOYEE') {
      // Find employee record for this user
      const employee = await prisma.employee.findFirst({
        where: { userId: req.user!.id }
      });
      if (employee) {
        whereClause.employeeId = employee.id;
      }
    }

    const leaveRecords = await prisma.leave.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            user: true,
            department: true
          }
        },
        leaveType: true
      },
      orderBy: { startDate: 'desc' }
    });

    const totalDaysTaken = leaveRecords
      .filter(l => l.status === 'APPROVED')
      .reduce((sum, l) => {
        // Calculate days between start and end date
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return sum + diffDays;
      }, 0);

    const stats = {
      totalApplications: leaveRecords.length,
      approvedLeaves: leaveRecords.filter(l => l.status === 'APPROVED').length,
      rejectedLeaves: leaveRecords.filter(l => l.status === 'REJECTED').length,
      pendingLeaves: leaveRecords.filter(l => l.status === 'PENDING').length,
      totalDaysTaken,
      utilizationRate: totalDaysTaken > 0 ? (totalDaysTaken / 365) * 100 : 0 // Rough calculation
    };

    const reportData = {
      title: 'Employee Leave Report',
      statistics: stats,
      records: leaveRecords.map(leave => ({
        id: leave.id,
        employeeName: `${leave.employee.firstName} ${leave.employee.lastName}`,
        department: leave.employee.department.name,
        leaveType: leave.leaveType.name,
        startDate: leave.startDate.toISOString().split('T')[0],
        endDate: leave.endDate.toISOString().split('T')[0],
        totalDays: Math.ceil((leave.endDate.getTime() - leave.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        status: leave.status,
        reason: leave.reason,
        appliedDate: leave.createdAt.toISOString().split('T')[0]
      }))
    };

    if (exportFormat === 'excel') {
      return await generateExcelReport(res, reportData, 'leave');
    } else if (exportFormat === 'pdf') {
      return await generatePDFReport(res, reportData, 'leave');
    }

    return res.json(reportData);
  } catch (error) {
    console.error('Error generating leave report:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Department Analytics
router.get('/departments/analytics', [
  query('departmentId').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('format').optional().isIn(['json', 'excel', 'pdf'])
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { departmentId, startDate, endDate, format: exportFormat } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const departments = await prisma.department.findMany({
      where: departmentId ? { id: departmentId as string } : {},
      include: {
        employees: {
          include: {
            user: true
          }
        }
      }
    });

    const analytics = await Promise.all(departments.map(async (dept) => {
      const employees = dept.employees;
      const totalEmployees = employees.length;
      
      // Get attendance records for this department
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          employee: {
            departmentId: dept.id
          },
          date: { gte: start, lte: end }
        }
      });

      // Get leave records for this department
      const leaveRecords = await prisma.leave.findMany({
        where: {
          employee: {
            departmentId: dept.id
          },
          startDate: { gte: start },
          endDate: { lte: end }
        }
      });

      // Calculate attendance rate
      const workingDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const expectedAttendance = totalEmployees * workingDays;
      const actualAttendance = attendanceRecords.filter(a => a.status === 'PRESENT').length;
      const attendanceRate = expectedAttendance > 0 ? (actualAttendance / expectedAttendance) * 100 : 0;

      // Calculate leave utilization
      const totalLeaveDays = leaveRecords
        .filter(l => l.status === 'APPROVED')
        .reduce((sum, l) => {
          const days = Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          return sum + days;
        }, 0);
      const avgLeaveUtilization = totalEmployees > 0 ? (totalLeaveDays / totalEmployees) : 0;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        totalEmployees,
        attendanceRate,
        avgLeaveUtilization,
        totalAttendanceRecords: attendanceRecords.length,
        totalLeaveApplications: leaveRecords.length
      };
    }));

    const reportData = {
      title: 'Department Analytics Report',
      analytics
    };

    if (exportFormat === 'excel') {
      return await generateExcelReport(res, reportData, 'department');
    } else if (exportFormat === 'pdf') {
      return await generatePDFReport(res, reportData, 'department');
    }

    return res.json(reportData);
  } catch (error) {
    console.error('Error generating department analytics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Payroll Report
router.get('/payroll', [
  query('employeeId').optional().isString(),
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('year').optional().isInt({ min: 2020 }),
  query('format').optional().isIn(['json', 'excel', 'pdf'])
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employeeId, month, year, format: exportFormat } = req.query;
    
    const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const currentYear = year ? parseInt(year as string) : new Date().getFullYear();

    const whereClause: any = {};
    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    if (req.user!.role === 'EMPLOYEE') {
      // Find employee record for this user
      const employee = await prisma.employee.findFirst({
        where: { userId: req.user!.id }
      });
      if (employee) {
        whereClause.employeeId = employee.id;
      }
    }

    // For now, we'll use employee salary data as payroll records
    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        user: true,
        department: true
      }
    });

    const payrollRecords = employees.map(emp => {
      const basicSalary = Number(emp.salary) || 0;
      const allowances = basicSalary * 0.1; // 10% allowances
      const grossSalary = basicSalary + allowances;
      const deductions = grossSalary * 0.05; // 5% deductions
      const tax = grossSalary * 0.15; // 15% tax
      const totalDeductions = deductions + tax;
      const netSalary = grossSalary - totalDeductions;

      return {
        id: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        department: emp.department.name,
        basicSalary,
        allowances,
        grossSalary,
        deductions,
        totalDeductions,
        tax,
        netSalary,
        status: 'PENDING',
        payDate: null
      };
    });

    const totals = {
      totalEmployees: payrollRecords.length,
      totalGrossSalary: payrollRecords.reduce((sum, r) => sum + r.grossSalary, 0),
      totalDeductions: payrollRecords.reduce((sum, r) => sum + r.totalDeductions, 0),
      totalTax: payrollRecords.reduce((sum, r) => sum + r.tax, 0),
      totalNetSalary: payrollRecords.reduce((sum, r) => sum + r.netSalary, 0)
    };

    const reportData = {
      title: 'Payroll Report',
      period: `${currentMonth}/${currentYear}`,
      totals,
      records: payrollRecords
    };

    if (exportFormat === 'excel') {
      return await generateExcelReport(res, reportData, 'payroll');
    } else if (exportFormat === 'pdf') {
      return await generatePDFReport(res, reportData, 'payroll');
    }

    return res.json(reportData);
  } catch (error) {
    console.error('Error generating payroll report:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Custom Report Builder
router.post('/custom', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, reportType, filters, columns, dateRange } = req.body;

    let reportData: any = {};
    reportData.title = title;
    reportData.type = reportType;
    reportData.columns = columns;
    reportData.generatedAt = new Date().toISOString();
    reportData.generatedBy = req.user!.email; // Use email instead of name

    switch (reportType) {
      case 'attendance':
        reportData.data = await buildCustomAttendanceReport(filters, columns, dateRange);
        break;
      case 'leave':
        reportData.data = await buildCustomLeaveReport(filters, columns, dateRange);
        break;
      case 'payroll':
        reportData.data = await buildCustomPayrollReport(filters, columns, dateRange);
        break;
      case 'department':
        reportData.data = await buildCustomDepartmentReport(filters, columns, dateRange);
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    return res.json(reportData);
  } catch (error) {
    console.error('Error generating custom report:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Export functionality is handled via format query parameter in main routes

// Helper functions for custom reports
async function buildCustomAttendanceReport(filters: any, columns: string[], dateRange: any) {
  const whereClause: any = {};
  
  if (filters.employeeId) {
    whereClause.employeeId = filters.employeeId;
  }
  
  if (dateRange.startDate && dateRange.endDate) {
    whereClause.date = {
      gte: new Date(dateRange.startDate),
      lte: new Date(dateRange.endDate)
    };
  }

  const records = await prisma.attendance.findMany({
    where: whereClause,
    include: {
      employee: {
        include: {
          user: true,
          department: true
        }
      }
    }
  });

  return records.map(record => {
    const data: any = {};
    columns.forEach(column => {
      switch (column) {
        case 'employeeName':
          data[column] = `${record.employee.firstName} ${record.employee.lastName}`;
          break;
        case 'department':
          data[column] = record.employee.department.name;
          break;
        case 'date':
          data[column] = record.date.toISOString().split('T')[0];
          break;
        case 'clockIn':
          data[column] = record.clockIn ? record.clockIn.toISOString().split('T')[1].substring(0, 5) : null;
          break;
        case 'clockOut':
          data[column] = record.clockOut ? record.clockOut.toISOString().split('T')[1].substring(0, 5) : null;
          break;
        case 'totalHours':
          data[column] = record.clockIn && record.clockOut ? 
            (new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / (1000 * 60 * 60) : 0;
          break;
        case 'status':
          data[column] = record.status;
          break;
        case 'overtimeHours':
          data[column] = 0; // Default since field doesn't exist
          break;
        default:
          data[column] = (record as any)[column] || '';
      }
    });
    return data;
  });
}

async function buildCustomLeaveReport(filters: any, columns: string[], dateRange: any) {
  const whereClause: any = {};
  
  if (filters.employeeId) {
    whereClause.employeeId = filters.employeeId;
  }
  
  if (dateRange.startDate && dateRange.endDate) {
    whereClause.startDate = { gte: new Date(dateRange.startDate) };
    whereClause.endDate = { lte: new Date(dateRange.endDate) };
  }

  const records = await prisma.leave.findMany({
    where: whereClause,
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

  return records.map(record => {
    const data: any = {};
    columns.forEach(column => {
      switch (column) {
        case 'employeeName':
          data[column] = `${record.employee.firstName} ${record.employee.lastName}`;
          break;
        case 'department':
          data[column] = record.employee.department.name;
          break;
        case 'leaveType':
          data[column] = record.leaveType.name;
          break;
        case 'startDate':
          data[column] = record.startDate.toISOString().split('T')[0];
          break;
        case 'endDate':
          data[column] = record.endDate.toISOString().split('T')[0];
          break;
        case 'totalDays':
          data[column] = Math.ceil((record.endDate.getTime() - record.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          break;
        case 'status':
          data[column] = record.status;
          break;
        case 'reason':
          data[column] = record.reason;
          break;
        default:
          data[column] = (record as any)[column] || '';
      }
    });
    return data;
  });
}

async function buildCustomPayrollReport(filters: any, columns: string[], dateRange: any) {
  const whereClause: any = {};
  
  if (filters.employeeId) {
    whereClause.id = filters.employeeId;
  }

  const records = await prisma.employee.findMany({
    where: whereClause,
    include: {
      user: true,
      department: true
    }
  });

     return records.map(record => {
     const basicSalary = Number(record.salary) || 0;
     const allowances = basicSalary * 0.1;
     const grossSalary = basicSalary + allowances;
    const deductions = grossSalary * 0.05;
    const tax = grossSalary * 0.15;
    const totalDeductions = deductions + tax;
    const netSalary = grossSalary - totalDeductions;

    const data: any = {};
    columns.forEach(column => {
      switch (column) {
        case 'employeeName':
          data[column] = `${record.firstName} ${record.lastName}`;
          break;
        case 'department':
          data[column] = record.department.name;
          break;
        case 'basicSalary':
          data[column] = basicSalary;
          break;
        case 'allowances':
          data[column] = allowances;
          break;
        case 'grossSalary':
          data[column] = grossSalary;
          break;
        case 'deductions':
          data[column] = deductions;
          break;
        case 'tax':
          data[column] = tax;
          break;
        case 'netSalary':
          data[column] = netSalary;
          break;
        case 'status':
          data[column] = 'PENDING';
          break;
        default:
          data[column] = (record as any)[column] || '';
      }
    });
    return data;
  });
}

async function buildCustomDepartmentReport(filters: any, columns: string[], dateRange: any) {
  const whereClause: any = {};
  
  if (filters.departmentId) {
    whereClause.id = filters.departmentId;
  }

  const records = await prisma.department.findMany({
    where: whereClause,
    include: {
      employees: {
        include: {
          user: true
        }
      }
    }
  });

  return records.map(record => {
    const data: any = {};
    columns.forEach(column => {
      switch (column) {
        case 'departmentName':
          data[column] = record.name;
          break;
        case 'totalEmployees':
          data[column] = record.employees.length;
          break;
        case 'attendanceRate':
          data[column] = 85.5; // Mock data
          break;
        case 'avgLeaveUtilization':
          data[column] = 12.3; // Mock data
          break;
        case 'totalAttendanceRecords':
          data[column] = record.employees.length * 20; // Mock data
          break;
        case 'totalLeaveApplications':
          data[column] = record.employees.length * 2; // Mock data
          break;
        default:
          data[column] = (record as any)[column] || '';
      }
    });
    return data;
  });
}

// Excel export function
async function generateExcelReport(res: Response, data: any, reportType: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(data.title);

  // Add headers based on report type
  let headers: string[] = [];
  let rows: any[] = [];

  switch (reportType) {
    case 'attendance':
      headers = ['Employee', 'Department', 'Date', 'Clock In', 'Clock Out', 'Total Hours', 'Status'];
      rows = data.records.map((record: any) => [
        record.employeeName,
        record.department,
        record.date,
        record.clockIn || '-',
        record.clockOut || '-',
        record.totalHours.toFixed(2),
        record.status
      ]);
      break;
    case 'leave':
      headers = ['Employee', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Total Days', 'Status', 'Reason'];
      rows = data.records.map((record: any) => [
        record.employeeName,
        record.department,
        record.leaveType,
        record.startDate,
        record.endDate,
        record.totalDays,
        record.status,
        record.reason || '-'
      ]);
      break;
    case 'payroll':
      headers = ['Employee', 'Department', 'Basic Salary', 'Allowances', 'Gross Salary', 'Deductions', 'Tax', 'Net Salary', 'Status'];
      rows = data.records.map((record: any) => [
        record.employeeName,
        record.department,
        record.basicSalary,
        record.allowances,
        record.grossSalary,
        record.deductions,
        record.tax,
        record.netSalary,
        record.status
      ]);
      break;
    case 'department':
      headers = ['Department', 'Total Employees', 'Attendance Rate', 'Leave Utilization', 'Attendance Records', 'Leave Applications'];
      rows = data.analytics.map((record: any) => [
        record.departmentName,
        record.totalEmployees,
        `${record.attendanceRate.toFixed(1)}%`,
        `${record.avgLeaveUtilization.toFixed(1)}%`,
        record.totalAttendanceRecords,
        record.totalLeaveApplications
      ]);
      break;
  }

  worksheet.addRow(headers);
  rows.forEach(row => worksheet.addRow(row));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${data.title}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
}

// PDF export function
async function generatePDFReport(res: Response, data: any, reportType: string) {
  const doc = new PDFDocument();
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${data.title}.pdf"`);
  
  doc.pipe(res);
  
  // Add title
  doc.fontSize(20).text(data.title, 50, 50);
  doc.moveDown();
  
  // Add content based on report type
  doc.fontSize(12);
  
  switch (reportType) {
    case 'attendance':
      doc.text(`Total Records: ${data.records.length}`, 50, doc.y);
      doc.text(`Present Days: ${data.statistics.presentDays}`, 50, doc.y);
      doc.text(`Absent Days: ${data.statistics.absentDays}`, 50, doc.y);
      break;
    case 'leave':
      doc.text(`Total Applications: ${data.statistics.totalApplications}`, 50, doc.y);
      doc.text(`Approved: ${data.statistics.approvedLeaves}`, 50, doc.y);
      doc.text(`Pending: ${data.statistics.pendingLeaves}`, 50, doc.y);
      break;
    case 'payroll':
      doc.text(`Total Employees: ${data.totals.totalEmployees}`, 50, doc.y);
      doc.text(`Total Gross Salary: $${data.totals.totalGrossSalary.toFixed(2)}`, 50, doc.y);
      doc.text(`Total Net Salary: $${data.totals.totalNetSalary.toFixed(2)}`, 50, doc.y);
      break;
    case 'department':
      doc.text(`Total Departments: ${data.analytics.length}`, 50, doc.y);
      break;
  }
  
  doc.end();
}

export default router; 