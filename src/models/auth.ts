import mongoose, { Schema, Model, Document } from "mongoose";
import { IUser } from "../utils/types/user-types";

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  isFakeUser: { type: Boolean, default: false },
  googleId: { type: String },
});

export const User: Model<IUser & Document> = mongoose.model<IUser>("User", userSchema);
