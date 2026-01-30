import type { ToolDefinition, ToolResult, ToolContext } from "../tool-registry";
import { runSystemHealthCheck, type HealthCheckResult } from "~/lib/monitoring/system-health";

interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: "low" | "normal" | "high";
  dueDate?: string;
}

interface SummarizeInboxThreadInput {
  threadId: string;
  maxMessages?: number;
}

interface DraftEmailInput {
  to: string;
  subject: string;
  context: string;
  tone?: "professional" | "friendly" | "formal";
}

interface CreateExpenseInput {
  amount: number;
  description: string;
  category: string;
  date?: string;
}

interface SystemHealthCheckInput {
  includeDetails?: boolean;
}

const stubHandler = async <TInput, TOutput>(
  _input: TInput,
  _context: ToolContext
): Promise<ToolResult<TOutput>> => {
  return {
    success: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Tool execution not implemented yet",
    },
  };
};

const systemHealthCheckHandler = async (
  input: SystemHealthCheckInput,
  _context: ToolContext
): Promise<ToolResult<HealthCheckResult>> => {
  try {
    const healthResult = await runSystemHealthCheck();

    if (input.includeDetails === false) {
      const checks = { ...healthResult.checks };
      for (const key in checks) {
        if (checks.hasOwnProperty(key)) {
          const check = checks[key as keyof typeof checks];
          if (check.details) {
            delete check.details;
          }
        }
      }
      healthResult.checks = checks;
    }

    return {
      success: true,
      data: healthResult,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "HEALTH_CHECK_FAILED",
        message: error instanceof Error ? error.message : "Health check failed",
      },
    };
  }
};

export const createTaskTool: ToolDefinition<CreateTaskInput, unknown> = {
  id: "assistant.create_task",
  name: "Create Task",
  description: "Create a new task in the task management system with title, description, priority, and optional due date",
  version: "1.0.0",
  category: "utility",
  permission: "user",
  enabled: true,
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Task title",
      },
      description: {
        type: "string",
        description: "Detailed task description",
      },
      priority: {
        type: "string",
        enum: ["low", "normal", "high"],
        description: "Task priority level",
      },
      dueDate: {
        type: "string",
        description: "Due date in ISO 8601 format",
      },
    },
    required: ["title"],
  },
  handler: stubHandler,
  metadata: {
    assistantRiskLevel: "medium",
  },
};

export const summarizeInboxThreadTool: ToolDefinition<SummarizeInboxThreadInput, unknown> = {
  id: "assistant.summarize_inbox_thread",
  name: "Summarize Inbox Thread",
  description: "Generate a summary of an inbox conversation thread including key points and action items",
  version: "1.0.0",
  category: "communication",
  permission: "user",
  enabled: true,
  inputSchema: {
    type: "object",
    properties: {
      threadId: {
        type: "string",
        description: "Unique identifier of the thread to summarize",
      },
      maxMessages: {
        type: "number",
        description: "Maximum number of messages to include in summary",
      },
    },
    required: ["threadId"],
  },
  handler: stubHandler,
  metadata: {
    assistantRiskLevel: "low",
  },
};

export const draftEmailTool: ToolDefinition<DraftEmailInput, unknown> = {
  id: "assistant.draft_email",
  name: "Draft Email",
  description: "Generate a draft email based on recipient, subject, context, and desired tone",
  version: "1.0.0",
  category: "communication",
  permission: "user",
  enabled: true,
  inputSchema: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description: "Email recipient address",
      },
      subject: {
        type: "string",
        description: "Email subject line",
      },
      context: {
        type: "string",
        description: "Context or main points to include in email",
      },
      tone: {
        type: "string",
        enum: ["professional", "friendly", "formal"],
        description: "Desired tone of the email",
      },
    },
    required: ["to", "subject", "context"],
  },
  handler: stubHandler,
  metadata: {
    assistantRiskLevel: "low",
  },
};

export const createExpenseTool: ToolDefinition<CreateExpenseInput, unknown> = {
  id: "assistant.create_expense",
  name: "Create Expense",
  description: "Record a new expense entry with amount, description, category, and date",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  inputSchema: {
    type: "object",
    properties: {
      amount: {
        type: "number",
        description: "Expense amount in local currency",
      },
      description: {
        type: "string",
        description: "Description of the expense",
      },
      category: {
        type: "string",
        description: "Expense category (e.g., travel, meals, supplies)",
      },
      date: {
        type: "string",
        description: "Expense date in ISO 8601 format",
      },
    },
    required: ["amount", "description", "category"],
  },
  handler: stubHandler,
  metadata: {
    assistantRiskLevel: "high",
  },
};

export const systemHealthCheckTool: ToolDefinition<SystemHealthCheckInput, HealthCheckResult> = {
  id: "assistant.system_health_check",
  name: "System Health Check",
  description: "Check system health status including database connectivity, API availability, and resource usage",
  version: "1.0.0",
  category: "integration",
  permission: "user",
  enabled: true,
  inputSchema: {
    type: "object",
    properties: {
      includeDetails: {
        type: "boolean",
        description: "Include detailed diagnostics in response",
      },
    },
  },
  handler: systemHealthCheckHandler,
  metadata: {
    assistantRiskLevel: "low",
  },
};

export const assistantTools = [
  createTaskTool,
  summarizeInboxThreadTool,
  draftEmailTool,
  createExpenseTool,
  systemHealthCheckTool,
];

export function getAssistantToolCount(): number {
  return assistantTools.length;
}
