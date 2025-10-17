import { Router } from 'express';
import AnalyticsController from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const analyticsController = new AnalyticsController();

// Apply authentication middleware to all analytics routes
router.use(authMiddleware);

// Attrition Risk Scoring
router.get('/attrition-risk', analyticsController.getAttritionRisk);

// Performance Insights
router.get('/performance-insights', analyticsController.getPerformanceInsights);
router.get('/team-performance', analyticsController.getTeamPerformanceInsights);

// Leave Pattern Analysis
router.get('/leave-patterns', analyticsController.getLeavePatternAnalysis);

// Attendance Anomaly Detection
router.get('/attendance-anomalies', analyticsController.getAttendanceAnomalies);

// Dashboard Analytics
router.get('/dashboard', analyticsController.getDashboardAnalytics);

// Employee-specific Analytics
router.get('/employee/:employeeId/summary', analyticsController.getEmployeeAnalyticsSummary);

// Department-specific Analytics (commented out until implemented)
// router.get('/department/:departmentId/summary', analyticsController.getDepartmentAnalyticsSummary);

// System Health
router.get('/health', analyticsController.getAnalyticsHealth);

export default router; 