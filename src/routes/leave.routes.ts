import { Router } from "express";
import { leaveController } from "../controllers/leave.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { roleMiddleware } from "../middleware/role.middleware";

const router = Router();

// Public endpoint for shared calendars (no auth required)
router.get("/calendar/share", leaveController.getSharedCalendar.bind(leaveController));

// Apply authentication middleware to all other routes
router.use(authMiddleware);

// Leave Type Management (HR and Admin only)
router.post(
  "/types",
  roleMiddleware(['HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']),
  leaveController.createLeaveType.bind(leaveController)
);

router.get("/types", leaveController.getLeaveTypes.bind(leaveController));

router.get("/types/:id", leaveController.getLeaveTypeById.bind(leaveController));

router.put(
  "/types/:id",
  roleMiddleware(['HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']),
  leaveController.updateLeaveType.bind(leaveController)
);

router.delete(
  "/types/:id",
  roleMiddleware(['HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']),
  leaveController.deleteLeaveType.bind(leaveController)
);

// Leave Application Management
router.post("/apply", leaveController.applyForLeave.bind(leaveController));

router.put(
  "/applications/:id/approve-reject",
  roleMiddleware(['HR_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN', 'MANAGER']),
  leaveController.updateLeaveApplication.bind(leaveController)
);

router.put(
  "/applications/:id/cancel",
  leaveController.cancelLeaveApplication.bind(leaveController)
);

router.get("/applications", leaveController.getLeaveApplications.bind(leaveController));

router.get("/applications/:id", leaveController.getLeaveApplicationById.bind(leaveController));

// Leave Balance
router.get("/balance", leaveController.getEmployeeLeaveBalance.bind(leaveController));

// Calendar Integration
router.get("/calendar", leaveController.getCalendarEvents.bind(leaveController));

router.get("/calendar/link", leaveController.generateCalendarLink.bind(leaveController));

export default router; 