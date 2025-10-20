import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { userService } from "../services/user.service";
import { User, Employee } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
user?: User & { employee: Employee | null };
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
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

    // Support tokens that include either `email`, `id` or `userId` in the payload
    const userId = (decoded as any).id || (decoded as any).userId;
    const email = (decoded as any).email;

    let user;
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { employee: true }
      });
    } else if (email) {
      user = await prisma.user.findUnique({
        where: { email },
        include: { employee: true }
      });
    } else {
      res.status(401).json({ message: 'Invalid token payload' });
      return;
    }

    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};