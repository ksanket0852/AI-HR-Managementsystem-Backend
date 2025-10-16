import jwt from "jsonwebtoken";
import { IUser } from "../types";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export const generateToken = (user: IUser) => {
  return jwt.sign(
    {
      id: user._id,
      isFakeUser: user.isFakeUser,
      googleId: user.googleId || null,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};
