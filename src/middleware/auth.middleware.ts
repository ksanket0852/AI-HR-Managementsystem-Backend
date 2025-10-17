import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { userService } from "../services/user.service";
import { User } from "@prisma/client";

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authorization header missing" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const decoded = authService.verifyToken(token);
  if (!decoded) {
    res.status(401).json({ message: "Invalid token" });
    return;
  }

  const user = await userService.findUserByEmail(decoded.email);
  if (!user) {
    res.status(401).json({ message: "User not found" });
    return;
  }

  req.user = user;
  next();
};