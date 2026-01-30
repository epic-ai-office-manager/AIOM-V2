/**
 * Workflow Automation Engine
 *
 * Core engine for executing workflow automations with support for
 * conditions, branches, parallel execution, and integrations.
 */

import type {
  WorkflowContext,
  WorkflowExecutionResult,
  StepExecutionResult,
  WorkflowEngineConfig,
  WorkflowStepDefinition,
  WorkflowLoopConfig,
  WorkflowParallelConfig,
  WorkflowApprovalConfig,
} from "./types";
import { DEFAULT_ENGINE_CONFIG } from "./types";
import { getStepHandler } from "./step-handlers";
import { parseWorkflowContext, stringifyWorkflowContext } from "~/data-access/workflow-automation";
import {
  findWorkflowDefinitionById,
  findWorkflowInstanceById,
  createWorkflowInstance,
  updateWorkflowInstance,
  startWorkflowInstance,
  completeWorkflowInstance,
  failWorkflowInstance,
  pauseWorkflowInstance,
  createStepExecution,
  startStepExecution,
  completeStepExecution,
  failStepExecution,
  skipStepExecution,
  logWorkflowEvent,
  countRunningInstances,
  incrementWorkflowExecutionStats,
  createApproval,
  findApprovalsByInstance,
} from "~/data-access/workflow-automation";
import type { WorkflowDefinition, WorkflowInstance } from "~/db/schema";

/**
 * WorkflowEngine - Core execution engine for workflow automations
 */
export class WorkflowEngine {
  private config: WorkflowEngineConfig;

  constructor(config: Partial<WorkflowEngineConfig> = {}) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
  }

  /**
   * Trigger a workflow by its definition ID
   */
  async triggerWorkflow(
    definitionId: string,
    options: {
      triggeredBy?: string;
      triggerData?: Record<string, unknown>;
    } = {}
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();

    // Get the workflow definition
    const definition = await findWorkflowDefinitionById(definitionId);
    if (!definition) {
      return {
        instanceId: "",
        status: "failed",
        error: "Workflow definition not found",
        stepsExecuted: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Check if workflow is active
    if (definition.status !== "active") {
      return {
        instanceId: "",
        status: "failed",
        error: `Workflow is not active (status: ${definition.status})`,
        stepsExecuted: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Check concurrent instance limit
    const runningCount = await countRunningInstances(definitionId);
    if (runningCount >= definition.maxConcurrentInstances) {
      return {
        instanceId: "",
        status: "failed",
        error: `Maximum concurrent instances (${definition.maxConcurrentInstances}) reached`,
        stepsExecuted: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Create workflow instance
    const instance = await createWorkflowInstance({
      id: crypto.randomUUID(),
      definitionId,
      status: "pending",
      triggeredBy: options.triggeredBy,
      triggerData: options.triggerData ? JSON.stringify(options.triggerData) : undefined,
      context: JSON.stringify({
        variables: this.parseVariables(definition.variables),
        triggerData: options.triggerData || {},
        stepResults: {},
      }),
    });

    // Log workflow started event
    await logWorkflowEvent(instance.id, "workflow_triggered", {
      actorId: options.triggeredBy,
      actorType: options.triggeredBy ? "user" : "system",
      eventData: { definitionId, triggerData: options.triggerData },
    });

    // Execute the workflow
    return this.executeWorkflow(instance.id, definition);
  }

  /**
   * Execute a workflow instance
   */
  async executeWorkflow(
    instanceId: string,
    definition?: WorkflowDefinition
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    let stepsExecuted = 0;

    // Get instance
    const instance = await findWorkflowInstanceById(instanceId);
    if (!instance) {
      return {
        instanceId,
        status: "failed",
        error: "Workflow instance not found",
        stepsExecuted,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Get definition if not provided
    if (!definition) {
      const foundDefinition = await findWorkflowDefinitionById(instance.definitionId);
      if (!foundDefinition) {
        await failWorkflowInstance(instanceId, "Workflow definition not found");
        return {
          instanceId,
          status: "failed",
          error: "Workflow definition not found",
          stepsExecuted,
          executionTimeMs: Date.now() - startTime,
        };
      }
      definition = foundDefinition;
    }

    // Start the instance if pending
    if (instance.status === "pending") {
      await startWorkflowInstance(instanceId);
      await logWorkflowEvent(instanceId, "workflow_started", {
        eventData: { definitionName: definition.name },
      });
    }

    // Parse steps and context
    const steps = this.parseSteps(definition.steps);
    const context = this.createContext(instance, definition);

    // Set timeout deadline
    const dueAt = new Date();
    dueAt.setMinutes(dueAt.getMinutes() + definition.timeoutMinutes);
    await updateWorkflowInstance(instanceId, { dueAt });

    // Execute steps
    try {
      let currentStepIndex = instance.currentStepIndex;
      let currentStepId: string | undefined = instance.currentStepId || steps[0]?.id;

      while (currentStepId) {
        // Check timeout
        if (Date.now() - startTime > this.config.workflowTimeoutMs) {
          await failWorkflowInstance(instanceId, "Workflow execution timeout");
          await logWorkflowEvent(instanceId, "workflow_timeout");
          await incrementWorkflowExecutionStats(definition.id, false);
          return {
            instanceId,
            status: "failed",
            error: "Workflow execution timeout",
            stepsExecuted,
            executionTimeMs: Date.now() - startTime,
          };
        }

        // Find the step
        const step = steps.find((s) => s.id === currentStepId);
        if (!step) {
          await failWorkflowInstance(instanceId, `Step not found: ${currentStepId}`);
          await incrementWorkflowExecutionStats(definition.id, false);
          return {
            instanceId,
            status: "failed",
            error: `Step not found: ${currentStepId}`,
            stepsExecuted,
            executionTimeMs: Date.now() - startTime,
          };
        }

        // Execute the step
        const stepResult = await this.executeStep(
          instanceId,
          step,
          currentStepIndex,
          context,
          definition
        );
        stepsExecuted++;

        // Update context with step result
        context.stepResults[step.id] = stepResult.output;

        // Update instance state
        await updateWorkflowInstance(instanceId, {
          currentStepIndex: currentStepIndex + 1,
          currentStepId: stepResult.nextStepId || null,
          context: stringifyWorkflowContext({
            variables: context.variables,
            triggerData: context.triggerData,
            stepResults: context.stepResults,
          }),
        });

        if (!stepResult.success) {
          // Step failed
          if (step.onFailure === "fail" || !step.onFailure) {
            // Check retry configuration
            if (step.retryConfig && step.retryConfig.maxRetries > 0) {
              const retryResult = await this.retryStep(
                instanceId,
                step,
                currentStepIndex,
                context,
                definition,
                step.retryConfig
              );
              if (retryResult.success) {
                currentStepId = retryResult.nextStepId;
                currentStepIndex++;
                continue;
              }
            }

            await failWorkflowInstance(instanceId, stepResult.error || "Step execution failed");
            await logWorkflowEvent(instanceId, "workflow_failed", {
              eventData: { stepId: step.id, error: stepResult.error },
            });
            await incrementWorkflowExecutionStats(definition.id, false);
            return {
              instanceId,
              status: "failed",
              error: stepResult.error,
              stepsExecuted,
              executionTimeMs: Date.now() - startTime,
            };
          } else {
            currentStepId = step.onFailure;
          }
        } else if (stepResult.shouldPause) {
          // Pause workflow (e.g., for approvals)
          await pauseWorkflowInstance(instanceId);
          await logWorkflowEvent(instanceId, "workflow_paused", {
            eventData: { stepId: step.id, reason: "awaiting_action" },
          });
          return {
            instanceId,
            status: "paused",
            stepsExecuted,
            executionTimeMs: Date.now() - startTime,
          };
        } else if (stepResult.shouldWait) {
          // Schedule resume
          await updateWorkflowInstance(instanceId, {
            status: "paused",
            pausedAt: new Date(),
            currentStepId: step.id, // Stay on current step
          });
          await logWorkflowEvent(instanceId, "workflow_waiting", {
            eventData: { stepId: step.id, until: stepResult.shouldWait.until },
          });
          return {
            instanceId,
            status: "paused",
            stepsExecuted,
            executionTimeMs: Date.now() - startTime,
          };
        } else {
          currentStepId = stepResult.nextStepId;
        }

        currentStepIndex++;

        // No more steps
        if (!currentStepId) {
          break;
        }
      }

      // Workflow completed successfully
      const output = JSON.stringify(context.stepResults);
      await completeWorkflowInstance(instanceId, output);
      await logWorkflowEvent(instanceId, "workflow_completed", {
        eventData: { stepsExecuted },
      });
      await incrementWorkflowExecutionStats(definition.id, true);

      return {
        instanceId,
        status: "completed",
        output: context.stepResults,
        stepsExecuted,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await failWorkflowInstance(instanceId, errorMessage);
      await logWorkflowEvent(instanceId, "workflow_error", {
        eventData: { error: errorMessage },
      });
      await incrementWorkflowExecutionStats(definition.id, false);
      return {
        instanceId,
        status: "failed",
        error: errorMessage,
        stepsExecuted,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    instanceId: string,
    step: WorkflowStepDefinition,
    stepIndex: number,
    context: WorkflowContext,
    definition: WorkflowDefinition
  ): Promise<StepExecutionResult> {
    // Create step execution record
    const stepExecution = await createStepExecution({
      id: crypto.randomUUID(),
      instanceId,
      stepId: step.id,
      stepIndex,
      stepType: step.type,
      stepName: step.name,
      input: JSON.stringify(context),
    });

    await startStepExecution(stepExecution.id);
    await logWorkflowEvent(instanceId, "step_started", {
      stepExecutionId: stepExecution.id,
      eventData: { stepId: step.id, stepName: step.name, stepType: step.type },
    });

    // Handle special step types
    if (step.type === "loop") {
      return this.executeLoopStep(instanceId, step, stepIndex, context, definition, stepExecution.id);
    }

    if (step.type === "parallel") {
      return this.executeParallelStep(instanceId, step, stepIndex, context, definition, stepExecution.id);
    }

    if (step.type === "approval") {
      return this.executeApprovalStep(instanceId, step, context, stepExecution.id);
    }

    // Get the appropriate handler
    const handler = getStepHandler(step.type);
    if (!handler) {
      await failStepExecution(stepExecution.id, `Unknown step type: ${step.type}`);
      return { success: false, error: `Unknown step type: ${step.type}` };
    }

    // Execute with timeout
    try {
      const timeoutMs = step.timeout ? step.timeout * 1000 : this.config.stepTimeoutMs;
      const result = await this.executeWithTimeout(
        handler.execute(step, context),
        timeoutMs
      );

      if (result.success) {
        await completeStepExecution(stepExecution.id, JSON.stringify(result.output));
        await logWorkflowEvent(instanceId, "step_completed", {
          stepExecutionId: stepExecution.id,
          eventData: { stepId: step.id, output: result.output },
        });
      } else {
        await failStepExecution(stepExecution.id, result.error || "Step failed");
        await logWorkflowEvent(instanceId, "step_failed", {
          stepExecutionId: stepExecution.id,
          eventData: { stepId: step.id, error: result.error },
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Step execution error";
      await failStepExecution(stepExecution.id, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Execute a loop step
   */
  private async executeLoopStep(
    instanceId: string,
    step: WorkflowStepDefinition,
    stepIndex: number,
    context: WorkflowContext,
    definition: WorkflowDefinition,
    stepExecutionId: string
  ): Promise<StepExecutionResult> {
    const config = step.config as WorkflowLoopConfig;
    const steps = this.parseSteps(definition.steps);
    const results: unknown[] = [];

    if (config.loopType === "for_each" && config.collection) {
      // Get collection from context
      const collectionPath = config.collection.startsWith("$")
        ? config.collection.slice(1)
        : config.collection;
      const collection = this.getNestedValue(context, collectionPath) as unknown[];

      if (!Array.isArray(collection)) {
        await failStepExecution(stepExecutionId, "Collection is not an array");
        return { success: false, error: "Collection is not an array" };
      }

      for (let i = 0; i < Math.min(collection.length, config.maxIterations); i++) {
        // Set loop context
        context.loopContext = {
          index: i,
          item: collection[i],
          collection,
        };

        // Execute loop steps
        for (const loopStepId of config.loopSteps) {
          const loopStep = steps.find((s) => s.id === loopStepId);
          if (loopStep) {
            const result = await this.executeStep(
              instanceId,
              loopStep,
              stepIndex,
              context,
              definition
            );
            if (!result.success) {
              return result;
            }
            results.push(result.output);
          }
        }
      }

      // Clear loop context
      delete context.loopContext;
    }

    await completeStepExecution(stepExecutionId, JSON.stringify(results));
    return {
      success: true,
      output: results,
      nextStepId: step.onSuccess,
    };
  }

  /**
   * Execute a parallel step
   */
  private async executeParallelStep(
    instanceId: string,
    step: WorkflowStepDefinition,
    stepIndex: number,
    context: WorkflowContext,
    definition: WorkflowDefinition,
    stepExecutionId: string
  ): Promise<StepExecutionResult> {
    const config = step.config as WorkflowParallelConfig;
    const steps = this.parseSteps(definition.steps);

    // Find all parallel steps
    const parallelSteps = config.parallelSteps
      .map((id) => steps.find((s) => s.id === id))
      .filter((s): s is WorkflowStepDefinition => s !== undefined);

    // Execute in parallel (limited by config)
    const batchSize = Math.min(parallelSteps.length, this.config.maxParallelSteps);
    const results: StepExecutionResult[] = [];

    for (let i = 0; i < parallelSteps.length; i += batchSize) {
      const batch = parallelSteps.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((s) => this.executeStep(instanceId, s, stepIndex, context, definition))
      );
      results.push(...batchResults);

      // If waitForAll is false and any succeeded, return early
      if (!config.waitForAll) {
        const success = batchResults.find((r) => r.success);
        if (success) {
          await completeStepExecution(stepExecutionId, JSON.stringify(success.output));
          return {
            success: true,
            output: success.output,
            nextStepId: step.onSuccess,
          };
        }
      }
    }

    // Check results
    const allSucceeded = results.every((r) => r.success);
    if (config.waitForAll && !allSucceeded) {
      const failed = results.find((r) => !r.success);
      await failStepExecution(stepExecutionId, failed?.error || "Parallel step failed");
      return { success: false, error: failed?.error || "Parallel step failed" };
    }

    const outputs = results.map((r) => r.output);
    await completeStepExecution(stepExecutionId, JSON.stringify(outputs));
    return {
      success: true,
      output: outputs,
      nextStepId: step.onSuccess,
    };
  }

  /**
   * Execute an approval step
   */
  private async executeApprovalStep(
    instanceId: string,
    step: WorkflowStepDefinition,
    context: WorkflowContext,
    stepExecutionId: string
  ): Promise<StepExecutionResult> {
    const config = step.config as WorkflowApprovalConfig;

    // Calculate due date
    const dueAt = new Date();
    dueAt.setHours(dueAt.getHours() + config.timeoutHours);

    // Create approval requests for each approver
    for (const approverId of config.approverIds) {
      await createApproval({
        id: crypto.randomUUID(),
        instanceId,
        stepExecutionId,
        approverId,
        dueAt,
      });
    }

    await logWorkflowEvent(instanceId, "approval_requested", {
      stepExecutionId,
      eventData: {
        approverIds: config.approverIds,
        requiredApprovals: config.requiredApprovals,
        dueAt,
      },
    });

    // Pause workflow to wait for approvals
    return {
      success: true,
      output: { awaitingApproval: true, approverCount: config.approverIds.length },
      shouldPause: true,
      nextStepId: step.onSuccess,
    };
  }

  /**
   * Check and resume workflow after approval
   */
  async checkApprovalStatus(instanceId: string): Promise<{
    complete: boolean;
    approved: boolean;
    approvalCount: number;
    rejectionCount: number;
  }> {
    const approvals = await findApprovalsByInstance(instanceId);
    const instance = await findWorkflowInstanceById(instanceId);

    if (!instance) {
      return { complete: true, approved: false, approvalCount: 0, rejectionCount: 0 };
    }

    const definition = await findWorkflowDefinitionById(instance.definitionId);
    if (!definition) {
      return { complete: true, approved: false, approvalCount: 0, rejectionCount: 0 };
    }

    const steps = this.parseSteps(definition.steps);
    const currentStep = steps.find((s) => s.id === instance.currentStepId);

    if (!currentStep || currentStep.type !== "approval") {
      return { complete: true, approved: false, approvalCount: 0, rejectionCount: 0 };
    }

    const config = currentStep.config as WorkflowApprovalConfig;
    const approvalCount = approvals.filter((a) => a.decision === "approved").length;
    const rejectionCount = approvals.filter((a) => a.decision === "rejected").length;

    // Check if we have enough approvals
    if (approvalCount >= config.requiredApprovals) {
      return { complete: true, approved: true, approvalCount, rejectionCount };
    }

    // Check if there are too many rejections
    const remainingApprovers = approvals.filter((a) => !a.decision).length;
    if (approvalCount + remainingApprovers < config.requiredApprovals) {
      return { complete: true, approved: false, approvalCount, rejectionCount };
    }

    return { complete: false, approved: false, approvalCount, rejectionCount };
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(instanceId: string): Promise<WorkflowExecutionResult> {
    const instance = await findWorkflowInstanceById(instanceId);
    if (!instance) {
      return {
        instanceId,
        status: "failed",
        error: "Workflow instance not found",
        stepsExecuted: 0,
        executionTimeMs: 0,
      };
    }

    if (instance.status !== "paused") {
      return {
        instanceId,
        status: instance.status as any,
        error: `Cannot resume workflow with status: ${instance.status}`,
        stepsExecuted: 0,
        executionTimeMs: 0,
      };
    }

    // Update status to running
    await updateWorkflowInstance(instanceId, {
      status: "running",
      pausedAt: null,
    });

    await logWorkflowEvent(instanceId, "workflow_resumed");

    // Continue execution
    return this.executeWorkflow(instanceId);
  }

  /**
   * Retry a failed step
   */
  private async retryStep(
    instanceId: string,
    step: WorkflowStepDefinition,
    stepIndex: number,
    context: WorkflowContext,
    definition: WorkflowDefinition,
    retryConfig: { maxRetries: number; retryDelaySeconds: number }
  ): Promise<StepExecutionResult> {
    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      await new Promise((resolve) =>
        setTimeout(resolve, retryConfig.retryDelaySeconds * 1000)
      );

      await logWorkflowEvent(instanceId, "step_retry", {
        eventData: { stepId: step.id, attempt, maxRetries: retryConfig.maxRetries },
      });

      const result = await this.executeStep(
        instanceId,
        step,
        stepIndex,
        context,
        definition
      );

      if (result.success) {
        return result;
      }
    }

    return { success: false, error: "Max retries exceeded" };
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Step execution timeout")), timeoutMs)
      ),
    ]);
  }

  /**
   * Parse steps from JSON string
   */
  private parseSteps(stepsJson: string): WorkflowStepDefinition[] {
    try {
      return JSON.parse(stepsJson) as WorkflowStepDefinition[];
    } catch {
      return [];
    }
  }

  /**
   * Parse variables from JSON string
   */
  private parseVariables(variablesJson: string | null): Record<string, unknown> {
    const emptyRecord: Record<string, unknown> = {};
    if (!variablesJson) return emptyRecord;
    try {
      return JSON.parse(variablesJson) as Record<string, unknown>;
    } catch {
      return emptyRecord;
    }
  }

  /**
   * Create execution context from instance and definition
   */
  private createContext(
    instance: WorkflowInstance,
    definition: WorkflowDefinition
  ): WorkflowContext {
    const savedContext = parseWorkflowContext(instance.context);
    const emptyRecord: Record<string, unknown> = {};

    // Ensure proper Record<string, unknown> typing for context fields
    const variables: Record<string, unknown> =
      (savedContext.variables as Record<string, unknown> | undefined) || this.parseVariables(definition.variables);
    const triggerData: Record<string, unknown> =
      (savedContext.triggerData as Record<string, unknown> | undefined) || (instance.triggerData ? JSON.parse(instance.triggerData) : emptyRecord);
    const stepResults: Record<string, unknown> =
      (savedContext.stepResults as Record<string, unknown> | undefined) || emptyRecord;

    return {
      variables,
      triggerData,
      stepResults,
      startedAt: instance.startedAt || new Date(),
      instanceId: instance.id,
      definitionId: definition.id,
      triggeredBy: instance.triggeredBy || undefined,
    };
  }

  /**
   * Get nested value from context
   */
  private getNestedValue(context: WorkflowContext, path: string): unknown {
    const [source, ...rest] = path.split(".");
    const restPath = rest.join(".");

    switch (source) {
      case "variables":
        return this.getObjectValue(context.variables, restPath);
      case "triggerData":
        return this.getObjectValue(context.triggerData, restPath);
      case "stepResults":
        return this.getObjectValue(context.stepResults, restPath);
      default:
        return this.getObjectValue(context.variables, path);
    }
  }

  /**
   * Get value from object by path
   */
  private getObjectValue(obj: Record<string, unknown>, path: string): unknown {
    if (!path) return obj;
    const keys = path.split(".");
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine();
