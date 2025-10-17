import express from "express";
import { performanceController } from "../controllers/performance.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { roleMiddleware } from "../middleware/role.middleware";
import { UserRole } from "@prisma/client";

const router = express.Router();

// Routes that require authentication
router.use(authMiddleware);

// Goal Management Routes
// Employee routes - employees can access their own goals
router.get("/goals/my", performanceController.getMyGoals.bind(performanceController));

// HR and Manager routes - require special permissions
router.post("/goals", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), 
  performanceController.createGoal.bind(performanceController)
);

router.get("/goals/:id", 
  performanceController.getGoalById.bind(performanceController)
);

router.get("/employees/:employeeId/goals", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), 
  performanceController.getEmployeeGoals.bind(performanceController)
);

router.put("/goals/:id", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE]), 
  performanceController.updateGoal.bind(performanceController)
);

router.delete("/goals/:id", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), 
  performanceController.deleteGoal.bind(performanceController)
);

// Performance Review Routes
// Employee routes - employees can access their own reviews
router.get("/reviews/my", performanceController.getMyPerformanceReviews.bind(performanceController));
router.get("/reviews/to-complete", performanceController.getReviewsToComplete.bind(performanceController));

// HR and Manager routes - require special permissions
router.post("/reviews", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), 
  performanceController.createPerformanceReview.bind(performanceController)
);

router.get("/reviews", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), 
  performanceController.getPerformanceReviews.bind(performanceController)
);

router.get("/reviews/:id", 
  performanceController.getPerformanceReviewById.bind(performanceController)
);

router.put("/reviews/:id", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE]), 
  performanceController.updatePerformanceReview.bind(performanceController)
);

router.post("/reviews/:id/submit", 
  performanceController.submitPerformanceReview.bind(performanceController)
);

router.post("/reviews/:id/approve", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), 
  performanceController.approvePerformanceReview.bind(performanceController)
);

router.post("/reviews/:id/reject", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), 
  performanceController.rejectPerformanceReview.bind(performanceController)
);

router.delete("/reviews/:id", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]), 
  performanceController.deletePerformanceReview.bind(performanceController)
);

// Performance Analytics Routes
router.get("/metrics/my", performanceController.getMyPerformanceMetrics.bind(performanceController));

router.get("/metrics/employees/:employeeId", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), 
  performanceController.getEmployeePerformanceMetrics.bind(performanceController)
);

router.get("/metrics/departments/:departmentId", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), 
  performanceController.getTeamPerformance.bind(performanceController)
);

export default router; 