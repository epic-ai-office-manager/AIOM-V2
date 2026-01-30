/**
 * Demo Environment Service
 *
 * Core service for managing demo sessions, authentication, and synthetic data.
 */

import { database } from "~/db";
import { demoSession, demoActivityLog, type DemoSession } from "~/db/schema";
import { eq, and, gt, lt, desc, sql } from "drizzle-orm";
import { DEMO_CREDENTIALS, DEMO_CONFIG } from "~/config/demoEnv";
import type {
  DemoSessionContext,
  DemoLoginCredentials,
  DemoLoginResult,
  DemoSessionValidation,
  DemoActivity,
} from "./types";

// =============================================================================
// Session Management
// =============================================================================

/**
 * Generate a secure random token for demo sessions
 */
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Authenticate a demo user and create a session
 */
export async function authenticateDemoUser(
  credentials: DemoLoginCredentials,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<DemoLoginResult> {
  // Find matching demo credentials
  const demoUser = Object.values(DEMO_CREDENTIALS).find(
    (cred) => cred.email === credentials.email && cred.password === credentials.password
  );

  if (!demoUser) {
    return {
      success: false,
      error: "Invalid demo credentials",
    };
  }

  // Generate session token and expiration
  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEMO_CONFIG.sessionDurationMs);

  // Create demo session in database
  const sessionId = crypto.randomUUID();

  try {
    await database.insert(demoSession).values({
      id: sessionId,
      demoUserEmail: demoUser.email,
      demoUserName: demoUser.name,
      demoUserRole: demoUser.role,
      token,
      expiresAt,
      createdAt: now,
      lastAccessedAt: now,
      ipAddress: metadata?.ipAddress || null,
      userAgent: metadata?.userAgent || null,
      actionsCount: 0,
    });

    const session: DemoSessionContext = {
      sessionId,
      email: demoUser.email,
      name: demoUser.name,
      role: demoUser.role,
      expiresAt,
      createdAt: now,
    };

    return {
      success: true,
      session,
      token,
    };
  } catch (error) {
    console.error("[DemoService] Failed to create session:", error);
    return {
      success: false,
      error: "Failed to create demo session",
    };
  }
}

/**
 * Validate a demo session token
 */
export async function validateDemoSession(token: string): Promise<DemoSessionValidation> {
  if (!token) {
    return { isValid: false, error: "No token provided" };
  }

  try {
    const [session] = await database
      .select()
      .from(demoSession)
      .where(and(eq(demoSession.token, token), gt(demoSession.expiresAt, new Date())))
      .limit(1);

    if (!session) {
      return { isValid: false, error: "Session not found or expired" };
    }

    // Update last accessed time
    await database
      .update(demoSession)
      .set({ lastAccessedAt: new Date() })
      .where(eq(demoSession.id, session.id));

    return {
      isValid: true,
      session: {
        sessionId: session.id,
        email: session.demoUserEmail,
        name: session.demoUserName,
        role: session.demoUserRole as DemoSessionContext["role"],
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      },
    };
  } catch (error) {
    console.error("[DemoService] Failed to validate session:", error);
    return { isValid: false, error: "Session validation failed" };
  }
}

/**
 * Get demo session by ID
 */
export async function getDemoSessionById(sessionId: string): Promise<DemoSession | null> {
  try {
    const [session] = await database
      .select()
      .from(demoSession)
      .where(eq(demoSession.id, sessionId))
      .limit(1);

    return session || null;
  } catch (error) {
    console.error("[DemoService] Failed to get session:", error);
    return null;
  }
}

/**
 * End a demo session (logout)
 */
export async function endDemoSession(token: string): Promise<boolean> {
  try {
    const result = await database
      .delete(demoSession)
      .where(eq(demoSession.token, token));

    return true;
  } catch (error) {
    console.error("[DemoService] Failed to end session:", error);
    return false;
  }
}

/**
 * Clean up expired demo sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await database
      .delete(demoSession)
      .where(lt(demoSession.expiresAt, new Date()));

    return 0; // Drizzle doesn't return count easily, but cleanup was attempted
  } catch (error) {
    console.error("[DemoService] Failed to cleanup sessions:", error);
    return 0;
  }
}

// =============================================================================
// Activity Tracking
// =============================================================================

/**
 * Log a demo user activity
 */
export async function logDemoActivity(
  sessionId: string,
  activity: Omit<DemoActivity, "timestamp">
): Promise<void> {
  try {
    await database.insert(demoActivityLog).values({
      id: crypto.randomUUID(),
      sessionId,
      action: activity.action,
      resourceType: activity.resourceType || null,
      resourceId: activity.resourceId || null,
      metadata: activity.metadata || null,
      createdAt: new Date(),
    });

    // Increment actions count
    await database
      .update(demoSession)
      .set({
        actionsCount: sql`actions_count + 1`,
        lastAccessedAt: new Date(),
      })
      .where(eq(demoSession.id, sessionId));
  } catch (error) {
    console.error("[DemoService] Failed to log activity:", error);
  }
}

/**
 * Get recent activities for a demo session
 */
export async function getDemoActivities(
  sessionId: string,
  limit = 50
): Promise<DemoActivity[]> {
  try {
    const activities = await database
      .select()
      .from(demoActivityLog)
      .where(eq(demoActivityLog.sessionId, sessionId))
      .orderBy(desc(demoActivityLog.createdAt))
      .limit(limit);

    return activities.map((a) => ({
      action: a.action,
      resourceType: a.resourceType || undefined,
      resourceId: a.resourceId || undefined,
      metadata: (a.metadata as Record<string, {}>) || undefined,
      timestamp: a.createdAt,
    }));
  } catch (error) {
    console.error("[DemoService] Failed to get activities:", error);
    return [];
  }
}

// =============================================================================
// Demo Environment Helpers
// =============================================================================

/**
 * Get all available demo roles with descriptions
 */
export function getAvailableDemoRoles() {
  return Object.entries(DEMO_CREDENTIALS).map(([key, value]) => ({
    key,
    email: value.email,
    name: value.name,
    role: value.role,
    description: value.description,
  }));
}

/**
 * Check if an email is a demo account
 */
export function isDemoAccount(email: string): boolean {
  return Object.values(DEMO_CREDENTIALS).some((cred) => cred.email === email);
}

/**
 * Get demo feature restrictions
 */
export function getDemoRestrictions() {
  return {
    canCreateRealPayments: DEMO_CONFIG.features.payments,
    canSendRealEmails: DEMO_CONFIG.features.emails,
    canAccessProduction: false,
    canExportData: false,
    maxDataLimit: Math.max(
      DEMO_CONFIG.limits.maxExpenseRequests,
      DEMO_CONFIG.limits.maxTransactions,
      DEMO_CONFIG.limits.maxWorkOrders,
      DEMO_CONFIG.limits.maxCustomers
    ),
  };
}
