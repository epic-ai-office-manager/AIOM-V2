/**
 * Workflow Automation Data Access Layer
 *
 * Handles database operations for the workflow automation engine.
 * Supports workflow definitions, instances, step executions, and approvals.
 */

import { eq, desc, and, gte, lte, or, count, sql, inArray } from "drizzle-orm";
import { database } from "~/db";
import {
  workflowDefinition,
  workflowInstance,
  workflowStepExecution,
  workflowEventLog,
  workflowScheduledRun,
  workflowApproval,
  user,
  type WorkflowDefinition,
  type CreateWorkflowDefinitionData,
  type UpdateWorkflowDefinitionData,
  type WorkflowInstance,
  type CreateWorkflowInstanceData,
  type UpdateWorkflowInstanceData,
  type WorkflowStepExecution,
  type CreateWorkflowStepExecutionData,
  type UpdateWorkflowStepExecutionData,
  type WorkflowEventLog,
  type CreateWorkflowEventLogData,
  type WorkflowScheduledRun,
  type CreateWorkflowScheduledRunData,
  type UpdateWorkflowScheduledRunData,
  type WorkflowApproval,
  type CreateWorkflowApprovalData,
  type UpdateWorkflowApprovalData,
  type WorkflowDefinitionStatus,
  type WorkflowInstanceStatus,
  type WorkflowStepStatus,
  type WorkflowTriggerType,
  type User,
} from "~/db/schema";

// =============================================================================
// Type Exports
// =============================================================================

export type {
  WorkflowDefinition,
  CreateWorkflowDefinitionData,
  UpdateWorkflowDefinitionData,
  WorkflowInstance,
  CreateWorkflowInstanceData,
  UpdateWorkflowInstanceData,
  WorkflowStepExecution,
  CreateWorkflowStepExecutionData,
  UpdateWorkflowStepExecutionData,
  WorkflowEventLog,
  CreateWorkflowEventLogData,
  WorkflowScheduledRun,
  CreateWorkflowScheduledRunData,
  UpdateWorkflowScheduledRunData,
  WorkflowApproval,
  CreateWorkflowApprovalData,
  UpdateWorkflowApprovalData,
  WorkflowDefinitionStatus,
  WorkflowInstanceStatus,
  WorkflowStepStatus,
  WorkflowTriggerType,
};

export type WorkflowDefinitionWithCreator = WorkflowDefinition & {
  creator: Pick<User, "id" | "name" | "email">;
};

export type WorkflowInstanceWithDefinition = WorkflowInstance & {
  definition: Pick<WorkflowDefinition, "id" | "name" | "triggerType">;
  triggeredByUser?: Pick<User, "id" | "name" | "email"> | null;
};

export type WorkflowStatistics = {
  totalDefinitions: number;
  activeDefinitions: number;
  totalInstances: number;
  runningInstances: number;
  completedInstances: number;
  failedInstances: number;
  pendingApprovals: number;
};

// =============================================================================
// Workflow Definition CRUD Operations
// =============================================================================

/**
 * Create a new workflow definition
 */
export async function createWorkflowDefinition(
  data: CreateWorkflowDefinitionData
): Promise<WorkflowDefinition> {
  const [newDefinition] = await database
    .insert(workflowDefinition)
    .values(data)
    .returning();

  return newDefinition;
}

/**
 * Find a workflow definition by ID
 */
export async function findWorkflowDefinitionById(
  id: string
): Promise<WorkflowDefinition | null> {
  const [result] = await database
    .select()
    .from(workflowDefinition)
    .where(eq(workflowDefinition.id, id))
    .limit(1);

  return result || null;
}

/**
 * Find a workflow definition by ID with creator info
 */
export async function findWorkflowDefinitionWithCreator(
  id: string
): Promise<WorkflowDefinitionWithCreator | null> {
  const result = await database
    .select({
      id: workflowDefinition.id,
      name: workflowDefinition.name,
      description: workflowDefinition.description,
      createdBy: workflowDefinition.createdBy,
      status: workflowDefinition.status,
      triggerType: workflowDefinition.triggerType,
      triggerConfig: workflowDefinition.triggerConfig,
      steps: workflowDefinition.steps,
      variables: workflowDefinition.variables,
      maxConcurrentInstances: workflowDefinition.maxConcurrentInstances,
      timeoutMinutes: workflowDefinition.timeoutMinutes,
      retryOnFailure: workflowDefinition.retryOnFailure,
      maxRetries: workflowDefinition.maxRetries,
      tags: workflowDefinition.tags,
      version: workflowDefinition.version,
      isLatest: workflowDefinition.isLatest,
      previousVersionId: workflowDefinition.previousVersionId,
      totalExecutions: workflowDefinition.totalExecutions,
      successfulExecutions: workflowDefinition.successfulExecutions,
      failedExecutions: workflowDefinition.failedExecutions,
      lastExecutedAt: workflowDefinition.lastExecutedAt,
      createdAt: workflowDefinition.createdAt,
      updatedAt: workflowDefinition.updatedAt,
      creator: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .from(workflowDefinition)
    .innerJoin(user, eq(workflowDefinition.createdBy, user.id))
    .where(eq(workflowDefinition.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Update a workflow definition
 */
export async function updateWorkflowDefinition(
  id: string,
  data: UpdateWorkflowDefinitionData
): Promise<WorkflowDefinition | null> {
  const [updated] = await database
    .update(workflowDefinition)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(workflowDefinition.id, id))
    .returning();

  return updated || null;
}

/**
 * Delete a workflow definition
 */
export async function deleteWorkflowDefinition(id: string): Promise<boolean> {
  const [deleted] = await database
    .delete(workflowDefinition)
    .where(eq(workflowDefinition.id, id))
    .returning();

  return deleted !== undefined;
}

/**
 * Find all workflow definitions with optional filters
 */
export async function findAllWorkflowDefinitions(options?: {
  status?: WorkflowDefinitionStatus;
  triggerType?: WorkflowTriggerType;
  createdBy?: string;
  isLatest?: boolean;
  limit?: number;
  offset?: number;
}): Promise<WorkflowDefinitionWithCreator[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (options?.status) {
    conditions.push(eq(workflowDefinition.status, options.status));
  }

  if (options?.triggerType) {
    conditions.push(eq(workflowDefinition.triggerType, options.triggerType));
  }

  if (options?.createdBy) {
    conditions.push(eq(workflowDefinition.createdBy, options.createdBy));
  }

  if (options?.isLatest !== undefined) {
    conditions.push(eq(workflowDefinition.isLatest, options.isLatest));
  }

  const query = database
    .select({
      id: workflowDefinition.id,
      name: workflowDefinition.name,
      description: workflowDefinition.description,
      createdBy: workflowDefinition.createdBy,
      status: workflowDefinition.status,
      triggerType: workflowDefinition.triggerType,
      triggerConfig: workflowDefinition.triggerConfig,
      steps: workflowDefinition.steps,
      variables: workflowDefinition.variables,
      maxConcurrentInstances: workflowDefinition.maxConcurrentInstances,
      timeoutMinutes: workflowDefinition.timeoutMinutes,
      retryOnFailure: workflowDefinition.retryOnFailure,
      maxRetries: workflowDefinition.maxRetries,
      tags: workflowDefinition.tags,
      version: workflowDefinition.version,
      isLatest: workflowDefinition.isLatest,
      previousVersionId: workflowDefinition.previousVersionId,
      totalExecutions: workflowDefinition.totalExecutions,
      successfulExecutions: workflowDefinition.successfulExecutions,
      failedExecutions: workflowDefinition.failedExecutions,
      lastExecutedAt: workflowDefinition.lastExecutedAt,
      createdAt: workflowDefinition.createdAt,
      updatedAt: workflowDefinition.updatedAt,
      creator: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
    .from(workflowDefinition)
    .innerJoin(user, eq(workflowDefinition.createdBy, user.id));

  const results =
    conditions.length > 0
      ? await query
          .where(and(...conditions))
          .orderBy(desc(workflowDefinition.updatedAt))
          .limit(options?.limit ?? 50)
          .offset(options?.offset ?? 0)
      : await query
          .orderBy(desc(workflowDefinition.updatedAt))
          .limit(options?.limit ?? 50)
          .offset(options?.offset ?? 0);

  return results;
}

/**
 * Find active workflow definitions by trigger type
 */
export async function findActiveWorkflowsByTrigger(
  triggerType: WorkflowTriggerType
): Promise<WorkflowDefinition[]> {
  const results = await database
    .select()
    .from(workflowDefinition)
    .where(
      and(
        eq(workflowDefinition.triggerType, triggerType),
        eq(workflowDefinition.status, "active"),
        eq(workflowDefinition.isLatest, true)
      )
    );

  return results;
}

/**
 * Find workflow definitions created by a specific user
 */
export async function findWorkflowDefinitionsByCreator(
  userId: string,
  options?: {
    status?: WorkflowDefinitionStatus;
    triggerType?: WorkflowTriggerType;
    category?: string;
    limit?: number;
    offset?: number;
  }
): Promise<WorkflowDefinitionWithCreator[]> {
  return findAllWorkflowDefinitions({
    ...options,
    createdBy: userId,
  });
}

/**
 * Activate a workflow definition
 */
export async function activateWorkflowDefinition(
  id: string
): Promise<WorkflowDefinition | null> {
  return updateWorkflowDefinition(id, { status: "active" });
}

/**
 * Pause a workflow definition
 */
export async function pauseWorkflowDefinition(
  id: string
): Promise<WorkflowDefinition | null> {
  return updateWorkflowDefinition(id, { status: "paused" });
}

/**
 * Archive a workflow definition
 */
export async function archiveWorkflowDefinition(
  id: string
): Promise<WorkflowDefinition | null> {
  return updateWorkflowDefinition(id, { status: "archived" });
}

/**
 * Create a new version of a workflow definition
 */
export async function createWorkflowVersion(
  baseDefinitionId: string,
  updates: UpdateWorkflowDefinitionData
): Promise<WorkflowDefinition | null> {
  const baseDefinition = await findWorkflowDefinitionById(baseDefinitionId);
  if (!baseDefinition) return null;

  // Mark the old version as not latest
  await updateWorkflowDefinition(baseDefinitionId, { isLatest: false });

  // Create new version
  const newVersion = await createWorkflowDefinition({
    id: crypto.randomUUID(),
    name: baseDefinition.name,
    description: updates.description ?? baseDefinition.description,
    createdBy: baseDefinition.createdBy,
    status: "draft",
    triggerType: updates.triggerType ?? baseDefinition.triggerType,
    triggerConfig: updates.triggerConfig ?? baseDefinition.triggerConfig,
    steps: updates.steps ?? baseDefinition.steps,
    variables: updates.variables ?? baseDefinition.variables,
    maxConcurrentInstances: updates.maxConcurrentInstances ?? baseDefinition.maxConcurrentInstances,
    timeoutMinutes: updates.timeoutMinutes ?? baseDefinition.timeoutMinutes,
    retryOnFailure: updates.retryOnFailure ?? baseDefinition.retryOnFailure,
    maxRetries: updates.maxRetries ?? baseDefinition.maxRetries,
    tags: updates.tags ?? baseDefinition.tags,
    version: baseDefinition.version + 1,
    isLatest: true,
    previousVersionId: baseDefinitionId,
  });

  return newVersion;
}

/**
 * Increment execution statistics for a workflow definition
 */
export async function incrementWorkflowExecutionStats(
  id: string,
  success: boolean
): Promise<void> {
  const def = await findWorkflowDefinitionById(id);
  if (!def) return;

  await database
    .update(workflowDefinition)
    .set({
      totalExecutions: def.totalExecutions + 1,
      successfulExecutions: success ? def.successfulExecutions + 1 : def.successfulExecutions,
      failedExecutions: !success ? def.failedExecutions + 1 : def.failedExecutions,
      lastExecutedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowDefinition.id, id));
}

// =============================================================================
// Workflow Instance CRUD Operations
// =============================================================================

/**
 * Create a new workflow instance
 */
export async function createWorkflowInstance(
  data: CreateWorkflowInstanceData
): Promise<WorkflowInstance> {
  const [newInstance] = await database
    .insert(workflowInstance)
    .values(data)
    .returning();

  return newInstance;
}

/**
 * Find a workflow instance by ID
 */
export async function findWorkflowInstanceById(
  id: string
): Promise<WorkflowInstance | null> {
  const [result] = await database
    .select()
    .from(workflowInstance)
    .where(eq(workflowInstance.id, id))
    .limit(1);

  return result || null;
}

/**
 * Find a workflow instance with its definition
 */
export async function findWorkflowInstanceWithDefinition(
  id: string
): Promise<WorkflowInstanceWithDefinition | null> {
  const result = await database
    .select({
      id: workflowInstance.id,
      definitionId: workflowInstance.definitionId,
      status: workflowInstance.status,
      triggeredBy: workflowInstance.triggeredBy,
      triggerData: workflowInstance.triggerData,
      currentStepIndex: workflowInstance.currentStepIndex,
      currentStepId: workflowInstance.currentStepId,
      context: workflowInstance.context,
      output: workflowInstance.output,
      errorMessage: workflowInstance.errorMessage,
      errorDetails: workflowInstance.errorDetails,
      retryCount: workflowInstance.retryCount,
      lastRetryAt: workflowInstance.lastRetryAt,
      startedAt: workflowInstance.startedAt,
      completedAt: workflowInstance.completedAt,
      pausedAt: workflowInstance.pausedAt,
      dueAt: workflowInstance.dueAt,
      createdAt: workflowInstance.createdAt,
      updatedAt: workflowInstance.updatedAt,
      definition: {
        id: workflowDefinition.id,
        name: workflowDefinition.name,
        triggerType: workflowDefinition.triggerType,
      },
    })
    .from(workflowInstance)
    .innerJoin(workflowDefinition, eq(workflowInstance.definitionId, workflowDefinition.id))
    .where(eq(workflowInstance.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Update a workflow instance
 */
export async function updateWorkflowInstance(
  id: string,
  data: UpdateWorkflowInstanceData
): Promise<WorkflowInstance | null> {
  const [updated] = await database
    .update(workflowInstance)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(workflowInstance.id, id))
    .returning();

  return updated || null;
}

/**
 * Find workflow instances by definition
 */
export async function findInstancesByDefinition(
  definitionId: string,
  options?: {
    status?: WorkflowInstanceStatus;
    limit?: number;
    offset?: number;
  }
): Promise<WorkflowInstance[]> {
  const conditions = [eq(workflowInstance.definitionId, definitionId)];

  if (options?.status) {
    conditions.push(eq(workflowInstance.status, options.status));
  }

  const results = await database
    .select()
    .from(workflowInstance)
    .where(and(...conditions))
    .orderBy(desc(workflowInstance.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  return results;
}

/**
 * Alias for findInstancesByDefinition
 */
export const findWorkflowInstancesByDefinition = findInstancesByDefinition;

/**
 * Find recent workflow instances across all definitions
 */
export async function findRecentWorkflowInstances(
  options?: {
    status?: WorkflowInstanceStatus;
    limit?: number;
    offset?: number;
  }
): Promise<WorkflowInstance[]> {
  const conditions = [];

  if (options?.status) {
    conditions.push(eq(workflowInstance.status, options.status));
  }

  const query = database
    .select()
    .from(workflowInstance)
    .orderBy(desc(workflowInstance.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  if (conditions.length > 0) {
    return await query.where(and(...conditions));
  }

  return await query;
}

/**
 * Find running workflow instances
 */
export async function findRunningInstances(
  definitionId?: string
): Promise<WorkflowInstance[]> {
  const conditions = [eq(workflowInstance.status, "running")];

  if (definitionId) {
    conditions.push(eq(workflowInstance.definitionId, definitionId));
  }

  const results = await database
    .select()
    .from(workflowInstance)
    .where(and(...conditions))
    .orderBy(workflowInstance.startedAt);

  return results;
}

/**
 * Count running instances for a definition
 */
export async function countRunningInstances(definitionId: string): Promise<number> {
  const [result] = await database
    .select({ count: count() })
    .from(workflowInstance)
    .where(
      and(
        eq(workflowInstance.definitionId, definitionId),
        eq(workflowInstance.status, "running")
      )
    );

  return result?.count ?? 0;
}

/**
 * Start a workflow instance
 */
export async function startWorkflowInstance(
  id: string
): Promise<WorkflowInstance | null> {
  return updateWorkflowInstance(id, {
    status: "running",
    startedAt: new Date(),
  });
}

/**
 * Complete a workflow instance
 */
export async function completeWorkflowInstance(
  id: string,
  output?: string
): Promise<WorkflowInstance | null> {
  return updateWorkflowInstance(id, {
    status: "completed",
    completedAt: new Date(),
    output,
  });
}

/**
 * Fail a workflow instance
 */
export async function failWorkflowInstance(
  id: string,
  errorMessage: string,
  errorDetails?: string
): Promise<WorkflowInstance | null> {
  return updateWorkflowInstance(id, {
    status: "failed",
    completedAt: new Date(),
    errorMessage,
    errorDetails,
  });
}

/**
 * Pause a workflow instance
 */
export async function pauseWorkflowInstance(
  id: string
): Promise<WorkflowInstance | null> {
  return updateWorkflowInstance(id, {
    status: "paused",
    pausedAt: new Date(),
  });
}

/**
 * Resume a workflow instance
 */
export async function resumeWorkflowInstance(
  id: string
): Promise<WorkflowInstance | null> {
  return updateWorkflowInstance(id, {
    status: "running",
    pausedAt: null,
  });
}

/**
 * Cancel a workflow instance
 */
export async function cancelWorkflowInstance(
  id: string
): Promise<WorkflowInstance | null> {
  return updateWorkflowInstance(id, {
    status: "cancelled",
    completedAt: new Date(),
  });
}

// =============================================================================
// Workflow Step Execution Operations
// =============================================================================

/**
 * Create a step execution record
 */
export async function createStepExecution(
  data: CreateWorkflowStepExecutionData
): Promise<WorkflowStepExecution> {
  const [newStep] = await database
    .insert(workflowStepExecution)
    .values(data)
    .returning();

  return newStep;
}

/**
 * Find a step execution by ID
 */
export async function findStepExecutionById(
  id: string
): Promise<WorkflowStepExecution | null> {
  const [result] = await database
    .select()
    .from(workflowStepExecution)
    .where(eq(workflowStepExecution.id, id))
    .limit(1);

  return result || null;
}

/**
 * Update a step execution
 */
export async function updateStepExecution(
  id: string,
  data: UpdateWorkflowStepExecutionData
): Promise<WorkflowStepExecution | null> {
  const [updated] = await database
    .update(workflowStepExecution)
    .set(data)
    .where(eq(workflowStepExecution.id, id))
    .returning();

  return updated || null;
}

/**
 * Find step executions for an instance
 */
export async function findStepExecutionsByInstance(
  instanceId: string
): Promise<WorkflowStepExecution[]> {
  const results = await database
    .select()
    .from(workflowStepExecution)
    .where(eq(workflowStepExecution.instanceId, instanceId))
    .orderBy(workflowStepExecution.stepIndex);

  return results;
}

/**
 * Start a step execution
 */
export async function startStepExecution(
  id: string
): Promise<WorkflowStepExecution | null> {
  return updateStepExecution(id, {
    status: "running",
    startedAt: new Date(),
  });
}

/**
 * Complete a step execution
 */
export async function completeStepExecution(
  id: string,
  output?: string
): Promise<WorkflowStepExecution | null> {
  const step = await findStepExecutionById(id);
  const startTime = step?.startedAt?.getTime() || Date.now();
  const executionDurationMs = Date.now() - startTime;

  return updateStepExecution(id, {
    status: "completed",
    completedAt: new Date(),
    output,
    executionDurationMs,
  });
}

/**
 * Fail a step execution
 */
export async function failStepExecution(
  id: string,
  errorMessage: string,
  errorDetails?: string
): Promise<WorkflowStepExecution | null> {
  const step = await findStepExecutionById(id);
  const startTime = step?.startedAt?.getTime() || Date.now();
  const executionDurationMs = Date.now() - startTime;

  return updateStepExecution(id, {
    status: "failed",
    completedAt: new Date(),
    errorMessage,
    errorDetails,
    executionDurationMs,
  });
}

/**
 * Skip a step execution
 */
export async function skipStepExecution(
  id: string
): Promise<WorkflowStepExecution | null> {
  return updateStepExecution(id, {
    status: "skipped",
    completedAt: new Date(),
    executionDurationMs: 0,
  });
}

// =============================================================================
// Workflow Event Log Operations
// =============================================================================

/**
 * Create an event log entry
 */
export async function createEventLog(
  data: CreateWorkflowEventLogData
): Promise<WorkflowEventLog> {
  const [newLog] = await database
    .insert(workflowEventLog)
    .values(data)
    .returning();

  return newLog;
}

/**
 * Find event logs for an instance
 */
export async function findEventLogsByInstance(
  instanceId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<WorkflowEventLog[]> {
  const results = await database
    .select()
    .from(workflowEventLog)
    .where(eq(workflowEventLog.instanceId, instanceId))
    .orderBy(desc(workflowEventLog.occurredAt))
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0);

  return results;
}

/**
 * Log a workflow event
 */
export async function logWorkflowEvent(
  instanceId: string,
  eventType: string,
  options?: {
    stepExecutionId?: string;
    eventData?: Record<string, unknown>;
    actorId?: string;
    actorType?: "system" | "user";
  }
): Promise<WorkflowEventLog> {
  return createEventLog({
    id: crypto.randomUUID(),
    instanceId,
    stepExecutionId: options?.stepExecutionId,
    eventType,
    eventData: options?.eventData ? JSON.stringify(options.eventData) : undefined,
    actorId: options?.actorId,
    actorType: options?.actorType || "system",
  });
}

// =============================================================================
// Workflow Scheduled Run Operations
// =============================================================================

/**
 * Create a scheduled run
 */
export async function createScheduledRun(
  data: CreateWorkflowScheduledRunData
): Promise<WorkflowScheduledRun> {
  const [newRun] = await database
    .insert(workflowScheduledRun)
    .values(data)
    .returning();

  return newRun;
}

/**
 * Find a scheduled run by ID
 */
export async function findScheduledRunById(
  id: string
): Promise<WorkflowScheduledRun | null> {
  const [result] = await database
    .select()
    .from(workflowScheduledRun)
    .where(eq(workflowScheduledRun.id, id))
    .limit(1);

  return result || null;
}

/**
 * Update a scheduled run
 */
export async function updateScheduledRun(
  id: string,
  data: UpdateWorkflowScheduledRunData
): Promise<WorkflowScheduledRun | null> {
  const [updated] = await database
    .update(workflowScheduledRun)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(workflowScheduledRun.id, id))
    .returning();

  return updated || null;
}

/**
 * Find due scheduled runs
 */
export async function findDueScheduledRuns(): Promise<WorkflowScheduledRun[]> {
  const results = await database
    .select()
    .from(workflowScheduledRun)
    .where(
      and(
        eq(workflowScheduledRun.isActive, true),
        lte(workflowScheduledRun.scheduledFor, new Date())
      )
    )
    .orderBy(workflowScheduledRun.scheduledFor);

  return results;
}

/**
 * Mark a scheduled run as executed
 */
export async function markScheduledRunExecuted(
  id: string,
  instanceId: string,
  nextRunAt?: Date
): Promise<WorkflowScheduledRun | null> {
  return updateScheduledRun(id, {
    lastRunAt: new Date(),
    lastRunInstanceId: instanceId,
    nextRunAt,
    scheduledFor: nextRunAt || new Date(),
    isActive: !!nextRunAt,
  });
}

// =============================================================================
// Workflow Approval Operations
// =============================================================================

/**
 * Create an approval request
 */
export async function createApproval(
  data: CreateWorkflowApprovalData
): Promise<WorkflowApproval> {
  const [newApproval] = await database
    .insert(workflowApproval)
    .values(data)
    .returning();

  return newApproval;
}

/**
 * Find an approval by ID
 */
export async function findApprovalById(
  id: string
): Promise<WorkflowApproval | null> {
  const [result] = await database
    .select()
    .from(workflowApproval)
    .where(eq(workflowApproval.id, id))
    .limit(1);

  return result || null;
}

/**
 * Update an approval
 */
export async function updateApproval(
  id: string,
  data: UpdateWorkflowApprovalData
): Promise<WorkflowApproval | null> {
  const [updated] = await database
    .update(workflowApproval)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(workflowApproval.id, id))
    .returning();

  return updated || null;
}

/**
 * Find pending approvals for a user
 */
export async function findPendingApprovalsForUser(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<WorkflowApproval[]> {
  const results = await database
    .select()
    .from(workflowApproval)
    .where(
      and(
        eq(workflowApproval.approverId, userId),
        eq(workflowApproval.status, "pending")
      )
    )
    .orderBy(workflowApproval.dueAt)
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  return results;
}

/**
 * Alias for findPendingApprovalsForUser
 */
export const findPendingApprovals = findPendingApprovalsForUser;

/**
 * Find approvals for an instance
 */
export async function findApprovalsByInstance(
  instanceId: string
): Promise<WorkflowApproval[]> {
  const results = await database
    .select()
    .from(workflowApproval)
    .where(eq(workflowApproval.instanceId, instanceId))
    .orderBy(desc(workflowApproval.createdAt));

  return results;
}

/**
 * Approve a workflow approval
 */
export async function approveWorkflowApproval(
  id: string,
  approverId: string,
  comments?: string
): Promise<WorkflowApproval | null> {
  // Verify the approval belongs to the approver
  const approval = await findApprovalById(id);
  if (!approval || approval.approverId !== approverId) {
    throw new Error("Approval not found or access denied");
  }

  return updateApproval(id, {
    status: "approved",
    decision: "approved",
    comments,
    decidedAt: new Date(),
  });
}

/**
 * Reject a workflow approval
 */
export async function rejectWorkflowApproval(
  id: string,
  approverId: string,
  comments?: string
): Promise<WorkflowApproval | null> {
  // Verify the approval belongs to the approver
  const approval = await findApprovalById(id);
  if (!approval || approval.approverId !== approverId) {
    throw new Error("Approval not found or access denied");
  }

  return updateApproval(id, {
    status: "rejected",
    decision: "rejected",
    comments,
    decidedAt: new Date(),
  });
}

// =============================================================================
// Statistics Operations
// =============================================================================

/**
 * Get workflow statistics
 */
export async function getWorkflowStatistics(): Promise<WorkflowStatistics> {
  // Count definitions by status
  const definitionsCount = await database
    .select({
      status: workflowDefinition.status,
      count: count(),
    })
    .from(workflowDefinition)
    .where(eq(workflowDefinition.isLatest, true))
    .groupBy(workflowDefinition.status);

  // Count instances by status
  const instancesCount = await database
    .select({
      status: workflowInstance.status,
      count: count(),
    })
    .from(workflowInstance)
    .groupBy(workflowInstance.status);

  // Count pending approvals
  const [approvalCount] = await database
    .select({ count: count() })
    .from(workflowApproval)
    .where(eq(workflowApproval.status, "pending"));

  const stats: WorkflowStatistics = {
    totalDefinitions: 0,
    activeDefinitions: 0,
    totalInstances: 0,
    runningInstances: 0,
    completedInstances: 0,
    failedInstances: 0,
    pendingApprovals: approvalCount?.count ?? 0,
  };

  for (const row of definitionsCount) {
    stats.totalDefinitions += row.count;
    if (row.status === "active") stats.activeDefinitions = row.count;
  }

  for (const row of instancesCount) {
    stats.totalInstances += row.count;
    if (row.status === "running") stats.runningInstances = row.count;
    if (row.status === "completed") stats.completedInstances = row.count;
    if (row.status === "failed") stats.failedInstances = row.count;
  }

  return stats;
}

/**
 * Get statistics for a specific workflow definition
 */
export async function getWorkflowStatisticsByDefinition(
  definitionId: string
): Promise<{
  totalInstances: number;
  runningInstances: number;
  completedInstances: number;
  failedInstances: number;
  averageExecutionTime: number | null;
  successRate: number;
}> {
  // Count instances by status
  const instancesCount = await database
    .select({
      status: workflowInstance.status,
      count: count(),
    })
    .from(workflowInstance)
    .where(eq(workflowInstance.definitionId, definitionId))
    .groupBy(workflowInstance.status);

  const stats = {
    totalInstances: 0,
    runningInstances: 0,
    completedInstances: 0,
    failedInstances: 0,
    averageExecutionTime: null as number | null,
    successRate: 0,
  };

  for (const row of instancesCount) {
    stats.totalInstances += row.count;
    if (row.status === "running") stats.runningInstances = row.count;
    if (row.status === "completed") stats.completedInstances = row.count;
    if (row.status === "failed") stats.failedInstances = row.count;
  }

  // Calculate success rate
  if (stats.totalInstances > 0) {
    stats.successRate = (stats.completedInstances / stats.totalInstances) * 100;
  }

  // Calculate average execution time for completed instances
  const completedInstances = await database
    .select({
      startedAt: workflowInstance.startedAt,
      completedAt: workflowInstance.completedAt,
    })
    .from(workflowInstance)
    .where(
      and(
        eq(workflowInstance.definitionId, definitionId),
        eq(workflowInstance.status, "completed")
      )
    );

  if (completedInstances.length > 0) {
    const totalTime = completedInstances.reduce((sum, instance) => {
      if (instance.startedAt && instance.completedAt) {
        return sum + (instance.completedAt.getTime() - instance.startedAt.getTime());
      }
      return sum;
    }, 0);
    stats.averageExecutionTime = totalTime / completedInstances.length;
  }

  return stats;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse workflow steps from JSON string
 */
export function parseWorkflowSteps(json: string): unknown[] {
  try {
    return JSON.parse(json) as unknown[];
  } catch {
    return [];
  }
}

/**
 * Stringify workflow steps to JSON
 */
export function stringifyWorkflowSteps(steps: unknown[]): string {
  return JSON.stringify(steps);
}

/**
 * Parse workflow variables from JSON string
 */
export function parseWorkflowVariables(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Stringify workflow variables to JSON
 */
export function stringifyWorkflowVariables(variables: Record<string, unknown>): string {
  return JSON.stringify(variables);
}

/**
 * Parse workflow context from JSON string
 */
export function parseWorkflowContext(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Stringify workflow context to JSON
 */
export function stringifyWorkflowContext(context: Record<string, unknown>): string {
  return JSON.stringify(context);
}
