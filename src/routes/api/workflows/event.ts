/**
 * Workflow Event Trigger API Route
 *
 * POST /api/workflows/event - Trigger workflows by event type
 */

import { createFileRoute } from "@tanstack/react-router";
import { database } from "~/db";
import { workflowDefinition } from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { workflowEngine } from "~/lib/workflow-automation-engine";
import { evaluateConditionGroup } from "~/lib/workflow-automation-engine/condition-evaluator";
import type { WorkflowContext, Condition } from "~/lib/workflow-automation-engine";

// API key for event trigger operations
const WORKFLOW_API_KEY = process.env.WORKFLOW_API_KEY;

export const Route = createFileRoute("/api/workflows/event")({
  server: {
    handlers: {
      /**
       * POST /api/workflows/event
       * Trigger workflows that match a specific event type
       *
       * Headers:
       * - Authorization: Bearer <API_KEY>
       *
       * Body:
       * - eventType: string (e.g., "expense_approved", "task_created")
       * - data: object (event payload)
       * - userId: string (optional, user who triggered the event)
       *
       * Response:
       * - 200: { success: true, triggered: number, instances: [...] }
       * - 400: { error: "Missing eventType" }
       * - 401: { error: "Unauthorized" }
       * - 500: { error: "Trigger failed" }
       */
      POST: async ({ request }) => {
        // Verify API key
        const authHeader = request.headers.get("Authorization");
        const apiKey = authHeader?.replace("Bearer ", "");

        if (WORKFLOW_API_KEY && apiKey !== WORKFLOW_API_KEY) {
          console.warn("[WorkflowEvent] Unauthorized attempt to trigger event");
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          const body = await request.json();
          const { eventType, data = {}, userId } = body as {
            eventType?: string;
            data?: Record<string, unknown>;
            userId?: string;
          };

          if (!eventType) {
            return Response.json(
              { error: "Missing eventType in request body" },
              { status: 400 }
            );
          }

          console.log(`[WorkflowEvent] Processing event: ${eventType}`);

          // Find active workflows with event triggers matching this event type
          const activeWorkflows = await database
            .select()
            .from(workflowDefinition)
            .where(eq(workflowDefinition.status, "active"));

          const matchingWorkflows = activeWorkflows.filter((wf) => {
            const triggerConfig = wf.triggerConfig
              ? JSON.parse(wf.triggerConfig)
              : { type: "" };
            return (
              triggerConfig.type === "event" && triggerConfig.eventType === eventType
            );
          });

          const results: Array<{
            definitionId: string;
            instanceId: string;
            status: string;
          }> = [];
          const errors: Array<{ definitionId: string; error: string }> = [];

          for (const workflow of matchingWorkflows) {
            try {
              const triggerConfig = workflow.triggerConfig
                ? JSON.parse(workflow.triggerConfig)
                : { type: "" };

              // Check if trigger conditions are met
              if (triggerConfig.conditions && triggerConfig.conditions.length > 0) {
                const context: WorkflowContext = {
                  variables: {},
                  triggerData: data,
                  stepResults: {},
                  startedAt: new Date(),
                  instanceId: "",
                  definitionId: workflow.id,
                  triggeredBy: userId,
                };

                const conditionsMet = evaluateConditionGroup(
                  {
                    conditions: triggerConfig.conditions,
                    logic: "and",
                  },
                  context
                );

                if (!conditionsMet) {
                  console.log(
                    `[WorkflowEvent] Conditions not met for workflow: ${workflow.id}`
                  );
                  continue;
                }
              }

              // Trigger the workflow
              const result = await workflowEngine.triggerWorkflow(workflow.id, {
                triggeredBy: userId,
                triggerData: data,
              });

              results.push({
                definitionId: workflow.id,
                instanceId: result.instanceId,
                status: result.status,
              });

              console.log(
                `[WorkflowEvent] Triggered workflow: ${workflow.id}, instance: ${result.instanceId}`
              );
            } catch (error) {
              errors.push({
                definitionId: workflow.id,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          return Response.json({
            success: true,
            eventType,
            triggered: results.length,
            instances: results,
            errors: errors.length > 0 ? errors : undefined,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("[WorkflowEvent] Error processing event:", error);
          return Response.json(
            {
              error: "Event processing failed",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
          );
        }
      },

      /**
       * GET /api/workflows/event
       * List available event types and their associated workflows
       */
      GET: async () => {
        try {
          const activeWorkflows = await database
            .select({
              id: workflowDefinition.id,
              name: workflowDefinition.name,
              triggerConfig: workflowDefinition.triggerConfig,
            })
            .from(workflowDefinition)
            .where(eq(workflowDefinition.status, "active"));

          const eventWorkflows = activeWorkflows
            .filter((wf) => {
              const config = wf.triggerConfig ? JSON.parse(wf.triggerConfig) : { type: "" };
              return config.type === "event";
            })
            .map((wf) => {
              const config = wf.triggerConfig ? JSON.parse(wf.triggerConfig) : {};
              return {
                id: wf.id,
                name: wf.name,
                eventType: config.eventType,
              };
            });

          // Group by event type
          const eventTypes = eventWorkflows.reduce(
            (acc, wf) => {
              const eventType = wf.eventType || "unknown";
              if (!acc[eventType]) {
                acc[eventType] = [];
              }
              acc[eventType].push({ id: wf.id, name: wf.name });
              return acc;
            },
            {} as Record<string, Array<{ id: string; name: string }>>
          );

          return Response.json({
            status: "ok",
            eventTypes,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("[WorkflowEvent] Error listing event types:", error);
          return Response.json(
            {
              error: "Failed to list event types",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
