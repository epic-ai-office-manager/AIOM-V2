import { database } from "~/db";
import { sql } from "drizzle-orm";

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
  };
  version: string;
  environment: string;
}

export interface HealthCheck {
  status: 'pass' | 'warn' | 'fail';
  responseTime?: number;
  message?: string;
  details?: Record<string, any>;
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await database.execute(sql`SELECT 1 as health_check`);

    const responseTime = Date.now() - start;

    if (responseTime > 100) {
      return {
        status: 'warn',
        responseTime,
        message: 'Database responding slowly',
      };
    }

    return {
      status: 'pass',
      responseTime,
      message: 'Database connection healthy',
    };
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const redisEnabled = process.env.REDIS_CACHE_ENABLED === 'true';

    if (!redisEnabled) {
      return {
        status: 'pass',
        message: 'Redis disabled (graceful degradation)',
      };
    }

    const { getRedisClient } = await import('~/lib/redis-cache/client');
    const client = getRedisClient();

    if (!client) {
      return {
        status: 'warn',
        message: 'Redis client not initialized (graceful degradation active)',
      };
    }

    const ok = await client.healthCheck();
    if (!ok) {
      return {
        status: 'warn',
        responseTime: Date.now() - start,
        message: 'Redis unavailable (graceful degradation active)',
      };
    }
    const responseTime = Date.now() - start;

    return {
      status: 'pass',
      responseTime,
      message: 'Redis connection healthy',
    };
  } catch (error) {
    return {
      status: 'warn',
      responseTime: Date.now() - start,
      message: 'Redis unavailable (graceful degradation active)',
    };
  }
}

function checkMemory(): HealthCheck {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const heapUsedPercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  if (heapUsedPercent > 80) {
    return {
      status: 'warn',
      message: 'High memory usage',
      details: {
        heapUsedMB,
        heapTotalMB,
        heapUsedPercent,
      },
    };
  }

  return {
    status: 'pass',
    message: 'Memory usage normal',
    details: {
      heapUsedMB,
      heapTotalMB,
      heapUsedPercent,
    },
  };
}

function checkDisk(): HealthCheck {
  return {
    status: 'pass',
    message: 'Disk check not implemented (use monitoring service)',
  };
}

function determineOverallStatus(checks: HealthCheckResult['checks']): HealthCheckResult['status'] {
  const statuses = Object.values(checks).map(c => c.status);

  if (statuses.includes('fail')) {
    return 'unhealthy';
  }

  if (statuses.includes('warn')) {
    return 'degraded';
  }

  return 'healthy';
}

export async function runSystemHealthCheck(): Promise<HealthCheckResult> {
  const [database, redis, memory, disk] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkMemory(),
    Promise.resolve(checkDisk()),
  ]);

  const checks = { database, redis, memory, disk };
  const status = determineOverallStatus(checks);

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  };
}
