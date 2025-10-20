import { Router } from 'express';
import { openaiService } from '../services/openai.service';

const router = Router();

/**
 * Health check endpoint for OpenAI connectivity
 * GET /api/health/openai
 */
router.get('/health/openai', async (req, res) => {
  try {
    console.log('Testing OpenAI connectivity...');
    const healthStatus = await openaiService.testConnection();
    
    if (healthStatus.connected) {
      console.log('OpenAI connection test successful');
      res.status(200).json({
        ...healthStatus,
        timestamp: new Date().toISOString(),
        message: 'OpenAI service is healthy'
      });
    } else {
      console.log('OpenAI connection test failed');
      res.status(503).json({
        ...healthStatus,
        timestamp: new Date().toISOString(),
        message: 'OpenAI service is unhealthy'
      });
    }
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      service: 'OpenAI',
      connected: false,
      apiKeyConfigured: false,
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: (error as Error).message
    });
  }
});

/**
 * General health check endpoint
 * GET /api/health
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'HRMS Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

export default router;