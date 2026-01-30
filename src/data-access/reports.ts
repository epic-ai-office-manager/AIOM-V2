/**
 * Reports Data Access Layer
 *
 * Handles database operations for the reporting dashboard including:
 * - Report definitions (CRUD)
 * - Report schedules
 * - Report snapshots
 * - KPI management
 * - Report data aggregation
 */

import { eq, desc, and, gte, lte, count, sum, avg, sql, inArray, or, isNull } from "drizzle-orm";
import { database } from "~/db";
import {
  reportDefinition,
  reportSchedule,
  reportSnapshot,
  reportKpi,
  reportDeliveryLog,
  type ReportDefinition,
  type CreateReportDefinitionData,
  type UpdateReportDefinitionData,
  type ReportSchedule,
  type CreateReportScheduleData,
  type UpdateReportScheduleData,
  type ReportSnapshot,
  type CreateReportSnapshotData,
  type ReportKpi,
  type CreateReportKpiData,
  type UpdateReportKpiData,
  type ReportDeliveryLog,
  type CreateReportDeliveryLogData,
  type ReportConfig,
  type ReportType,
  type ReportStatus,
  type ReportScheduleFrequency,
  type ReportExportFormat,
} from "~/db/schema-reporting";
import { user, expenseRequest, callRecord, callTask, type User } from "~/db/schema";

// =============================================================================
// Re-export types
// =============================================================================

export type {
  ReportDefinition,
  CreateReportDefinitionData,
  UpdateReportDefinitionData,
  ReportSchedule,
  CreateReportScheduleData,
  UpdateReportScheduleData,
  ReportSnapshot,
  CreateReportSnapshotData,
  ReportKpi,
  CreateReportKpiData,
  UpdateReportKpiData,
  ReportDeliveryLog,
  CreateReportDeliveryLogData,
  ReportConfig,
  ReportType,
  ReportStatus,
  ReportScheduleFrequency,
  ReportExportFormat,
};

// =============================================================================
// Extended Types
// =============================================================================

export type ReportDefinitionWithCreator = ReportDefinition & {
  creator: Pick<User, "id" | "name" | "email">;
};

export type ReportScheduleWithDetails = ReportSchedule & {
  reportDefinition: Pick<ReportDefinition, "id" | "name" | "type">;
  user: Pick<User, "id" | "name" | "email">;
};

// =============================================================================
// Report Definition Operations
// =============================================================================

/**
 * Create a new report definition
 */
export async function createReportDefinition(
  data: CreateReportDefinitionData
): Promise<ReportDefinition> {
  const [newReport] = await database
    .insert(reportDefinition)
    .values(data)
    .returning();

  return newReport;
}

/**
 * Find a report definition by ID
 */
export async function findReportDefinitionById(
  id: string
): Promise<ReportDefinition | null> {
  const [result] = await database
    .select()
    .from(reportDefinition)
    .where(eq(reportDefinition.id, id))
    .limit(1);

  return result || null;
}

/**
 * Find a report definition with creator info
 */
export async function findReportDefinitionWithCreator(
  id: string
): Promise<ReportDefinitionWithCreator | null> {
  const results = await database
    .select({
      id: reportDefinition.id,
      name: reportDefinition.name,
      description: reportDefinition.description,
      type: reportDefinition.type,
      createdBy: reportDefinition.createdBy,
      isPublic: reportDefinition.isPublic,
      config: reportDefinition.config,
      layout: reportDefinition.layout,
      status: reportDefinition.status,
      createdAt: reportDefinition.createdAt,
      updatedAt: reportDefinition.updatedAt,
      creator: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .from(reportDefinition)
    .innerJoin(user, eq(reportDefinition.createdBy, user.id))
    .where(eq(reportDefinition.id, id))
    .limit(1);

  return results[0] || null;
}

/**
 * Get all report definitions for a user (their own + public)
 */
export async function findReportDefinitionsForUser(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: ReportType;
    status?: ReportStatus;
  } = {}
): Promise<ReportDefinitionWithCreator[]> {
  const { limit = 50, offset = 0, type, status } = options;

  const conditions = [
    or(
      eq(reportDefinition.createdBy, userId),
      eq(reportDefinition.isPublic, true)
    ),
  ];

  if (type) {
    conditions.push(eq(reportDefinition.type, type));
  }

  if (status) {
    conditions.push(eq(reportDefinition.status, status));
  }

  const results = await database
    .select({
      id: reportDefinition.id,
      name: reportDefinition.name,
      description: reportDefinition.description,
      type: reportDefinition.type,
      createdBy: reportDefinition.createdBy,
      isPublic: reportDefinition.isPublic,
      config: reportDefinition.config,
      layout: reportDefinition.layout,
      status: reportDefinition.status,
      createdAt: reportDefinition.createdAt,
      updatedAt: reportDefinition.updatedAt,
      creator: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .from(reportDefinition)
    .innerJoin(user, eq(reportDefinition.createdBy, user.id))
    .where(and(...conditions))
    .orderBy(desc(reportDefinition.updatedAt))
    .limit(limit)
    .offset(offset);

  return results;
}

/**
 * Update a report definition
 */
export async function updateReportDefinition(
  id: string,
  data: UpdateReportDefinitionData
): Promise<ReportDefinition | null> {
  const [updated] = await database
    .update(reportDefinition)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(reportDefinition.id, id))
    .returning();

  return updated || null;
}

/**
 * Delete a report definition
 */
export async function deleteReportDefinition(id: string): Promise<boolean> {
  const [deleted] = await database
    .delete(reportDefinition)
    .where(eq(reportDefinition.id, id))
    .returning();

  return deleted !== undefined;
}

// =============================================================================
// Report Schedule Operations
// =============================================================================

/**
 * Create a new report schedule
 */
export async function createReportSchedule(
  data: CreateReportScheduleData
): Promise<ReportSchedule> {
  const [newSchedule] = await database
    .insert(reportSchedule)
    .values(data)
    .returning();

  return newSchedule;
}

/**
 * Find a report schedule by ID
 */
export async function findReportScheduleById(
  id: string
): Promise<ReportSchedule | null> {
  const [result] = await database
    .select()
    .from(reportSchedule)
    .where(eq(reportSchedule.id, id))
    .limit(1);

  return result || null;
}

/**
 * Find all schedules for a report definition
 */
export async function findSchedulesForReport(
  reportDefinitionId: string
): Promise<ReportSchedule[]> {
  const results = await database
    .select()
    .from(reportSchedule)
    .where(eq(reportSchedule.reportDefinitionId, reportDefinitionId))
    .orderBy(desc(reportSchedule.createdAt));

  return results;
}

/**
 * Find all schedules for a user
 */
export async function findSchedulesForUser(
  userId: string
): Promise<ReportScheduleWithDetails[]> {
  const results = await database
    .select({
      id: reportSchedule.id,
      reportDefinitionId: reportSchedule.reportDefinitionId,
      userId: reportSchedule.userId,
      isEnabled: reportSchedule.isEnabled,
      frequency: reportSchedule.frequency,
      dayOfWeek: reportSchedule.dayOfWeek,
      dayOfMonth: reportSchedule.dayOfMonth,
      deliveryTime: reportSchedule.deliveryTime,
      timezone: reportSchedule.timezone,
      deliveryMethod: reportSchedule.deliveryMethod,
      recipients: reportSchedule.recipients,
      exportFormat: reportSchedule.exportFormat,
      lastDeliveredAt: reportSchedule.lastDeliveredAt,
      nextDeliveryAt: reportSchedule.nextDeliveryAt,
      consecutiveFailures: reportSchedule.consecutiveFailures,
      lastErrorMessage: reportSchedule.lastErrorMessage,
      createdAt: reportSchedule.createdAt,
      updatedAt: reportSchedule.updatedAt,
      reportDefinition: {
        id: reportDefinition.id,
        name: reportDefinition.name,
        type: reportDefinition.type,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .from(reportSchedule)
    .innerJoin(reportDefinition, eq(reportSchedule.reportDefinitionId, reportDefinition.id))
    .innerJoin(user, eq(reportSchedule.userId, user.id))
    .where(eq(reportSchedule.userId, userId))
    .orderBy(desc(reportSchedule.createdAt));

  return results;
}

/**
 * Get enabled schedules due for delivery
 */
export async function getSchedulesDueForDelivery(): Promise<ReportScheduleWithDetails[]> {
  const now = new Date();

  const results = await database
    .select({
      id: reportSchedule.id,
      reportDefinitionId: reportSchedule.reportDefinitionId,
      userId: reportSchedule.userId,
      isEnabled: reportSchedule.isEnabled,
      frequency: reportSchedule.frequency,
      dayOfWeek: reportSchedule.dayOfWeek,
      dayOfMonth: reportSchedule.dayOfMonth,
      deliveryTime: reportSchedule.deliveryTime,
      timezone: reportSchedule.timezone,
      deliveryMethod: reportSchedule.deliveryMethod,
      recipients: reportSchedule.recipients,
      exportFormat: reportSchedule.exportFormat,
      lastDeliveredAt: reportSchedule.lastDeliveredAt,
      nextDeliveryAt: reportSchedule.nextDeliveryAt,
      consecutiveFailures: reportSchedule.consecutiveFailures,
      lastErrorMessage: reportSchedule.lastErrorMessage,
      createdAt: reportSchedule.createdAt,
      updatedAt: reportSchedule.updatedAt,
      reportDefinition: {
        id: reportDefinition.id,
        name: reportDefinition.name,
        type: reportDefinition.type,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .from(reportSchedule)
    .innerJoin(reportDefinition, eq(reportSchedule.reportDefinitionId, reportDefinition.id))
    .innerJoin(user, eq(reportSchedule.userId, user.id))
    .where(
      and(
        eq(reportSchedule.isEnabled, true),
        or(
          isNull(reportSchedule.nextDeliveryAt),
          lte(reportSchedule.nextDeliveryAt, now)
        )
      )
    );

  return results;
}

/**
 * Update a report schedule
 */
export async function updateReportSchedule(
  id: string,
  data: UpdateReportScheduleData
): Promise<ReportSchedule | null> {
  const [updated] = await database
    .update(reportSchedule)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(reportSchedule.id, id))
    .returning();

  return updated || null;
}

/**
 * Mark schedule as delivered
 */
export async function markScheduleDelivered(
  id: string,
  nextDeliveryAt: Date
): Promise<ReportSchedule | null> {
  const [updated] = await database
    .update(reportSchedule)
    .set({
      lastDeliveredAt: new Date(),
      nextDeliveryAt,
      consecutiveFailures: 0,
      lastErrorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(reportSchedule.id, id))
    .returning();

  return updated || null;
}

/**
 * Mark schedule delivery as failed
 */
export async function markScheduleDeliveryFailed(
  id: string,
  errorMessage: string
): Promise<ReportSchedule | null> {
  const schedule = await findReportScheduleById(id);
  if (!schedule) return null;

  const [updated] = await database
    .update(reportSchedule)
    .set({
      consecutiveFailures: schedule.consecutiveFailures + 1,
      lastErrorMessage: errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(reportSchedule.id, id))
    .returning();

  return updated || null;
}

/**
 * Delete a report schedule
 */
export async function deleteReportSchedule(id: string): Promise<boolean> {
  const [deleted] = await database
    .delete(reportSchedule)
    .where(eq(reportSchedule.id, id))
    .returning();

  return deleted !== undefined;
}

// =============================================================================
// Report Snapshot Operations
// =============================================================================

/**
 * Create a new report snapshot
 */
export async function createReportSnapshot(
  data: CreateReportSnapshotData
): Promise<ReportSnapshot> {
  const [newSnapshot] = await database
    .insert(reportSnapshot)
    .values(data)
    .returning();

  return newSnapshot;
}

/**
 * Find snapshots for a report definition
 */
export async function findSnapshotsForReport(
  reportDefinitionId: string,
  limit: number = 20
): Promise<ReportSnapshot[]> {
  const results = await database
    .select()
    .from(reportSnapshot)
    .where(eq(reportSnapshot.reportDefinitionId, reportDefinitionId))
    .orderBy(desc(reportSnapshot.generatedAt))
    .limit(limit);

  return results;
}

/**
 * Find latest snapshot for a report
 */
export async function findLatestSnapshot(
  reportDefinitionId: string
): Promise<ReportSnapshot | null> {
  const [result] = await database
    .select()
    .from(reportSnapshot)
    .where(eq(reportSnapshot.reportDefinitionId, reportDefinitionId))
    .orderBy(desc(reportSnapshot.generatedAt))
    .limit(1);

  return result || null;
}

/**
 * Delete expired snapshots
 */
export async function deleteExpiredSnapshots(): Promise<number> {
  const now = new Date();
  const result = await database
    .delete(reportSnapshot)
    .where(lte(reportSnapshot.expiresAt, now))
    .returning({ id: reportSnapshot.id });

  return result.length;
}

// =============================================================================
// Report KPI Operations
// =============================================================================

/**
 * Create a new KPI
 */
export async function createReportKpi(
  data: CreateReportKpiData
): Promise<ReportKpi> {
  const [newKpi] = await database
    .insert(reportKpi)
    .values(data)
    .returning();

  return newKpi;
}

/**
 * Find KPIs for a report definition
 */
export async function findKpisForReport(
  reportDefinitionId: string
): Promise<ReportKpi[]> {
  const results = await database
    .select()
    .from(reportKpi)
    .where(eq(reportKpi.reportDefinitionId, reportDefinitionId))
    .orderBy(reportKpi.name);

  return results;
}

/**
 * Update a KPI
 */
export async function updateReportKpi(
  id: string,
  data: UpdateReportKpiData
): Promise<ReportKpi | null> {
  const [updated] = await database
    .update(reportKpi)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(reportKpi.id, id))
    .returning();

  return updated || null;
}

/**
 * Delete a KPI
 */
export async function deleteReportKpi(id: string): Promise<boolean> {
  const [deleted] = await database
    .delete(reportKpi)
    .where(eq(reportKpi.id, id))
    .returning();

  return deleted !== undefined;
}

// =============================================================================
// Report Delivery Log Operations
// =============================================================================

/**
 * Create a delivery log entry
 */
export async function createDeliveryLog(
  data: CreateReportDeliveryLogData
): Promise<ReportDeliveryLog> {
  const [newLog] = await database
    .insert(reportDeliveryLog)
    .values(data)
    .returning();

  return newLog;
}

/**
 * Find delivery logs for a schedule
 */
export async function findDeliveryLogsForSchedule(
  scheduleId: string,
  limit: number = 20
): Promise<ReportDeliveryLog[]> {
  const results = await database
    .select()
    .from(reportDeliveryLog)
    .where(eq(reportDeliveryLog.scheduleId, scheduleId))
    .orderBy(desc(reportDeliveryLog.createdAt))
    .limit(limit);

  return results;
}

/**
 * Update delivery log status
 */
export async function updateDeliveryLogStatus(
  id: string,
  status: "pending" | "delivered" | "failed",
  errorMessage?: string
): Promise<ReportDeliveryLog | null> {
  const [updated] = await database
    .update(reportDeliveryLog)
    .set({
      status,
      deliveredAt: status === "delivered" ? new Date() : undefined,
      errorMessage: errorMessage || null,
    })
    .where(eq(reportDeliveryLog.id, id))
    .returning();

  return updated || null;
}

// =============================================================================
// Report Data Aggregation Functions
// =============================================================================

/**
 * Get expense summary data for reports
 */
export async function getExpenseSummaryData(
  startDate: Date,
  endDate: Date
): Promise<{
  totalAmount: number;
  count: number;
  byStatus: { status: string; count: number; amount: number }[];
  byMonth: { month: string; count: number; amount: number }[];
}> {
  // Get totals
  const [totals] = await database
    .select({
      totalAmount: sql<number>`COALESCE(SUM(CAST(${expenseRequest.amount} AS DECIMAL)), 0)`,
      count: count(),
    })
    .from(expenseRequest)
    .where(
      and(
        gte(expenseRequest.createdAt, startDate),
        lte(expenseRequest.createdAt, endDate)
      )
    );

  // Get by status
  const byStatus = await database
    .select({
      status: expenseRequest.status,
      count: count(),
      amount: sql<number>`COALESCE(SUM(CAST(${expenseRequest.amount} AS DECIMAL)), 0)`,
    })
    .from(expenseRequest)
    .where(
      and(
        gte(expenseRequest.createdAt, startDate),
        lte(expenseRequest.createdAt, endDate)
      )
    )
    .groupBy(expenseRequest.status);

  // Get by month
  const byMonth = await database
    .select({
      month: sql<string>`TO_CHAR(${expenseRequest.createdAt}, 'YYYY-MM')`,
      count: count(),
      amount: sql<number>`COALESCE(SUM(CAST(${expenseRequest.amount} AS DECIMAL)), 0)`,
    })
    .from(expenseRequest)
    .where(
      and(
        gte(expenseRequest.createdAt, startDate),
        lte(expenseRequest.createdAt, endDate)
      )
    )
    .groupBy(sql`TO_CHAR(${expenseRequest.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${expenseRequest.createdAt}, 'YYYY-MM')`);

  return {
    totalAmount: Number(totals?.totalAmount) || 0,
    count: totals?.count || 0,
    byStatus: byStatus.map((s) => ({
      status: s.status,
      count: s.count,
      amount: Number(s.amount),
    })),
    byMonth: byMonth.map((m) => ({
      month: m.month,
      count: m.count,
      amount: Number(m.amount),
    })),
  };
}

/**
 * Get call analytics data for reports
 */
export async function getCallAnalyticsData(
  startDate: Date,
  endDate: Date
): Promise<{
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  byDirection: { direction: string; count: number; duration: number }[];
  byDay: { day: string; count: number; duration: number }[];
}> {
  // Get totals
  const [totals] = await database
    .select({
      totalCalls: count(),
      totalDuration: sql<number>`COALESCE(SUM(${callRecord.duration}), 0)`,
      avgDuration: sql<number>`COALESCE(AVG(${callRecord.duration}), 0)`,
    })
    .from(callRecord)
    .where(
      and(
        gte(callRecord.callTimestamp, startDate),
        lte(callRecord.callTimestamp, endDate)
      )
    );

  // Get by direction
  const byDirection = await database
    .select({
      direction: callRecord.direction,
      count: count(),
      duration: sql<number>`COALESCE(SUM(${callRecord.duration}), 0)`,
    })
    .from(callRecord)
    .where(
      and(
        gte(callRecord.callTimestamp, startDate),
        lte(callRecord.callTimestamp, endDate)
      )
    )
    .groupBy(callRecord.direction);

  // Get by day
  const byDay = await database
    .select({
      day: sql<string>`TO_CHAR(${callRecord.callTimestamp}, 'YYYY-MM-DD')`,
      count: count(),
      duration: sql<number>`COALESCE(SUM(${callRecord.duration}), 0)`,
    })
    .from(callRecord)
    .where(
      and(
        gte(callRecord.callTimestamp, startDate),
        lte(callRecord.callTimestamp, endDate)
      )
    )
    .groupBy(sql`TO_CHAR(${callRecord.callTimestamp}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${callRecord.callTimestamp}, 'YYYY-MM-DD')`);

  return {
    totalCalls: totals?.totalCalls || 0,
    totalDuration: Number(totals?.totalDuration) || 0,
    avgDuration: Number(totals?.avgDuration) || 0,
    byDirection: byDirection.map((d) => ({
      direction: d.direction,
      count: d.count,
      duration: Number(d.duration),
    })),
    byDay: byDay.map((d) => ({
      day: d.day,
      count: d.count,
      duration: Number(d.duration),
    })),
  };
}

/**
 * Get task completion data for reports
 */
export async function getTaskCompletionData(
  startDate: Date,
  endDate: Date
): Promise<{
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
}> {
  // Get totals
  const [totals] = await database
    .select({
      totalTasks: count(),
      completedTasks: sql<number>`SUM(CASE WHEN ${callTask.status} = 'completed' THEN 1 ELSE 0 END)`,
    })
    .from(callTask)
    .where(
      and(
        gte(callTask.createdAt, startDate),
        lte(callTask.createdAt, endDate)
      )
    );

  // Get by status
  const byStatus = await database
    .select({
      status: callTask.status,
      count: count(),
    })
    .from(callTask)
    .where(
      and(
        gte(callTask.createdAt, startDate),
        lte(callTask.createdAt, endDate)
      )
    )
    .groupBy(callTask.status);

  // Get by priority
  const byPriority = await database
    .select({
      priority: callTask.priority,
      count: count(),
    })
    .from(callTask)
    .where(
      and(
        gte(callTask.createdAt, startDate),
        lte(callTask.createdAt, endDate)
      )
    )
    .groupBy(callTask.priority);

  const total = totals?.totalTasks || 0;
  const completed = Number(totals?.completedTasks) || 0;

  return {
    totalTasks: total,
    completedTasks: completed,
    completionRate: total > 0 ? (completed / total) * 100 : 0,
    byStatus: byStatus.map((s) => ({
      status: s.status,
      count: s.count,
    })),
    byPriority: byPriority.map((p) => ({
      priority: p.priority,
      count: p.count,
    })),
  };
}

/**
 * Get aggregated report data based on report type
 */
export async function getReportData(
  reportType: ReportType,
  startDate: Date,
  endDate: Date
): Promise<unknown> {
  switch (reportType) {
    case "expense_summary":
      return getExpenseSummaryData(startDate, endDate);
    case "call_analytics":
      return getCallAnalyticsData(startDate, endDate);
    case "task_completion":
      return getTaskCompletionData(startDate, endDate);
    case "financial_overview":
      return getExpenseSummaryData(startDate, endDate);
    default:
      return {};
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate next delivery date based on frequency
 */
export function calculateNextDelivery(
  frequency: ReportScheduleFrequency,
  deliveryTime: string,
  timezone: string,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null
): Date {
  const now = new Date();
  const [hour, minute] = deliveryTime.split(":").map(Number);

  let nextDate = new Date(now);
  nextDate.setHours(hour, minute, 0, 0);

  switch (frequency) {
    case "daily":
      if (nextDate <= now) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
      break;

    case "weekly":
      const targetDay = dayOfWeek ?? 1; // Monday default
      const currentDay = nextDate.getDay();
      let daysUntilTarget = targetDay - currentDay;
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextDate <= now)) {
        daysUntilTarget += 7;
      }
      nextDate.setDate(nextDate.getDate() + daysUntilTarget);
      break;

    case "monthly":
      const targetDayOfMonth = dayOfMonth ?? 1;
      nextDate.setDate(targetDayOfMonth);
      if (nextDate <= now) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      break;

    case "quarterly":
      const currentMonth = nextDate.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      nextDate.setMonth(quarterStartMonth);
      nextDate.setDate(dayOfMonth ?? 1);
      if (nextDate <= now) {
        nextDate.setMonth(nextDate.getMonth() + 3);
      }
      break;
  }

  return nextDate;
}
