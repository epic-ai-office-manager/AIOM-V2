/**
 * Workflow Webhook API Route
 *
 * POST /api/workflows/webhook - Trigger workflow via webhook
 */

import { createFileRoute } from "@tanstack/react-router";
import { findWorkflowDefinitionById } from "~/data-access/workflow-automation";
import { workflowEngine } from "~/lib/workflow-automation-engine";

export const Route = createFileRoute("/api/workflows/webhook")({
  server: {
    handlers: {
      /**
       * POST /api/workflows/webhook
       * Trigger a workflow via webhook
       *
       * Query Parameters:
       * - definitionId: UUID of the workflow definition
       *
       * Headers:
       * - X-Webhook-Secret: Secret key for authentication
       *
       * Body:
       * - JSON payload with trigger data
       *
       * Response:
       * - 200: { success: true, instanceId: string }
       * - 400: { error: "Missing definitionId" }
       * - 401: { error: "Invalid webhook secret" }
       * - 404: { error: "Workflow not found" }
       * - 500: { error: "Trigger failed" }
       */
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const definitionId = url.searchParams.get("definitionId");

        if (!definitionId) {
          return Response.json(
            { error: "Missing definitionId query parameter" },
            { status: 400 }
          );
        }

        try {
          // Get the workflow definition
          const definition = await findWorkflowDefinitionById(definitionId);

          if (!definition) {
            return Response.json(
              { error: "Workflow definition not found" },
              { status: 404 }
            );
          }

          // Verify webhook secret
          const providedSecret = request.headers.get("X-Webhook-Secret");
          const triggerConfig = definition.triggerConfig
            ? JSON.parse(definition.triggerConfig)
            : { type: "" };

          if (triggerConfig.type !== "webhook") {
            return Response.json(
              { error: "Workflow is not configured for webhook triggers" },
              { status: 400 }
            );
          }

          if (triggerConfig.webhookSecret && providedSecret !== triggerConfig.webhookSecret) {
            return Response.json(
              { error: "Invalid webhook secret" },
              { status: 401 }
            );
          }

          if (definition.status !== "active") {
            return Response.json(
              { error: "Workflow is not active" },
              { status: 400 }
            );
          }

          // Parse request body
          let triggerData: Record<string, unknown> = {};
          try {
            const contentType = request.headers.get("Content-Type");
            if (contentType?.includes("application/json")) {
              triggerData = await request.json();
            }
          } catch {
            // Ignore JSON parse errors, use empty object
          }

          // Trigger the workflow
          const result = await workflowEngine.triggerWorkflow(definitionId, {
            triggerData,
          });

          console.log(
            `[WorkflowWebhook] Workflow triggered: ${definitionId}, instance: ${result.instanceId}`
          );

          return Response.json({
            success: true,
            instanceId: result.instanceId,
            status: result.status,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("[WorkflowWebhook] Error triggering workflow:", error);
          return Response.json(
            {
              error: "Failed to trigger workflow",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
          );
        }
      },

      /**
       * GET /api/workflows/webhook
       * Health check for webhook endpoint
       */
      GET: async () => {
        return Response.json({
          status: "ok",
          service: "workflow-webhook",
          timestamp: new Date().toISOString(),
        });
      },
    },
  },
});
