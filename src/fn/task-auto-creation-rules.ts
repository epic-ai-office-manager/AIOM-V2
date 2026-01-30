/**
 * Server Functions for Task Auto-Creation Rules
 *
 * Provides server-side functions for managing task auto-creation rules
 * with authentication and validation.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticatedMiddleware } from "./middleware";
import {
  createTaskAutoCreationRule,
  findTaskAutoCreationRuleById,
  findTaskAutoCreationRuleWithCreator,
  updateTaskAutoCreationRule,
  deleteTaskAutoCreationRule,
  findRulesByCreator,
  findAllRules,
  findActiveRulesByTrigger,
  activateRule,
  pauseRule,
  disableRule,
  archiveRule,
  canRuleBeTrigger,
  findExecutionLogsByRule,
  findRecentExecutionLogs,
  getRuleStatistics,
  getRuleStatisticsById,
  stringifyTaskTemplate,
  stringifyConditions,
  type TaskRuleTriggerType,
  type TaskRuleStatus,
} from "~/data-access/task-auto-creation-rules";
import {
  processTrigger,
  triggerRule,
  testRuleConditions,
  previewGeneratedTask,
  type TriggerContext,
  type TaskTemplateConfig,
  type TaskRuleConditionsConfig,
} from "~/lib/task-rule-engine";

// =============================================================================
// Zod Schemas
// =============================================================================

const triggerTypeSchema = z.enum([
  "new_customer",
  "overdue_invoice",
  "low_inventory",
  "expense_approved",
  "expense_rejected",
  "call_completed",
  "customer_inactive",
  "subscription_expiring",
  "manual",
  "scheduled",
  "custom",
]);

const statusSchema = z.enum(["active", "paused", "disabled", "archived"]);

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
]);

const taskTemplateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueInDays: z.number().int().min(0).optional(),
  dueInHours: z.number().int().min(0).optional(),
  assigneeId: z.string().optional(),
  assigneeRole: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: conditionOperatorSchema,
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(z.number()),
  ]),
});

const conditionsConfigSchema = z.object({
  conditions: z.array(conditionSchema),
  logic: z.enum(["and", "or"]),
});

const createRuleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  triggerType: triggerTypeSchema,
  conditions: conditionsConfigSchema.optional(),
  taskTemplate: taskTemplateSchema,
  schedule: z.string().optional(),
  cooldownMinutes: z.number().int().min(0).optional(),
  maxTriggersPerDay: z.number().int().min(1).optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

const updateRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  triggerType: triggerTypeSchema.optional(),
  conditions: conditionsConfigSchema.optional().nullable(),
  taskTemplate: taskTemplateSchema.optional(),
  status: statusSchema.optional(),
  schedule: z.string().optional().nullable(),
  cooldownMinutes: z.number().int().min(0).optional(),
  maxTriggersPerDay: z.number().int().min(1).optional().nullable(),
  priority: z.number().int().min(0).max(100).optional(),
});

const filterSchema = z
  .object({
    status: statusSchema.optional(),
    triggerType: triggerTypeSchema.optional(),
    limit: z.number().int().min(1).max(100).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
  })
  .optional();

// =============================================================================
// Rule CRUD Operations
// =============================================================================

/**
 * Create a new task auto-creation rule
 */
export const createRuleFn = createServerFn({ method: "POST" })
  .inputValidator(createRuleSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const rule = await createTaskAutoCreationRule({
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      createdBy: userId,
      triggerType: data.triggerType,
      conditions: data.conditions ? stringifyConditions(data.conditions) : null,
      taskTemplate: stringifyTaskTemplate(data.taskTemplate),
      status: "active",
      schedule: data.schedule,
      cooldownMinutes: data.cooldownMinutes ?? 0,
      maxTriggersPerDay: data.maxTriggersPerDay,
      priority: data.priority ?? 0,
    });

    return { rule };
  });

/**
 * Get a rule by ID
 */
export const getRuleFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const rule = await findTaskAutoCreationRuleWithCreator(data.id);
    return { rule };
  });

/**
 * Update a rule
 */
export const updateRuleFn = createServerFn({ method: "POST" })
  .inputValidator(updateRuleSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const { id, conditions, taskTemplate, ...rest } = data;

    const updateData: Record<string, unknown> = { ...rest };

    if (conditions !== undefined) {
      updateData.conditions = conditions ? stringifyConditions(conditions) : null;
    }

    if (taskTemplate !== undefined) {
      updateData.taskTemplate = stringifyTaskTemplate(taskTemplate);
    }

    const rule = await updateTaskAutoCreationRule(id, updateData);
    return { rule };
  });

/**
 * Delete a rule
 */
export const deleteRuleFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const success = await deleteTaskAutoCreationRule(data.id);
    return { success };
  });

/**
 * List rules with filters
 */
export const listRulesFn = createServerFn({ method: "GET" })
  .inputValidator(filterSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const rules = await findAllRules(data);
    return { rules };
  });

/**
 * List rules created by the current user
 */
export const listMyRulesFn = createServerFn({ method: "GET" })
  .inputValidator(filterSchema)
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const rules = await findRulesByCreator(context.userId, data);
    return { rules };
  });

// =============================================================================
// Rule Status Operations
// =============================================================================

/**
 * Activate a rule
 */
export const activateRuleFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const rule = await activateRule(data.id);
    return { rule };
  });

/**
 * Pause a rule
 */
export const pauseRuleFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const rule = await pauseRule(data.id);
    return { rule };
  });

/**
 * Disable a rule
 */
export const disableRuleFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const rule = await disableRule(data.id);
    return { rule };
  });

/**
 * Archive a rule
 */
export const archiveRuleFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const rule = await archiveRule(data.id);
    return { rule };
  });

// =============================================================================
// Rule Execution Operations
// =============================================================================

/**
 * Manually trigger a rule
 */
export const manualTriggerRuleFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      data: z.record(z.string(), z.unknown()).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const result = await triggerRule(data.id, data.data || {});
    return { result };
  });

/**
 * Test rule conditions against sample data
 */
export const testRuleConditionsFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      sampleData: z.record(z.string(), z.unknown()),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const result = await testRuleConditions(data.id, data.sampleData);
    return { result: result as any };
  });

/**
 * Preview task generation from a template
 */
export const previewTaskFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      template: taskTemplateSchema,
      sampleData: z.record(z.string(), z.unknown()),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const preview = previewGeneratedTask(data.template as TaskTemplateConfig, data.sampleData);
    return { preview };
  });

/**
 * Check if a rule can be triggered
 */
export const canTriggerRuleFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const result = await canRuleBeTrigger(data.id);
    return result;
  });

// =============================================================================
// Execution Log Operations
// =============================================================================

/**
 * Get execution logs for a rule
 */
export const getRuleExecutionLogsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      ruleId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).optional().default(20),
      offset: z.number().int().min(0).optional().default(0),
      successOnly: z.boolean().optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const logs = await findExecutionLogsByRule(data.ruleId, {
      limit: data.limit,
      offset: data.offset,
      successOnly: data.successOnly,
    });
    return { logs };
  });

/**
 * Get recent execution logs across all rules
 */
export const getRecentExecutionLogsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
        since: z.string().datetime().optional(),
      })
      .optional()
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const logs = await findRecentExecutionLogs({
      limit: data?.limit ?? 50,
      offset: data?.offset ?? 0,
      since: data?.since ? new Date(data.since) : undefined,
    });
    return { logs };
  });

// =============================================================================
// Statistics Operations
// =============================================================================

/**
 * Get overall rule statistics
 */
export const getRuleStatisticsFn = createServerFn({ method: "GET" })
  .middleware([authenticatedMiddleware])
  .handler(async () => {
    const stats = await getRuleStatistics();
    return { stats };
  });

/**
 * Get statistics for a specific rule
 */
export const getRuleStatsByIdFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }) => {
    const stats = await getRuleStatisticsById(data.id);
    return { stats };
  });

// =============================================================================
// Trigger Processing (for internal use)
// =============================================================================

/**
 * Process a trigger event (typically called by other services)
 * This function is meant to be used internally when events occur
 */
export const processRuleTriggerFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      triggerType: triggerTypeSchema,
      data: z.record(z.string(), z.unknown()),
      userId: z.string().optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data, context }) => {
    const triggerContext: TriggerContext = {
      triggerType: data.triggerType,
      data: data.data,
      userId: data.userId || context.userId,
      timestamp: new Date(),
    };

    // Note: In a real implementation, you would pass a createTaskFn that
    // actually creates tasks in your task system (e.g., Odoo, local DB)
    const result = await processTrigger(triggerContext);
    return { result };
  });
