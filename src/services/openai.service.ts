import OpenAI from 'openai';
import { ChatCompletionRequestDto, ChatCompletionResponseDto } from '../types/chat.dto';
import { redisClient } from '../config/redis';
import { Pinecone } from '@pinecone-database/pinecone';

class OpenAIService {
  private openai: OpenAI;
  private pinecone: Pinecone | null = null;
  private indexName: string = 'hr-knowledge-base';
  private namespace: string = 'hr-policies';
  private contextWindowSize = 10; // Number of previous messages to include for context

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
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
        model: 'gpt-4-turbo',
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
        sessionId: request.sessionId || 'new-session'
      };
    } catch (error) {
      console.error('Error processing message with OpenAI:', error);
      throw new Error(`Failed to process message: ${(error as Error).message}`);
    }
  }

  /**
   * Get conversation history from Redis
   */
  private async getConversationHistory(sessionId: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    try {
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
        return this.getMockKnowledgeBase();
      }

      return relevantPolicies.join('\n\n');
    } catch (error) {
      console.error('Error retrieving knowledge base entries:', error);
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
}

export const openaiService = new OpenAIService(); 