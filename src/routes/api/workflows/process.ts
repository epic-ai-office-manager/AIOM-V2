/**
 * Workflow Process API Route
 *
 * POST /api/workflows/process - Process pending/waiting workflows
 * This is designed to be called by a cron job to resume waiting workflows
 */

import { createFileRoute } from "@tanstack/react-router";
import { database } from "~/db";
import { workflowInstance, workflowScheduledRun, workflowDefinition } from "~/db/schema";
import { eq, and, lte, or } from "drizzle-orm";
import { workflowEngine } from "~/lib/workflow-automation-engine";

// API key for workflow processing operations
const WORKFLOW_API_KEY = process.env.WORKFLOW_API_KEY;

export const Route = createFileRoute("/api/workflows/process")({
  server: {
    handlers: {
      /**
       * POST /api/workflows/process
       * Process pending workflows and scheduled runs
       *
       * Headers:
       * - Authorization: Bearer <API_KEY>
       *
       * Query Parameters:
       * - limit: Maximum number of workflows to process (default: 10)
       *
       * Response:
       * - 200: { success: true, processed: number, ... }
       * - 401: { error: "Unauthorized" }
       * - 500: { error: "Processing failed" }
       */
      POST: async ({ request }) => {
        // Verify API key
        const authHeader = request.headers.get("Authorization");
        const apiKey = authHeader?.replace("Bearer ", "");

        if (WORKFLOW_API_KEY && apiKey !== WORKFLOW_API_KEY) {
          console.warn("[WorkflowProcess] Unauthorized attempt to process workflows");
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get("limit") || "10", 10);

        try {
          console.log(`[WorkflowProcess] Starting workflow processing (limit: ${limit})...`);

          const now = new Date();
          const results = {
            waitingResumed: 0,
            scheduledTriggered: 0,
            errors: [] as Array<{ id: string; error: string }>,
          };

          // 1. Resume waiting workflows whose wait time has passed
          const waitingInstances = await database
            .select()
            .from(workflowInstance)
            .where(
              and(
                eq(workflowInstance.status, "paused"),
                lte(workflowInstance.dueAt, now)
              )
            )
            .limit(limit);

          for (const instance of waitingInstances) {
            try {
              await workflowEngine.resumeWorkflow(instance.id);
              results.waitingResumed++;
              console.log(`[WorkflowProcess] Resumed waiting workflow: ${instance.id}`);
            } catch (error) {
              results.errors.push({
                id: instance.id,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          // 2. Trigger scheduled workflow runs
          const scheduledRuns = await database
            .select({
              run: workflowScheduledRun,
              definition: workflowDefinition,
            })
            .from(workflowScheduledRun)
            .innerJoin(
              workflowDefinition,
              eq(workflowScheduledRun.definitionId, workflowDefinition.id)
            )
            .where(
              and(
                eq(workflowScheduledRun.isActive, true),
                lte(workflowScheduledRun.scheduledFor, now),
                eq(workflowDefinition.status, "active")
              )
            )
            .limit(limit - results.waitingResumed);

          for (const { run, definition } of scheduledRuns) {
            try {
              // Trigger the workflow
              const result = await workflowEngine.triggerWorkflow(definition.id, {
                triggerData: run.triggerData ? JSON.parse(run.triggerData) : {},
              });

              // Mark as completed - deactivate one-time runs, update recurring runs
              await database
                .update(workflowScheduledRun)
                .set({
                  lastRunInstanceId: result.instanceId,
                  lastRunAt: now,
                  // Deactivate if no cron expression (one-time run)
                  isActive: run.cronExpression ? true : false,
                })
                .where(eq(workflowScheduledRun.id, run.id));

              results.scheduledTriggered++;
              console.log(`[WorkflowProcess] Triggered scheduled workflow: ${definition.id}`);
            } catch (error) {
              // Mark as failed - deactivate to prevent retry loop
              await database
                .update(workflowScheduledRun)
                .set({
                  isActive: false,
                  lastRunAt: now,
                })
                .where(eq(workflowScheduledRun.id, run.id));

              results.errors.push({
                id: run.id,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          console.log(
            `[WorkflowProcess] Processing complete: ${results.waitingResumed} resumed, ` +
              `${results.scheduledTriggered} scheduled triggers, ${results.errors.length} errors`
          );

          return Response.json({
            success: true,
            waitingResumed: results.waitingResumed,
            scheduledTriggered: results.scheduledTriggered,
            errors: results.errors.length > 0 ? results.errors : undefined,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("[WorkflowProcess] Error processing workflows:", error);
          return Response.json(
            {
              error: "Processing failed",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
          );
        }
      },

      /**
       * GET /api/workflows/process
       * Health check endpoint with queue status
       */
      GET: async () => {
        try {
          const now = new Date();

          // Count waiting instances
          const waitingCount = await database
            .select({ count: workflowInstance.id })
            .from(workflowInstance)
            .where(
              and(
                eq(workflowInstance.status, "paused"),
                lte(workflowInstance.dueAt, now)
              )
            );

          // Count pending scheduled runs
          const scheduledCount = await database
            .select({ count: workflowScheduledRun.id })
            .from(workflowScheduledRun)
            .where(
              and(
                eq(workflowScheduledRun.isActive, true),
                lte(workflowScheduledRun.scheduledFor, now)
              )
            );

          return Response.json({
            status: "ok",
            service: "workflow-processor",
            pending: {
              waiting: waitingCount.length,
              scheduled: scheduledCount.length,
            },
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("[WorkflowProcess] Health check error:", error);
          return Response.json({
            status: "error",
            service: "workflow-processor",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
          });
        }
      },
    },
  },
});
