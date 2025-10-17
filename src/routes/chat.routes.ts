import express from "express";
import { chatController } from "../controllers/chat.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Chat session routes
router.post("/sessions", chatController.createChatSession.bind(chatController));
router.get("/sessions", chatController.getMyChatSessions.bind(chatController));
router.get("/sessions/:id", chatController.getChatSessionById.bind(chatController));

// Chat message routes
router.post("/messages", chatController.createChatMessage.bind(chatController));
router.get("/messages", chatController.getChatMessages.bind(chatController));

// Chatbot routes
router.post("/chatbot", chatController.processChatbotMessage.bind(chatController));

export default router; 