/**
 * Server Functions for Workflow Automation Engine
 *
 * Provides server-side functions for managing workflow definitions,
 * instances, and executions with authentication and validation.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticatedMiddleware } from "./middleware";
import {
  createWorkflowDefinition,
  findWorkflowDefinitionById,
  findWorkflowDefinitionWithCreator,
  updateWorkflowDefinition,
  deleteWorkflowDefinition,
  findWorkflowDefinitionsByCreator,
  findAllWorkflowDefinitions,
  activateWorkflowDefinition,
  pauseWorkflowDefinition,
  archiveWorkflowDefinition,
  createWorkflowInstance,
  findWorkflowInstanceById,
  findWorkflowInstancesByDefinition,
  findRecentWorkflowInstances,
  findStepExecutionsByInstance,
  findEventLogsByInstance,
  getWorkflowStatistics,
  getWorkflowStatisticsByDefinition,
  findPendingApprovals,
  approveWorkflowApproval,
  rejectWorkflowApproval,
  type WorkflowDefinitionStatus,
  type WorkflowTriggerType,
} from "~/data-access/workflow-automation";
import { workflowEngine } from "~/lib/workflow-automation-engine/engine";
import type { WorkflowExecutionResult } from "~/lib/workflow-automation-engine/types";

// =============================================================================
// Zod Schemas
// =============================================================================

const definitionStatusSchema = z.enum(["draft", "active", "paused", "archived"]);

const triggerTypeSchema = z.enum(["manual", "schedule", "event", "webhook", "api"]);

const stepTypeSchema = z.enum([
  "action",
  "condition",
  "branch",
  "wait",
  "loop",
  "parallel",
  "approval",
  "notification",
  "integration",
]);

const conditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "greater_than_or_equals",
  "less_than_or_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
  "in",
  "not_in",
  "regex_match",
]);

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: conditionOperatorSchema,
  value: z.unknown(),
});

const stepDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: stepTypeSchema,
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  onSuccess: z.string().optional(),
  onFailure: z.string().optional(),
  retryConfig: z.object({
    maxRetries: z.number().int().min(0).max(10),
    retryDelayMs: z.number().int().min(0),
    backoffMultiplier: z.number().optional(),
  }).optional(),
  timeout: z.number().int().min(0).optional(),
});

const triggerConfigSchema = z.object({
  type: triggerTypeSchema,
  schedule: z.string().optional(),
  eventType: z.string().optional(),
  webhookSecret: z.string().optional(),
  conditions: z.array(conditionSchema).optional(),
});

const createDefinitionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  version: z.string().max(20).optional(),
  triggerConfig: triggerConfigSchema,
  steps: z.array(stepDefinitionSchema).min(1, "At least one step is required"),
  variables: z.record(z.string(), z.unknown()).optional(),
  settings: z.object({
    maxConcurrentInstances: z.number().int().min(1).max(100).optional(),
    instanceTimeoutMs: z.number().int().min(0).optional(),
    retryFailedSteps: z.boolean().optional(),
  }).optional(),
});

const updateDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  version: z.string().max(20).optional(),
  triggerConfig: triggerConfigSchema.optional(),
  steps: z.array(stepDefinitionSchema).optional(),
  variables: z.record(z.string(), z.unknown()).optional().nullable(),
  settings: z.object({
    maxConcurrentInstances: z.number().int().min(1).max(100).optional(),
    instanceTimeoutMs: z.number().int().min(0).optional(),
    retryFailedSteps: z.boolean().optional(),
  }).optional().nullable(),
});

const filterSchema = z
  .object({
    status: definitionStatusSchema.optional(),
    triggerType: triggerTypeSchema.optional(),
    category: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
  })
  .optional();

const instanceFilterSchema = z.object({
  definitionId: z.string().uuid().optional(),
  status: z.enum(["pending", "running", "paused", "completed", "failed", "cancelled"]).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
}).optional();

// =============================================================================
// Workflow Definition CRUD Operations
// =============================================================================

/**
 * Create a new workflow definition
 */
export const createWorkflowDefinitionFn = createServerFn({ method: "POST" })
  .inputValidator(createDefinitionSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const userId = context!.userId;

    const definition = await createWorkflowDefinition({
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description || null,
      createdBy: userId,
      triggerType: data.triggerConfig.type,
      triggerConfig: JSON.stringify(data.triggerConfig),
      steps: JSON.stringify(data.steps),
      variables: JSON.stringify(data.variables || {}),
      // Map category to tags array if provided
      tags: data.category ? JSON.stringify([data.category]) : null,
      status: "draft",
    });

    return { definition };
  });

/**
 * Get a workflow definition by ID
 */
export const getWorkflowDefinitionFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const definition = await findWorkflowDefinitionWithCreator(data.id);
    return { definition };
  });

/**
 * Update a workflow definition
 */
export const updateWorkflowDefinitionFn = createServerFn({ method: "POST" })
  .inputValidator(updateDefinitionSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const { id, ...updateData } = data;

    // Stringify JSON fields for DB storage
    const dbUpdateData: any = { ...updateData };
    if (updateData.triggerConfig) {
      dbUpdateData.triggerType = updateData.triggerConfig.type;
      dbUpdateData.triggerConfig = JSON.stringify(updateData.triggerConfig);
    }
    if (updateData.steps) {
      dbUpdateData.steps = JSON.stringify(updateData.steps);
    }
    if (updateData.variables !== undefined) {
      dbUpdateData.variables = JSON.stringify(updateData.variables);
    }

    const definition = await updateWorkflowDefinition(id, dbUpdateData);
    return { definition };
  });

/**
 * Delete a workflow definition
 */
export const deleteWorkflowDefinitionFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const success = await deleteWorkflowDefinition(data.id);
    return { success };
  });

/**
 * List workflow definitions with filters
 */
export const listWorkflowDefinitionsFn = createServerFn({ method: "GET" })
  .inputValidator(filterSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const definitions = await findAllWorkflowDefinitions(data);
    return { definitions };
  });

/**
 * List workflow definitions created by the current user
 */
export const listMyWorkflowDefinitionsFn = createServerFn({ method: "GET" })
  .inputValidator(filterSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const definitions = await findWorkflowDefinitionsByCreator(context!.userId, data);
    return { definitions };
  });

// =============================================================================
// Workflow Definition Status Operations
// =============================================================================

/**
 * Activate a workflow definition
 */
export const activateWorkflowFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const definition = await activateWorkflowDefinition(data.id);
    return { definition };
  });

/**
 * Pause a workflow definition
 */
export const pauseWorkflowFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const definition = await pauseWorkflowDefinition(data.id);
    return { definition };
  });

/**
 * Archive a workflow definition
 */
export const archiveWorkflowFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const definition = await archiveWorkflowDefinition(data.id);
    return { definition };
  });

// =============================================================================
// Workflow Execution Operations
// =============================================================================

/**
 * Trigger a workflow manually
 */
export const triggerWorkflowFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      definitionId: z.string().uuid(),
      data: z.record(z.string(), z.unknown()).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  // @ts-expect-error - TanStack Start type inference issue with WorkflowExecutionResult containing unknown
  .handler(async ({ data, context }) => {
    const result = await workflowEngine.triggerWorkflow(data.definitionId, {
      triggeredBy: context!.userId,
      triggerData: data.data,
    });
    return { result };
  });

/**
 * Resume a paused workflow instance
 */
export const resumeWorkflowFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ instanceId: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  // @ts-expect-error - TanStack Start type inference issue with WorkflowExecutionResult containing unknown
  .handler(async ({ data }) => {
    const result = await workflowEngine.resumeWorkflow(data.instanceId);
    return { result };
  });

/**
 * Get a workflow instance by ID
 */
export const getWorkflowInstanceFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const instance = await findWorkflowInstanceById(data.id);
    return { instance };
  });

/**
 * List workflow instances with filters
 */
export const listWorkflowInstancesFn = createServerFn({ method: "GET" })
  .inputValidator(instanceFilterSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    if (data?.definitionId) {
      const instances = await findWorkflowInstancesByDefinition(data.definitionId, {
        status: data.status,
        limit: data.limit,
        offset: data.offset,
      });
      return { instances };
    }
    const instances = await findRecentWorkflowInstances({
      status: data?.status,
      limit: data?.limit,
      offset: data?.offset,
    });
    return { instances };
  });

/**
 * Get step executions for an instance
 */
export const getStepExecutionsFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ instanceId: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const executions = await findStepExecutionsByInstance(data.instanceId);
    return { executions };
  });

/**
 * Get event logs for an instance
 */
export const getEventLogsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      instanceId: z.string().uuid(),
      limit: z.number().int().min(1).max(500).optional().default(100),
      offset: z.number().int().min(0).optional().default(0),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const logs = await findEventLogsByInstance(data.instanceId, {
      limit: data.limit,
      offset: data.offset,
    });
    return { logs };
  });

// =============================================================================
// Approval Operations
// =============================================================================

/**
 * Get pending approvals for the current user
 */
export const getPendingApprovalsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      limit: z.number().int().min(1).max(100).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    }).optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const approvals = await findPendingApprovals(context!.userId, {
      limit: data?.limit,
      offset: data?.offset,
    });
    return { approvals };
  });

/**
 * Approve a workflow approval request
 */
export const approveWorkflowApprovalFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      approvalId: z.string().uuid(),
      comments: z.string().max(500).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const approval = await approveWorkflowApproval(
      data.approvalId,
      context!.userId,
      data.comments
    );

    // Resume the workflow after approval
    if (approval?.instanceId) {
      await workflowEngine.resumeWorkflow(approval.instanceId);
    }

    return { approval };
  });

/**
 * Reject a workflow approval request
 */
export const rejectWorkflowApprovalFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      approvalId: z.string().uuid(),
      comments: z.string().max(500).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const approval = await rejectWorkflowApproval(
      data.approvalId,
      context!.userId,
      data.comments
    );
    return { approval };
  });

// =============================================================================
// Statistics Operations
// =============================================================================

/**
 * Get overall workflow statistics
 */
export const getWorkflowStatisticsFn = createServerFn({ method: "GET" })
  .middleware([authenticatedMiddleware])
  .handler(async () => {
    const stats = await getWorkflowStatistics();
    return { stats };
  });

/**
 * Get statistics for a specific workflow definition
 */
export const getWorkflowDefinitionStatsFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const stats = await getWorkflowStatisticsByDefinition(data.id);
    return { stats };
  });

// =============================================================================
// Validation Operations
// =============================================================================

/**
 * Validate a workflow definition
 */
export const validateWorkflowDefinitionFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      steps: z.array(stepDefinitionSchema).min(1, "At least one step is required"),
      triggerConfig: triggerConfigSchema,
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const errors: Array<{ stepId?: string; field?: string; message: string }> = [];
    const warnings: Array<{ stepId?: string; message: string }> = [];

    // Check if steps array has at least one step
    if (data.steps.length === 0) {
      errors.push({
        field: "steps",
        message: "At least one step is required",
      });
      return { valid: false, errors, warnings };
    }

    // The first step is the start step
    const startStepId = data.steps[0].id;

    // Validate each step
    for (const step of data.steps) {
      // Check for orphaned steps (no incoming connections except start)
      if (step.id !== startStepId) {
        const hasIncoming = data.steps.some(
          (s) => s.onSuccess === step.id || s.onFailure === step.id
        );
        if (!hasIncoming) {
          warnings.push({
            stepId: step.id,
            message: "Step is not reachable from any other step",
          });
        }
      }

      // Check if onSuccess/onFailure references exist
      if (step.onSuccess && !data.steps.find((s) => s.id === step.onSuccess)) {
        errors.push({
          stepId: step.id,
          field: "onSuccess",
          message: `Referenced step '${step.onSuccess}' does not exist`,
        });
      }
      if (step.onFailure && !data.steps.find((s) => s.id === step.onFailure)) {
        errors.push({
          stepId: step.id,
          field: "onFailure",
          message: `Referenced step '${step.onFailure}' does not exist`,
        });
      }

      // Validate step-specific config
      if (step.type === "condition" || step.type === "branch") {
        if (!step.config.conditions) {
          errors.push({
            stepId: step.id,
            field: "config.conditions",
            message: "Condition/branch steps require conditions",
          });
        }
      }

      if (step.type === "loop") {
        if (!step.config.collection && !step.config.count) {
          errors.push({
            stepId: step.id,
            field: "config",
            message: "Loop steps require either collection or count",
          });
        }
      }

      if (step.type === "approval") {
        if (!step.config.approverType) {
          errors.push({
            stepId: step.id,
            field: "config.approverType",
            message: "Approval steps require approverType",
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  });

// =============================================================================
// Webhook Trigger (for external systems)
// =============================================================================

/**
 * Trigger workflow via webhook
 * Note: This would typically have different auth (webhook secret)
 */
export const webhookTriggerWorkflowFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      definitionId: z.string().uuid(),
      secret: z.string().min(1),
      data: z.record(z.string(), z.unknown()).optional(),
    })
  )
  // @ts-expect-error - TanStack Start type inference issue with WorkflowExecutionResult containing unknown
  .handler(async ({ data }) => {
    // Get the definition to verify webhook secret
    const definition = await findWorkflowDefinitionById(data.definitionId);
    if (!definition) {
      throw new Error("Workflow definition not found");
    }

    const triggerConfig = definition.triggerConfig as { webhookSecret?: string };
    if (triggerConfig.webhookSecret !== data.secret) {
      throw new Error("Invalid webhook secret");
    }

    if (definition.status !== "active") {
      throw new Error("Workflow is not active");
    }

    const result = await workflowEngine.triggerWorkflow(data.definitionId, {
      triggerData: data.data,
    });

    return { result };
  });
