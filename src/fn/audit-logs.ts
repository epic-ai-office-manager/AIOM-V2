import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticatedMiddleware, assertAdminMiddleware } from "./middleware";
import {
  getAuditLogs,
  getAuditLogsWithActors,
  getAuditLogById,
  getAuditLogWithActor,
  getAuditLogCount,
  getResourceAuditLogs,
  getActorAuditLogs,
  getAuditLogsByCategory,
  getSecurityAuditLogs,
  getFailedActions,
  getAuditLogStats,
  parseAuditLogFields,
} from "~/data-access/audit-logging";
import type {
  AuditLogCategory,
  AuditSeverity,
  AuditActorType,
} from "~/db/schema";

// =============================================================================
// Constants and Types
// =============================================================================

export const AUDIT_LOG_CATEGORIES: AuditLogCategory[] = [
  "authentication",
  "authorization",
  "user_management",
  "resource_access",
  "financial",
  "approval",
  "configuration",
  "security",
  "integration",
  "system",
];

export const AUDIT_SEVERITIES: AuditSeverity[] = ["info", "warning", "critical"];

export const AUDIT_ACTOR_TYPES: AuditActorType[] = [
  "user",
  "admin",
  "system",
  "api",
  "scheduler",
  "webhook",
];

// =============================================================================
// Validation Schemas
// =============================================================================

const auditLogFiltersSchema = z.object({
  action: z.string().optional(),
  category: z.enum([
    "authentication",
    "authorization",
    "user_management",
    "resource_access",
    "financial",
    "approval",
    "configuration",
    "security",
    "integration",
    "system",
  ]).optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  actorId: z.string().optional(),
  actorType: z.enum(["user", "admin", "system", "api", "scheduler", "webhook"]).optional(),
  ipAddress: z.string().optional(),
  sessionId: z.string().optional(),
  success: z.boolean().optional(),
  startDate: z.string().transform((val) => new Date(val)).optional(),
  endDate: z.string().transform((val) => new Date(val)).optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

// =============================================================================
// Query Functions (Authenticated Users)
// =============================================================================

/**
 * Get a single audit log entry by ID
 */
export const getAuditLogByIdFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().min(1, "Audit log ID is required") }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const log = await getAuditLogWithActor(data.id);
    if (!log) {
      throw new Error("Audit log entry not found");
    }
    return {
      ...log,
      parsedFields: parseAuditLogFields(log),
    };
  });

/**
 * Get audit logs for the current user (their own activity)
 */
export const getMyAuditLogsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      category: z.enum([
        "authentication",
        "authorization",
        "user_management",
        "resource_access",
        "financial",
        "approval",
        "configuration",
        "security",
        "integration",
        "system",
      ]).optional(),
      startDate: z.string().transform((val) => new Date(val)).optional(),
      endDate: z.string().transform((val) => new Date(val)).optional(),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().nonnegative().default(0),
    }).optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const logs = await getActorAuditLogs(context.userId, {
      limit: data?.limit ?? 50,
      offset: data?.offset ?? 0,
      startDate: data?.startDate,
      endDate: data?.endDate,
      category: data?.category,
    });
    return logs;
  });

/**
 * Get audit logs for a specific resource (e.g., all logs for an expense voucher)
 */
export const getResourceAuditLogsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      resourceType: z.string().min(1, "Resource type is required"),
      resourceId: z.string().min(1, "Resource ID is required"),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().nonnegative().default(0),
      startDate: z.string().transform((val) => new Date(val)).optional(),
      endDate: z.string().transform((val) => new Date(val)).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const logs = await getResourceAuditLogs(data.resourceType, data.resourceId, {
      limit: data.limit,
      offset: data.offset,
      startDate: data.startDate,
      endDate: data.endDate,
    });
    return logs;
  });

// =============================================================================
// Admin Query Functions
// =============================================================================

/**
 * Get all audit logs with filters (admin only)
 */
export const getAuditLogsFn = createServerFn({ method: "GET" })
  .inputValidator(auditLogFiltersSchema.optional())
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const filters = data || {};
    const logs = await getAuditLogsWithActors(filters);
    return logs;
  });

/**
 * Get audit log count with filters (admin only)
 */
export const getAuditLogsCountFn = createServerFn({ method: "GET" })
  .inputValidator(auditLogFiltersSchema.optional())
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const filters = data || {};
    const count = await getAuditLogCount(filters);
    return { count };
  });

/**
 * Get audit logs by category (admin only)
 */
export const getAuditLogsByCategoryFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      category: z.enum([
        "authentication",
        "authorization",
        "user_management",
        "resource_access",
        "financial",
        "approval",
        "configuration",
        "security",
        "integration",
        "system",
      ]),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().nonnegative().default(0),
      startDate: z.string().transform((val) => new Date(val)).optional(),
      endDate: z.string().transform((val) => new Date(val)).optional(),
    })
  )
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const logs = await getAuditLogsByCategory(data.category, {
      limit: data.limit,
      offset: data.offset,
      startDate: data.startDate,
      endDate: data.endDate,
    });
    return logs;
  });

/**
 * Get security-related audit logs (admin only)
 */
export const getSecurityAuditLogsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().nonnegative().default(0),
      startDate: z.string().transform((val) => new Date(val)).optional(),
      endDate: z.string().transform((val) => new Date(val)).optional(),
      ipAddress: z.string().optional(),
    }).optional()
  )
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const logs = await getSecurityAuditLogs({
      limit: data?.limit ?? 50,
      offset: data?.offset ?? 0,
      startDate: data?.startDate,
      endDate: data?.endDate,
      ipAddress: data?.ipAddress,
    });
    return logs;
  });

/**
 * Get failed actions (admin only)
 */
export const getFailedActionsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      category: z.enum([
        "authentication",
        "authorization",
        "user_management",
        "resource_access",
        "financial",
        "approval",
        "configuration",
        "security",
        "integration",
        "system",
      ]).optional(),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().nonnegative().default(0),
      startDate: z.string().transform((val) => new Date(val)).optional(),
      endDate: z.string().transform((val) => new Date(val)).optional(),
    }).optional()
  )
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const logs = await getFailedActions({
      limit: data?.limit ?? 50,
      offset: data?.offset ?? 0,
      startDate: data?.startDate,
      endDate: data?.endDate,
      category: data?.category,
    });
    return logs;
  });

/**
 * Get audit log statistics (admin only)
 */
export const getAuditLogStatsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      startDate: z.string().transform((val) => new Date(val)).optional(),
      endDate: z.string().transform((val) => new Date(val)).optional(),
      actorId: z.string().optional(),
      resourceType: z.string().optional(),
    }).optional()
  )
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const filters = data || {};
    const stats = await getAuditLogStats({
      startDate: filters.startDate,
      endDate: filters.endDate,
      actorId: filters.actorId,
      resourceType: filters.resourceType,
    });
    return stats;
  });

/**
 * Get audit logs for a specific user (admin only)
 */
export const getUserAuditLogsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      userId: z.string().min(1, "User ID is required"),
      category: z.enum([
        "authentication",
        "authorization",
        "user_management",
        "resource_access",
        "financial",
        "approval",
        "configuration",
        "security",
        "integration",
        "system",
      ]).optional(),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().nonnegative().default(0),
      startDate: z.string().transform((val) => new Date(val)).optional(),
      endDate: z.string().transform((val) => new Date(val)).optional(),
    })
  )
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    const logs = await getActorAuditLogs(data.userId, {
      limit: data.limit,
      offset: data.offset,
      startDate: data.startDate,
      endDate: data.endDate,
      category: data.category,
    });
    return logs;
  });

/**
 * Export audit logs (admin only) - returns data for export
 */
export const exportAuditLogsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      startDate: z.string().transform((val) => new Date(val)),
      endDate: z.string().transform((val) => new Date(val)),
      category: z.enum([
        "authentication",
        "authorization",
        "user_management",
        "resource_access",
        "financial",
        "approval",
        "configuration",
        "security",
        "integration",
        "system",
      ]).optional(),
      resourceType: z.string().optional(),
      actorId: z.string().optional(),
      format: z.enum(["json", "csv"]).default("json"),
    })
  )
  .middleware([assertAdminMiddleware])
  .handler(async ({ data }) => {
    // Fetch all logs within the date range (up to 10000 for exports)
    const logs = await getAuditLogsWithActors({
      startDate: data.startDate,
      endDate: data.endDate,
      category: data.category,
      resourceType: data.resourceType,
      actorId: data.actorId,
      limit: 10000,
      offset: 0,
    });

    if (data.format === "csv") {
      // Convert to CSV format
      const headers = [
        "ID",
        "Timestamp",
        "Action",
        "Category",
        "Severity",
        "Resource Type",
        "Resource ID",
        "Actor ID",
        "Actor Name",
        "Actor Email",
        "IP Address",
        "Success",
        "Description",
      ];

      const rows = logs.map((log) => [
        log.id,
        log.createdAt.toISOString(),
        log.action,
        log.category,
        log.severity,
        log.resourceType,
        log.resourceId,
        log.actorId || "",
        log.actorName || "",
        log.actorEmail || "",
        log.ipAddress || "",
        log.success ? "true" : "false",
        log.description || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      return {
        format: "csv" as const,
        data: csvContent,
        count: logs.length,
        filename: `audit-logs-${data.startDate.toISOString().split("T")[0]}-to-${data.endDate.toISOString().split("T")[0]}.csv`,
      };
    }

    return {
      format: "json" as const,
      data: logs,
      count: logs.length,
      filename: `audit-logs-${data.startDate.toISOString().split("T")[0]}-to-${data.endDate.toISOString().split("T")[0]}.json`,
    };
  });
