export type AssistantPolicyDecision = "allow" | "deny" | "requires_approval";

export interface AssistantPolicyInput {
  tenantId: string;
  userId: string;
  toolId: string;
  riskLevel: "low" | "medium" | "high";
  channel: "web" | "telegram";
}

export interface AssistantPolicyResult {
  decision: AssistantPolicyDecision;
  reason: string;
}

export function evaluateAssistantPolicy(input: AssistantPolicyInput): AssistantPolicyResult {
  const recognizedToolIds = [
    "assistant.create_task",
    "assistant.summarize_inbox_thread",
    "assistant.draft_email",
    "assistant.create_expense",
    "assistant.system_health_check",
  ];

  if (!recognizedToolIds.includes(input.toolId)) {
    return {
      decision: "deny",
      reason: `Tool ID '${input.toolId}' is not recognized`,
    };
  }

  if (input.riskLevel === "low") {
    return {
      decision: "allow",
      reason: "Low risk tool - auto-approved",
    };
  }

  if (input.riskLevel === "medium" || input.riskLevel === "high") {
    return {
      decision: "requires_approval",
      reason: `${input.riskLevel === "high" ? "High" : "Medium"} risk tool - requires user approval before execution`,
    };
  }

  return {
    decision: "deny",
    reason: "Invalid risk level",
  };
}
