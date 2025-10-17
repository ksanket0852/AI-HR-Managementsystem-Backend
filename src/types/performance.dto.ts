import { ReviewStatus, GoalStatus } from "@prisma/client";

export interface GoalDto {
  id: string;
  employeeId: string;
  title: string;
  description?: string;
  targetDate: Date;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
}

export interface CreateGoalDto {
  employeeId: string;
  title: string;
  description?: string;
  targetDate: Date;
  status?: GoalStatus;
}

export interface UpdateGoalDto {
  title?: string;
  description?: string;
  targetDate?: Date;
  status?: GoalStatus;
}

export interface GoalAchievementDto {
  goalId: string;
  achieved: boolean;
  completionDate?: Date;
  notes?: string;
}

export interface PerformanceReviewDto {
  id: string;
  revieweeId: string;
  reviewerId: string;
  revieweeUserId: string;
  reviewerUserId: string;
  period: string;
  overallRating: number;
  feedback?: string;
  goals?: any[];
  achievements?: any[];
  status: ReviewStatus;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  reviewee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
}

export interface CreatePerformanceReviewDto {
  revieweeId: string;
  reviewerId: string;
  revieweeUserId: string;
  reviewerUserId: string;
  period: string;
  overallRating?: number;
  feedback?: string;
  goals?: any[];
  achievements?: any[];
}

export interface UpdatePerformanceReviewDto {
  overallRating?: number;
  feedback?: string;
  goals?: any[];
  achievements?: any[];
  status?: ReviewStatus;
  submittedAt?: Date;
}

export interface PerformanceFilterDto {
  revieweeId?: string;
  reviewerId?: string;
  period?: string;
  status?: ReviewStatus;
}

export interface PerformanceMetricsDto {
  employeeId: string;
  averageRating: number;
  completedGoals: number;
  pendingGoals: number;
  reviewCount: number;
  latestReviewDate?: Date;
  latestReviewRating?: number;
  employeeName?: string;
}

export interface TeamPerformanceDto {
  departmentId: string;
  departmentName: string;
  averageRating: number;
  topPerformers: {
    employeeId: string;
    employeeName: string;
    rating: number;
  }[];
  improvementNeeded: {
    employeeId: string;
    employeeName: string;
    rating: number;
  }[];
  goalCompletionRate: number;
}

export interface ReviewCycleDto {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'ACTIVE' | 'COMPLETED' | 'UPCOMING';
  description?: string;
} 