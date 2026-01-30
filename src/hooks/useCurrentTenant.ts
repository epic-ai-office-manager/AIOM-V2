/**
 * useCurrentTenant Hook
 *
 * React hook to get the authenticated user's default tenant ID.
 * Used by components that need tenant context for API calls.
 */

import { useQuery } from "@tanstack/react-query";
import { getCurrentTenantId, type CurrentTenantResponse } from "~/fn/current-tenant";

/**
 * Hook to get current user's default tenant
 *
 * Returns:
 * - tenantId: The user's default tenant ID (null if not available)
 * - tenantName: The tenant's display name
 * - isLoading: Whether tenant data is being fetched
 * - error: Error message if tenant resolution failed
 *
 * Usage:
 * ```tsx
 * const { tenantId, isLoading } = useCurrentTenant();
 *
 * if (isLoading) return <Loading />;
 * if (!tenantId) return <SelectTenant />;
 *
 * // Use tenantId for API calls
 * fetch('/api/data', {
 *   headers: { 'x-tenant-id': tenantId }
 * });
 * ```
 */
export function useCurrentTenant() {
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ["current-tenant"],
    queryFn: async () => {
      const result = await getCurrentTenantId();
      return result as CurrentTenantResponse;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - tenant doesn't change frequently
    retry: 1, // Only retry once on failure
  });

  return {
    tenantId: data?.tenantId ?? null,
    tenantName: data?.tenantName ?? null,
    isLoading,
    error: data?.error ?? (queryError ? String(queryError) : null),
  };
}

/**
 * Return type for useCurrentTenant hook
 */
export type UseCurrentTenantReturn = {
  tenantId: string | null;
  tenantName: string | null;
  isLoading: boolean;
  error: string | null;
};
