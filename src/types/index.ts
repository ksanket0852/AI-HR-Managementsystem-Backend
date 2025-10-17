// User and Authentication Types
export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  HR_ADMIN = 'HR_ADMIN',
  HR_MANAGER = 'HR_MANAGER',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE'
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Employee Types
export interface Employee {
  id: string;
  employeeId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: Date;
  dateOfJoining: Date;
  departmentId: string;
  designation: string;
  managerId?: string;
  salary?: number;
  isActive: boolean;
  profilePicture?: string;
  address?: Address;
  emergencyContact?: EmergencyContact;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

// Department Types
export interface Department {
  id: string;
  name: string;
  description?: string;
  headId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Attendance Types
export interface Attendance {
  id: string;
  employeeId: string;
  date: Date;
  clockIn?: Date;
  clockOut?: Date;
  breakTime?: number; // in minutes
  totalHours?: number;
  overtime?: number;
  status: AttendanceStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  HALF_DAY = 'HALF_DAY',
  WORK_FROM_HOME = 'WORK_FROM_HOME'
}

// Leave Types
export interface Leave {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export interface LeaveType {
  id: string;
  name: string;
  description?: string;
  maxDays: number;
  carryForward: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    type?: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request Types
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface AuthRequest extends Request {
  user?: User;
}

// AI Types
export interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  response: string;
  timestamp: Date;
  context?: any;
}

export interface ResumeParseResult {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    address?: string;
  };
  experience: Array<{
    company: string;
    position: string;
    duration: string;
    description: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    year: string;
  }>;
  skills: string[];
  summary: string;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  data?: any;
  createdAt: Date;
}

export enum NotificationType {
  LEAVE_REQUEST = 'LEAVE_REQUEST',
  LEAVE_APPROVED = 'LEAVE_APPROVED',
  LEAVE_REJECTED = 'LEAVE_REJECTED',
  ATTENDANCE_REMINDER = 'ATTENDANCE_REMINDER',
  PAYROLL_GENERATED = 'PAYROLL_GENERATED',
  PERFORMANCE_REVIEW = 'PERFORMANCE_REVIEW',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT'
} 