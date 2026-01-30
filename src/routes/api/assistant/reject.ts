/**
 * API Route: Reject Assistant Tool Call (Web-only)
 *
 * POST /api/assistant/reject
 *
 * Authenticated, tenant-scoped endpoint that:
 * - Transitions aiToolCall from "proposed" → "failed"
 * - Stores rejection audit trail
 * - Does NOT execute tools
 *
 * Enterprise guardrails:
 * - Better Auth session required (401 if unauthenticated)
 * - x-tenant-id header required (400 if missing)
 * - Tenant membership validated (403 if not member)
 * - Tool call ownership validated (403 if not owner)
 * - Tool call tenant validated (403 if mismatch)
 */

import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/utils/auth";
import { findTenantById, isUserTenantMember } from "~/data-access/tenants";
import {
  findAIToolCallById,
  findAIConversationByIdForUser,
  updateAIToolCall,
} from "~/data-access/ai-conversations";

/**
 * Request body schema
 */
interface RejectRequest {
  aiToolCallId: string;
  reason: string;
}

/**
 * Tool call output result structure
 */
interface ToolCallOutputResult {
  tenantId?: string;
  userId?: string;
  toolId?: string;
  policy?: unknown;
  riskLevel?: string;
  approval?: {
    decision: "approved" | "rejected";
    approvedAt?: string;
    approvedBy?: string;
    rejectedAt?: string;
    rejectedBy?: string;
    comment?: string;
    reason?: string;
  };
}

export const Route = createFileRoute("/api/assistant/reject")({
  server: {
    handlers: {
      /**
       * POST /api/assistant/reject
       *
       * Reject a proposed tool call
       *
       * Headers:
       * - x-tenant-id: Required tenant ID
       *
       * Body:
       * - aiToolCallId: Tool call ID to reject
       * - reason: Required rejection reason
       *
       * Response (200):
       * - ok: true
       * - aiToolCallId: Tool call ID
       * - status: "failed"
       * - approval: { decision, rejectedAt, rejectedBy, reason }
       */
      POST: async ({ request }) => {
        // =====================================================================
        // 1. Authentication (Better Auth session)
        // =====================================================================

        let session;
        try {
          session = await auth.api.getSession({ headers: request.headers });
        } catch (error) {
          console.error("[Assistant Reject] Session error:", error);
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

        let body: RejectRequest;
        try {
          body = await request.json();
        } catch (error) {
          console.error("[Assistant Reject] JSON parse error:", error);
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

        if (!body.reason || typeof body.reason !== "string") {
          return Response.json(
            { error: "Bad Request: Missing or invalid 'reason' field" },
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
        // 5. Validate Tool Call Status
        // =====================================================================

        if (toolCall.status !== "proposed") {
          return Response.json(
            {
              error: `Bad Request: Tool call status is '${toolCall.status}', must be 'proposed'`,
              currentStatus: toolCall.status,
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
        // 7. Validate Tenant Context (Backward-compatibility guard)
        // =====================================================================

        let outputResult: ToolCallOutputResult = {};
        try {
          if (toolCall.outputResult) {
            outputResult = JSON.parse(toolCall.outputResult);
          }
        } catch (error) {
          console.error(
            "[Assistant Reject] Failed to parse outputResult:",
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
              message:
                "Please re-create the proposal using /api/assistant/propose",
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
        // 8. Transition to "failed" Status
        // =====================================================================

        const rejectedAt = new Date();

        // Update outputResult with rejection metadata
        const updatedOutputResult: ToolCallOutputResult = {
          ...outputResult,
          approval: {
            decision: "rejected",
            rejectedAt: rejectedAt.toISOString(),
            rejectedBy: userId,
            reason: body.reason,
          },
        };

        const updatedToolCall = await updateAIToolCall(body.aiToolCallId, {
          status: "failed",
          completedAt: rejectedAt,
          errorMessage: body.reason,
          outputResult: JSON.stringify(updatedOutputResult),
        });

        if (!updatedToolCall) {
          return Response.json(
            { error: "Internal Error: Failed to update tool call" },
            { status: 500 }
          );
        }

        console.log(
          `[Assistant Reject] Tool call rejected: ${body.aiToolCallId}`
        );

        // =====================================================================
        // 9. Return Success Response
        // =====================================================================

        return Response.json({
          ok: true,
          aiToolCallId: updatedToolCall.id,
          status: updatedToolCall.status,
          toolName: updatedToolCall.toolName,
          toolCallId: updatedToolCall.toolCallId,
          approval: updatedOutputResult.approval,
        });
      },
    },
  },
});
