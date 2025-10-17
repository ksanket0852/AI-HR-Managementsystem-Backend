import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Prisma Client Configuration
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Redis Client Configuration
export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true, // Don't connect immediately
});

// Database Connection Functions
export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected successfully');
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
    console.log('⚠️  Continuing without database (some features will be limited)');
  }
};

export const connectRedis = async () => {
  try {
    await redis.ping();
    console.log('✅ Redis connected successfully');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    console.log('⚠️  Continuing without Redis (some features may be limited)');
  }
};

// Graceful Shutdown
export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    redis.disconnect();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
};

// Redis Helper Functions
export const redisHelpers = {
  // Session management
  setSession: async (sessionId: string, data: any, ttl: number = 86400) => {
    try {
      await redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
    } catch (error) {
      console.error('Redis setSession error:', error);
    }
  },
  
  getSession: async (sessionId: string) => {
    try {
      const data = await redis.get(`session:${sessionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis getSession error:', error);
      return null;
    }
  },
  
  deleteSession: async (sessionId: string) => {
    try {
      await redis.del(`session:${sessionId}`);
    } catch (error) {
      console.error('Redis deleteSession error:', error);
    }
  },

  // Caching
  setCache: async (key: string, data: any, ttl: number = 3600) => {
    try {
      await redis.setex(`cache:${key}`, ttl, JSON.stringify(data));
    } catch (error) {
      console.error('Redis setCache error:', error);
    }
  },
  
  getCache: async (key: string) => {
    try {
      const data = await redis.get(`cache:${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis getCache error:', error);
      return null;
    }
  },
  
  deleteCache: async (key: string) => {
    try {
      await redis.del(`cache:${key}`);
    } catch (error) {
      console.error('Redis deleteCache error:', error);
    }
  },

  // Real-time notifications
  publishNotification: async (channel: string, data: any) => {
    try {
      await redis.publish(channel, JSON.stringify(data));
    } catch (error) {
      console.error('Redis publishNotification error:', error);
    }
  },

  // Rate limiting
  checkRateLimit: async (key: string, limit: number, window: number) => {
    try {
      const current = await redis.incr(`rate:${key}`);
      if (current === 1) {
        await redis.expire(`rate:${key}`, window);
      }
      return current <= limit;
    } catch (error) {
      console.error('Redis checkRateLimit error:', error);
      return true; // Allow request if Redis is down
    }
  }
}; 