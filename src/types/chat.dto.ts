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
  candidateId?: string;
  jobId?: string;
  interviewType?: 'pre-screening' | 'technical' | 'hr' | 'final';
  isVoiceInput?: boolean;
  audioData?: string; // Base64 encoded audio for voice input
}

export interface ChatCompletionResponseDto {
  message: string;
  sessionId: string;
  textResponse: string;
  voiceResponse: string;
  analysis?: CandidateAnalysisDto;
  nextQuestion?: string;
  conversationPhase?: 'greeting' | 'experience' | 'skills' | 'behavioral' | 'closing';
}

export interface CandidateAnalysisDto {
  skillsDetected: string[];
  fitScore: number; // 0-100
  communicationTone: 'confident' | 'nervous' | 'professional' | 'casual' | 'enthusiastic';
  recommendedAction: 'invite_technical' | 'invite_hr' | 'schedule_final' | 'reject' | 'additional_screening';
  strengths: string[];
  concerns: string[];
  experienceMatch: number; // 0-100
  culturalFit: number; // 0-100
  technicalSkills: string[];
  softSkills: string[];
  confidenceLevel: number; // 0-100
  responseQuality: number; // 0-100
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

// Interview Session DTOs
export interface InterviewSessionDto {
  id: string;
  candidateId: string;
  jobId: string;
  interviewerId: string;
  sessionType: 'pre-screening' | 'technical' | 'hr' | 'final';
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number; // in minutes
  analysis?: CandidateAnalysisDto;
  conversationHistory: ChatMessageDto[];
  overallRating?: number; // 0-100
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInterviewSessionDto {
  candidateId: string;
  jobId: string;
  interviewerId: string;
  sessionType: 'pre-screening' | 'technical' | 'hr' | 'final';
  scheduledAt: Date;
  duration?: number;
}

// Voice Processing DTOs
export interface VoiceProcessingDto {
  audioData: string; // Base64 encoded audio
  language?: string;
  format?: 'wav' | 'mp3' | 'm4a';
}

export interface VoiceResponseDto {
  text: string;
  audioUrl?: string; // URL to generated audio file
  duration?: number; // in seconds
  confidence?: number; // 0-100
}

// Resume Analysis Integration DTOs
export interface ResumeAnalysisDto {
  candidateId: string;
  resumeId: string;
  extractedSkills: string[];
  experience: WorkExperienceDto[];
  education: EducationDto[];
  projects: ProjectDto[];
  certifications: CertificationDto[];
  languages: LanguageDto[];
  aiScore: number; // 0-100
  keywordMatches: string[];
}

export interface WorkExperienceDto {
  company: string;
  position: string;
  startDate: Date;
  endDate?: Date;
  description: string;
  skills: string[];
  achievements: string[];
}

export interface EducationDto {
  institution: string;
  degree: string;
  field: string;
  startDate: Date;
  endDate?: Date;
  gpa?: number;
}

export interface ProjectDto {
  name: string;
  description: string;
  technologies: string[];
  startDate: Date;
  endDate?: Date;
  url?: string;
}

export interface CertificationDto {
  name: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  credentialId?: string;
}

export interface LanguageDto {
  language: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'native';
} 