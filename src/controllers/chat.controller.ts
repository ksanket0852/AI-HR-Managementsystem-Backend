import { Response } from "express";
import { chatService } from "../services/chat.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { PrismaClient } from "@prisma/client";
import { 
  CreateChatSessionDto,
  CreateChatMessageDto,
  ChatCompletionRequestDto,
  ChatHistoryQueryDto
} from "../types/chat.dto";

class ChatController {
  private prisma = new PrismaClient();

  /**
   * Create a new chat session
   */
  async createChatSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const data: CreateChatSessionDto = {
        userId,
        title: req.body.title || "New Chat"
      };

      const session = await chatService.createChatSession(data);
      res.status(201).json(session);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Get a chat session by ID
   */
  async getChatSessionById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const session = await chatService.getChatSessionById(id);
      
      if (!session) {
        res.status(404).json({ message: "Chat session not found" });
        return;
      }
      
      // Check if the user has access to this session
      if (session.userId !== req.user?.id) {
        res.status(403).json({ message: "You don't have permission to access this chat session" });
        return;
      }
      
      res.status(200).json(session);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Get all chat sessions for the current user
   */
  async getMyChatSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const sessions = await chatService.getChatSessionsByUserId(userId);
      res.status(200).json(sessions);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Create a new chat message
   */
  async createChatMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const data: CreateChatMessageDto = {
        userId,
        content: req.body.content,
        isFromBot: false
      };

      const message = await chatService.createChatMessage(data);
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Get chat messages with filtering and pagination
   */
  async getChatMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const { sessionId, startDate, endDate, searchQuery, page, limit } = req.query;
      
      const query: ChatHistoryQueryDto = {
        userId,
        sessionId: sessionId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        searchQuery: searchQuery as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20
      };
      
      const result = await chatService.getChatMessages(query);
      
      res.status(200).json({
        messages: result.messages,
        total: result.total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(result.total / (query.limit || 20))
      });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Process a message with the chatbot
   */
  async processChatbotMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const request: ChatCompletionRequestDto = {
        userId,
        message: req.body.message,
        sessionId: req.body.sessionId
      };

      // Process the message asynchronously
      chatService.processUserMessage(request)
        .catch(error => console.error('Error processing chatbot message:', error));
      
      // Return immediately to the client
      res.status(202).json({ 
        message: "Message received and being processed",
        note: "The response will be sent via WebSocket"
      });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }
}

export const chatController = new ChatController(); 