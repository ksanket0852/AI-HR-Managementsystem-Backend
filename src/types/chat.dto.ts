export interface ChatMessageDto {
  id: string;
  userId: string;
  content: string;
  isFromBot: boolean;
  createdAt: Date;
  user?: {
    id: string;
    email: string;
  };
}

export interface CreateChatMessageDto {
  userId: string;
  content: string;
  isFromBot: boolean;
}

export interface ChatSessionDto {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages?: ChatMessageDto[];
}

export interface CreateChatSessionDto {
  userId: string;
  title: string;
}

export interface ChatCompletionRequestDto {
  message: string;
  userId: string;
  sessionId?: string;
}

export interface ChatCompletionResponseDto {
  message: string;
  sessionId: string;
}

export interface ChatHistoryQueryDto {
  userId?: string;
  sessionId?: string;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
  page?: number;
  limit?: number;
}

export interface KnowledgeBaseEntryDto {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKnowledgeBaseEntryDto {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

export interface UpdateKnowledgeBaseEntryDto {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
}

export interface KnowledgeBaseQueryDto {
  category?: string;
  tags?: string[];
  searchQuery?: string;
  page?: number;
  limit?: number;
} 