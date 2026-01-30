/**
 * Anomaly Detection Server Functions
 *
 * Server functions for anomaly detection API:
 * - Get anomaly alerts with filters
 * - Acknowledge, resolve, dismiss alerts
 * - Get detection statistics
 * - Manage detection rules
 * - Run detection analysis
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticatedMiddleware, assertAdminMiddleware } from "./middleware";
import { nanoid } from "nanoid";
import {
  findAnomalyAlerts,
  findAnomalyAlertById,
  createAnomalyAlert,
  acknowledgeAnomalyAlert,
  resolveAnomalyAlert,
  dismissAnomalyAlert,
  confirmAnomalyAlert,
  findUnresolvedAlerts,
  getAnomalyAlertStats,
  getAnomalyTrend,
  findDetectionRules,
  findDetectionRuleById,
  createDetectionRule,
  updateDetectionRule,
  deleteDetectionRule,
  setDetectionRuleEnabled,
  findRecentDetectionRuns,
  findMetricDataPoints,
  createMetricDataPoint,
  type AnomalyAlertFilters,
} from "~/data-access/anomaly-detection";
import {
  getAnomalyDetectionService,
} from "~/lib/anomaly-detection-service/service";
import type {
  AnomalyCategory,
  AnomalySeverity,
  AnomalyStatus,
  AnomalyAlgorithm,
} from "~/lib/anomaly-detection-service/types";
import {
  ANOMALY_CATEGORIES,
  ANOMALY_SEVERITIES,
  ANOMALY_STATUSES,
  ANOMALY_ALGORITHMS,
} from "~/lib/anomaly-detection-service/types";

// =============================================================================
// Validation Schemas
// =============================================================================

const alertFiltersSchema = z.object({
  category: z.enum(ANOMALY_CATEGORIES as unknown as [string, ...string[]]).optional(),
  severity: z.enum(ANOMALY_SEVERITIES as unknown as [string, ...string[]]).optional(),
  status: z.enum(ANOMALY_STATUSES as unknown as [string, ...string[]]).optional(),
  userId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
});

const detectionRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.enum(ANOMALY_CATEGORIES as unknown as [string, ...string[]]),
  algorithm: z.enum(ANOMALY_ALGORITHMS as unknown as [string, ...string[]]),
  enabled: z.boolean().optional().default(true),
  warningThreshold: z.number().min(0),
  criticalThreshold: z.number().min(0),
  parameters: z.string().optional(), // JSON string
  checkIntervalMinutes: z.number().min(1).max(1440).optional().default(15),
  notifyOnSeverity: z.string().optional(), // JSON array
  recipientUserIds: z.string().optional(), // JSON array
});

const analyzeValueSchema = z.object({
  value: z.number(),
  category: z.enum(ANOMALY_CATEGORIES as unknown as [string, ...string[]]),
  metric: z.string().min(1, "Metric name is required"),
  algorithm: z.enum(ANOMALY_ALGORITHMS as unknown as [string, ...string[]]).optional(),
  entityId: z.string().optional(),
  entityType: z.string().optional(),
  historicalDays: z.number().min(1).max(365).optional().default(30),
});

// =============================================================================
// Alert Server Functions
// =============================================================================

/**
 * Get anomaly alerts with optional filters
 */
export const getAnomalyAlertsFn = createServerFn({
  method: "GET",
})
  .inputValidator(alertFiltersSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const filters: AnomalyAlertFilters = {
      category: data.category,
      severity: data.severity,
      status: data.status,
      userId: data.userId,
      entityType: data.entityType,
      entityId: data.entityId,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    };

    const alerts = await findAnomalyAlerts(filters, data.limit, data.offset);
    return alerts;
  });

/**
 * Get a single anomaly alert by ID
 */
export const getAnomalyAlertFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ alertId: z.string().min(1) }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const alert = await findAnomalyAlertById(data.alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }
    return alert;
  });

/**
 * Get unresolved anomaly alerts
 */
export const getUnresolvedAlertsFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ limit: z.number().min(1).max(100).optional().default(50) }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    return await findUnresolvedAlerts(data.limit);
  });

/**
 * Acknowledge an anomaly alert
 */
export const acknowledgeAlertFn = createServerFn({
  method: "POST",
})
  .inputValidator(z.object({ alertId: z.string().min(1) }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const updated = await acknowledgeAnomalyAlert(data.alertId, context.userId);
    if (!updated) {
      throw new Error("Failed to acknowledge alert");
    }
    return updated;
  });

/**
 * Resolve an anomaly alert
 */
export const resolveAlertFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      alertId: z.string().min(1),
      findings: z.string().optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const updated = await resolveAnomalyAlert(
      data.alertId,
      context.userId,
      data.findings
    );
    if (!updated) {
      throw new Error("Failed to resolve alert");
    }
    return updated;
  });

/**
 * Dismiss an anomaly alert as false positive
 */
export const dismissAlertFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      alertId: z.string().min(1),
      reason: z.string().min(1, "Reason is required"),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const updated = await dismissAnomalyAlert(
      data.alertId,
      context.userId,
      data.reason
    );
    if (!updated) {
      throw new Error("Failed to dismiss alert");
    }
    return updated;
  });

/**
 * Confirm an anomaly alert as a true anomaly
 */
export const confirmAlertFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      alertId: z.string().min(1),
      notes: z.string().optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const updated = await confirmAnomalyAlert(data.alertId, data.notes);
    if (!updated) {
      throw new Error("Failed to confirm alert");
    }
    return updated;
  });

// =============================================================================
// Statistics Server Functions
// =============================================================================

/**
 * Get anomaly detection statistics
 */
export const getAnomalyStatsFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async () => {
    const [dbStats, trend] = await Promise.all([
      getAnomalyAlertStats(),
      getAnomalyTrend(7),
    ]);

    const service = getAnomalyDetectionService();
    const serviceStats = service.getStats();

    return {
      database: dbStats,
      service: {
        isRunning: serviceStats.isRunning,
        lastRunAt: serviceStats.lastRunAt?.toISOString(),
        lastRunDuration: serviceStats.lastRunDuration,
        totalAnomaliesDetected: serviceStats.totalAnomaliesDetected,
        totalAlertsActive: serviceStats.totalAlertsActive,
      },
      trend,
    };
  });

/**
 * Get anomaly trend for chart
 */
export const getAnomalyTrendFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ days: z.number().min(1).max(90).optional().default(30) }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    return await getAnomalyTrend(data.days);
  });

// =============================================================================
// Detection Rules Server Functions
// =============================================================================

/**
 * Get detection rules
 */
export const getDetectionRulesFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      category: z.enum(ANOMALY_CATEGORIES as unknown as [string, ...string[]]).optional(),
      algorithm: z.enum(ANOMALY_ALGORITHMS as unknown as [string, ...string[]]).optional(),
      enabled: z.boolean().optional(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    return await findDetectionRules(
      {
        category: data.category,
        algorithm: data.algorithm,
        enabled: data.enabled,
      },
      data.limit,
      data.offset
    );
  });

/**
 * Get a single detection rule
 */
export const getDetectionRuleFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ ruleId: z.string().min(1) }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const rule = await findDetectionRuleById(data.ruleId);
    if (!rule) {
      throw new Error("Detection rule not found");
    }
    return rule;
  });

/**
 * Create a new detection rule (admin only)
 */
export const createDetectionRuleFn = createServerFn({
  method: "POST",
})
  .inputValidator(detectionRuleSchema)
  .middleware([assertAdminMiddleware])
  .handler(async ({ data, context }) => {
    const rule = await createDetectionRule({
      id: `dr_${nanoid()}`,
      ...data,
      createdById: context.userId,
    });
    return rule;
  });

/**
 * Update a detection rule (admin only)
 */
export const updateDetectionRuleFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      ruleId: z.string().min(1),
      updates: detectionRuleSchema.partial(),
    })
  )
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const updated = await updateDetectionRule(data.ruleId, data.updates);
    if (!updated) {
      throw new Error("Failed to update detection rule");
    }
    return updated;
  });

/**
 * Delete a detection rule (admin only)
 */
export const deleteDetectionRuleFn = createServerFn({
  method: "POST",
})
  .inputValidator(z.object({ ruleId: z.string().min(1) }))
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const deleted = await deleteDetectionRule(data.ruleId);
    if (!deleted) {
      throw new Error("Failed to delete detection rule");
    }
    return { success: true };
  });

/**
 * Enable or disable a detection rule (admin only)
 */
export const toggleDetectionRuleFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      ruleId: z.string().min(1),
      enabled: z.boolean(),
    })
  )
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const updated = await setDetectionRuleEnabled(data.ruleId, data.enabled);
    if (!updated) {
      throw new Error("Failed to toggle detection rule");
    }
    return updated;
  });

// =============================================================================
// Detection Runs Server Functions
// =============================================================================

/**
 * Get recent detection runs
 */
export const getDetectionRunsFn = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ limit: z.number().min(1).max(100).optional().default(20) }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    return await findRecentDetectionRuns(data.limit);
  });

// =============================================================================
// Analysis Server Functions
// =============================================================================

/**
 * Analyze a value for anomaly detection
 */
export const analyzeValueFn = createServerFn({
  method: "POST",
})
  .inputValidator(analyzeValueSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    // Get historical data points
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - data.historicalDays);

    const historicalData = await findMetricDataPoints(
      data.category,
      data.metric,
      startDate,
      endDate,
      data.entityType,
      data.entityId
    );

    // Convert to DataPoint format
    const dataPoints = historicalData.map((p) => ({
      timestamp: p.timestamp,
      value: p.value,
      metadata: p.metadata ? JSON.parse(p.metadata) : undefined,
    }));

    // Run analysis
    const service = getAnomalyDetectionService();
    const result = service.analyzeValue(data.value, dataPoints, {
      category: data.category as AnomalyCategory,
      metric: data.metric,
      algorithm: data.algorithm as AnomalyAlgorithm | undefined,
      entityId: data.entityId,
      entityType: data.entityType,
      userId: context.userId,
    });

    if (result) {
      // Create alert in database
      const alert = await createAnomalyAlert({
        id: result.id,
        algorithm: result.algorithm,
        category: result.category,
        severity: result.severity,
        status: "detected",
        anomalyScore: result.score,
        confidenceScore: result.confidence,
        title: result.title,
        description: result.description,
        metric: result.metric,
        observedValue: result.observedValue,
        expectedValue: result.expectedValue,
        deviation: result.deviation,
        statisticalContext: JSON.stringify(result.statisticalContext),
        entityId: result.entityId,
        entityType: result.entityType,
        userId: result.userId,
        suggestedActions: JSON.stringify(result.suggestedActions),
        relatedDataPoints: JSON.stringify(result.relatedDataPoints),
        detectedAt: result.detectedAt,
      });

      return {
        isAnomaly: true as const,
        result: result as any,
        alertId: alert.id,
      };
    }

    return {
      isAnomaly: false,
      result: null,
      alertId: null,
    };
  });

/**
 * Record a metric data point
 */
export const recordMetricDataPointFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    z.object({
      category: z.enum(ANOMALY_CATEGORIES as unknown as [string, ...string[]]),
      metricName: z.string().min(1),
      value: z.number(),
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      metadata: z.string().optional(), // JSON string
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const dataPoint = await createMetricDataPoint({
      id: `mdp_${nanoid()}`,
      category: data.category,
      metricName: data.metricName,
      value: data.value,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata,
      timestamp: new Date(),
    });
    return dataPoint;
  });

/**
 * Get service configuration
 */
export const getAnomalyConfigFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async () => {
    const service = getAnomalyDetectionService();
    return service.getConfig();
  });

/**
 * Get available categories, severities, and algorithms
 */
export const getAnomalyEnumsFn = createServerFn({
  method: "GET",
})
  .middleware([authenticatedMiddleware])
  .handler(async () => {
    return {
      categories: [...ANOMALY_CATEGORIES],
      severities: [...ANOMALY_SEVERITIES],
      statuses: [...ANOMALY_STATUSES],
      algorithms: [...ANOMALY_ALGORITHMS],
    };
  });
