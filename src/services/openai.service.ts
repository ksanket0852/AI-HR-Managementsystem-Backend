import OpenAI from 'openai';
import { 
  ChatCompletionRequestDto, 
  ChatCompletionResponseDto,
  CandidateAnalysisDto,
  VoiceProcessingDto,
  VoiceResponseDto
} from '../types/chat.dto';
import { redisClient } from '../config/redis';
import { Pinecone } from '@pinecone-database/pinecone';

class OpenAIService {
  private openai: OpenAI;
  private openaiApiKeyConfigured: boolean = false;
  private pinecone: Pinecone | null = null;
  private indexName: string = 'hr-knowledge-base';
  private namespace: string = 'hr-policies';
  private contextWindowSize = 10; // Number of previous messages to include for context

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openaiApiKeyConfigured = !!process.env.OPENAI_API_KEY;
    
    // Initialize Pinecone if API key is available
    if (process.env.PINECONE_API_KEY) {
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
      console.log('Pinecone initialized for vector search');
    } else {
      console.log('Pinecone API key not found, using mock knowledge base');
    }
  }

  /**
   * Test OpenAI connectivity and API key presence
   */
  async testConnection(): Promise<{ status: string; service: string; connected: boolean; apiKeyConfigured: boolean }> {
    // Quick check: API key configured?
    if (!this.openaiApiKeyConfigured) {
      return { status: 'unhealthy', service: 'OpenAI', connected: false, apiKeyConfigured: false };
    }

    try {
      // Try a lightweight API call: list models (fast and low-cost)
      // Add a short timeout so this health check returns quickly if outbound requests stall
      await Promise.race([
        this.openai.models.list(),
        new Promise((_res, rej) => setTimeout(() => rej(new Error('OpenAI health check timeout')), 5000))
      ]);
      return { status: 'healthy', service: 'OpenAI', connected: true, apiKeyConfigured: true };
    } catch (error) {
      console.error('OpenAI connectivity test failed:', error);
      return { status: 'unhealthy', service: 'OpenAI', connected: false, apiKeyConfigured: true };
    }
  }

  /**
   * Helper: run function with retries and timeout
   */
  private async withRetry<T>(fn: () => Promise<T>, retries = 3, timeoutMs = 30000): Promise<T> {
    let attempt = 0;
    let lastErr: any = null;

    while (attempt <= retries) {
      try {
        console.log(`OpenAI API attempt ${attempt + 1}/${retries + 1} with ${timeoutMs}ms timeout`);
        
        const p = fn();
        const result = await Promise.race([
          p,
          new Promise<never>((_, rej) => 
            setTimeout(() => rej(new Error('Request timeout')), timeoutMs)
          )
        ]);
        
        console.log('OpenAI API call successful');
        return result as T;
        
      } catch (error) {
        lastErr = error;
        attempt++;
        
        const errorMsg = (error as Error).message || '';
        console.warn(`OpenAI call failed (attempt ${attempt}/${retries + 1}):`, errorMsg);
        
        // Don't retry on certain errors
        if (errorMsg.includes('API key') || 
            errorMsg.includes('authentication') ||
            errorMsg.includes('invalid') ||
            errorMsg.includes('quota') ||
            errorMsg.includes('billing')) {
          console.error('Non-retryable error detected:', errorMsg);
          throw error;
        }
        
        // Don't retry on network errors that won't resolve
        if (errorMsg.includes('ECONNRESET') && attempt > 1) {
          console.error('Connection reset error, stopping retries');
          throw new Error('Connection to OpenAI failed. Please check your internet connection.');
        }
        
        const isLastAttempt = attempt > retries;
        if (!isLastAttempt) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`Waiting ${backoffMs}ms before retry...`);
          await new Promise(r => setTimeout(r, backoffMs));
        }
      }
    }

    console.error('All retry attempts exhausted');
    throw lastErr;
  }

  /**
   * Process a chat message and get a response from OpenAI
   */
  async processMessage(request: ChatCompletionRequestDto): Promise<ChatCompletionResponseDto> {
    try {
      // Get conversation history from Redis if sessionId is provided
      let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];
      
      if (request.sessionId) {
        const history = await this.getConversationHistory(request.sessionId);
        conversationHistory = history;
      }

      // Add the current message to the conversation history
      conversationHistory.push({
        role: 'user',
        content: request.message
      });

      // Get relevant knowledge base entries
      const relevantKnowledge = await this.getRelevantKnowledgeBase(request.message);
      
      // Create the system message with HR knowledge
      const systemMessage = {
        role: 'system',
        content: `You are an AI HR assistant for a company. Your goal is to help employees with HR-related questions and issues.
        Be professional, helpful, and concise in your responses. If you don't know the answer to a specific question, 
        direct the user to contact the HR department. Here is some relevant information from the company's HR knowledge base:
        ${relevantKnowledge}`
      };

      // Create the messages array for the API call
      const messages = [
        systemMessage,
        ...conversationHistory.slice(-this.contextWindowSize) // Limit context window
      ];

      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages as any,
        max_tokens: 500,
        temperature: 0.7,
      });

      // Get the response
      const responseMessage = completion.choices[0].message.content || 'I apologize, but I couldn\'t generate a response.';

      // Add the assistant's response to the conversation history
      conversationHistory.push({
        role: 'assistant',
        content: responseMessage
      });

      // Store the updated conversation history in Redis if sessionId is provided
      if (request.sessionId) {
        await this.storeConversationHistory(request.sessionId, conversationHistory);
      }

      return {
        message: responseMessage,
        sessionId: request.sessionId || 'new-session',
        textResponse: responseMessage,
        voiceResponse: this.createVoiceResponse(responseMessage)
      };
    } catch (error) {
      console.error('Error processing message with OpenAI:', error);
      
      // Provide a fallback response when OpenAI fails
      const fallbackResponse = "I apologize, but I'm currently experiencing technical difficulties. Please try again later or contact the HR department directly for assistance.";
      
      return {
        message: fallbackResponse,
        sessionId: request.sessionId || 'new-session',
        textResponse: fallbackResponse,
        voiceResponse: this.createVoiceResponse(fallbackResponse)
      };
    }
  }

  /**
   * Create shorter response for voice playback
   */
  private createVoiceResponse(fullResponse: string): string {
    // Keep voice responses under 30 seconds (roughly 75 words)
    const words = fullResponse.split(' ');
    if (words.length <= 75) return fullResponse;

    // Extract key parts
    const sentences = fullResponse.split('. ');
    let voiceResponse = sentences[0];
    
    if (sentences.length > 1 && voiceResponse.split(' ').length < 50) {
      voiceResponse += '. ' + sentences[1];
    }

    return voiceResponse;
  }

  /**
   * Get conversation history from Redis
   */
  private async getConversationHistory(sessionId: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    try {
      // Check if Redis is available
      if (!redisClient.isOpen) {
        console.log('Redis not available, using empty conversation history');
        return [];
      }
      
      const historyJson = await redisClient.get(`chat:history:${sessionId}`);
      
      if (historyJson) {
        return JSON.parse(historyJson);
      }
      
      return [];
    } catch (error) {
      console.error('Error retrieving conversation history from Redis:', error);
      return [];
    }
  }

  /**
   * Store conversation history in Redis with an expiration time (24 hours)
   */
  private async storeConversationHistory(
    sessionId: string, 
    history: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<void> {
    try {
      // Check if Redis is available
      if (!redisClient.isOpen) {
        console.log('Redis not available, skipping conversation history storage');
        return;
      }
      
      const historyJson = JSON.stringify(history);
      // Store with 24-hour expiration (86400 seconds)
      await redisClient.set(`chat:history:${sessionId}`, historyJson, {
        EX: 86400
      });
    } catch (error) {
      console.error('Error storing conversation history in Redis:', error);
    }
  }

  /**
   * Get relevant knowledge base entries based on the user's message using vector search
   */
  private async getRelevantKnowledgeBase(message: string): Promise<string> {
    try {
      // If Pinecone is not initialized, return mock data
      if (!this.pinecone) {
        console.log('Pinecone not initialized, using mock knowledge base');
        return this.getMockKnowledgeBase();
      }

      // Get the index
      const index = this.pinecone.index(this.indexName);
      
      // Search the index using integrated embedding
      const searchResponse = await index.searchRecords({
        query: {
          topK: 5,
          inputs: { text: message }
        },
        fields: ['content', 'title', 'category']
      });
      
      // Extract and format the relevant knowledge
      const relevantPolicies = searchResponse.result?.hits
        .filter(hit => hit._score && hit._score > 0.7) // Only include relevant matches
        .map(hit => {
          const fields = hit.fields as { content: string, title: string };
          return fields.content;
        }) || [];

      if (relevantPolicies.length === 0) {
        console.log('No relevant policies found, using mock knowledge base');
        return this.getMockKnowledgeBase();
      }

      return relevantPolicies.join('\n\n');
    } catch (error) {
      console.error('Error retrieving knowledge base entries:', error);
      console.log('Falling back to mock knowledge base due to error');
      return this.getMockKnowledgeBase();
    }
  }

  /**
   * Get mock HR knowledge base data when vector search is unavailable
   */
  private getMockKnowledgeBase(): string {
    const hrPolicies = [
      "Vacation Policy: Employees are entitled to 20 days of paid vacation per year.",
      "Sick Leave: Employees can take up to 10 paid sick days per year.",
      "Remote Work: Employees can work remotely up to 2 days per week with manager approval.",
      "Parental Leave: New parents are entitled to 12 weeks of paid leave.",
      "Healthcare Benefits: The company provides comprehensive health insurance to all full-time employees."
    ];

    return hrPolicies.join('\n\n');
  }
/**
 * Process voice input with offline fallback
 */
async processVoiceInput(voiceData: VoiceProcessingDto): Promise<VoiceResponseDto> {
  // First check network connectivity
  const hasNetwork = await this.checkNetworkConnectivity();
  
  if (!hasNetwork) {
    console.warn('No network connectivity detected, using offline mode');
    return {
      text: '[Network Error: Unable to process voice input. Please check your internet connection and try again.]',
      confidence: 0
    };
  }

  let tempFilePath: string | null = null;
  
  try {
    console.log('Starting voice input processing:', {
      audioDataLength: voiceData.audioData.length,
      language: voiceData.language,
      format: voiceData.format
    });

    const audioBuffer = Buffer.from(voiceData.audioData, 'base64');
    console.log('Audio buffer created, size:', audioBuffer.length);

    const MAX_SIZE = 25 * 1024 * 1024;
    if (audioBuffer.length > MAX_SIZE) {
      throw new Error(`Audio file too large: ${audioBuffer.length} bytes (max ${MAX_SIZE})`);
    }

    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const tempDir = os.tmpdir();
    const format = voiceData.format || 'wav';
    tempFilePath = path.join(tempDir, `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${format}`);
    
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    const stats = fs.statSync(tempFilePath);
    console.log('File stats:', { size: stats.size });
    
    if (stats.size === 0) {
      throw new Error('Written file is empty');
    }
    
    console.log('Calling OpenAI Whisper API...');
    
    const transcription: any = await this.withRetry(async () => {
      const fileStream = fs.createReadStream(tempFilePath);
      
      return await this.openai.audio.transcriptions.create({
        file: fileStream,
        model: 'gpt-4o-mini-transcribe', // Using newer model for better quality
        language: voiceData.language || 'en',
        response_format: 'json',
        prompt: 'This is a conversation with an AI HR assistant. The user is asking questions about HR policies, benefits, or general workplace information.'
      });
    }, 3, 60000);

    console.log('OpenAI transcription completed:', transcription?.text);

    if (!transcription || !transcription.text) {
      throw new Error('No transcription text returned from Whisper API');
    }

    return {
      text: transcription.text,
      confidence: 95
    };
    
  } catch (error) {
    console.error('Error processing voice input:', error);
    
    const errorMsg = (error as Error).message;
    
    // Check for network-related errors
    if (errorMsg.includes('ECONNRESET') || 
        errorMsg.includes('ENOTFOUND') || 
        errorMsg.includes('ETIMEDOUT') ||
        errorMsg.includes('EAI_AGAIN') ||
        errorMsg.includes('Connection error')) {
      
      throw new Error('Network connection failed. Please check your internet connection and try again. If the problem persists, contact your network administrator.');
    }
    
    if (errorMsg.includes('timeout')) {
      throw new Error('Request timed out. Your internet connection may be too slow or unstable. Try with a shorter audio clip.');
    } else if (errorMsg.includes('too large')) {
      throw new Error(errorMsg);
    } else if (errorMsg.includes('API key')) {
      throw new Error('OpenAI API authentication failed. Please check your API key configuration.');
    }
    
    throw new Error(`Failed to process voice input: ${errorMsg}`);
    
  } finally {
    if (tempFilePath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log('Temporary file cleaned up');
        }
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary file:', cleanupError);
      }
    }
  }
}

/**
 * Check network connectivity before making API calls
 */
private async checkNetworkConnectivity(): Promise<boolean> {
  try {
    const dns = require('dns').promises;
    
    // Try to resolve a reliable hostname
    await Promise.race([
      dns.resolve('api.openai.com'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('DNS timeout')), 5000)
      )
    ]);
    
    return true;
  } catch (error) {
    console.error('Network connectivity check failed:', error);
    return false;
  }
}

  /**
   * Generate voice response using TTS API
   */
  async generateVoiceResponse(text: string, voice: string = 'alloy'): Promise<VoiceResponseDto> {
    try {
      console.log('Generating voice response for text:', text.substring(0, 100) + '...');
      
      // Use OpenAI TTS for text-to-speech with retries
      const mp3: any = await this.withRetry(async () => {
        return await this.openai.audio.speech.create({
          model: 'tts-1',
          voice: voice as any, // 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
          input: text,
          response_format: 'mp3'
        });
      }, 2, 30000);

      const buffer = Buffer.from(await mp3.arrayBuffer());
      const audioBase64 = buffer.toString('base64');

      console.log('Voice response generated successfully, size:', buffer.length);

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
   * Analyze candidate response for recruitment purposes
   */
  async analyzeCandidateResponse(
    message: string,
    jobRequirements: any,
    resumeData: any,
    conversationContext: any[]
  ): Promise<CandidateAnalysisDto> {
    const analysisPrompt = `Analyze this candidate's response for a recruitment interview:

Candidate Response: "${message}"

Job Requirements: ${JSON.stringify(jobRequirements || [])}
Resume Skills: ${JSON.stringify(resumeData?.skills || [])}
Conversation Context: ${conversationContext.length} previous exchanges

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
}

Communication tone options: confident, nervous, professional, casual, enthusiastic
Recommended action options: invite_technical, invite_hr, schedule_final, reject, additional_screening`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert recruitment analyst. Analyze candidate responses objectively and provide detailed analysis in valid JSON format only. Focus on skills, communication, and cultural fit.' 
          },
          { role: 'user', content: analysisPrompt }
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const analysisText = completion.choices[0].message.content || '{}';
      const analysis = JSON.parse(analysisText);
      
      // Validate and ensure all required fields are present
      return {
        skillsDetected: analysis.skillsDetected || [],
        fitScore: Math.max(0, Math.min(100, analysis.fitScore || 50)),
        communicationTone: analysis.communicationTone || 'professional',
        recommendedAction: analysis.recommendedAction || 'additional_screening',
        strengths: analysis.strengths || [],
        concerns: analysis.concerns || [],
        experienceMatch: Math.max(0, Math.min(100, analysis.experienceMatch || 50)),
        culturalFit: Math.max(0, Math.min(100, analysis.culturalFit || 50)),
        technicalSkills: analysis.technicalSkills || [],
        softSkills: analysis.softSkills || [],
        confidenceLevel: Math.max(0, Math.min(100, analysis.confidenceLevel || 50)),
        responseQuality: Math.max(0, Math.min(100, analysis.responseQuality || 50))
      };
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
   * Generate recruitment-specific questions
   */
  async generateRecruitmentQuestion(
    phase: string,
    jobData: any,
    resumeData: any,
    previousQuestions: string[]
  ): Promise<string> {
    const questionPrompt = `Generate an interview question for a recruitment conversation:

Current Phase: ${phase}
Job Title: ${jobData?.title || 'Software Developer'}
Job Requirements: ${JSON.stringify(jobData?.requirements || [])}
Required Skills: ${JSON.stringify(jobData?.skills || [])}
Resume Skills: ${JSON.stringify(resumeData?.skills || [])}
Previous Questions Asked: ${previousQuestions.join(', ')}

Phase Guidelines:
- Greeting: Welcome, confirm role, set expectations
- Experience: Deep dive into relevant work experience
- Skills: Assess technical and soft skills
- Behavioral: Situational and behavioral questions
- Closing: Summarize, next steps, answer candidate questions

Generate one specific, engaging question that:
1. Is appropriate for the current phase
2. Builds on their resume and the job requirements
3. Hasn't been asked before
4. Is conversational and natural
5. Helps assess their fit for the role

Return only the question text, no additional formatting.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert interviewer. Generate relevant, engaging interview questions that help assess candidate fit.' 
          },
          { role: 'user', content: questionPrompt }
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      return completion.choices[0].message.content || 'Can you tell me more about your experience with this technology?';
    } catch (error) {
      console.error('Error generating recruitment question:', error);
      return 'Can you tell me more about your experience with this technology?';
    }
  }

  /**
   * Generate recruitment conversation summary
   */
  async generateConversationSummary(
    conversationHistory: any[],
    candidateAnalysis: CandidateAnalysisDto,
    jobData: any
  ): Promise<string> {
    const summaryPrompt = `Generate a comprehensive summary of this recruitment interview:

Conversation History: ${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
Candidate Analysis: ${JSON.stringify(candidateAnalysis)}
Job Requirements: ${JSON.stringify(jobData?.requirements || [])}

Create a professional summary that includes:
1. Candidate overview and key qualifications
2. Technical skills assessment
3. Soft skills and communication evaluation
4. Cultural fit assessment
5. Overall recommendation
6. Next steps

Format as a structured report suitable for HR review.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert HR professional. Generate comprehensive, professional interview summaries.' 
          },
          { role: 'user', content: summaryPrompt }
        ],
        max_tokens: 800,
        temperature: 0.5,
      });

      return completion.choices[0].message.content || 'Interview summary could not be generated.';
    } catch (error) {
      console.error('Error generating conversation summary:', error);
      return 'Interview summary could not be generated due to technical issues.';
    }
  }
}

export const openaiService = new OpenAIService(); 