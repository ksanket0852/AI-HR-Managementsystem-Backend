import { PrismaClient, AttendanceStatus, Prisma } from "@prisma/client";
import { 
  ClockInDto, 
  ClockOutDto, 
  BreakTimeDto, 
  AttendanceReportDto, 
  AttendanceSummary 
} from "../types/attendance.dto";
import SocketService from './socket.service';

class AttendanceService {
  private prisma = new PrismaClient();
  // Standard workday hours (8 hours)
  private standardWorkHours = 8;
  private socketService?: SocketService;

  setSocketService(socketService: SocketService) {
    this.socketService = socketService;
  }

  private async getTodaysAttendance(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.attendance.findFirst({
      where: {
        employeeId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
  }

  public async clockIn(employeeId: string, data: ClockInDto) {
    const todaysAttendance = await this.getTodaysAttendance(employeeId);

    if (todaysAttendance) {
      throw new Error("You have already clocked in today.");
    }

    const attendance = await this.prisma.attendance.create({
      data: {
        employee: { connect: { id: employeeId } },
        date: new Date(),
        clockIn: new Date(),
        status: AttendanceStatus.PRESENT,
        notes: data.notes,
      },
    });

    // Send real-time update
    if (this.socketService) {
      this.socketService.broadcastAttendanceUpdate(employeeId, 'CLOCK_IN', {
        attendanceId: attendance.id,
        clockIn: attendance.clockIn,
        status: attendance.status
      });
    }

    return attendance;
  }

  public async clockOut(employeeId: string, data: ClockOutDto) {
    const todaysAttendance = await this.getTodaysAttendance(employeeId);

    if (!todaysAttendance || !todaysAttendance.clockIn) {
      throw new Error("You have not clocked in today.");
    }

    if (todaysAttendance.clockOut) {
      throw new Error("You have already clocked out today.");
    }

    const clockOutTime = new Date();
    const clockInTime = todaysAttendance.clockIn;

    const totalMilliseconds = clockOutTime.getTime() - clockInTime.getTime();
    const totalHours = totalMilliseconds / (1000 * 60 * 60);
    
    // Calculate break time in hours
    const breakHours = data.breakMinutes ? data.breakMinutes / 60 : 0;
    
    // Calculate net working hours
    const netHours = Math.max(0, totalHours - breakHours);
    
    // Calculate overtime (hours worked beyond standard work hours)
    const overtime = Math.max(0, netHours - this.standardWorkHours);

    // Determine attendance status based on clock-in time
    let status = todaysAttendance.status;
    if (clockInTime.getHours() >= 10) { // Assuming 10 AM is late
      status = AttendanceStatus.LATE;
    }
    
    // If worked less than half day (4 hours)
    if (netHours < 4) {
      status = AttendanceStatus.HALF_DAY;
    }

    const updatedAttendance = await this.prisma.attendance.update({
      where: { id: todaysAttendance.id },
      data: {
        clockOut: clockOutTime,
        totalHours: new Prisma.Decimal(netHours.toFixed(2)),
        overtime: new Prisma.Decimal(overtime.toFixed(2)),
        breakTime: data.breakMinutes || 0,
        status,
        notes: todaysAttendance.notes ? `${todaysAttendance.notes}\n${data.notes}` : data.notes,
      },
    });

    // Send real-time update
    if (this.socketService) {
      this.socketService.broadcastAttendanceUpdate(employeeId, 'CLOCK_OUT', {
        attendanceId: updatedAttendance.id,
        clockOut: updatedAttendance.clockOut,
        totalHours: updatedAttendance.totalHours,
        overtime: updatedAttendance.overtime,
        status: updatedAttendance.status
      });
    }

    return updatedAttendance;
  }

  public async updateBreakTime(data: BreakTimeDto) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: data.attendanceId },
    });

    if (!attendance) {
      throw new Error("Attendance record not found.");
    }

    if (!attendance.clockIn) {
      throw new Error("Cannot update break time before clocking in.");
    }

    // Recalculate total hours if clock out exists
    let totalHours: number | null = attendance.totalHours ? Number(attendance.totalHours) : null;
    let overtime: number | null = attendance.overtime ? Number(attendance.overtime) : null;

    if (attendance.clockOut) {
      const clockOutTime = attendance.clockOut;
      const clockInTime = attendance.clockIn;
      
      const totalMilliseconds = clockOutTime.getTime() - clockInTime.getTime();
      const grossHours = totalMilliseconds / (1000 * 60 * 60);
      
      // Calculate break time in hours
      const breakHours = data.breakMinutes / 60;
      
      // Calculate net working hours
      totalHours = Math.max(0, grossHours - breakHours);
      
      // Calculate overtime
      overtime = Math.max(0, totalHours - this.standardWorkHours);
    }

    return this.prisma.attendance.update({
      where: { id: data.attendanceId },
      data: {
        breakTime: data.breakMinutes,
        totalHours: totalHours !== null ? new Prisma.Decimal(totalHours.toFixed(2)) : undefined,
        overtime: overtime !== null ? new Prisma.Decimal(overtime.toFixed(2)) : undefined,
      },
    });
  }

  public async getAttendance(query: { employeeId?: string; dateFrom?: string; dateTo?: string; status?: string; month?: string; year?: string }) {
    const { employeeId, dateFrom, dateTo, status, month, year } = query;
    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (dateFrom && dateTo) {
      where.date = {
        gte: new Date(dateFrom),
        lte: new Date(dateTo),
      };
    } else if (month && year) {
      // Filter by month and year
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month
      
      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });
  }

  public async generateAttendanceReport(data: AttendanceReportDto): Promise<AttendanceSummary> {
    const { employeeId, month, year } = data;
    
    // Create date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    
    // Query to get all attendance records for the employee in the specified month
    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        employeeId: employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
    
    // Initialize counters
    const totalDays = endDate.getDate(); // Total days in the month
    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let workFromHomeDays = 0;
    let totalHours = 0;
    let totalOvertime = 0;
    
    // Create a map of dates with attendance records
    const attendanceDates = new Map();
    attendanceRecords.forEach(record => {
      const dateKey = record.date.toISOString().split('T')[0];
      attendanceDates.set(dateKey, record);
      
      // Count by status
      switch (record.status) {
        case AttendanceStatus.PRESENT:
          presentDays++;
          break;
        case AttendanceStatus.ABSENT:
          absentDays++;
          break;
        case AttendanceStatus.LATE:
          lateDays++;
          presentDays++; // Late is also counted as present
          break;
        case AttendanceStatus.HALF_DAY:
          halfDays++;
          break;
        case AttendanceStatus.WORK_FROM_HOME:
          workFromHomeDays++;
          presentDays++; // WFH is also counted as present
          break;
      }
      
      // Sum hours and overtime
      if (record.totalHours) {
        totalHours += Number(record.totalHours);
      }
      
      if (record.overtime) {
        totalOvertime += Number(record.overtime);
      }
    });
    
    // Calculate absent days (days without attendance records)
    // We'll count weekdays only (Monday-Friday)
    for (let day = 1; day <= totalDays; day++) {
      const currentDate = new Date(year, month - 1, day);
      const dayOfWeek = currentDate.getDay();
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }
      
      const dateKey = currentDate.toISOString().split('T')[0];
      if (!attendanceDates.has(dateKey)) {
        absentDays++;
      }
    }
    
    // Calculate average hours per day (only for days with records)
    const daysWithRecords = attendanceRecords.filter(record => record.totalHours).length;
    const averageHoursPerDay = daysWithRecords > 0 ? totalHours / daysWithRecords : 0;
    
    return {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      halfDays,
      workFromHomeDays,
      totalHours,
      totalOvertime,
      averageHoursPerDay: parseFloat(averageHoursPerDay.toFixed(2)),
    };
  }

  public async markAbsentees() {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all employees
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    
    // For each employee, check if they have an attendance record for yesterday
    for (const employee of employees) {
      const attendanceRecord = await this.prisma.attendance.findFirst({
        where: {
          employeeId: employee.id,
          date: {
            gte: yesterday,
            lt: today,
          },
        },
      });
      
      // If no attendance record exists, create one with ABSENT status
      if (!attendanceRecord) {
        await this.prisma.attendance.create({
          data: {
            employee: { connect: { id: employee.id } },
            date: yesterday,
            status: AttendanceStatus.ABSENT,
          },
        });
      }
    }
    
    return { message: "Absentees marked successfully" };
  }
}

export const attendanceService = new AttendanceService();