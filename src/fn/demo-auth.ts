/**
 * Demo Authentication Server Functions
 *
 * Server functions for demo environment authentication and session management.
 * Uses token-based authentication - the token is stored on the client (localStorage)
 * and passed with each request.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import {
  authenticateDemoUser,
  validateDemoSession,
  endDemoSession,
  logDemoActivity,
  getDemoActivities,
  getAvailableDemoRoles,
  getDemoRestrictions,
  generateDemoDataSet,
  generateDashboardStats,
} from "~/lib/demo-environment";

// =============================================================================
// Demo Login/Logout Functions
// =============================================================================

/**
 * Login to demo environment
 * Returns a token that the client should store and send with subsequent requests
 */
export const demoLoginFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    })
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const userAgent = request?.headers?.get("user-agent") || undefined;
    const forwardedFor = request?.headers?.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || undefined;

    const result = await authenticateDemoUser(
      { email: data.email, password: data.password },
      { ipAddress, userAgent }
    );

    return {
      success: result.success,
      session: result.session,
      token: result.token, // Client stores this
      error: result.error,
    };
  });

/**
 * Logout from demo environment
 */
export const demoLogoutFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string(),
    })
  )
  .handler(async ({ data }) => {
    try {
      await endDemoSession(data.token);
      return { success: true };
    } catch (error) {
      console.error("[DemoAuth] Logout failed:", error);
      return { success: false, error: "Logout failed" };
    }
  });

/**
 * Validate demo session and get session info
 */
export const validateDemoSessionFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const validation = await validateDemoSession(data.token);

    if (!validation.isValid || !validation.session) {
      return { authenticated: false, session: null };
    }

    return {
      authenticated: true,
      session: {
        sessionId: validation.session.sessionId,
        email: validation.session.email,
        name: validation.session.name,
        role: validation.session.role,
        expiresAt: validation.session.expiresAt.toISOString(),
      },
    };
  });

/**
 * Get current demo session (for backward compatibility)
 * Note: Without cookies, this will always return unauthenticated
 * Use validateDemoSessionFn with a token instead
 */
export const getDemoSessionFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return { authenticated: false, session: null };
  }
);

/**
 * Get available demo roles for login
 */
export const getDemoRolesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const roles = getAvailableDemoRoles();
    return { roles };
  }
);

// =============================================================================
// Demo Data Functions (require token in request)
// =============================================================================

/**
 * Get demo dashboard data
 */
export const getDemoDashboardDataFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const validation = await validateDemoSession(data.token);
    if (!validation.isValid || !validation.session) {
      throw new Error("Invalid demo session");
    }

    const demoSession = validation.session;

    await logDemoActivity(demoSession.sessionId, {
      action: "view_dashboard",
      resourceType: "dashboard",
    });

    const stats = generateDashboardStats();
    const restrictions = getDemoRestrictions();

    return {
      session: {
        name: demoSession.name,
        email: demoSession.email,
        role: demoSession.role,
      },
      stats,
      restrictions,
    };
  });

/**
 * Get demo expenses data
 */
export const getDemoExpensesFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const validation = await validateDemoSession(data.token);
    if (!validation.isValid || !validation.session) {
      throw new Error("Invalid demo session");
    }

    await logDemoActivity(validation.session.sessionId, {
      action: "view_expenses",
      resourceType: "expense",
    });

    const demoData = generateDemoDataSet({ expenseCount: 20 });
    return { expenses: demoData.expenses };
  });

/**
 * Get demo work orders data
 */
export const getDemoWorkOrdersFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const validation = await validateDemoSession(data.token);
    if (!validation.isValid || !validation.session) {
      throw new Error("Invalid demo session");
    }

    await logDemoActivity(validation.session.sessionId, {
      action: "view_work_orders",
      resourceType: "work_order",
    });

    const demoData = generateDemoDataSet({ workOrderCount: 15 });
    return { workOrders: demoData.workOrders };
  });

/**
 * Get demo customers data
 */
export const getDemoCustomersFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const validation = await validateDemoSession(data.token);
    if (!validation.isValid || !validation.session) {
      throw new Error("Invalid demo session");
    }

    await logDemoActivity(validation.session.sessionId, {
      action: "view_customers",
      resourceType: "customer",
    });

    const demoData = generateDemoDataSet({ customerCount: 15 });
    return { customers: demoData.customers };
  });

/**
 * Get demo transactions data
 */
export const getDemoTransactionsFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const validation = await validateDemoSession(data.token);
    if (!validation.isValid || !validation.session) {
      throw new Error("Invalid demo session");
    }

    await logDemoActivity(validation.session.sessionId, {
      action: "view_transactions",
      resourceType: "transaction",
    });

    const demoData = generateDemoDataSet({ transactionCount: 30 });
    return { transactions: demoData.transactions };
  });

/**
 * Log demo activity
 */
export const logDemoActivityFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string(),
      action: z.string(),
      resourceType: z.string().optional(),
      resourceId: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
  )
  .handler(async ({ data }) => {
    const validation = await validateDemoSession(data.token);
    if (!validation.isValid || !validation.session) {
      throw new Error("Invalid demo session");
    }

    await logDemoActivity(validation.session.sessionId, {
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      metadata: data.metadata as Record<string, {}> | undefined,
    });

    return { success: true };
  });

/**
 * Get demo activity history
 */
export const getDemoActivityHistoryFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string(),
    })
  )
  .handler(async (ctx) => {
    const { data } = ctx;
    const validation = await validateDemoSession(data.token);
    if (!validation.isValid || !validation.session) {
      throw new Error("Invalid demo session");
    }

    const activities = await getDemoActivities(
      validation.session.sessionId,
      50
    );
    return { activities };
  });
