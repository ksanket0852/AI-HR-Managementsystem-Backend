import { PrismaClient } from "@prisma/client";
import { 
  ChatMessageDto, 
  CreateChatMessageDto, 
  ChatSessionDto,
  CreateChatSessionDto,
  ChatHistoryQueryDto,
  ChatCompletionRequestDto,
  ChatCompletionResponseDto
} from "../types/chat.dto";
import { openaiService } from "./openai.service";
import { io } from "../index";

class ChatService {
  private prisma = new PrismaClient();

  /**
   * Create a new chat session
   */
  async createChatSession(data: CreateChatSessionDto): Promise<ChatSessionDto> {
    const session = await this.prisma.chatMessage.create({
      data: {
        userId: data.userId,
        message: `Chat session started: ${data.title}`,
        response: '',
        context: {}
      }
    });

    return {
      id: session.id,
      userId: session.userId,
      title: data.title,
      createdAt: session.createdAt,
      updatedAt: session.createdAt
    };
  }

  /**
   * Get a chat session by ID
   */
  async getChatSessionById(id: string): Promise<ChatSessionDto | null> {
    const firstMessage = await this.prisma.chatMessage.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    if (!firstMessage) return null;

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        userId: firstMessage.userId,
        createdAt: {
          gte: firstMessage.createdAt
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return {
      id: firstMessage.id,
      userId: firstMessage.userId,
      title: firstMessage.message.replace('Chat session started: ', ''),
      createdAt: firstMessage.createdAt,
      updatedAt: messages[messages.length - 1].createdAt,
      messages: messages.map(this.mapMessageToDto)
    };
  }

  /**
   * Get chat sessions for a user
   */
  async getChatSessionsByUserId(userId: string): Promise<ChatSessionDto[]> {
    const sessions = await this.prisma.chatMessage.findMany({
      where: {
        userId,
        message: {
          startsWith: 'Chat session started: '
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return sessions.map(session => ({
      id: session.id,
      userId: session.userId,
      title: session.message.replace('Chat session started: ', ''),
      createdAt: session.createdAt,
      updatedAt: session.createdAt
    }));
  }

  /**
   * Create a new chat message
   */
  async createChatMessage(data: CreateChatMessageDto): Promise<ChatMessageDto> {
    const message = await this.prisma.chatMessage.create({
      data: {
        userId: data.userId,
        message: data.content,
        response: data.isFromBot ? data.content : '',
        context: {}
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    return this.mapMessageToDto(message);
  }

  /**
   * Get chat messages by query parameters
   */
  async getChatMessages(query: ChatHistoryQueryDto): Promise<{ messages: ChatMessageDto[], total: number }> {
    const { userId, sessionId, startDate, endDate, searchQuery, page = 1, limit = 20 } = query;

    // Build where clause based on filters
    const where: any = {};

    if (userId) where.userId = userId;
    
    if (sessionId) {
      const session = await this.prisma.chatMessage.findUnique({
        where: { id: sessionId }
      });
      
      if (session) {
        where.userId = session.userId;
        where.createdAt = {
          gte: session.createdAt
        };
      }
    }

    if (startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: startDate
      };
    }

    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: endDate
      };
    }

    if (searchQuery) {
      where.message = {
        contains: searchQuery,
        mode: 'insensitive'
      };
    }

    // Get total count
    const total = await this.prisma.chatMessage.count({ where });

    // Get paginated messages
    const messages = await this.prisma.chatMessage.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      messages: messages.map(this.mapMessageToDto),
      total
    };
  }

  /**
   * Process a user message and get a response from the chatbot
   */
  async processUserMessage(request: ChatCompletionRequestDto): Promise<ChatCompletionResponseDto> {
    try {
      // Create user message in database
      const userMessage = await this.createChatMessage({
        userId: request.userId,
        content: request.message,
        isFromBot: false
      });

      // Process with OpenAI
      const response = await openaiService.processMessage(request);

      // Create bot response in database
      const botMessage = await this.createChatMessage({
        userId: request.userId,
        content: response.message,
        isFromBot: true
      });

      // Emit the bot response via Socket.io
      io.to(`user-${request.userId}`).emit('chatbot-response', {
        message: botMessage,
        sessionId: response.sessionId
      });

      return response;
    } catch (error) {
      console.error('Error processing user message:', error);
      throw new Error(`Failed to process message: ${(error as Error).message}`);
    }
  }

  /**
   * Map Prisma ChatMessage to DTO
   */
  private mapMessageToDto(message: any): ChatMessageDto {
    return {
      id: message.id,
      userId: message.userId,
      content: message.message,
      isFromBot: message.response === message.message && message.message !== '',
      createdAt: message.createdAt,
      user: message.user
    };
  }
}

export const chatService = new ChatService(); 