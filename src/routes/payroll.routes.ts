import express from "express";
import { payrollController } from "../controllers/payroll.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { roleMiddleware } from "../middleware/role.middleware";
import { UserRole } from "@prisma/client";

const router = express.Router();

// Routes that require authentication
router.use(authMiddleware);

// Employee routes - employees can access their own payroll information
router.get("/my", payrollController.getMyPayroll.bind(payrollController));

// HR and Admin routes - require special permissions
router.get("/", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]), 
  payrollController.getAllPayrolls.bind(payrollController)
);

router.post("/", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]), 
  payrollController.createPayroll.bind(payrollController)
);

router.post("/generate", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]), 
  payrollController.generatePayrolls.bind(payrollController)
);

router.get("/report", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]), 
  payrollController.getPayrollReport.bind(payrollController)
);

router.get("/:id", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]), 
  payrollController.getPayrollById.bind(payrollController)
);

router.put("/:id", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]), 
  payrollController.updatePayroll.bind(payrollController)
);

router.delete("/:id", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.SUPER_ADMIN]), 
  payrollController.deletePayroll.bind(payrollController)
);

router.post("/:id/approve", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]), 
  payrollController.approvePayroll.bind(payrollController)
);

router.post("/:id/pay", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.SUPER_ADMIN]), 
  payrollController.markAsPaid.bind(payrollController)
);

router.get("/:id/payslip", 
  roleMiddleware([UserRole.HR_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.EMPLOYEE]), 
  payrollController.generatePayslip.bind(payrollController)
);

export default router; 