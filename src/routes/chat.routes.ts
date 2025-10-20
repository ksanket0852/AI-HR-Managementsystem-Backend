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

// Recruitment AI routes
router.post("/recruitment/process", chatController.processRecruitmentMessage.bind(chatController));
router.post("/recruitment/sessions", chatController.createInterviewSession.bind(chatController));
router.get("/recruitment/sessions/:id", chatController.getInterviewSession.bind(chatController));

// Voice processing routes
router.post("/voice/input", chatController.processVoiceInput.bind(chatController));
router.post("/voice/generate", chatController.generateVoiceResponse.bind(chatController));

// Analysis routes
router.post("/analysis/candidate", chatController.analyzeCandidateResponse.bind(chatController));
router.post("/analysis/question", chatController.generateRecruitmentQuestion.bind(chatController));
router.post("/analysis/summary", chatController.generateConversationSummary.bind(chatController));

export default router; 