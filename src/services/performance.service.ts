import { PrismaClient, Prisma, ReviewStatus, GoalStatus } from "@prisma/client";
import {
  GoalDto,
  CreateGoalDto,
  UpdateGoalDto,
  PerformanceReviewDto,
  CreatePerformanceReviewDto,
  UpdatePerformanceReviewDto,
  PerformanceFilterDto,
  PerformanceMetricsDto,
  TeamPerformanceDto
} from "../types/performance.dto";

class PerformanceService {
  private prisma = new PrismaClient();

  // Goal Management
  async createGoal(data: CreateGoalDto): Promise<GoalDto> {
    const goal = await this.prisma.goal.create({
      data: {
        employeeId: data.employeeId,
        title: data.title,
        description: data.description || undefined,
        targetDate: data.targetDate,
        status: data.status || GoalStatus.NOT_STARTED
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

    return this.mapGoalToDto(goal);
  }

  async getGoalById(id: string): Promise<GoalDto | null> {
    const goal = await this.prisma.goal.findUnique({
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

    if (!goal) return null;

    return this.mapGoalToDto(goal);
  }

  async getGoalsByEmployeeId(employeeId: string): Promise<GoalDto[]> {
    const goals = await this.prisma.goal.findMany({
      where: { employeeId },
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
      orderBy: { targetDate: 'asc' }
    });

    return goals.map(goal => this.mapGoalToDto(goal));
  }

  async updateGoal(id: string, data: UpdateGoalDto): Promise<GoalDto> {
    const goal = await this.prisma.goal.findUnique({
      where: { id }
    });

    if (!goal) {
      throw new Error(`Goal with ID ${id} not found`);
    }

    const updatedGoal = await this.prisma.goal.update({
      where: { id },
      data,
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

    return this.mapGoalToDto(updatedGoal);
  }

  async deleteGoal(id: string): Promise<void> {
    const goal = await this.prisma.goal.findUnique({
      where: { id }
    });

    if (!goal) {
      throw new Error(`Goal with ID ${id} not found`);
    }

    await this.prisma.goal.delete({
      where: { id }
    });
  }

  // Performance Review Management
  async createPerformanceReview(data: CreatePerformanceReviewDto): Promise<PerformanceReviewDto> {
    const review = await this.prisma.performanceReview.create({
      data: {
        revieweeId: data.revieweeId,
        reviewerId: data.reviewerId,
        revieweeUserId: data.revieweeUserId,
        reviewerUserId: data.reviewerUserId,
        period: data.period,
        overallRating: data.overallRating !== undefined ? new Prisma.Decimal(data.overallRating) : new Prisma.Decimal(0),
        feedback: data.feedback || undefined,
        goals: data.goals as unknown as Prisma.JsonArray || undefined,
        achievements: data.achievements as unknown as Prisma.JsonArray || undefined,
        status: ReviewStatus.DRAFT
      },
      include: {
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    return this.mapReviewToDto(review);
  }

  async getPerformanceReviewById(id: string): Promise<PerformanceReviewDto | null> {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id },
      include: {
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    if (!review) return null;

    return this.mapReviewToDto(review);
  }

  async getPerformanceReviews(
    filters: PerformanceFilterDto,
    page = 1,
    limit = 10
  ): Promise<{ reviews: PerformanceReviewDto[], total: number }> {
    const { revieweeId, reviewerId, period, status } = filters;

    // Build where clause based on filters
    const where: Prisma.PerformanceReviewWhereInput = {};

    if (revieweeId) where.revieweeId = revieweeId;
    if (reviewerId) where.reviewerId = reviewerId;
    if (period) where.period = period;
    if (status) where.status = status;

    // Get total count
    const total = await this.prisma.performanceReview.count({ where });

    // Get paginated reviews
    const reviews = await this.prisma.performanceReview.findMany({
      where,
      include: {
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        reviewer: {
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
        { period: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return {
      reviews: reviews.map(review => this.mapReviewToDto(review)),
      total
    };
  }

  async updatePerformanceReview(id: string, data: UpdatePerformanceReviewDto): Promise<PerformanceReviewDto> {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id }
    });

    if (!review) {
      throw new Error(`Performance review with ID ${id} not found`);
    }

    const updatedReview = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        overallRating: data.overallRating !== undefined ? new Prisma.Decimal(data.overallRating) : undefined,
        feedback: data.feedback,
        goals: data.goals !== undefined ? data.goals as Prisma.JsonArray : undefined,
        achievements: data.achievements !== undefined ? data.achievements as Prisma.JsonArray : undefined,
        status: data.status,
        submittedAt: data.submittedAt
      },
      include: {
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    return this.mapReviewToDto(updatedReview);
  }

  async submitPerformanceReview(id: string): Promise<PerformanceReviewDto> {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id }
    });

    if (!review) {
      throw new Error(`Performance review with ID ${id} not found`);
    }

    if (review.status !== ReviewStatus.DRAFT) {
      throw new Error(`Performance review with ID ${id} is not in draft status`);
    }

    const updatedReview = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        status: ReviewStatus.SUBMITTED,
        submittedAt: new Date()
      },
      include: {
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    return this.mapReviewToDto(updatedReview);
  }

  async approvePerformanceReview(id: string): Promise<PerformanceReviewDto> {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id }
    });

    if (!review) {
      throw new Error(`Performance review with ID ${id} not found`);
    }

    if (review.status !== ReviewStatus.SUBMITTED) {
      throw new Error(`Performance review with ID ${id} is not in submitted status`);
    }

    const updatedReview = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        status: ReviewStatus.APPROVED
      },
      include: {
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    return this.mapReviewToDto(updatedReview);
  }

  async rejectPerformanceReview(id: string): Promise<PerformanceReviewDto> {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id }
    });

    if (!review) {
      throw new Error(`Performance review with ID ${id} not found`);
    }

    if (review.status !== ReviewStatus.SUBMITTED) {
      throw new Error(`Performance review with ID ${id} is not in submitted status`);
    }

    const updatedReview = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        status: ReviewStatus.REJECTED
      },
      include: {
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });

    return this.mapReviewToDto(updatedReview);
  }

  async deletePerformanceReview(id: string): Promise<void> {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id }
    });

    if (!review) {
      throw new Error(`Performance review with ID ${id} not found`);
    }

    await this.prisma.performanceReview.delete({
      where: { id }
    });
  }

  // Performance Analytics
  async getEmployeePerformanceMetrics(employeeId: string): Promise<PerformanceMetricsDto> {
    // Get employee details
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        firstName: true,
        lastName: true
      }
    });

    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} not found`);
    }

    // Get all reviews for the employee
    const reviews = await this.prisma.performanceReview.findMany({
      where: {
        revieweeId: employeeId,
        status: ReviewStatus.APPROVED
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + Number(review.overallRating), 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Get latest review
    const latestReview = reviews.length > 0 ? reviews[0] : null;

    // Get goals stats
    const goals = await this.prisma.goal.findMany({
      where: {
        employeeId
      }
    });

    const completedGoals = goals.filter(goal => goal.status === GoalStatus.COMPLETED).length;
    const pendingGoals = goals.length - completedGoals;

    return {
      employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      averageRating,
      completedGoals,
      pendingGoals,
      reviewCount: reviews.length,
      latestReviewDate: latestReview?.createdAt,
      latestReviewRating: latestReview ? Number(latestReview.overallRating) : undefined
    };
  }

  async getTeamPerformance(departmentId: string): Promise<TeamPerformanceDto> {
    // Get department details
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!department) {
      throw new Error(`Department with ID ${departmentId} not found`);
    }

    const employeeIds = department.employees.map(emp => emp.id);

    // Get all approved reviews for employees in the department
    const reviews = await this.prisma.performanceReview.findMany({
      where: {
        revieweeId: {
          in: employeeIds
        },
        status: ReviewStatus.APPROVED
      },
      include: {
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Calculate average ratings per employee
    const employeeRatings = new Map<string, { total: number, count: number, name: string }>();

    for (const review of reviews) {
      const empId = review.revieweeId;
      const rating = Number(review.overallRating);
      const name = `${review.reviewee.firstName} ${review.reviewee.lastName}`;

      if (!employeeRatings.has(empId)) {
        employeeRatings.set(empId, { total: 0, count: 0, name });
      }

      const current = employeeRatings.get(empId)!;
      current.total += rating;
      current.count += 1;
    }

    // Calculate average rating for the department
    let departmentTotal = 0;
    let departmentCount = 0;

    // Calculate average rating for each employee
    const employeeAverages: { id: string, name: string, average: number }[] = [];

    for (const [id, data] of employeeRatings.entries()) {
      const average = data.count > 0 ? data.total / data.count : 0;
      employeeAverages.push({ id, name: data.name, average });
      departmentTotal += data.total;
      departmentCount += data.count;
    }

    const departmentAverage = departmentCount > 0 ? departmentTotal / departmentCount : 0;

    // Sort employees by rating
    employeeAverages.sort((a, b) => b.average - a.average);

    // Get top performers and those needing improvement
    const topPerformers = employeeAverages.slice(0, 3).map(emp => ({
      employeeId: emp.id,
      employeeName: emp.name,
      rating: emp.average
    }));

    const improvementNeeded = [...employeeAverages]
      .sort((a, b) => a.average - b.average)
      .slice(0, 3)
      .map(emp => ({
        employeeId: emp.id,
        employeeName: emp.name,
        rating: emp.average
      }));

    // Calculate goal completion rate
    const goals = await this.prisma.goal.findMany({
      where: {
        employeeId: {
          in: employeeIds
        }
      }
    });

    const completedGoals = goals.filter(goal => goal.status === GoalStatus.COMPLETED).length;
    const goalCompletionRate = goals.length > 0 ? completedGoals / goals.length : 0;

    return {
      departmentId,
      departmentName: department.name,
      averageRating: departmentAverage,
      topPerformers,
      improvementNeeded,
      goalCompletionRate
    };
  }

  // Helper method to map Prisma Goal to DTO
  private mapGoalToDto(goal: any): GoalDto {
    return {
      ...goal,
      description: goal.description || undefined
    };
  }

  // Helper method to map Prisma PerformanceReview to DTO
  private mapReviewToDto(review: any): PerformanceReviewDto {
    return {
      ...review,
      overallRating: review.overallRating ? Number(review.overallRating) : 0,
      goals: review.goals || [],
      achievements: review.achievements || []
    };
  }
}

export const performanceService = new PerformanceService(); 