/**
 * Task Management Tools
 *
 * Tools for creating, updating, assigning, and querying tasks through natural language.
 * Includes smart scheduling, priority setting, and dependency management.
 * Provides conversational access to task management through Claude.
 */

import type { ToolDefinition, ToolResult } from "../tool-registry";
import { createSummaryFormatter, createTableFormatter } from "../tool-registry";
import {
  getTasksWithFilters,
  getTaskStatistics,
  getUserTasks,
  getOverdueTasksForDashboard,
  getTasksDueToday,
  getTasksDueThisWeek,
  getHighPriorityTasks,
  getBlockedTasks,
  getProjectTasksForDashboard,
  type TaskFilters,
  type TaskStats,
  type DashboardTaskSummary,
  type TaskQueryResult,
} from "~/data-access/odoo-tasks";
import { getOdooClient } from "~/data-access/odoo";
import type { OdooRecord, XmlRpcValue } from "~/lib/odoo/types";

// =============================================================================
// Type Definitions for Tool Inputs/Outputs
// =============================================================================

interface GetTasksInput {
  status?: "open" | "closed" | "all";
  priority?: "high" | "normal" | "all";
  dueDateFilter?: "overdue" | "due_today" | "due_this_week" | "due_this_month" | "no_deadline" | "all";
  projectId?: number;
  assignedUserId?: number;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

interface GetTaskByIdInput {
  taskId: number;
}

interface GetTaskStatsInput {
  projectId?: number;
  assignedUserId?: number;
}

interface GetMyTasksInput {
  status?: "open" | "closed" | "all";
  priority?: "high" | "normal" | "all";
  dueDateFilter?: "overdue" | "due_today" | "due_this_week" | "all";
  limit?: number;
}

interface CreateTaskInput {
  name: string;
  projectId: number;
  description?: string;
  priority?: "high" | "normal";
  deadline?: string;
  assignedUserIds?: number[];
  parentTaskId?: number;
  plannedHours?: number;
}

interface UpdateTaskInput {
  taskId: number;
  name?: string;
  description?: string;
  priority?: "high" | "normal";
  deadline?: string;
  stageId?: number;
  kanbanState?: "normal" | "done" | "blocked";
  plannedHours?: number;
}

interface AssignTaskInput {
  taskId: number;
  userIds: number[];
  addToExisting?: boolean;
}

interface SetTaskPriorityInput {
  taskId: number;
  priority: "high" | "normal";
}

interface SetTaskDeadlineInput {
  taskId: number;
  deadline: string;
}

interface CompleteTaskInput {
  taskId: number;
}

interface GetTaskDependenciesInput {
  taskId: number;
}

interface AddSubtaskInput {
  parentTaskId: number;
  name: string;
  description?: string;
  deadline?: string;
  assignedUserIds?: number[];
}

interface ScheduleTaskInput {
  taskId: number;
  deadline: string;
  plannedHours?: number;
  assignedUserIds?: number[];
}

interface GetProjectTasksInput {
  projectId: number;
  status?: "open" | "closed" | "all";
  limit?: number;
}

interface SearchTasksInput {
  query: string;
  projectId?: number;
  status?: "open" | "closed" | "all";
  limit?: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert priority string to Odoo priority value
 */
function toPriority(priority?: "high" | "normal" | "all"): "0" | "1" | "all" {
  if (priority === "high") return "1";
  if (priority === "normal") return "0";
  return "all";
}

/**
 * Parse natural language date to ISO format
 */
function parseNaturalDate(dateStr: string): string {
  const today = new Date();
  const lowerStr = dateStr.toLowerCase().trim();

  // Handle relative dates
  if (lowerStr === "today") {
    return today.toISOString().split("T")[0];
  }
  if (lowerStr === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }
  if (lowerStr === "next week") {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split("T")[0];
  }
  if (lowerStr === "next month") {
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.toISOString().split("T")[0];
  }

  // Handle "in X days/weeks/months"
  const inMatch = lowerStr.match(/^in\s+(\d+)\s+(day|days|week|weeks|month|months)$/);
  if (inMatch) {
    const amount = parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    const result = new Date(today);
    if (unit.startsWith("day")) {
      result.setDate(result.getDate() + amount);
    } else if (unit.startsWith("week")) {
      result.setDate(result.getDate() + amount * 7);
    } else if (unit.startsWith("month")) {
      result.setMonth(result.getMonth() + amount);
    }
    return result.toISOString().split("T")[0];
  }

  // Try to parse as ISO date
  const isoMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoMatch) {
    return dateStr;
  }

  // Try to parse as a date string
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  // Fallback - return original string
  return dateStr;
}

// =============================================================================
// Query Tasks Tool
// =============================================================================

export const getTasksTool: ToolDefinition<
  GetTasksInput,
  { tasks: DashboardTaskSummary[]; totalCount: number; hasMore: boolean }
> = {
  id: "tasks-list",
  name: "Tasks List",
  description:
    "Get a list of tasks with filtering options. Use this to find tasks by status (open/closed), priority (high/normal), due date (overdue, today, this week), project, or assignee. Perfect for answering questions like 'show me overdue tasks' or 'what tasks are due this week'.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "project", "management", "list", "query"],
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        description: "Filter by task status: 'open' for active tasks, 'closed' for completed, 'all' for both",
        enum: ["open", "closed", "all"],
      },
      priority: {
        type: "string",
        description: "Filter by priority: 'high' for urgent tasks, 'normal' for regular tasks, 'all' for both",
        enum: ["high", "normal", "all"],
      },
      dueDateFilter: {
        type: "string",
        description: "Filter by due date: 'overdue', 'due_today', 'due_this_week', 'due_this_month', 'no_deadline', or 'all'",
        enum: ["overdue", "due_today", "due_this_week", "due_this_month", "no_deadline", "all"],
      },
      projectId: {
        type: "integer",
        description: "Filter by project ID",
      },
      assignedUserId: {
        type: "integer",
        description: "Filter by assigned user ID",
      },
      searchQuery: {
        type: "string",
        description: "Search tasks by name",
      },
      limit: {
        type: "integer",
        description: "Maximum number of tasks to return (default 20, max 100)",
        default: 20,
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: "integer",
        description: "Number of tasks to skip for pagination",
        default: 0,
        minimum: 0,
      },
    },
  },
  handler: async (input, context): Promise<ToolResult<{ tasks: DashboardTaskSummary[]; totalCount: number; hasMore: boolean }>> => {
    try {
      const filters: TaskFilters = {
        status: input.status || "all",
        priority: toPriority(input.priority),
        dueDateFilter: input.dueDateFilter || "all",
        projectId: input.projectId,
        assignedUserId: input.assignedUserId,
        searchQuery: input.searchQuery,
        limit: Math.min(input.limit || 20, 100),
        offset: input.offset || 0,
      };

      const result = await getTasksWithFilters(filters);

      return {
        success: true,
        data: {
          tasks: result.tasks,
          totalCount: result.totalCount,
          hasMore: result.hasMore,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "TASKS_LIST_ERROR",
          message: error instanceof Error ? error.message : "Failed to get tasks list",
          retryable: true,
        },
      };
    }
  },
  // Note: Using default formatter since return type includes additional metadata
};

// =============================================================================
// Get Task By ID Tool
// =============================================================================

export const getTaskByIdTool: ToolDefinition<
  GetTaskByIdInput,
  { task: DashboardTaskSummary | null }
> = {
  id: "task-detail",
  name: "Task Detail",
  description:
    "Get detailed information about a specific task by its ID. Use this when you need full details about a particular task including description, assignees, progress, and time tracking.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "detail", "query"],
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "integer",
        description: "The task ID to retrieve",
      },
    },
    required: ["taskId"],
  },
  handler: async (input, context): Promise<ToolResult<{ task: DashboardTaskSummary | null }>> => {
    try {
      const client = await getOdooClient();
      const tasks = await client.searchRead<OdooRecord>("project.task", [["id", "=", input.taskId]], {
        fields: [
          "id", "name", "active", "project_id", "partner_id", "user_ids",
          "date_deadline", "date_assign", "date_end", "priority", "sequence",
          "stage_id", "tag_ids", "kanban_state", "description", "parent_id",
          "child_ids", "milestone_id", "planned_hours", "effective_hours",
          "remaining_hours", "progress", "subtask_count", "create_date", "write_date",
        ],
        limit: 1,
      });

      if (tasks.length === 0) {
        return {
          success: false,
          error: {
            code: "TASK_NOT_FOUND",
            message: `Task with ID ${input.taskId} not found`,
            retryable: false,
          },
        };
      }

      const result = await getTasksWithFilters({ limit: 1 });
      const taskData = result.tasks.find(t => t.id === input.taskId);

      // If not found in filtered results, construct basic task info
      const task = taskData || {
        id: tasks[0].id as number,
        name: tasks[0].name as string,
        projectId: Array.isArray(tasks[0].project_id) ? (tasks[0].project_id as [number, string])[0] : null,
        projectName: Array.isArray(tasks[0].project_id) ? (tasks[0].project_id as [number, string])[1] : null,
        assigneeIds: (tasks[0].user_ids as number[]) || [],
        deadline: typeof tasks[0].date_deadline === "string" ? tasks[0].date_deadline : null,
        priority: (tasks[0].priority as string) || "0",
        stageId: Array.isArray(tasks[0].stage_id) ? (tasks[0].stage_id as [number, string])[0] : null,
        stageName: Array.isArray(tasks[0].stage_id) ? (tasks[0].stage_id as [number, string])[1] : null,
        milestoneId: Array.isArray(tasks[0].milestone_id) ? (tasks[0].milestone_id as [number, string])[0] : null,
        milestoneName: Array.isArray(tasks[0].milestone_id) ? (tasks[0].milestone_id as [number, string])[1] : null,
        kanbanState: (tasks[0].kanban_state as string) || "normal",
        plannedHours: (tasks[0].planned_hours as number) || 0,
        effectiveHours: (tasks[0].effective_hours as number) || 0,
        progress: (tasks[0].progress as number) || 0,
        daysUntilDeadline: null,
        isOverdue: false,
        isDueToday: false,
        isDueThisWeek: false,
        statusLabel: tasks[0].date_end ? "Completed" : "In Progress",
        deadlineFormatted: null,
        assigneeNames: [],
      } as DashboardTaskSummary;

      return {
        success: true,
        data: { task },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "TASK_DETAIL_ERROR",
          message: error instanceof Error ? error.message : "Failed to get task details",
          retryable: true,
        },
      };
    }
  },
  formatter: createSummaryFormatter<{ task: DashboardTaskSummary | null }>([
    { key: "task", label: "Task Details" },
  ]),
};

// =============================================================================
// Get Task Statistics Tool
// =============================================================================

export const getTaskStatsTool: ToolDefinition<GetTaskStatsInput, TaskStats> = {
  id: "task-statistics",
  name: "Task Statistics",
  description:
    "Get task statistics and metrics including total tasks, open/closed counts, overdue tasks, high priority tasks, and average progress. Use this for dashboard summaries or answering questions like 'how many tasks are overdue?' or 'what's our task completion rate?'.",
  version: "1.0.0",
  category: "analysis",
  permission: "user",
  enabled: true,
  tags: ["tasks", "statistics", "metrics", "dashboard", "summary"],
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "integer",
        description: "Optional project ID to filter statistics",
      },
      assignedUserId: {
        type: "integer",
        description: "Optional user ID to filter statistics for a specific assignee",
      },
    },
  },
  handler: async (input, context): Promise<ToolResult<TaskStats>> => {
    try {
      const stats = await getTaskStatistics({
        projectId: input.projectId,
        assignedUserId: input.assignedUserId,
      });

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "TASK_STATS_ERROR",
          message: error instanceof Error ? error.message : "Failed to get task statistics",
          retryable: true,
        },
      };
    }
  },
  formatter: createSummaryFormatter<TaskStats>([
    { key: "totalTasks", label: "Total Tasks" },
    { key: "openTasks", label: "Open Tasks" },
    { key: "closedTasks", label: "Closed Tasks" },
    { key: "overdueTasks", label: "Overdue Tasks" },
    { key: "dueToday", label: "Due Today" },
    { key: "dueThisWeek", label: "Due This Week" },
    { key: "highPriority", label: "High Priority" },
    { key: "blockedTasks", label: "Blocked Tasks" },
    { key: "unassignedTasks", label: "Unassigned Tasks" },
    { key: "averageProgress", label: "Average Progress (%)" },
  ]),
};

// =============================================================================
// Get Overdue Tasks Tool
// =============================================================================

export const getOverdueTasksTool: ToolDefinition<
  { limit?: number; projectId?: number },
  { tasks: DashboardTaskSummary[]; totalCount: number }
> = {
  id: "overdue-tasks",
  name: "Overdue Tasks",
  description:
    "Get all overdue tasks that have passed their deadline but are not yet completed. Use this to identify tasks that need immediate attention or for follow-up on delayed work.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "overdue", "deadline", "urgent"],
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        description: "Maximum number of tasks to return (default 20)",
        default: 20,
        minimum: 1,
        maximum: 100,
      },
      projectId: {
        type: "integer",
        description: "Optional project ID to filter overdue tasks",
      },
    },
  },
  handler: async (input, context): Promise<ToolResult<{ tasks: DashboardTaskSummary[]; totalCount: number }>> => {
    try {
      const result = await getOverdueTasksForDashboard({
        limit: input.limit || 20,
        projectId: input.projectId,
      });

      return {
        success: true,
        data: {
          tasks: result.tasks,
          totalCount: result.totalCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "OVERDUE_TASKS_ERROR",
          message: error instanceof Error ? error.message : "Failed to get overdue tasks",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Get Tasks Due Today Tool
// =============================================================================

export const getTasksDueTodayTool: ToolDefinition<
  { limit?: number; projectId?: number },
  { tasks: DashboardTaskSummary[]; totalCount: number }
> = {
  id: "tasks-due-today",
  name: "Tasks Due Today",
  description:
    "Get all tasks that are due today. Use this for daily planning or to see what needs to be completed today.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "due", "today", "deadline"],
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        description: "Maximum number of tasks to return (default 20)",
        default: 20,
        minimum: 1,
        maximum: 100,
      },
      projectId: {
        type: "integer",
        description: "Optional project ID to filter tasks",
      },
    },
  },
  handler: async (input, context): Promise<ToolResult<{ tasks: DashboardTaskSummary[]; totalCount: number }>> => {
    try {
      const result = await getTasksDueToday({
        limit: input.limit || 20,
        projectId: input.projectId,
      });

      return {
        success: true,
        data: {
          tasks: result.tasks,
          totalCount: result.totalCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "TASKS_DUE_TODAY_ERROR",
          message: error instanceof Error ? error.message : "Failed to get tasks due today",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Get Tasks Due This Week Tool
// =============================================================================

export const getTasksDueThisWeekTool: ToolDefinition<
  { limit?: number; projectId?: number },
  { tasks: DashboardTaskSummary[]; totalCount: number }
> = {
  id: "tasks-due-this-week",
  name: "Tasks Due This Week",
  description:
    "Get all tasks that are due within the current week. Use this for weekly planning or sprint reviews.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "due", "week", "deadline", "planning"],
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        description: "Maximum number of tasks to return (default 30)",
        default: 30,
        minimum: 1,
        maximum: 100,
      },
      projectId: {
        type: "integer",
        description: "Optional project ID to filter tasks",
      },
    },
  },
  handler: async (input, context): Promise<ToolResult<{ tasks: DashboardTaskSummary[]; totalCount: number }>> => {
    try {
      const result = await getTasksDueThisWeek({
        limit: input.limit || 30,
        projectId: input.projectId,
      });

      return {
        success: true,
        data: {
          tasks: result.tasks,
          totalCount: result.totalCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "TASKS_DUE_WEEK_ERROR",
          message: error instanceof Error ? error.message : "Failed to get tasks due this week",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Get High Priority Tasks Tool
// =============================================================================

export const getHighPriorityTasksTool: ToolDefinition<
  { limit?: number; projectId?: number },
  { tasks: DashboardTaskSummary[]; totalCount: number }
> = {
  id: "high-priority-tasks",
  name: "High Priority Tasks",
  description:
    "Get all high priority/urgent tasks. Use this to focus on the most important work or to see what needs immediate attention.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "priority", "urgent", "important"],
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        description: "Maximum number of tasks to return (default 20)",
        default: 20,
        minimum: 1,
        maximum: 100,
      },
      projectId: {
        type: "integer",
        description: "Optional project ID to filter tasks",
      },
    },
  },
  handler: async (input, context): Promise<ToolResult<{ tasks: DashboardTaskSummary[]; totalCount: number }>> => {
    try {
      const result = await getHighPriorityTasks({
        limit: input.limit || 20,
        projectId: input.projectId,
      });

      return {
        success: true,
        data: {
          tasks: result.tasks,
          totalCount: result.totalCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "HIGH_PRIORITY_TASKS_ERROR",
          message: error instanceof Error ? error.message : "Failed to get high priority tasks",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Get Blocked Tasks Tool
// =============================================================================

export const getBlockedTasksTool: ToolDefinition<
  { limit?: number; projectId?: number },
  { tasks: DashboardTaskSummary[]; totalCount: number }
> = {
  id: "blocked-tasks",
  name: "Blocked Tasks",
  description:
    "Get all tasks that are currently blocked and cannot progress. Use this to identify blockers and dependencies that need resolution.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "blocked", "dependencies", "blockers"],
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        description: "Maximum number of tasks to return (default 20)",
        default: 20,
        minimum: 1,
        maximum: 100,
      },
      projectId: {
        type: "integer",
        description: "Optional project ID to filter tasks",
      },
    },
  },
  handler: async (input, context): Promise<ToolResult<{ tasks: DashboardTaskSummary[]; totalCount: number }>> => {
    try {
      const result = await getBlockedTasks({
        limit: input.limit || 20,
        projectId: input.projectId,
      });

      return {
        success: true,
        data: {
          tasks: result.tasks,
          totalCount: result.totalCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "BLOCKED_TASKS_ERROR",
          message: error instanceof Error ? error.message : "Failed to get blocked tasks",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Get Project Tasks Tool
// =============================================================================

export const getProjectTasksTool: ToolDefinition<
  GetProjectTasksInput,
  { tasks: DashboardTaskSummary[]; totalCount: number; projectId: number }
> = {
  id: "project-tasks",
  name: "Project Tasks",
  description:
    "Get all tasks for a specific project. Use this when asked about tasks in a particular project or for project-level reporting.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "project", "list"],
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "integer",
        description: "The project ID to get tasks for",
      },
      status: {
        type: "string",
        description: "Filter by task status: 'open', 'closed', or 'all'",
        enum: ["open", "closed", "all"],
      },
      limit: {
        type: "integer",
        description: "Maximum number of tasks to return (default 50)",
        default: 50,
        minimum: 1,
        maximum: 200,
      },
    },
    required: ["projectId"],
  },
  handler: async (input, context): Promise<ToolResult<{ tasks: DashboardTaskSummary[]; totalCount: number; projectId: number }>> => {
    try {
      const result = await getProjectTasksForDashboard(input.projectId, {
        status: input.status || "all",
        limit: input.limit || 50,
      });

      return {
        success: true,
        data: {
          tasks: result.tasks,
          totalCount: result.totalCount,
          projectId: input.projectId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "PROJECT_TASKS_ERROR",
          message: error instanceof Error ? error.message : "Failed to get project tasks",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Search Tasks Tool
// =============================================================================

export const searchTasksTool: ToolDefinition<
  SearchTasksInput,
  { tasks: DashboardTaskSummary[]; totalCount: number; query: string }
> = {
  id: "search-tasks",
  name: "Search Tasks",
  description:
    "Search for tasks by name or keyword. Use this when looking for specific tasks by name or when the user mentions a task by name.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "search", "find", "query"],
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query to find tasks by name",
      },
      projectId: {
        type: "integer",
        description: "Optional project ID to limit search scope",
      },
      status: {
        type: "string",
        description: "Filter by task status",
        enum: ["open", "closed", "all"],
      },
      limit: {
        type: "integer",
        description: "Maximum number of results (default 20)",
        default: 20,
        minimum: 1,
        maximum: 50,
      },
    },
    required: ["query"],
  },
  handler: async (input, context): Promise<ToolResult<{ tasks: DashboardTaskSummary[]; totalCount: number; query: string }>> => {
    try {
      const result = await getTasksWithFilters({
        searchQuery: input.query,
        projectId: input.projectId,
        status: input.status || "all",
        limit: input.limit || 20,
      });

      return {
        success: true,
        data: {
          tasks: result.tasks,
          totalCount: result.totalCount,
          query: input.query,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "SEARCH_TASKS_ERROR",
          message: error instanceof Error ? error.message : "Failed to search tasks",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Create Task Tool
// =============================================================================

export const createTaskTool: ToolDefinition<
  CreateTaskInput,
  { taskId: number; name: string; projectId: number }
> = {
  id: "create-task",
  name: "Create Task",
  description:
    "Create a new task in a project. Requires a task name and project ID. Optionally set description, priority, deadline, assignees, parent task (for subtasks), and planned hours.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "create", "new", "add"],
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the task",
      },
      projectId: {
        type: "integer",
        description: "Project ID to create the task in",
      },
      description: {
        type: "string",
        description: "Optional detailed description of the task",
      },
      priority: {
        type: "string",
        description: "Task priority: 'high' or 'normal' (default)",
        enum: ["high", "normal"],
      },
      deadline: {
        type: "string",
        description: "Due date in YYYY-MM-DD format or natural language (e.g., 'tomorrow', 'next week', 'in 3 days')",
      },
      assignedUserIds: {
        type: "array",
        items: { type: "integer" },
        description: "Array of user IDs to assign the task to",
      },
      parentTaskId: {
        type: "integer",
        description: "Parent task ID if this is a subtask",
      },
      plannedHours: {
        type: "number",
        description: "Estimated hours to complete the task",
      },
    },
    required: ["name", "projectId"],
  },
  handler: async (input, context): Promise<ToolResult<{ taskId: number; name: string; projectId: number }>> => {
    try {
      const client = await getOdooClient();

      const taskData: Record<string, XmlRpcValue> = {
        name: input.name,
        project_id: input.projectId,
      };

      if (input.description) {
        taskData.description = input.description;
      }

      if (input.priority === "high") {
        taskData.priority = "1";
      }

      if (input.deadline) {
        taskData.date_deadline = parseNaturalDate(input.deadline);
      }

      if (input.assignedUserIds && input.assignedUserIds.length > 0) {
        taskData.user_ids = [[6, 0, input.assignedUserIds]];
      }

      if (input.parentTaskId) {
        taskData.parent_id = input.parentTaskId;
      }

      if (input.plannedHours) {
        taskData.planned_hours = input.plannedHours;
      }

      const taskId = await client.create("project.task", taskData);

      return {
        success: true,
        data: {
          taskId: taskId as number,
          name: input.name,
          projectId: input.projectId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "CREATE_TASK_ERROR",
          message: error instanceof Error ? error.message : "Failed to create task",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Update Task Tool
// =============================================================================

export const updateTaskTool: ToolDefinition<
  UpdateTaskInput,
  { taskId: number; updated: string[] }
> = {
  id: "update-task",
  name: "Update Task",
  description:
    "Update an existing task's properties including name, description, priority, deadline, stage, or kanban state. Use this to modify task details or change task status.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "update", "edit", "modify"],
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "integer",
        description: "ID of the task to update",
      },
      name: {
        type: "string",
        description: "New name for the task",
      },
      description: {
        type: "string",
        description: "New description for the task",
      },
      priority: {
        type: "string",
        description: "New priority: 'high' or 'normal'",
        enum: ["high", "normal"],
      },
      deadline: {
        type: "string",
        description: "New deadline in YYYY-MM-DD format or natural language",
      },
      stageId: {
        type: "integer",
        description: "New stage ID to move the task to",
      },
      kanbanState: {
        type: "string",
        description: "New kanban state: 'normal', 'done' (ready), or 'blocked'",
        enum: ["normal", "done", "blocked"],
      },
      plannedHours: {
        type: "number",
        description: "New planned hours estimate",
      },
    },
    required: ["taskId"],
  },
  handler: async (input, context): Promise<ToolResult<{ taskId: number; updated: string[] }>> => {
    try {
      const client = await getOdooClient();
      const updateData: Record<string, XmlRpcValue> = {};
      const updatedFields: string[] = [];

      if (input.name !== undefined) {
        updateData.name = input.name;
        updatedFields.push("name");
      }

      if (input.description !== undefined) {
        updateData.description = input.description;
        updatedFields.push("description");
      }

      if (input.priority !== undefined) {
        updateData.priority = input.priority === "high" ? "1" : "0";
        updatedFields.push("priority");
      }

      if (input.deadline !== undefined) {
        updateData.date_deadline = parseNaturalDate(input.deadline);
        updatedFields.push("deadline");
      }

      if (input.stageId !== undefined) {
        updateData.stage_id = input.stageId;
        updatedFields.push("stage");
      }

      if (input.kanbanState !== undefined) {
        updateData.kanban_state = input.kanbanState;
        updatedFields.push("kanbanState");
      }

      if (input.plannedHours !== undefined) {
        updateData.planned_hours = input.plannedHours;
        updatedFields.push("plannedHours");
      }

      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          error: {
            code: "NO_UPDATES",
            message: "No fields provided to update",
            retryable: false,
          },
        };
      }

      await client.write("project.task", [input.taskId], updateData);

      return {
        success: true,
        data: {
          taskId: input.taskId,
          updated: updatedFields,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "UPDATE_TASK_ERROR",
          message: error instanceof Error ? error.message : "Failed to update task",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Assign Task Tool
// =============================================================================

export const assignTaskTool: ToolDefinition<
  AssignTaskInput,
  { taskId: number; assignedUserIds: number[] }
> = {
  id: "assign-task",
  name: "Assign Task",
  description:
    "Assign users to a task. Can either replace existing assignees or add to them. Use this when asked to assign, reassign, or add team members to a task.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "assign", "users", "team"],
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "integer",
        description: "ID of the task to assign",
      },
      userIds: {
        type: "array",
        items: { type: "integer" },
        description: "Array of user IDs to assign",
      },
      addToExisting: {
        type: "boolean",
        description: "If true, add to existing assignees; if false, replace them (default: false)",
      },
    },
    required: ["taskId", "userIds"],
  },
  handler: async (input, context): Promise<ToolResult<{ taskId: number; assignedUserIds: number[] }>> => {
    try {
      const client = await getOdooClient();

      let command: [number, number, number[]];
      if (input.addToExisting) {
        // Use command 4 to add without removing existing
        for (const userId of input.userIds) {
          await client.write("project.task", [input.taskId], {
            user_ids: [[4, userId, 0]],
          });
        }
        return {
          success: true,
          data: {
            taskId: input.taskId,
            assignedUserIds: input.userIds,
          },
        };
      } else {
        // Use command 6 to replace all
        command = [6, 0, input.userIds];
        await client.write("project.task", [input.taskId], {
          user_ids: [command],
        });
      }

      return {
        success: true,
        data: {
          taskId: input.taskId,
          assignedUserIds: input.userIds,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "ASSIGN_TASK_ERROR",
          message: error instanceof Error ? error.message : "Failed to assign task",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Set Task Priority Tool
// =============================================================================

export const setTaskPriorityTool: ToolDefinition<
  SetTaskPriorityInput,
  { taskId: number; priority: string }
> = {
  id: "set-task-priority",
  name: "Set Task Priority",
  description:
    "Set the priority level of a task. Use 'high' for urgent/important tasks or 'normal' for regular tasks.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "priority", "urgent"],
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "integer",
        description: "ID of the task to update",
      },
      priority: {
        type: "string",
        description: "Priority level: 'high' or 'normal'",
        enum: ["high", "normal"],
      },
    },
    required: ["taskId", "priority"],
  },
  handler: async (input, context): Promise<ToolResult<{ taskId: number; priority: string }>> => {
    try {
      const client = await getOdooClient();

      await client.write("project.task", [input.taskId], {
        priority: input.priority === "high" ? "1" : "0",
      });

      return {
        success: true,
        data: {
          taskId: input.taskId,
          priority: input.priority,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "SET_PRIORITY_ERROR",
          message: error instanceof Error ? error.message : "Failed to set task priority",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Set Task Deadline Tool
// =============================================================================

export const setTaskDeadlineTool: ToolDefinition<
  SetTaskDeadlineInput,
  { taskId: number; deadline: string }
> = {
  id: "set-task-deadline",
  name: "Set Task Deadline",
  description:
    "Set or update the deadline/due date for a task. Supports ISO format (YYYY-MM-DD) or natural language like 'tomorrow', 'next week', 'in 3 days'.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "deadline", "due date", "schedule"],
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "integer",
        description: "ID of the task to update",
      },
      deadline: {
        type: "string",
        description: "New deadline in YYYY-MM-DD format or natural language (e.g., 'tomorrow', 'next week', 'in 5 days')",
      },
    },
    required: ["taskId", "deadline"],
  },
  handler: async (input, context): Promise<ToolResult<{ taskId: number; deadline: string }>> => {
    try {
      const client = await getOdooClient();
      const parsedDeadline = parseNaturalDate(input.deadline);

      await client.write("project.task", [input.taskId], {
        date_deadline: parsedDeadline,
      });

      return {
        success: true,
        data: {
          taskId: input.taskId,
          deadline: parsedDeadline,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "SET_DEADLINE_ERROR",
          message: error instanceof Error ? error.message : "Failed to set task deadline",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Complete Task Tool
// =============================================================================

export const completeTaskTool: ToolDefinition<
  CompleteTaskInput,
  { taskId: number; completedAt: string }
> = {
  id: "complete-task",
  name: "Complete Task",
  description:
    "Mark a task as completed. This sets the task's end date to now and marks it as done.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "complete", "done", "finish"],
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "integer",
        description: "ID of the task to complete",
      },
    },
    required: ["taskId"],
  },
  handler: async (input, context): Promise<ToolResult<{ taskId: number; completedAt: string }>> => {
    try {
      const client = await getOdooClient();
      const now = new Date().toISOString();

      await client.write("project.task", [input.taskId], {
        date_end: now,
        kanban_state: "done",
      });

      return {
        success: true,
        data: {
          taskId: input.taskId,
          completedAt: now,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "COMPLETE_TASK_ERROR",
          message: error instanceof Error ? error.message : "Failed to complete task",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Add Subtask Tool
// =============================================================================

export const addSubtaskTool: ToolDefinition<
  AddSubtaskInput,
  { subtaskId: number; parentTaskId: number; name: string }
> = {
  id: "add-subtask",
  name: "Add Subtask",
  description:
    "Create a subtask under a parent task. Use this to break down large tasks into smaller, manageable pieces.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "subtask", "create", "breakdown"],
  inputSchema: {
    type: "object",
    properties: {
      parentTaskId: {
        type: "integer",
        description: "ID of the parent task",
      },
      name: {
        type: "string",
        description: "Name of the subtask",
      },
      description: {
        type: "string",
        description: "Optional description",
      },
      deadline: {
        type: "string",
        description: "Optional deadline in YYYY-MM-DD format or natural language",
      },
      assignedUserIds: {
        type: "array",
        items: { type: "integer" },
        description: "Optional array of user IDs to assign",
      },
    },
    required: ["parentTaskId", "name"],
  },
  handler: async (input, context): Promise<ToolResult<{ subtaskId: number; parentTaskId: number; name: string }>> => {
    try {
      const client = await getOdooClient();

      // First, get the parent task to inherit project
      const parentTasks = await client.read<OdooRecord & { project_id: [number, string] }>("project.task", [input.parentTaskId], {
        fields: ["project_id"],
      });

      if (parentTasks.length === 0) {
        return {
          success: false,
          error: {
            code: "PARENT_NOT_FOUND",
            message: `Parent task with ID ${input.parentTaskId} not found`,
            retryable: false,
          },
        };
      }

      const projectId = parentTasks[0].project_id[0];

      const subtaskData: Record<string, XmlRpcValue> = {
        name: input.name,
        project_id: projectId,
        parent_id: input.parentTaskId,
      };

      if (input.description) {
        subtaskData.description = input.description;
      }

      if (input.deadline) {
        subtaskData.date_deadline = parseNaturalDate(input.deadline);
      }

      if (input.assignedUserIds && input.assignedUserIds.length > 0) {
        subtaskData.user_ids = [[6, 0, input.assignedUserIds]];
      }

      const subtaskId = await client.create("project.task", subtaskData);

      return {
        success: true,
        data: {
          subtaskId: subtaskId as number,
          parentTaskId: input.parentTaskId,
          name: input.name,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "ADD_SUBTASK_ERROR",
          message: error instanceof Error ? error.message : "Failed to add subtask",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Schedule Task Tool (Smart Scheduling)
// =============================================================================

export const scheduleTaskTool: ToolDefinition<
  ScheduleTaskInput,
  { taskId: number; deadline: string; plannedHours?: number; assignedUserIds?: number[] }
> = {
  id: "schedule-task",
  name: "Schedule Task",
  description:
    "Schedule a task by setting its deadline, estimated hours, and optionally assigning team members. Supports natural language dates like 'next Monday', 'in 2 weeks', etc.",
  version: "1.0.0",
  category: "data",
  permission: "user",
  enabled: true,
  tags: ["tasks", "schedule", "plan", "deadline", "assign"],
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "integer",
        description: "ID of the task to schedule",
      },
      deadline: {
        type: "string",
        description: "Deadline in YYYY-MM-DD format or natural language",
      },
      plannedHours: {
        type: "number",
        description: "Estimated hours to complete the task",
      },
      assignedUserIds: {
        type: "array",
        items: { type: "integer" },
        description: "Optional user IDs to assign the task to",
      },
    },
    required: ["taskId", "deadline"],
  },
  handler: async (input, context): Promise<ToolResult<{ taskId: number; deadline: string; plannedHours?: number; assignedUserIds?: number[] }>> => {
    try {
      const client = await getOdooClient();
      const parsedDeadline = parseNaturalDate(input.deadline);

      const updateData: Record<string, XmlRpcValue> = {
        date_deadline: parsedDeadline,
      };

      if (input.plannedHours) {
        updateData.planned_hours = input.plannedHours;
      }

      if (input.assignedUserIds && input.assignedUserIds.length > 0) {
        updateData.user_ids = [[6, 0, input.assignedUserIds]];
      }

      await client.write("project.task", [input.taskId], updateData);

      return {
        success: true,
        data: {
          taskId: input.taskId,
          deadline: parsedDeadline,
          plannedHours: input.plannedHours,
          assignedUserIds: input.assignedUserIds,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "SCHEDULE_TASK_ERROR",
          message: error instanceof Error ? error.message : "Failed to schedule task",
          retryable: true,
        },
      };
    }
  },
};

// =============================================================================
// Export All Tools
// =============================================================================

export const taskManagementTools = [
  // Query tools
  getTasksTool,
  getTaskByIdTool,
  getTaskStatsTool,
  getOverdueTasksTool,
  getTasksDueTodayTool,
  getTasksDueThisWeekTool,
  getHighPriorityTasksTool,
  getBlockedTasksTool,
  getProjectTasksTool,
  searchTasksTool,
  // Create/update tools
  createTaskTool,
  updateTaskTool,
  assignTaskTool,
  setTaskPriorityTool,
  setTaskDeadlineTool,
  completeTaskTool,
  addSubtaskTool,
  scheduleTaskTool,
];

/**
 * Get count of task management tools
 */
export function getTaskManagementToolCount(): number {
  return taskManagementTools.length;
}
