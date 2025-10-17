import { Router } from "express";
import { attendanceController } from "../controllers/attendance.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { roleMiddleware } from "../middleware/role.middleware";

const router = Router();

router.use(authMiddleware);

// Basic attendance endpoints
router.get("/", attendanceController.getAttendance);
router.post("/clock-in", attendanceController.clockIn);
router.post("/clock-out", attendanceController.clockOut);

// Break time management
router.post("/break", attendanceController.updateBreakTime);

// Attendance reporting
router.post("/report", attendanceController.generateAttendanceReport);

// Admin only endpoints
router.post("/mark-absentees", roleMiddleware(['HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']), attendanceController.markAbsentees);

export default router;