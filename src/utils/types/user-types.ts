import { Request } from "express";
import {Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  isFakeUser: boolean; 
  googleId?: string;  
}

export interface AuthRequest extends Request {
  user?: IUser;
}