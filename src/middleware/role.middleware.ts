import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware";
import { UserRole } from "@prisma/client";

/**
 * Middleware to check if the user has one of the allowed roles
 * @param allowedRoles Array of roles that are allowed to access the route
 */
export const roleMiddleware = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole as UserRole)) {
      return res.status(403).json({ 
        message: "Access denied. You don't have permission to perform this action." 
      });
    }
    
    next();
    return;
  };
}; 