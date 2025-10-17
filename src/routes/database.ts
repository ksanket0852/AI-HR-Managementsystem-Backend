import { Router } from 'express';
import { prisma, redis } from '../config/database';

const router = Router();

// Database Status Endpoint
router.get('/status', async (req, res) => {
  try {
    const dbStatus = {
      postgresql: {
        connected: false,
        error: null as string | null,
      },
      redis: {
        connected: false,
        error: null as string | null,
      },
      timestamp: new Date().toISOString(),
    };

    // Test PostgreSQL connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus.postgresql.connected = true;
    } catch (error) {
      dbStatus.postgresql.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Test Redis connection
    try {
      await redis.ping();
      dbStatus.redis.connected = true;
    } catch (error) {
      dbStatus.redis.error = error instanceof Error ? error.message : 'Unknown error';
    }

    res.json({
      success: true,
      message: 'Database status check completed',
      data: dbStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to check database status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

// Database Info Endpoint
router.get('/info', async (req, res) => {
  try {
    const info = {
      tables: [] as string[],
      counts: {} as Record<string, number>,
    };

    // Get table information (this is a simplified version)
    try {
      const userCount = await prisma.user.count();
      const employeeCount = await prisma.employee.count();
      const departmentCount = await prisma.department.count();
      const leaveTypeCount = await prisma.leaveType.count();

      info.counts = {
        users: userCount,
        employees: employeeCount,
        departments: departmentCount,
        leaveTypes: leaveTypeCount,
      };

      info.tables = ['users', 'employees', 'departments', 'leave_types', 'leaves', 'attendances', 'payrolls'];
    } catch (error) {
      console.error('Database info error:', error);
    }

    res.json({
      success: true,
      message: 'Database information retrieved',
      data: info,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get database info',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export default router; 