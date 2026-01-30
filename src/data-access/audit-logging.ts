import { eq, desc, and, count, gte, lte, like, inArray } from "drizzle-orm";
import { database } from "~/db";
import {
  auditLog,
  user,
  type AuditLog,
  type CreateAuditLogData,
  type AuditLogFilters,
  type CreateAuditLogPayload,
  type AuditLogCategory,
  type AuditActorType,
  type AuditSeverity,
  type AuditLogWithActor,
} from "~/db/schema";

// =============================================================================
// Audit Log CRUD Operations
// =============================================================================

/**
 * Create a new audit log entry
 */
export async function createAuditLogEntry(
  data: CreateAuditLogData
): Promise<AuditLog> {
  const [result] = await database
    .insert(auditLog)
    .values(data)
    .returning();

  return result;
}

/**
 * Get a single audit log entry by ID
 */
export async function getAuditLogById(id: string): Promise<AuditLog | null> {
  const [result] = await database
    .select()
    .from(auditLog)
    .where(eq(auditLog.id, id))
    .limit(1);

  return result || null;
}

/**
 * Get audit log entry with actor details
 */
export async function getAuditLogWithActor(
  id: string
): Promise<AuditLogWithActor | null> {
  const [result] = await database
    .select({
      id: auditLog.id,
      action: auditLog.action,
      category: auditLog.category,
      severity: auditLog.severity,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      parentResourceType: auditLog.parentResourceType,
      parentResourceId: auditLog.parentResourceId,
      actorId: auditLog.actorId,
      actorType: auditLog.actorType,
      actorName: auditLog.actorName,
      actorEmail: auditLog.actorEmail,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      sessionId: auditLog.sessionId,
      requestId: auditLog.requestId,
      previousState: auditLog.previousState,
      newState: auditLog.newState,
      changedFields: auditLog.changedFields,
      description: auditLog.description,
      metadata: auditLog.metadata,
      tags: auditLog.tags,
      success: auditLog.success,
      errorDetails: auditLog.errorDetails,
      createdAt: auditLog.createdAt,
      durationMs: auditLog.durationMs,
      actor: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorId, user.id))
    .where(eq(auditLog.id, id))
    .limit(1);

  if (!result) return null;

  return {
    ...result,
    actor: result.actor?.id ? result.actor : null,
  } as AuditLogWithActor;
}

/**
 * Get audit logs with optional filters
 */
export async function getAuditLogs(
  filters: AuditLogFilters = {}
): Promise<AuditLog[]> {
  const {
    action,
    category,
    severity,
    resourceType,
    resourceId,
    actorId,
    actorType,
    ipAddress,
    sessionId,
    success,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = filters;

  const conditions = [];

  if (action) {
    conditions.push(eq(auditLog.action, action));
  }

  if (category) {
    conditions.push(eq(auditLog.category, category));
  }

  if (severity) {
    conditions.push(eq(auditLog.severity, severity));
  }

  if (resourceType) {
    conditions.push(eq(auditLog.resourceType, resourceType));
  }

  if (resourceId) {
    conditions.push(eq(auditLog.resourceId, resourceId));
  }

  if (actorId) {
    conditions.push(eq(auditLog.actorId, actorId));
  }

  if (actorType) {
    conditions.push(eq(auditLog.actorType, actorType));
  }

  if (ipAddress) {
    conditions.push(eq(auditLog.ipAddress, ipAddress));
  }

  if (sessionId) {
    conditions.push(eq(auditLog.sessionId, sessionId));
  }

  if (success !== undefined) {
    conditions.push(eq(auditLog.success, success));
  }

  if (startDate) {
    conditions.push(gte(auditLog.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(auditLog.createdAt, endDate));
  }

  const query = database
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    return await query.where(and(...conditions));
  }

  return await query;
}

/**
 * Get audit logs with actor details
 */
export async function getAuditLogsWithActors(
  filters: AuditLogFilters = {}
): Promise<AuditLogWithActor[]> {
  const {
    action,
    category,
    severity,
    resourceType,
    resourceId,
    actorId,
    actorType,
    ipAddress,
    sessionId,
    success,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = filters;

  const conditions = [];

  if (action) {
    conditions.push(eq(auditLog.action, action));
  }

  if (category) {
    conditions.push(eq(auditLog.category, category));
  }

  if (severity) {
    conditions.push(eq(auditLog.severity, severity));
  }

  if (resourceType) {
    conditions.push(eq(auditLog.resourceType, resourceType));
  }

  if (resourceId) {
    conditions.push(eq(auditLog.resourceId, resourceId));
  }

  if (actorId) {
    conditions.push(eq(auditLog.actorId, actorId));
  }

  if (actorType) {
    conditions.push(eq(auditLog.actorType, actorType));
  }

  if (ipAddress) {
    conditions.push(eq(auditLog.ipAddress, ipAddress));
  }

  if (sessionId) {
    conditions.push(eq(auditLog.sessionId, sessionId));
  }

  if (success !== undefined) {
    conditions.push(eq(auditLog.success, success));
  }

  if (startDate) {
    conditions.push(gte(auditLog.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(auditLog.createdAt, endDate));
  }

  const baseQuery = database
    .select({
      id: auditLog.id,
      action: auditLog.action,
      category: auditLog.category,
      severity: auditLog.severity,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      parentResourceType: auditLog.parentResourceType,
      parentResourceId: auditLog.parentResourceId,
      actorId: auditLog.actorId,
      actorType: auditLog.actorType,
      actorName: auditLog.actorName,
      actorEmail: auditLog.actorEmail,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      sessionId: auditLog.sessionId,
      requestId: auditLog.requestId,
      previousState: auditLog.previousState,
      newState: auditLog.newState,
      changedFields: auditLog.changedFields,
      description: auditLog.description,
      metadata: auditLog.metadata,
      tags: auditLog.tags,
      success: auditLog.success,
      errorDetails: auditLog.errorDetails,
      createdAt: auditLog.createdAt,
      durationMs: auditLog.durationMs,
      actor: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorId, user.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  let results;
  if (conditions.length > 0) {
    results = await baseQuery.where(and(...conditions));
  } else {
    results = await baseQuery;
  }

  return results.map((result) => ({
    ...result,
    actor: result.actor?.id ? result.actor : null,
  })) as AuditLogWithActor[];
}

/**
 * Get audit log count with optional filters
 */
export async function getAuditLogCount(
  filters: AuditLogFilters = {}
): Promise<number> {
  const {
    action,
    category,
    severity,
    resourceType,
    resourceId,
    actorId,
    actorType,
    ipAddress,
    sessionId,
    success,
    startDate,
    endDate,
  } = filters;

  const conditions = [];

  if (action) {
    conditions.push(eq(auditLog.action, action));
  }

  if (category) {
    conditions.push(eq(auditLog.category, category));
  }

  if (severity) {
    conditions.push(eq(auditLog.severity, severity));
  }

  if (resourceType) {
    conditions.push(eq(auditLog.resourceType, resourceType));
  }

  if (resourceId) {
    conditions.push(eq(auditLog.resourceId, resourceId));
  }

  if (actorId) {
    conditions.push(eq(auditLog.actorId, actorId));
  }

  if (actorType) {
    conditions.push(eq(auditLog.actorType, actorType));
  }

  if (ipAddress) {
    conditions.push(eq(auditLog.ipAddress, ipAddress));
  }

  if (sessionId) {
    conditions.push(eq(auditLog.sessionId, sessionId));
  }

  if (success !== undefined) {
    conditions.push(eq(auditLog.success, success));
  }

  if (startDate) {
    conditions.push(gte(auditLog.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(auditLog.createdAt, endDate));
  }

  const query = database.select({ count: count() }).from(auditLog);

  if (conditions.length > 0) {
    const results = await query.where(and(...conditions));
    return results[0]?.count || 0;
  }

  const results = await query;
  return results[0]?.count || 0;
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(
  resourceType: string,
  resourceId: string,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<AuditLog[]> {
  return getAuditLogs({
    resourceType,
    resourceId,
    ...options,
  });
}

/**
 * Get audit logs for a specific actor
 */
export async function getActorAuditLogs(
  actorId: string,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    category?: AuditLogCategory;
  }
): Promise<AuditLog[]> {
  return getAuditLogs({
    actorId,
    ...options,
  });
}

/**
 * Get audit logs by category
 */
export async function getAuditLogsByCategory(
  category: AuditLogCategory,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<AuditLog[]> {
  return getAuditLogs({
    category,
    ...options,
  });
}

/**
 * Get security-related audit logs
 */
export async function getSecurityAuditLogs(
  options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
  }
): Promise<AuditLog[]> {
  return getAuditLogs({
    category: "security",
    ...options,
  });
}

/**
 * Get failed actions
 */
export async function getFailedActions(
  options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    category?: AuditLogCategory;
  }
): Promise<AuditLog[]> {
  return getAuditLogs({
    success: false,
    ...options,
  });
}

// =============================================================================
// Helper Functions for Creating Audit Logs
// =============================================================================

/**
 * Log an action with full audit trail
 * This is the primary helper function for creating audit log entries
 */
export async function logAction(
  payload: CreateAuditLogPayload
): Promise<AuditLog> {
  const {
    action,
    category,
    severity = "info",
    resourceType,
    resourceId,
    parentResourceType,
    parentResourceId,
    actorId,
    actorType,
    actorName,
    actorEmail,
    ipAddress,
    userAgent,
    sessionId,
    requestId,
    previousState,
    newState,
    changedFields,
    description,
    metadata,
    tags,
    success = true,
    errorDetails,
    durationMs,
  } = payload;

  return await createAuditLogEntry({
    id: crypto.randomUUID(),
    action,
    category,
    severity,
    resourceType,
    resourceId,
    parentResourceType: parentResourceType || null,
    parentResourceId: parentResourceId || null,
    actorId: actorId || null,
    actorType,
    actorName: actorName || null,
    actorEmail: actorEmail || null,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    sessionId: sessionId || null,
    requestId: requestId || null,
    previousState: previousState ? JSON.stringify(previousState) : null,
    newState: newState ? JSON.stringify(newState) : null,
    changedFields: changedFields ? JSON.stringify(changedFields) : null,
    description: description || null,
    metadata: metadata ? JSON.stringify(metadata) : null,
    tags: tags ? JSON.stringify(tags) : null,
    success,
    errorDetails: errorDetails ? JSON.stringify(errorDetails) : null,
    durationMs: durationMs || null,
  });
}

/**
 * Log an authentication event (login, logout, password change, etc.)
 */
export async function logAuthEvent(
  action: string,
  userId: string | null,
  context: {
    success?: boolean;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    actorName?: string;
    actorEmail?: string;
    metadata?: Record<string, unknown>;
    errorDetails?: Record<string, unknown>;
  }
): Promise<AuditLog> {
  return logAction({
    action,
    category: "authentication",
    severity: context.success === false ? "warning" : "info",
    resourceType: "user",
    resourceId: userId || "anonymous",
    actorId: userId,
    actorType: "user",
    actorName: context.actorName,
    actorEmail: context.actorEmail,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    sessionId: context.sessionId,
    success: context.success ?? true,
    metadata: context.metadata,
    errorDetails: context.errorDetails,
  });
}

/**
 * Log a resource modification (create, update, delete)
 */
export async function logResourceChange(
  action: string,
  resourceType: string,
  resourceId: string,
  actorInfo: {
    actorId?: string | null;
    actorType: AuditActorType;
    actorName?: string;
    actorEmail?: string;
  },
  changeInfo?: {
    previousState?: unknown;
    newState?: unknown;
    changedFields?: string[];
    description?: string;
    parentResourceType?: string;
    parentResourceId?: string;
  },
  context?: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
    severity?: AuditSeverity;
    category?: AuditLogCategory;
  }
): Promise<AuditLog> {
  return logAction({
    action,
    category: context?.category || "resource_access",
    severity: context?.severity || "info",
    resourceType,
    resourceId,
    parentResourceType: changeInfo?.parentResourceType,
    parentResourceId: changeInfo?.parentResourceId,
    actorId: actorInfo.actorId,
    actorType: actorInfo.actorType,
    actorName: actorInfo.actorName,
    actorEmail: actorInfo.actorEmail,
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    sessionId: context?.sessionId,
    requestId: context?.requestId,
    previousState: changeInfo?.previousState,
    newState: changeInfo?.newState,
    changedFields: changeInfo?.changedFields,
    description: changeInfo?.description,
    metadata: context?.metadata,
  });
}

/**
 * Log a security event (suspicious activity, permission denied, etc.)
 */
export async function logSecurityEvent(
  action: string,
  resourceType: string,
  resourceId: string,
  context: {
    actorId?: string | null;
    actorType: AuditActorType;
    actorName?: string;
    actorEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    severity?: AuditSeverity;
    description?: string;
    metadata?: Record<string, unknown>;
    success?: boolean;
    errorDetails?: Record<string, unknown>;
  }
): Promise<AuditLog> {
  return logAction({
    action,
    category: "security",
    severity: context.severity || "warning",
    resourceType,
    resourceId,
    actorId: context.actorId,
    actorType: context.actorType,
    actorName: context.actorName,
    actorEmail: context.actorEmail,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    sessionId: context.sessionId,
    description: context.description,
    metadata: context.metadata,
    success: context.success ?? false,
    errorDetails: context.errorDetails,
  });
}

/**
 * Log a system event (cron job, maintenance, etc.)
 */
export async function logSystemEvent(
  action: string,
  resourceType: string,
  resourceId: string,
  context?: {
    description?: string;
    metadata?: Record<string, unknown>;
    success?: boolean;
    errorDetails?: Record<string, unknown>;
    durationMs?: number;
  }
): Promise<AuditLog> {
  return logAction({
    action,
    category: "system",
    severity: context?.success === false ? "warning" : "info",
    resourceType,
    resourceId,
    actorId: null,
    actorType: "system",
    description: context?.description,
    metadata: context?.metadata,
    success: context?.success ?? true,
    errorDetails: context?.errorDetails,
    durationMs: context?.durationMs,
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse JSON fields from audit log
 */
export function parseAuditLogFields(log: AuditLog): {
  previousState: {} | null;
  newState: {} | null;
  changedFields: string[] | null;
  metadata: Record<string, {}> | null;
  tags: string[] | null;
  errorDetails: Record<string, {}> | null;
} {
  return {
    previousState: log.previousState ? (JSON.parse(log.previousState) as {}) : null,
    newState: log.newState ? (JSON.parse(log.newState) as {}) : null,
    changedFields: log.changedFields ? JSON.parse(log.changedFields) : null,
    metadata: log.metadata ? (JSON.parse(log.metadata) as Record<string, {}>) : null,
    tags: log.tags ? JSON.parse(log.tags) : null,
    errorDetails: log.errorDetails ? (JSON.parse(log.errorDetails) as Record<string, {}>) : null,
  };
}

/**
 * Get summary statistics for audit logs
 */
export async function getAuditLogStats(
  filters: Pick<AuditLogFilters, "startDate" | "endDate" | "actorId" | "resourceType">
): Promise<{
  totalCount: number;
  successCount: number;
  failureCount: number;
  categoryBreakdown: Record<string, number>;
}> {
  const [total, successful, failed] = await Promise.all([
    getAuditLogCount(filters),
    getAuditLogCount({ ...filters, success: true }),
    getAuditLogCount({ ...filters, success: false }),
  ]);

  // Get category breakdown
  const categories: AuditLogCategory[] = [
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

  const categoryBreakdown: Record<string, number> = {};
  for (const category of categories) {
    categoryBreakdown[category] = await getAuditLogCount({ ...filters, category });
  }

  return {
    totalCount: total,
    successCount: successful,
    failureCount: failed,
    categoryBreakdown,
  };
}

// =============================================================================
// Type Re-exports for convenience
// =============================================================================

export type {
  AuditLog,
  CreateAuditLogData,
  AuditLogFilters,
  CreateAuditLogPayload,
  AuditLogCategory,
  AuditActorType,
  AuditSeverity,
  AuditLogWithActor,
};
