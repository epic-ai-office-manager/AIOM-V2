/**
 * Legacy Modules Feature - Stub Hooks
 *
 * This module contains minimal stub hooks for the legacy "modules" feature
 * that has been removed from the codebase. These stubs exist solely
 * to allow UI components to compile.
 *
 * WARNING: These are non-functional stubs. Do not use in production.
 */

import { useMutation } from "@tanstack/react-query";

/**
 * Stub hook for creating module content
 * @returns A mutation hook that does nothing
 */
export function useCreateModuleContent() {
  return useMutation({
    mutationFn: async (data: any) => {
      console.warn("[useCreateModuleContent] Legacy feature - no-op stub called", data);
      throw new Error("Module content creation is not supported (legacy feature removed)");
    },
    onError: (error) => {
      console.error("[useCreateModuleContent] Stub error:", error);
    },
  });
}

/**
 * Stub hook for deleting module content
 * @param moduleId - Module ID (unused in stub)
 * @returns A mutation hook that does nothing
 */
export function useDeleteModuleContent(moduleId?: string) {
  return useMutation({
    mutationFn: async (contentId: string) => {
      console.warn("[useDeleteModuleContent] Legacy feature - no-op stub called", { moduleId, contentId });
      throw new Error("Module content deletion is not supported (legacy feature removed)");
    },
    onError: (error) => {
      console.error("[useDeleteModuleContent] Stub error:", error);
    },
  });
}
