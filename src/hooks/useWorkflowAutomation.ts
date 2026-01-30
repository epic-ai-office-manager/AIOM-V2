/**
 * React Hooks for Workflow Automation Engine
 *
 * Provides React hooks for fetching and managing workflow definitions,
 * instances, and executions using TanStack Query.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  workflowDefinitionsQueryOptions,
  myWorkflowDefinitionsQueryOptions,
  workflowDefinitionQueryOptions,
  workflowDefinitionStatsQueryOptions,
  workflowInstancesQueryOptions,
  workflowInstanceQueryOptions,
  stepExecutionsQueryOptions,
  eventLogsQueryOptions,
  pendingApprovalsQueryOptions,
  workflowStatisticsQueryOptions,
} from "~/queries/workflow-automation";
import {
  createWorkflowDefinitionFn,
  updateWorkflowDefinitionFn,
  deleteWorkflowDefinitionFn,
  activateWorkflowFn,
  pauseWorkflowFn,
  archiveWorkflowFn,
  triggerWorkflowFn,
  resumeWorkflowFn,
  approveWorkflowApprovalFn,
  rejectWorkflowApprovalFn,
  validateWorkflowDefinitionFn,
} from "~/fn/workflow-automation";
import type {
  WorkflowDefinitionStatus,
  WorkflowTriggerType,
  WorkflowInstanceStatus,
  WorkflowStepDefinition,
} from "~/db/schema";

// =============================================================================
// ServerFn Input Types (derived from Zod schemas)
// =============================================================================

type CreateWorkflowDefinitionInput = Parameters<typeof createWorkflowDefinitionFn>[0]["data"];
type UpdateWorkflowDefinitionInput = Parameters<typeof updateWorkflowDefinitionFn>[0]["data"];
type ValidateWorkflowDefinitionInput = Parameters<typeof validateWorkflowDefinitionFn>[0]["data"];

// =============================================================================
// Workflow Definition Query Hooks
// =============================================================================

/**
 * Hook for fetching all workflow definitions with filters
 */
export function useWorkflowDefinitions(
  filters?: {
    status?: WorkflowDefinitionStatus;
    triggerType?: WorkflowTriggerType;
    category?: string;
    limit?: number;
    offset?: number;
  },
  enabled: boolean = true
) {
  return useQuery({
    ...workflowDefinitionsQueryOptions(filters),
    enabled,
  });
}

/**
 * Hook for fetching workflow definitions created by the current user
 */
export function useMyWorkflowDefinitions(
  filters?: {
    status?: WorkflowDefinitionStatus;
    triggerType?: WorkflowTriggerType;
    category?: string;
    limit?: number;
    offset?: number;
  },
  enabled: boolean = true
) {
  return useQuery({
    ...myWorkflowDefinitionsQueryOptions(filters),
    enabled,
  });
}

/**
 * Hook for fetching a single workflow definition by ID
 */
export function useWorkflowDefinition(id: string, enabled: boolean = true) {
  return useQuery({
    ...workflowDefinitionQueryOptions(id),
    enabled: enabled && !!id,
  });
}

/**
 * Hook for fetching statistics for a specific workflow definition
 */
export function useWorkflowDefinitionStats(id: string, enabled: boolean = true) {
  return useQuery({
    ...workflowDefinitionStatsQueryOptions(id),
    enabled: enabled && !!id,
  });
}

// =============================================================================
// Workflow Instance Query Hooks
// =============================================================================

/**
 * Hook for fetching workflow instances with filters
 */
export function useWorkflowInstances(
  filters?: {
    definitionId?: string;
    status?: WorkflowInstanceStatus;
    limit?: number;
    offset?: number;
  },
  enabled: boolean = true
) {
  return useQuery({
    ...workflowInstancesQueryOptions(filters),
    enabled,
  });
}

/**
 * Hook for fetching a single workflow instance by ID
 */
export function useWorkflowInstance(id: string, enabled: boolean = true) {
  return useQuery({
    ...workflowInstanceQueryOptions(id),
    enabled: enabled && !!id,
  });
}

/**
 * Hook for fetching step executions for an instance
 */
export function useStepExecutions(instanceId: string, enabled: boolean = true) {
  return useQuery({
    ...stepExecutionsQueryOptions(instanceId),
    enabled: enabled && !!instanceId,
  });
}

/**
 * Hook for fetching event logs for an instance
 */
export function useEventLogs(
  instanceId: string,
  options?: {
    limit?: number;
    offset?: number;
  },
  enabled: boolean = true
) {
  return useQuery({
    ...eventLogsQueryOptions(instanceId, options),
    enabled: enabled && !!instanceId,
  });
}

// =============================================================================
// Approval Query Hooks
// =============================================================================

/**
 * Hook for fetching pending approvals for the current user
 */
export function usePendingApprovals(
  options?: {
    limit?: number;
    offset?: number;
  },
  enabled: boolean = true
) {
  return useQuery({
    ...pendingApprovalsQueryOptions(options),
    enabled,
  });
}

// =============================================================================
// Statistics Query Hooks
// =============================================================================

/**
 * Hook for fetching overall workflow statistics
 */
export function useWorkflowStatistics(enabled: boolean = true) {
  return useQuery({
    ...workflowStatisticsQueryOptions(),
    enabled,
  });
}

// =============================================================================
// Workflow Definition Mutation Hooks
// =============================================================================

/**
 * Hook for creating a new workflow definition
 */
export function useCreateWorkflowDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkflowDefinitionInput) => createWorkflowDefinitionFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-definitions"] });
    },
  });
}

/**
 * Hook for updating a workflow definition
 */
export function useUpdateWorkflowDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateWorkflowDefinitionInput) => updateWorkflowDefinitionFn({ data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-definitions"] });
      queryClient.invalidateQueries({
        queryKey: ["workflow-definitions", "detail", variables.id],
      });
    },
  });
}

/**
 * Hook for deleting a workflow definition
 */
export function useDeleteWorkflowDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteWorkflowDefinitionFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-definitions"] });
    },
  });
}

/**
 * Hook for activating a workflow definition
 */
export function useActivateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => activateWorkflowFn({ data: { id } }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-definitions"] });
      queryClient.invalidateQueries({
        queryKey: ["workflow-definitions", "detail", id],
      });
    },
  });
}

/**
 * Hook for pausing a workflow definition
 */
export function usePauseWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pauseWorkflowFn({ data: { id } }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-definitions"] });
      queryClient.invalidateQueries({
        queryKey: ["workflow-definitions", "detail", id],
      });
    },
  });
}

/**
 * Hook for archiving a workflow definition
 */
export function useArchiveWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => archiveWorkflowFn({ data: { id } }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-definitions"] });
      queryClient.invalidateQueries({
        queryKey: ["workflow-definitions", "detail", id],
      });
    },
  });
}

// =============================================================================
// Workflow Execution Mutation Hooks
// =============================================================================

/**
 * Hook for triggering a workflow manually
 */
export function useTriggerWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      definitionId: string;
      data?: Record<string, unknown>;
    }) => triggerWorkflowFn({ data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-instances"] });
      queryClient.invalidateQueries({
        queryKey: ["workflow-definitions", "stats", variables.definitionId],
      });
      queryClient.invalidateQueries({ queryKey: ["workflow-statistics"] });
    },
  });
}

/**
 * Hook for resuming a paused workflow instance
 */
export function useResumeWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (instanceId: string) => resumeWorkflowFn({ data: { instanceId } }),
    onSuccess: (_, instanceId) => {
      queryClient.invalidateQueries({ queryKey: ["workflow-instances"] });
      queryClient.invalidateQueries({
        queryKey: ["workflow-instances", "detail", instanceId],
      });
    },
  });
}

// =============================================================================
// Approval Mutation Hooks
// =============================================================================

/**
 * Hook for approving a workflow approval request
 */
export function useApproveWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { approvalId: string; comments?: string }) =>
      approveWorkflowApprovalFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-instances"] });
    },
  });
}

/**
 * Hook for rejecting a workflow approval request
 */
export function useRejectWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { approvalId: string; comments?: string }) =>
      rejectWorkflowApprovalFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-instances"] });
    },
  });
}

// =============================================================================
// Validation Hooks
// =============================================================================

/**
 * Hook for validating a workflow definition
 */
export function useValidateWorkflowDefinition() {
  return useMutation({
    mutationFn: (data: ValidateWorkflowDefinitionInput) => validateWorkflowDefinitionFn({ data }),
  });
}

// =============================================================================
// Query Invalidation Hook
// =============================================================================

/**
 * Hook for invalidating workflow queries
 */
export function useInvalidateWorkflowQueries() {
  const queryClient = useQueryClient();

  return {
    /**
     * Invalidate all workflow queries
     */
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-definitions"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-instances"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-statistics"] });
    },

    /**
     * Invalidate workflow definition queries
     */
    invalidateDefinitions: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-definitions"] });
    },

    /**
     * Invalidate a specific workflow definition
     */
    invalidateDefinition: (id: string) => {
      queryClient.invalidateQueries({
        queryKey: ["workflow-definitions", "detail", id],
      });
      queryClient.invalidateQueries({
        queryKey: ["workflow-definitions", "stats", id],
      });
    },

    /**
     * Invalidate workflow instance queries
     */
    invalidateInstances: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-instances"] });
    },

    /**
     * Invalidate a specific workflow instance
     */
    invalidateInstance: (id: string) => {
      queryClient.invalidateQueries({
        queryKey: ["workflow-instances", "detail", id],
      });
      queryClient.invalidateQueries({
        queryKey: ["workflow-instances", "steps", id],
      });
      queryClient.invalidateQueries({
        queryKey: ["workflow-instances", "logs", id],
      });
    },

    /**
     * Invalidate approval queries
     */
    invalidateApprovals: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-approvals"] });
    },

    /**
     * Invalidate statistics
     */
    invalidateStatistics: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-statistics"] });
    },
  };
}

// =============================================================================
// Combined Dashboard Hook
// =============================================================================

/**
 * Hook for fetching all data needed for the workflow dashboard
 */
export function useWorkflowDashboard(enabled: boolean = true) {
  const statistics = useWorkflowStatistics(enabled);
  const activeDefinitions = useWorkflowDefinitions(
    { status: "active", limit: 10 },
    enabled
  );
  const recentInstances = useWorkflowInstances({ limit: 10 }, enabled);
  const pendingApprovals = usePendingApprovals({ limit: 5 }, enabled);

  return {
    statistics,
    activeDefinitions,
    recentInstances,
    pendingApprovals,
    isLoading:
      statistics.isLoading ||
      activeDefinitions.isLoading ||
      recentInstances.isLoading ||
      pendingApprovals.isLoading,
    isError:
      statistics.isError ||
      activeDefinitions.isError ||
      recentInstances.isError ||
      pendingApprovals.isError,
    error:
      statistics.error ||
      activeDefinitions.error ||
      recentInstances.error ||
      pendingApprovals.error,
  };
}

// =============================================================================
// Instance Detail Hook
// =============================================================================

/**
 * Hook for fetching all data related to a workflow instance
 */
export function useWorkflowInstanceDetail(instanceId: string, enabled: boolean = true) {
  const instance = useWorkflowInstance(instanceId, enabled && !!instanceId);
  const steps = useStepExecutions(instanceId, enabled && !!instanceId);
  const logs = useEventLogs(instanceId, { limit: 100 }, enabled && !!instanceId);

  return {
    instance,
    steps,
    logs,
    isLoading: instance.isLoading || steps.isLoading || logs.isLoading,
    isError: instance.isError || steps.isError || logs.isError,
    error: instance.error || steps.error || logs.error,
    refetch: () => {
      instance.refetch();
      steps.refetch();
      logs.refetch();
    },
  };
}
