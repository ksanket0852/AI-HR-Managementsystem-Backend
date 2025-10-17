import { LeaveStatus } from "@prisma/client";

export interface CreateLeaveTypeDto {
  name: string;
  description?: string;
  maxDays: number;
  carryForward: boolean;
}

export interface UpdateLeaveTypeDto {
  name?: string;
  description?: string;
  maxDays?: number;
  carryForward?: boolean;
  isActive?: boolean;
}

export interface LeaveTypeQuery {
  isActive?: boolean;
}

export interface CreateLeaveApplicationDto {
  leaveTypeId: string;
  startDate: string; // ISO format date string
  endDate: string; // ISO format date string
  reason: string;
}

export interface UpdateLeaveApplicationDto {
  status?: LeaveStatus;
  rejectedReason?: string;
}

export interface LeaveApplicationQuery {
  employeeId?: string;
  status?: LeaveStatus;
  startDate?: string;
  endDate?: string;
}

export interface LeaveBalanceDto {
  employeeId: string;
  year: number;
}

export interface LeaveBalance {
  leaveTypeId: string;
  leaveTypeName: string;
  maxDays: number;
  used: number;
  remaining: number;
  pending: number;
}

// Calendar integration DTOs
export interface CalendarQuery {
  startDate: string;
  endDate: string;
  employeeId?: string;
  departmentId?: string;
  format?: 'json' | 'ical';
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO date string
  end: string; // ISO date string
  allDay: boolean;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  status: LeaveStatus;
  color?: string; // Optional color based on leave type or status
} 