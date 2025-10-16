import { Request, Response } from "express";
import bcrypt from 'bcrypt';
import {User} from "../models/auth";
import { generateToken } from "../utils/helper-functions/jwt";

export const registerFakeUser = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields required" });

  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(400).json({ message: "Email already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    isFakeUser: true,
  });

  const token = generateToken(user);
  res.json({ token });
};

export const loginFakeUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !user.isFakeUser)
    return res.status(400).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password!);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const token = generateToken(user);
  res.json({ token });
};

export const oauthLogin = async (req: Request, res: Response) => {
  const { googleId, name, email } = req.body;

  let user = await User.findOne({ googleId });
  
  if (!user) {
    user = await User.create({ googleId, name, email, isFakeUser: false });
  }

  const token = generateToken(user);
  res.json({ token });
};

export const updatePassword = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { newPassword } = req.body;

  if (!newPassword) return res.status(400).json({ message: "New password required" });
  if (user.isFakeUser) return res.status(403).json({ message: "Fake users cannot update password" });

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();

  res.json({ message: "Password updated successfully" });
};
