import { UserRole } from "@prisma/client";

export interface CreateEmployeeDto {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role?: UserRole;
  phone?: string;
  dateOfBirth?: string | Date;
  dateOfJoining: string | Date;
  departmentId: string;
  designation: string;
  managerId?: string;
  salary?: number;
  address?: any;
  emergencyContact?: any;
}

export interface UpdateEmployeeDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string | Date;
  dateOfJoining?: string | Date;
  departmentId?: string;
  designation?: string;
  managerId?: string | null;
  salary?: number;
  isActive?: boolean;
  profilePicture?: string | null;
  address?: any;
  emergencyContact?: any;
}

export interface SearchEmployeeQueryDto {
  name?: string;
  email?: string;
  departmentId?: string;
  designation?: string;
  page?: string;
  limit?: string;
}