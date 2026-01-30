/**
 * API Route: Assistant Proposal Endpoint (Web-only)
 *
 * POST /api/assistant/propose
 *
 * Authenticated, tenant-scoped endpoint that:
 * - Parses text commands deterministically (no LLM)
 * - Proposes tool calls with parameters
 * - Evaluates policy (allow/deny/requires_approval)
 * - Does NOT execute tools
 *
 * Enterprise guardrails:
 * - Better Auth session required (401 if unauthenticated)
 * - x-tenant-id header required (400 if missing)
 * - Tenant membership validated (403 if not member)
 */

import { createFileRoute } from "@tanstack/react-router";
import crypto, { createHash } from "crypto";
import { auth } from "~/utils/auth";
import { findTenantById, isUserTenantMember } from "~/data-access/tenants";
import { registerAssistantTools } from "~/lib/assistant-tools";
import { getToolRegistry } from "~/lib/tool-registry";
import { evaluateAssistantPolicy } from "~/lib/assistant-policy/policy";
import {
  findAIToolCallByToolCallId,
  getOrCreateAssistantProposalConversation,
  createAIMessage,
  createAIToolCall,
  getNextSequenceNumber,
} from "~/data-access/ai-conversations";

/**
 * Request body schema
 */
interface ProposeRequest {
  text: string;
}

/**
 * Parsed intent result
 */
interface ParsedIntent {
  toolId: string;
  input: Record<string, unknown>;
}

/**
 * Deterministic v0 intent parser
 *
 * Uses simple regex patterns to match common commands.
 * No LLM calls, no database access.
 *
 * Patterns:
 * - "create task: <title>" -> assistant.create_task
 * - "summarize thread: <threadId>" -> assistant.summarize_inbox_thread
 * - "system health" -> assistant.system_health_check
 * - "system health details" -> assistant.system_health_check with details
 */
function parseIntent(text: string): ParsedIntent | null {
  const trimmed = text.trim();

  // Pattern 1: Create task
  const createTaskPattern = /^create task:\s*(.+)$/i;
  const createTaskMatch = trimmed.match(createTaskPattern);
  if (createTaskMatch) {
    return {
      toolId: "assistant.create_task",
      input: {
        title: createTaskMatch[1].trim(),
      },
    };
  }

  // Pattern 2: Summarize thread
  const summarizeThreadPattern = /^summarize thread:\s*(.+)$/i;
  const summarizeThreadMatch = trimmed.match(summarizeThreadPattern);
  if (summarizeThreadMatch) {
    return {
      toolId: "assistant.summarize_inbox_thread",
      input: {
        threadId: summarizeThreadMatch[1].trim(),
      },
    };
  }

  // Pattern 3: System health check (with or without "details")
  const systemHealthPattern = /^system health(?:\s+details)?$/i;
  const systemHealthMatch = trimmed.match(systemHealthPattern);
  if (systemHealthMatch) {
    const includeDetails = trimmed.toLowerCase().includes("details");
    return {
      toolId: "assistant.system_health_check",
      input: {
        includeDetails,
      },
    };
  }

  // Pattern 4: Draft email
  const draftEmailPattern = /^draft email to:\s*([^\s]+)\s+subject:\s*(.+?)\s+context:\s*(.+)$/i;
  const draftEmailMatch = trimmed.match(draftEmailPattern);
  if (draftEmailMatch) {
    return {
      toolId: "assistant.draft_email",
      input: {
        to: draftEmailMatch[1].trim(),
        subject: draftEmailMatch[2].trim(),
        context: draftEmailMatch[3].trim(),
      },
    };
  }

  // No pattern matched
  return null;
}

/**
 * Normalize risk level from tool metadata
 *
 * Returns "low" | "medium" | "high"
 * If missing or invalid, defaults to "low" (safe default)
 */
function normalizeRiskLevel(
  metadata: Record<string, unknown> | undefined
): { riskLevel: "low" | "medium" | "high"; warning?: string } {
  const assistantRiskLevel = metadata?.assistantRiskLevel;

  if (
    assistantRiskLevel === "low" ||
    assistantRiskLevel === "medium" ||
    assistantRiskLevel === "high"
  ) {
    return { riskLevel: assistantRiskLevel };
  }

  // Missing or invalid - default to low with warning
  return {
    riskLevel: "low",
    warning: "Tool metadata missing or invalid assistantRiskLevel, defaulting to 'low'",
  };
}

export const Route = createFileRoute("/api/assistant/propose")({
  server: {
    handlers: {
      /**
       * POST /api/assistant/propose
       *
       * Parse text command, propose tool call, evaluate policy
       *
       * Headers:
       * - x-tenant-id: Required tenant ID
       *
       * Body:
       * - text: Command text to parse
       *
       * Response (200):
       * - ok: true
       * - tenantId: Tenant ID used
       * - userId: Authenticated user ID
       * - proposed: { toolId, input, riskLevel } or null if no match
       * - policy: { decision, reason } (only if proposed is not null)
       */
      POST: async ({ request }) => {
        // =====================================================================
        // 1. Authentication (Better Auth session)
        // =====================================================================

        let session;
        try {
          session = await auth.api.getSession({ headers: request.headers });
        } catch (error) {
          console.error("[Assistant Propose] Session error:", error);
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
        // 3. Register Assistant Tools (Idempotent)
        // =====================================================================

        registerAssistantTools();

        // =====================================================================
        // 4. Parse Request Body
        // =====================================================================

        let body: ProposeRequest;
        try {
          body = await request.json();
        } catch (error) {
          console.error("[Assistant Propose] JSON parse error:", error);
          return Response.json(
            { error: "Bad Request: Invalid JSON body" },
            { status: 400 }
          );
        }

        if (!body.text || typeof body.text !== "string") {
          return Response.json(
            { error: "Bad Request: Missing or invalid 'text' field" },
            { status: 400 }
          );
        }

        // =====================================================================
        // 5. Deterministic Intent Parsing (No LLM)
        // =====================================================================

        const parsed = parseIntent(body.text);

        if (!parsed) {
          // No intent matched - return successful response with null proposal
          return Response.json({
            ok: true,
            tenantId,
            userId,
            proposed: null,
            reason: "no_intent_match",
          });
        }

        // =====================================================================
        // 6. Get Tool Definition and Extract Risk Level
        // =====================================================================

        const registry = getToolRegistry();
        const tool = registry.get(parsed.toolId);

        if (!tool) {
          // Tool not found in registry (shouldn't happen with hardcoded patterns)
          console.error(
            `[Assistant Propose] Tool not found in registry: ${parsed.toolId}`
          );
          return Response.json({
            ok: true,
            tenantId,
            userId,
            proposed: null,
            reason: "tool_not_found",
          });
        }

        // Normalize risk level from tool metadata
        const { riskLevel, warning } = normalizeRiskLevel(tool.metadata);

        // =====================================================================
        // 7. Compute Deterministic Idempotency Key (SHA256)
        // =====================================================================

        const idempotencyPayload = [
          tenantId,
          userId,
          parsed.toolId,
          JSON.stringify(parsed.input),
          body.text.trim(),
        ].join("|");

        const idempotencyKey =
          "assistant:propose:v1:" +
          createHash("sha256").update(idempotencyPayload).digest("hex");

        // =====================================================================
        // 8. Policy Evaluation
        // =====================================================================

        const policyResult = evaluateAssistantPolicy({
          tenantId,
          userId,
          toolId: parsed.toolId,
          riskLevel,
          channel: "web",
        });

        // =====================================================================
        // 9. Idempotent Persistence (Check if proposal already exists)
        // =====================================================================

        let existingToolCall = await findAIToolCallByToolCallId(idempotencyKey);

        let conversationId: string;
        let messageId: string;
        let aiToolCallId: string;

        if (existingToolCall) {
          // Proposal already exists - return existing record
          conversationId = existingToolCall.conversationId;
          messageId = existingToolCall.messageId;
          aiToolCallId = existingToolCall.id;

          console.log(
            `[Assistant Propose] Idempotent duplicate detected: ${idempotencyKey}`
          );
        } else {
          // Create new proposal records

          // Get or create "Assistant Proposals" conversation
          const conversation = await getOrCreateAssistantProposalConversation(
            userId
          );
          conversationId = conversation.id;

          // Get next sequence number for message
          const sequenceNumber = await getNextSequenceNumber(conversationId);

          // Create user message
          const message = await createAIMessage({
            id: crypto.randomUUID(),
            conversationId,
            role: "user",
            content: body.text,
            sequenceNumber,
          });
          messageId = message.id;

          // Create tool call record (status: "proposed")
          const toolCall = await createAIToolCall({
            id: crypto.randomUUID(),
            messageId,
            conversationId,
            toolName: parsed.toolId,
            toolCallId: idempotencyKey,
            inputArguments: JSON.stringify(parsed.input),
            status: "proposed",
            outputResult: JSON.stringify({
              tenantId,
              userId,
              toolId: parsed.toolId,
              policy: policyResult,
              riskLevel,
            }),
          });
          aiToolCallId = toolCall.id;

          console.log(
            `[Assistant Propose] Created new proposal: ${idempotencyKey}`
          );
        }

        // =====================================================================
        // 10. Return Proposal + Policy Decision + Persistence Metadata
        // =====================================================================

        return Response.json({
          ok: true,
          tenantId,
          userId,
          proposed: {
            toolId: parsed.toolId,
            input: parsed.input,
            riskLevel,
            ...(warning && { warning }),
          },
          policy: {
            decision: policyResult.decision,
            reason: policyResult.reason,
          },
          proposalRecord: {
            aiToolCallId,
            aiConversationId: conversationId,
            aiMessageId: messageId,
            toolCallId: idempotencyKey,
          },
        });
      },
    },
  },
});
