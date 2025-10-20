import { Response } from "express";
import { chatService } from "../services/chat.service";
import { recruitmentAIService } from "../services/recruitment-ai.service";
import { openaiService } from "../services/openai.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { PrismaClient } from "@prisma/client";
import { 
  CreateChatSessionDto,
  CreateChatMessageDto,
  ChatCompletionRequestDto,
  ChatHistoryQueryDto,
  CreateInterviewSessionDto,
  VoiceProcessingDto,
  CandidateAnalysisDto
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

  /**
   * Process recruitment message with candidate analysis
   */
  async processRecruitmentMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const request: ChatCompletionRequestDto = {
        userId,
        message: req.body.message,
        sessionId: req.body.sessionId,
        candidateId: req.body.candidateId,
        jobId: req.body.jobId,
        interviewType: req.body.interviewType,
        isVoiceInput: req.body.isVoiceInput,
        audioData: req.body.audioData
      };

      const response = await recruitmentAIService.processRecruitmentMessage(request);
      res.status(200).json(response);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Create interview session
   */
  async createInterviewSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const data: CreateInterviewSessionDto = {
        candidateId: req.body.candidateId,
        jobId: req.body.jobId,
        interviewerId: userId, // Current user as interviewer
        sessionType: req.body.sessionType,
        scheduledAt: new Date(req.body.scheduledAt),
        duration: req.body.duration
      };

      const session = await recruitmentAIService.createInterviewSession(data);
      res.status(201).json(session);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Get interview session by ID
   */
  async getInterviewSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const session = await recruitmentAIService.getInterviewSession(id);
      
      if (!session) {
        res.status(404).json({ message: "Interview session not found" });
        return;
      }
      
      res.status(200).json(session);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Process voice input (speech-to-text)
   */
  async processVoiceInput(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      // Validate required fields
      if (!req.body.audioData) {
        res.status(400).json({ message: "audioData is required" });
        return;
      }

      if (typeof req.body.audioData !== 'string') {
        res.status(400).json({ message: "audioData must be a string" });
        return;
      }

      // Validate base64 format
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(req.body.audioData)) {
        res.status(400).json({ message: "audioData must be valid base64" });
        return;
      }

      const voiceData: VoiceProcessingDto = {
        audioData: req.body.audioData,
        language: req.body.language || 'en',
        format: req.body.format || 'wav'
      };

      console.log('Processing voice input:', {
        audioDataLength: voiceData.audioData.length,
        language: voiceData.language,
        format: voiceData.format
      });

      const response = await openaiService.processVoiceInput(voiceData);
      res.status(200).json(response);
    } catch (error) {
      console.error('Voice input processing error:', error);
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Generate voice response (text-to-speech)
   */
  async generateVoiceResponse(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const { text, voice } = req.body;
      
      if (!text) {
        res.status(400).json({ message: "Text is required for voice generation" });
        return;
      }

      const response = await openaiService.generateVoiceResponse(text, voice);
      res.status(200).json(response);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Analyze candidate response
   */
  async analyzeCandidateResponse(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const { message, jobRequirements, resumeData, conversationContext } = req.body;
      
      if (!message) {
        res.status(400).json({ message: "Message is required for analysis" });
        return;
      }

      const analysis = await openaiService.analyzeCandidateResponse(
        message,
        jobRequirements,
        resumeData,
        conversationContext || []
      );

      res.status(200).json(analysis);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Generate recruitment question
   */
  async generateRecruitmentQuestion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const { phase, jobData, resumeData, previousQuestions } = req.body;
      
      if (!phase) {
        res.status(400).json({ message: "Phase is required for question generation" });
        return;
      }

      const question = await openaiService.generateRecruitmentQuestion(
        phase,
        jobData,
        resumeData,
        previousQuestions || []
      );

      res.status(200).json({ question });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  /**
   * Generate conversation summary
   */
  async generateConversationSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const { conversationHistory, candidateAnalysis, jobData } = req.body;
      
      if (!conversationHistory || !candidateAnalysis) {
        res.status(400).json({ message: "Conversation history and analysis are required" });
        return;
      }

      const summary = await openaiService.generateConversationSummary(
        conversationHistory,
        candidateAnalysis,
        jobData
      );

      res.status(200).json({ summary });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }
}

export const chatController = new ChatController(); 