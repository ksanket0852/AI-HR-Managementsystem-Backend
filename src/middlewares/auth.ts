import { Request, Response, NextFunction } from "express";
import dotenv from 'dotenv';
import jwt from "jsonwebtoken";
import { AuthRequest, IUser } from "../utils/types";
import { User } from "../models";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    console.log('JWT_SECRET',JWT_SECRET);
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
