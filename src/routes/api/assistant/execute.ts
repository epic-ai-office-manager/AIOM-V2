/**
 * API Route: Execute Assistant Tool Call (Web-only)
 *
 * POST /api/assistant/execute
 *
 * Authenticated, tenant-scoped endpoint that:
 * - Transitions aiToolCall from "pending" → "running" → "completed"/"failed"
 * - Executes tool via Tool Registry
 * - Persists execution results
 *
 * Enterprise guardrails:
 * - Better Auth session required (401 if unauthenticated)
 * - x-tenant-id header required (400 if missing)
 * - Tenant membership validated (403 if not member)
 * - Tool call ownership validated (403 if not owner)
 * - Tool call tenant validated (403 if mismatch)
 * - Tool exists in registry (400 if not found)
 * - Conditional status transition (400 if not pending)
 */

import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/utils/auth";
import { findTenantById, isUserTenantMember } from "~/data-access/tenants";
import { isUserAdmin } from "~/data-access/users";
import {
  findAIToolCallById,
  findAIConversationByIdForUser,
  updateAIToolCall,
  completeAIToolCall,
  failAIToolCall,
} from "~/data-access/ai-conversations";
import { registerAssistantTools } from "~/lib/assistant-tools";
import { getToolRegistry, createToolContext } from "~/lib/tool-registry";

/**
 * Request body schema
 */
interface ExecuteRequest {
  aiToolCallId: string;
}

/**
 * Tool call output result structure
 */
interface ToolCallOutputResult {
  tenantId?: string;
  userId?: string;
  toolId?: string;
  policy?: {
    decision: string;
    reason: string;
  };
  riskLevel?: string;
  approval?: unknown;
  execution?: {
    attemptedAt: string;
    status: "completed" | "failed";
    durationMs?: number;
    error?: string;
  };
}

export const Route = createFileRoute("/api/assistant/execute")({
  server: {
    handlers: {
      /**
       * POST /api/assistant/execute
       *
       * Execute a pending tool call
       *
       * Headers:
       * - x-tenant-id: Required tenant ID
       *
       * Body:
       * - aiToolCallId: Tool call ID to execute
       *
       * Response (200):
       * - ok: true
       * - aiToolCallId: Tool call ID
       * - status: "completed" | "failed"
       * - resultSummary: Minimal result summary
       */
      POST: async ({ request }) => {
        // =====================================================================
        // 1. Authentication (Better Auth session)
        // =====================================================================

        let session;
        try {
          session = await auth.api.getSession({ headers: request.headers });
        } catch (error) {
          console.error("[Assistant Execute] Session error:", error);
          return Response.json(
            { error: "Unauthorized: No valid session" },
            { status: 401 }
          );
        }

        if (!session || !session.user) {
          return Response.json(
            { error: "Unauthorized: No valid session" },
            { status: 401 }
          );
        }

        const userId = session.user.id;

        // =====================================================================
        // 2. Tenant Scoping (Explicit x-tenant-id header required)
        // =====================================================================

        const tenantId = request.headers.get("x-tenant-id");

        if (!tenantId) {
          return Response.json(
            { error: "Bad Request: Missing x-tenant-id header" },
            { status: 400 }
          );
        }

        // Validate tenant exists and is active
        const tenant = await findTenantById(tenantId);
        if (!tenant) {
          return Response.json(
            { error: "Bad Request: Invalid tenant ID" },
            { status: 400 }
          );
        }

        if (!tenant.isActive) {
          return Response.json(
            { error: "Forbidden: Tenant is inactive" },
            { status: 403 }
          );
        }

        // Validate user is tenant member
        const isMember = await isUserTenantMember(tenantId, userId);
        if (!isMember) {
          return Response.json(
            { error: "Forbidden: User is not a member of this tenant" },
            { status: 403 }
          );
        }

        // =====================================================================
        // 3. Parse Request Body
        // =====================================================================

        let body: ExecuteRequest;
        try {
          body = await request.json();
        } catch (error) {
          console.error("[Assistant Execute] JSON parse error:", error);
          return Response.json(
            { error: "Bad Request: Invalid JSON body" },
            { status: 400 }
          );
        }

        if (!body.aiToolCallId || typeof body.aiToolCallId !== "string") {
          return Response.json(
            { error: "Bad Request: Missing or invalid 'aiToolCallId' field" },
            { status: 400 }
          );
        }

        // =====================================================================
        // 4. Find Tool Call
        // =====================================================================

        const toolCall = await findAIToolCallById(body.aiToolCallId);

        if (!toolCall) {
          return Response.json(
            { error: "Not Found: Tool call does not exist" },
            { status: 404 }
          );
        }

        // =====================================================================
        // 5. Validate Tool Call Status (Must be "pending")
        // =====================================================================

        if (toolCall.status !== "pending") {
          return Response.json(
            {
              error: `Bad Request: Tool call status is '${toolCall.status}', must be 'pending'`,
              currentStatus: toolCall.status,
              code: "not_pending",
            },
            { status: 400 }
          );
        }

        // =====================================================================
        // 6. Validate Ownership (User owns the conversation)
        // =====================================================================

        const conversation = await findAIConversationByIdForUser(
          toolCall.conversationId,
          userId
        );

        if (!conversation) {
          return Response.json(
            {
              error:
                "Forbidden: Tool call does not belong to authenticated user",
            },
            { status: 403 }
          );
        }

        // =====================================================================
        // 7. Validate Tenant Context
        // =====================================================================

        let outputResult: ToolCallOutputResult = {};
        try {
          if (toolCall.outputResult) {
            outputResult = JSON.parse(toolCall.outputResult);
          }
        } catch (error) {
          console.error(
            "[Assistant Execute] Failed to parse outputResult:",
            error
          );
          return Response.json(
            { error: "Internal Error: Invalid tool call data" },
            { status: 500 }
          );
        }

        // Check if proposal has tenant context
        if (!outputResult.tenantId) {
          return Response.json(
            {
              error:
                "Bad Request: Proposal missing tenant context (created before PM STEP 27.4)",
              code: "proposal_missing_tenant_context",
            },
            { status: 400 }
          );
        }

        // Validate tenant matches header
        if (outputResult.tenantId !== tenantId) {
          return Response.json(
            {
              error: "Forbidden: Tool call tenant does not match x-tenant-id",
              proposalTenantId: outputResult.tenantId,
              requestTenantId: tenantId,
            },
            { status: 403 }
          );
        }

        // =====================================================================
        // 8. Parse Tool Input
        // =====================================================================

        let toolInput: Record<string, unknown> = {};
        try {
          if (toolCall.inputArguments) {
            toolInput = JSON.parse(toolCall.inputArguments);
          }
        } catch (error) {
          console.error(
            "[Assistant Execute] Failed to parse inputArguments:",
            error
          );
          return Response.json(
            { error: "Internal Error: Invalid tool input data" },
            { status: 500 }
          );
        }

        // =====================================================================
        // 9. Ensure Tools are Registered
        // =====================================================================

        registerAssistantTools();

        // =====================================================================
        // 10. Validate Tool Exists in Registry
        // =====================================================================

        const registry = getToolRegistry();
        const tool = registry.get(toolCall.toolName);

        if (!tool) {
          return Response.json(
            {
              error: `Bad Request: Tool '${toolCall.toolName}' not found in registry`,
              toolName: toolCall.toolName,
            },
            { status: 400 }
          );
        }

        // =====================================================================
        // 11. Defense in Depth: Check Policy Decision
        // =====================================================================

        if (
          outputResult.policy &&
          outputResult.policy.decision !== "allow" &&
          outputResult.policy.decision !== "requires_approval"
        ) {
          return Response.json(
            {
              error: `Forbidden: Policy decision was '${outputResult.policy.decision}', cannot execute`,
              policyDecision: outputResult.policy.decision,
            },
            { status: 403 }
          );
        }

        // =====================================================================
        // 12. Transition to "running" (Anti-double-execute)
        // =====================================================================

        const runningUpdate = await updateAIToolCall(body.aiToolCallId, {
          status: "running",
          startedAt: toolCall.startedAt || new Date(),
          errorMessage: null,
        });

        if (!runningUpdate) {
          // Update failed - likely race condition (another request updated status)
          return Response.json(
            {
              error:
                "Bad Request: Tool call is no longer pending (race condition)",
              code: "not_pending",
            },
            { status: 400 }
          );
        }

        console.log(
          `[Assistant Execute] Tool call transition to running: ${body.aiToolCallId}`
        );

        // =====================================================================
        // 13. Execute Tool via Registry
        // =====================================================================

        const executionStartTime = Date.now();
        let executionResult: {
          success: boolean;
          result?: unknown;
          formatted?: unknown;
          error?: unknown;
        };

        try {
          // Get admin status for tool context
          const isAdmin = await isUserAdmin(userId);

          // Create tool context
          const toolContext = createToolContext(userId, {
            isAdmin,
            custom: {
              tenantId,
              channel: "web",
            },
          });

          // Execute tool
          const { result, formatted } = await registry.execute(
            toolCall.toolName,
            toolInput,
            toolContext,
            { timeoutMs: 30000 } // 30 second timeout
          );

          executionResult = {
            success: result.success,
            result,
            formatted,
          };
        } catch (error) {
          console.error(
            `[Assistant Execute] Execution error for ${body.aiToolCallId}:`,
            error
          );
          executionResult = {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }

        const durationMs = Date.now() - executionStartTime;

        // =====================================================================
        // 14. Persist Execution Results
        // =====================================================================

        let finalStatus: "completed" | "failed";
        let updatedToolCall;

        if (executionResult.success && executionResult.result) {
          // Success path
          finalStatus = "completed";

          // Update outputResult with execution metadata
          const updatedOutputResult: ToolCallOutputResult = {
            ...outputResult,
            execution: {
              attemptedAt: new Date().toISOString(),
              status: "completed",
              durationMs,
            },
          };

          // Use completeAIToolCall helper
          updatedToolCall = await completeAIToolCall(
            body.aiToolCallId,
            {
              ...updatedOutputResult,
              toolResult: executionResult.result,
              formatted: executionResult.formatted,
            },
            durationMs
          );

          console.log(
            `[Assistant Execute] Tool call completed successfully: ${body.aiToolCallId}`
          );
        } else {
          // Failure path
          finalStatus = "failed";

          const errorMessage =
            (executionResult.result as { error?: { message?: string } })?.error
              ?.message ||
            (executionResult.error as string) ||
            "Tool execution failed";

          // Update outputResult with execution metadata
          const updatedOutputResult: ToolCallOutputResult = {
            ...outputResult,
            execution: {
              attemptedAt: new Date().toISOString(),
              status: "failed",
              durationMs,
              error: errorMessage,
            },
          };

          // Use failAIToolCall helper and update outputResult
          updatedToolCall = await updateAIToolCall(body.aiToolCallId, {
            status: "failed",
            completedAt: new Date(),
            errorMessage,
            outputResult: JSON.stringify(updatedOutputResult),
          });

          console.log(
            `[Assistant Execute] Tool call failed: ${body.aiToolCallId} - ${errorMessage}`
          );
        }

        if (!updatedToolCall) {
          return Response.json(
            { error: "Internal Error: Failed to persist execution results" },
            { status: 500 }
          );
        }

        // =====================================================================
        // 15. Return Success Response
        // =====================================================================

        return Response.json({
          ok: true,
          aiToolCallId: updatedToolCall.id,
          status: finalStatus,
          toolName: updatedToolCall.toolName,
          toolCallId: updatedToolCall.toolCallId,
          durationMs,
          resultSummary: {
            success: executionResult.success,
            formatted: executionResult.formatted
              ? typeof executionResult.formatted === "string"
                ? executionResult.formatted.substring(0, 200)
                : JSON.stringify(executionResult.formatted).substring(0, 200)
              : undefined,
            error:
              finalStatus === "failed"
                ? updatedToolCall.errorMessage?.substring(0, 200) ||
                  "Execution failed"
                : undefined,
          },
        });
      },
    },
  },
});
