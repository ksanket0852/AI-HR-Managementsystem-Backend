import { Response } from "express";
import { performanceService } from "../services/performance.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { PrismaClient } from "@prisma/client";
import {
  CreateGoalDto,
  UpdateGoalDto,
  CreatePerformanceReviewDto,
  UpdatePerformanceReviewDto,
  PerformanceFilterDto
} from "../types/performance.dto";

class PerformanceController {
  private prisma = new PrismaClient();

  private async getEmployeeId(userId: string): Promise<string | null> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true },
    });
    return employee?.id || null;
  }

  // Goal Management
  async createGoal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const goalData: CreateGoalDto = req.body;
      const goal = await performanceService.createGoal(goalData);
      res.status(201).json(goal);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async getGoalById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const goal = await performanceService.getGoalById(id);
      
      if (!goal) {
        res.status(404).json({ message: "Goal not found" });
        return;
      }
      
      res.status(200).json(goal);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async getMyGoals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const employeeId = await this.getEmployeeId(userId);
      if (!employeeId) {
        res.status(404).json({ message: "Employee profile not found" });
        return;
      }

      const goals = await performanceService.getGoalsByEmployeeId(employeeId);
      res.status(200).json(goals);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async getEmployeeGoals(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { employeeId } = req.params;
      const goals = await performanceService.getGoalsByEmployeeId(employeeId);
      res.status(200).json(goals);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async updateGoal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const goalData: UpdateGoalDto = req.body;
      const goal = await performanceService.updateGoal(id, goalData);
      res.status(200).json(goal);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async deleteGoal(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await performanceService.deleteGoal(id);
      res.status(200).json({ message: "Goal deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Performance Review Management
  async createPerformanceReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const reviewData: CreatePerformanceReviewDto = req.body;
      const review = await performanceService.createPerformanceReview(reviewData);
      res.status(201).json(review);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async getPerformanceReviewById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const review = await performanceService.getPerformanceReviewById(id);
      
      if (!review) {
        res.status(404).json({ message: "Performance review not found" });
        return;
      }
      
      res.status(200).json(review);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async getPerformanceReviews(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { revieweeId, reviewerId, period, status, page, limit } = req.query;
      
      const filters: PerformanceFilterDto = {};
      
      if (revieweeId) filters.revieweeId = revieweeId as string;
      if (reviewerId) filters.reviewerId = reviewerId as string;
      if (period) filters.period = period as string;
      if (status) filters.status = status as any;
      
      const pageNum = page ? parseInt(page as string) : 1;
      const limitNum = limit ? parseInt(limit as string) : 10;
      
      const result = await performanceService.getPerformanceReviews(filters, pageNum, limitNum);
      
      res.status(200).json({
        reviews: result.reviews,
        total: result.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.total / limitNum)
      });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async getMyPerformanceReviews(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const employeeId = await this.getEmployeeId(userId);
      if (!employeeId) {
        res.status(404).json({ message: "Employee profile not found" });
        return;
      }

      const { page, limit } = req.query;
      const pageNum = page ? parseInt(page as string) : 1;
      const limitNum = limit ? parseInt(limit as string) : 10;
      
      const result = await performanceService.getPerformanceReviews(
        { revieweeId: employeeId },
        pageNum,
        limitNum
      );
      
      res.status(200).json({
        reviews: result.reviews,
        total: result.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.total / limitNum)
      });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async getReviewsToComplete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const employeeId = await this.getEmployeeId(userId);
      if (!employeeId) {
        res.status(404).json({ message: "Employee profile not found" });
        return;
      }

      const { page, limit } = req.query;
      const pageNum = page ? parseInt(page as string) : 1;
      const limitNum = limit ? parseInt(limit as string) : 10;
      
      const result = await performanceService.getPerformanceReviews(
        { reviewerId: employeeId },
        pageNum,
        limitNum
      );
      
      res.status(200).json({
        reviews: result.reviews,
        total: result.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(result.total / limitNum)
      });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async updatePerformanceReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const reviewData: UpdatePerformanceReviewDto = req.body;
      const review = await performanceService.updatePerformanceReview(id, reviewData);
      res.status(200).json(review);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async submitPerformanceReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const review = await performanceService.submitPerformanceReview(id);
      res.status(200).json(review);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async approvePerformanceReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const review = await performanceService.approvePerformanceReview(id);
      res.status(200).json(review);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async rejectPerformanceReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const review = await performanceService.rejectPerformanceReview(id);
      res.status(200).json(review);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async deletePerformanceReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await performanceService.deletePerformanceReview(id);
      res.status(200).json({ message: "Performance review deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Performance Analytics
  async getEmployeePerformanceMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { employeeId } = req.params;
      const metrics = await performanceService.getEmployeePerformanceMetrics(employeeId);
      res.status(200).json(metrics);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async getMyPerformanceMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const employeeId = await this.getEmployeeId(userId);
      if (!employeeId) {
        res.status(404).json({ message: "Employee profile not found" });
        return;
      }

      const metrics = await performanceService.getEmployeePerformanceMetrics(employeeId);
      res.status(200).json(metrics);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async getTeamPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { departmentId } = req.params;
      const teamMetrics = await performanceService.getTeamPerformance(departmentId);
      res.status(200).json(teamMetrics);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }
}

export const performanceController = new PerformanceController(); 