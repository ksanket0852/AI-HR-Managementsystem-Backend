import { PrismaClient } from "@prisma/client";
import OpenAI from 'openai';
import { 
  ChatCompletionRequestDto, 
  ChatCompletionResponseDto, 
  CandidateAnalysisDto,
  ResumeAnalysisDto,
  InterviewSessionDto,
  CreateInterviewSessionDto,
  VoiceProcessingDto,
  VoiceResponseDto
} from "../types/chat.dto";
import { redisClient } from "../config/redis";
import { resumeIntegrationService } from "./resume-integration.service";

class RecruitmentAIService {
  private prisma = new PrismaClient();
  private openai: OpenAI;
  private contextWindowSize = 15; // Increased for recruitment conversations

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Process recruitment conversation with candidate analysis
   */
  async processRecruitmentMessage(request: ChatCompletionRequestDto): Promise<ChatCompletionResponseDto> {
    try {
      // Get candidate and job information
      const candidateData = await this.getCandidateData(request.candidateId);
      const jobData = await this.getJobData(request.jobId);
      const resumeAnalysis = await resumeIntegrationService.getJobSpecificResumeAnalysis(
        request.candidateId || '', 
        request.jobId || ''
      );

      // Get conversation history
      const conversationHistory = await this.getConversationHistory(request.sessionId || 'new-session');

      // Add current message to history
      conversationHistory.push({
        role: 'user',
        content: request.message
      });

      // Determine conversation phase
      const conversationPhase = this.determineConversationPhase(conversationHistory);

      // Create recruitment-specific system prompt
      const systemPrompt = this.createRecruitmentSystemPrompt(
        candidateData, 
        jobData, 
        resumeAnalysis, 
        request.interviewType || 'pre-screening',
        conversationPhase
      );

      // Generate AI response
      const aiResponse = await this.generateRecruitmentResponse(
        systemPrompt,
        conversationHistory,
        conversationPhase
      );

      // Analyze candidate response
      const analysis = await this.analyzeCandidateResponse(
        request.message,
        candidateData,
        jobData,
        resumeAnalysis,
        conversationHistory
      );

      // Generate next question using resume integration
      const contextAwareQuestions = await resumeIntegrationService.generateContextAwareQuestions(
        request.candidateId || '',
        request.jobId || '',
        conversationPhase,
        conversationHistory.map(h => h.content).filter(c => c)
      );

      const nextQuestion = contextAwareQuestions[0] || await this.generateNextQuestion(
        conversationPhase,
        analysis,
        jobData,
        resumeAnalysis
      );

      // Add assistant response to history
      conversationHistory.push({
        role: 'assistant',
        content: aiResponse.textResponse
      });

      // Store updated conversation history
      await this.storeConversationHistory(request.sessionId || 'new-session', conversationHistory);

      // Store analysis if session exists
      if (request.sessionId) {
        await this.updateInterviewAnalysis(request.sessionId, analysis);
      }

      return {
        message: aiResponse.textResponse,
        sessionId: request.sessionId || 'new-session',
        textResponse: aiResponse.textResponse,
        voiceResponse: aiResponse.voiceResponse,
        analysis,
        nextQuestion,
        conversationPhase: conversationPhase as 'greeting' | 'experience' | 'skills' | 'behavioral' | 'closing'
      };
    } catch (error) {
      console.error('Error processing recruitment message:', error);
      throw new Error(`Failed to process recruitment message: ${(error as Error).message}`);
    }
  }

  /**
   * Create interview session
   */
  async createInterviewSession(data: CreateInterviewSessionDto): Promise<InterviewSessionDto> {
    const session = await this.prisma.interview.create({
      data: {
        candidateId: data.candidateId,
        jobId: data.jobId,
        interviewerId: data.interviewerId,
        type: data.sessionType.toUpperCase() as any,
        scheduledAt: data.scheduledAt,
        duration: data.duration || 60,
        status: 'SCHEDULED'
      },
      include: {
        candidate: true,
        job: true,
        interviewer: true
      }
    });

    return this.mapInterviewToDto(session);
  }

  /**
   * Get interview session by ID
   */
  async getInterviewSession(sessionId: string): Promise<InterviewSessionDto | null> {
    const session = await this.prisma.interview.findUnique({
      where: { id: sessionId },
      include: {
        candidate: true,
        job: true,
        interviewer: true
      }
    });

    if (!session) return null;

    // Get conversation history for this session
    const conversationHistory = await this.getConversationHistory(sessionId);

    return {
      ...this.mapInterviewToDto(session),
      conversationHistory: conversationHistory.map(msg => ({
        id: msg.id || '',
        userId: msg.userId || '',
        content: msg.content,
        isFromBot: msg.role === 'assistant',
        createdAt: new Date(),
        user: undefined
      }))
    };
  }

  /**
   * Process voice input (speech-to-text)
   */
  async processVoiceInput(voiceData: VoiceProcessingDto): Promise<VoiceResponseDto> {
    try {
      // Convert base64 audio to buffer
      const audioBuffer = Buffer.from(voiceData.audioData, 'base64');

      // Use OpenAI Whisper for speech-to-text
      const transcription = await this.openai.audio.transcriptions.create({
        file: new File([audioBuffer], 'audio.wav', { type: 'audio/wav' }),
        model: 'whisper-1',
        language: voiceData.language || 'en'
      });

      return {
        text: transcription.text,
        confidence: 95 // Whisper doesn't provide confidence, using high default
      };
    } catch (error) {
      console.error('Error processing voice input:', error);
      throw new Error(`Failed to process voice input: ${(error as Error).message}`);
    }
  }

  /**
   * Generate voice response (text-to-speech)
   */
  async generateVoiceResponse(text: string): Promise<VoiceResponseDto> {
    try {
      // Use OpenAI TTS for text-to-speech
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy', // You can use 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
        input: text
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      const audioBase64 = buffer.toString('base64');

      return {
        text,
        audioUrl: `data:audio/mp3;base64,${audioBase64}`,
        duration: Math.ceil(text.length / 15) // Rough estimate: 15 chars per second
      };
    } catch (error) {
      console.error('Error generating voice response:', error);
      throw new Error(`Failed to generate voice response: ${(error as Error).message}`);
    }
  }

  /**
   * Get candidate data for context
   */
  private async getCandidateData(candidateId?: string): Promise<any> {
    if (!candidateId) return null;

    return await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        resumes: {
          where: { isLatest: true },
          take: 1
        }
      }
    });
  }

  /**
   * Get job data for context
   */
  private async getJobData(jobId?: string): Promise<any> {
    if (!jobId) return null;

    return await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        department: true,
        poster: true
      }
    });
  }


  /**
   * Determine conversation phase based on history
   */
  private determineConversationPhase(history: any[]): 'greeting' | 'experience' | 'skills' | 'behavioral' | 'closing' {
    if (history.length <= 2) return 'greeting';
    if (history.length <= 8) return 'experience';
    if (history.length <= 15) return 'skills';
    if (history.length <= 20) return 'behavioral';
    return 'closing';
  }

  /**
   * Create recruitment-specific system prompt
   */
  private createRecruitmentSystemPrompt(
    candidateData: any,
    jobData: any,
    resumeAnalysis: ResumeAnalysisDto | null,
    interviewType: string,
    phase: string
  ): string {
    const candidateInfo = candidateData ? `
Candidate Information:
- Name: ${candidateData.firstName} ${candidateData.lastName}
- Email: ${candidateData.email}
- Experience: ${candidateData.totalExperience || 'Not specified'} years
- Skills: ${JSON.stringify(candidateData.skills || [])}
- Status: ${candidateData.status}
` : '';

    const jobInfo = jobData ? `
Job Information:
- Title: ${jobData.title}
- Department: ${jobData.department?.name}
- Requirements: ${JSON.stringify(jobData.requirements || [])}
- Required Skills: ${JSON.stringify(jobData.skills || [])}
- Experience Required: ${jobData.experienceMin}-${jobData.experienceMax} years
- Location: ${jobData.location}
` : '';

    const resumeInfo = resumeAnalysis ? `
Resume Analysis:
- Extracted Skills: ${JSON.stringify(resumeAnalysis.extractedSkills || [])}
- Experience: ${JSON.stringify(resumeAnalysis.experience || [])}
- Education: ${JSON.stringify(resumeAnalysis.education || [])}
- Projects: ${JSON.stringify(resumeAnalysis.projects || [])}
- Certifications: ${JSON.stringify(resumeAnalysis.certifications || [])}
- Languages: ${JSON.stringify(resumeAnalysis.languages || [])}
- AI Score: ${resumeAnalysis.aiScore || 'Not available'}
- Keyword Matches: ${JSON.stringify(resumeAnalysis.keywordMatches || [])}
` : '';

    return `You are an advanced AI Recruitment Assistant conducting a ${interviewType} interview. 

${candidateInfo}
${jobInfo}
${resumeInfo}

Current conversation phase: ${phase}

Your role:
1. Conduct intelligent conversations with candidates during pre-screening or interviews
2. Ask context-aware follow-up questions based on their resume, job role, and past responses
3. Analyze candidate responses to assess skills, confidence, communication style, and relevance
4. Respond naturally and conversationally, mimicking a human recruiter's tone
5. Provide encouraging and professional feedback

Guidelines:
- Be warm, professional, and encouraging
- Ask specific questions based on their resume and the job requirements
- Listen actively and ask follow-up questions
- Assess technical skills, soft skills, and cultural fit
- Keep responses concise for voice playback (under 30 seconds)
- Provide both detailed text responses and shorter voice responses

Phase-specific focus:
- Greeting: Welcome, confirm role applied for, set expectations
- Experience: Deep dive into relevant work experience
- Skills: Assess technical and soft skills
- Behavioral: Situational and behavioral questions
- Closing: Summarize, next steps, answer candidate questions

Always maintain a positive, professional tone while gathering necessary information for evaluation.`;
  }

  /**
   * Generate recruitment response using OpenAI
   */
  private async generateRecruitmentResponse(
    systemPrompt: string,
    conversationHistory: any[],
    phase: string
  ): Promise<{ textResponse: string; voiceResponse: string }> {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-this.contextWindowSize)
    ];

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages as any,
      max_tokens: 300,
      temperature: 0.7,
    });

    const fullResponse = completion.choices[0].message.content || 'I apologize, but I couldn\'t generate a response.';
    
    // Create shorter version for voice
    const voiceResponse = this.createVoiceResponse(fullResponse, phase);

    return {
      textResponse: fullResponse,
      voiceResponse
    };
  }

  /**
   * Create shorter response for voice playback
   */
  private createVoiceResponse(fullResponse: string, phase: string): string {
    // Keep voice responses under 30 seconds (roughly 75 words)
    const words = fullResponse.split(' ');
    if (words.length <= 75) return fullResponse;

    // Extract key parts based on phase
    const sentences = fullResponse.split('. ');
    let voiceResponse = sentences[0];
    
    if (sentences.length > 1 && voiceResponse.split(' ').length < 50) {
      voiceResponse += '. ' + sentences[1];
    }

    return voiceResponse;
  }

  /**
   * Analyze candidate response using AI
   */
  private async analyzeCandidateResponse(
    message: string,
    candidateData: any,
    jobData: any,
    resumeAnalysis: ResumeAnalysisDto | null,
    conversationHistory: any[]
  ): Promise<CandidateAnalysisDto> {
    const analysisPrompt = `Analyze this candidate's response for a recruitment interview:

Candidate Response: "${message}"

Job Requirements: ${JSON.stringify(jobData?.requirements || [])}
Required Skills: ${JSON.stringify(jobData?.skills || [])}
Resume Skills: ${JSON.stringify(resumeAnalysis?.extractedSkills || [])}
Resume Experience: ${JSON.stringify(resumeAnalysis?.experience || [])}
Resume Projects: ${JSON.stringify(resumeAnalysis?.projects || [])}

Provide analysis in this JSON format:
{
  "skillsDetected": ["skill1", "skill2"],
  "fitScore": 85,
  "communicationTone": "confident",
  "recommendedAction": "invite_technical",
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1"],
  "experienceMatch": 80,
  "culturalFit": 75,
  "technicalSkills": ["tech1", "tech2"],
  "softSkills": ["soft1", "soft2"],
  "confidenceLevel": 85,
  "responseQuality": 90
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert recruitment analyst. Provide detailed analysis in valid JSON format only.' },
          { role: 'user', content: analysisPrompt }
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const analysisText = completion.choices[0].message.content || '{}';
      return JSON.parse(analysisText);
    } catch (error) {
      console.error('Error analyzing candidate response:', error);
      // Return default analysis
      return {
        skillsDetected: [],
        fitScore: 50,
        communicationTone: 'professional',
        recommendedAction: 'additional_screening',
        strengths: [],
        concerns: [],
        experienceMatch: 50,
        culturalFit: 50,
        technicalSkills: [],
        softSkills: [],
        confidenceLevel: 50,
        responseQuality: 50
      };
    }
  }

  /**
   * Generate next question based on analysis
   */
  private async generateNextQuestion(
    phase: string,
    analysis: CandidateAnalysisDto,
    jobData: any,
    resumeAnalysis: ResumeAnalysisDto | null
  ): Promise<string> {
    const questionPrompt = `Generate the next interview question based on:

Current Phase: ${phase}
Candidate Analysis: ${JSON.stringify(analysis)}
Job Requirements: ${JSON.stringify(jobData?.requirements || [])}
Resume Skills: ${JSON.stringify(resumeAnalysis?.extractedSkills || [])}
Resume Experience: ${JSON.stringify(resumeAnalysis?.experience || [])}
Resume Projects: ${JSON.stringify(resumeAnalysis?.projects || [])}

Generate one specific, follow-up question that:
1. Builds on their previous response
2. Assesses relevant skills for the role
3. Is appropriate for the current phase
4. Is conversational and engaging

Return only the question text, no additional formatting.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are an expert interviewer. Generate relevant follow-up questions.' },
          { role: 'user', content: questionPrompt }
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      return completion.choices[0].message.content || 'Can you tell me more about that experience?';
    } catch (error) {
      console.error('Error generating next question:', error);
      return 'Can you tell me more about that experience?';
    }
  }

  /**
   * Get conversation history from Redis
   */
  private async getConversationHistory(sessionId: string): Promise<any[]> {
    try {
      const historyJson = await redisClient.get(`recruitment:history:${sessionId}`);
      return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
      console.error('Error retrieving conversation history:', error);
      return [];
    }
  }

  /**
   * Store conversation history in Redis
   */
  private async storeConversationHistory(sessionId: string, history: any[]): Promise<void> {
    try {
      const historyJson = JSON.stringify(history);
      await redisClient.set(`recruitment:history:${sessionId}`, historyJson, { EX: 86400 });
    } catch (error) {
      console.error('Error storing conversation history:', error);
    }
  }

  /**
   * Update interview analysis
   */
  private async updateInterviewAnalysis(sessionId: string, analysis: CandidateAnalysisDto): Promise<void> {
    try {
      await this.prisma.interview.update({
        where: { id: sessionId },
        data: {
          feedback: JSON.stringify(analysis),
          rating: analysis.fitScore
        }
      });
    } catch (error) {
      console.error('Error updating interview analysis:', error);
    }
  }

  /**
   * Map Prisma Interview to DTO
   */
  private mapInterviewToDto(interview: any): InterviewSessionDto {
    return {
      id: interview.id,
      candidateId: interview.candidateId,
      jobId: interview.jobId,
      interviewerId: interview.interviewerId,
      sessionType: interview.type.toLowerCase(),
      status: interview.status.toLowerCase(),
      startTime: interview.scheduledAt,
      endTime: interview.status === 'COMPLETED' ? interview.updatedAt : undefined,
      duration: interview.duration,
      analysis: interview.feedback ? JSON.parse(interview.feedback) : undefined,
      conversationHistory: [],
      overallRating: interview.rating,
      notes: interview.notes,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt
    };
  }
}

export const recruitmentAIService = new RecruitmentAIService();
