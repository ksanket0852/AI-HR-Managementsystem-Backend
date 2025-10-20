import express from "express";
import { openaiService } from "../services/openai.service";

const router = express.Router();

/**
 * Test voice input without authentication
 * POST /api/test/voice/input
 */
router.post('/voice/input', async (req, res) => {
  try {
    console.log('Test voice input received:', {
      audioDataLength: req.body.audioData?.length || 0,
      language: req.body.language,
      format: req.body.format
    });

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

    const voiceData = {
      audioData: req.body.audioData,
      language: req.body.language || 'en',
      format: req.body.format || 'wav'
    };

    console.log('Processing voice input with OpenAI...');
    const response = await openaiService.processVoiceInput(voiceData);
    
    console.log('Voice input processed successfully:', response);
    res.status(200).json(response);
  } catch (error) {
    console.error('Test voice input processing error:', error);
    res.status(400).json({ message: (error as Error).message });
  }
});

/**
 * Test voice generation without authentication
 * POST /api/test/voice/generate
 */
router.post('/voice/generate', async (req, res) => {
  try {
    const { text, voice } = req.body;
    
    if (!text) {
      res.status(400).json({ message: "Text is required for voice generation" });
      return;
    }

    console.log('Generating voice response for text:', text.substring(0, 100) + '...');
    const response = await openaiService.generateVoiceResponse(text, voice);
    
    console.log('Voice response generated successfully');
    res.status(200).json(response);
  } catch (error) {
    console.error('Test voice generation error:', error);
    res.status(400).json({ message: (error as Error).message });
  }
});

export default router;
