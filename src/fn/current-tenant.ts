/**
 * Current Tenant Resolution
 *
 * Server function to get the authenticated user's default tenant ID.
 * Used by frontend components that need tenant context for API calls.
 */

import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { auth } from "~/utils/auth";
import { getUserDefaultTenant } from "~/data-access/tenants";

/**
 * Response type for getCurrentTenantId
 */
export type CurrentTenantResponse = {
  tenantId: string | null;
  tenantName?: string;
  error: string | null;
};

/**
 * Get Current Tenant ID
 *
 * Returns the authenticated user's default tenant ID.
 * Returns null if user is not authenticated or has no default tenant.
 *
 * This is the canonical way for frontend components to resolve tenant ID
 * for making tenant-scoped API calls.
 */
export const getCurrentTenantId = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentTenantResponse> => {
    try {
      // Get authenticated session
      const sessionToken = getCookie("better-auth.session_token");

      if (!sessionToken) {
        return { tenantId: null, error: "Not authenticated" };
      }

      const session = await auth.api.getSession({
        headers: new Headers({
          cookie: `better-auth.session_token=${sessionToken}`,
        }),
      });

      if (!session?.user?.id) {
        return { tenantId: null, error: "Not authenticated" };
      }

      const userId = session.user.id;

      // Get user's default tenant
      const defaultTenant = await getUserDefaultTenant(userId);

      if (!defaultTenant) {
        return { tenantId: null, error: "No default tenant" };
      }

      // Return tenant info
      return {
        tenantId: defaultTenant.tenantId,
        tenantName: defaultTenant.tenant.name,
        error: null,
      };
    } catch (error) {
      console.error("[getCurrentTenantId] Error:", error);
      return {
        tenantId: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);
