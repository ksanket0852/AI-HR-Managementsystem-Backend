import express from "express";
import {
  registerFakeUser,
  loginFakeUser,
  oauthLogin,
  updatePassword,
} from "../controllers/auth";
import { authMiddleware } from "../middlewares/auth";

const router = express.Router();

router.post("/register-fake", registerFakeUser);
router.post("/login-fake", loginFakeUser);
router.post("/oauth-login", oauthLogin);
router.put("/update-password", authMiddleware, updatePassword);

export default router;
