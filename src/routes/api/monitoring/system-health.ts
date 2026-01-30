/**
 * System Health Check API Route
 * 
 * Comprehensive health check for production monitoring.
 * Checks database, Redis, external services, and system resources.
 * 
 * Use this for:
 * - Load balancer health checks
 * - Monitoring dashboards (Datadog, New Relic, etc.)
 * - Alerting systems
 * - Deployment verification
 */

import { createFileRoute } from "@tanstack/react-router";
import { runSystemHealthCheck, type HealthCheckResult } from "~/lib/monitoring/system-health";

export const Route = createFileRoute("/api/monitoring/system-health")({
  server: {
    handlers: {
      /**
       * GET /api/monitoring/system-health
       * 
       * Returns comprehensive system health status
       * 
       * Response codes:
       * - 200: System healthy or degraded (still operational)
       * - 503: System unhealthy (critical failure)
       */
      GET: async () => {
        const startTime = Date.now();

        try {
          const result = await runSystemHealthCheck();

          const responseTime = Date.now() - startTime;

          // Log health check results
          console.log(`[Health Check] Status: ${result.status}, Response time: ${responseTime}ms`);

          // Return 503 if unhealthy, 200 otherwise
          const statusCode = result.status === 'unhealthy' ? 503 : 200;

          return Response.json(result, {
            status: statusCode,
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'X-Response-Time': `${responseTime}ms`,
            },
          });
        } catch (error) {
          console.error('[Health Check] Error:', error);

          return Response.json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            checks: {
              database: { status: 'fail', message: 'Health check failed' },
              redis: { status: 'fail', message: 'Health check failed' },
              memory: { status: 'fail', message: 'Health check failed' },
              disk: { status: 'fail', message: 'Health check failed' },
            },
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            error: error instanceof Error ? error.message : 'Unknown error',
          } as HealthCheckResult & { error: string }, {
            status: 503,
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
        }
      },
    },
  },
});
