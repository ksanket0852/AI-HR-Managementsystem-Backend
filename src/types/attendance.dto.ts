export interface ClockInDto {
  notes?: string;
}

export interface ClockOutDto {
  notes?: string;
  breakMinutes?: number;
}

export interface GetAttendanceQuery {
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  month?: string;
  year?: string;
}

export interface BreakTimeDto {
  attendanceId: string;
  breakMinutes: number;
}

export interface AttendanceReportDto {
  employeeId?: string;
  month: number;
  year: number;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  workFromHomeDays: number;
  totalHours: number;
  totalOvertime: number;
  averageHoursPerDay: number;
}
