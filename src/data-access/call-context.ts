/**
 * Call Context Data Access Layer
 * Fetches customer context during incoming/outgoing calls including:
 * - Account status
 * - Recent interactions
 * - Open tickets
 * - Suggested talking points
 */

import { eq, desc, and, gte, or, ilike, sql } from "drizzle-orm";
import { database } from "~/db";
import {
  callRecord,
  user,
  notification,
  aiConversation,
  aiMessage,
  expenseRequest,
  type User,
  type CallRecord,
  type Notification,
  type AIConversation,
  type ExpenseRequest,
} from "~/db/schema";

// ============================================================================
// Types
// ============================================================================

export type AccountStatus = "active" | "inactive" | "pending" | "suspended";

export interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  image: string | null;
  plan: string;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: Date | null;
  accountStatus: AccountStatus;
  createdAt: Date;
}

export interface RecentInteraction {
  id: string;
  type: "call" | "notification" | "ai_conversation" | "expense_request";
  title: string;
  summary: string | null;
  timestamp: Date;
  metadata?: Record<string, {}>;
}

export interface OpenTicket {
  id: string;
  type: "expense_request" | "notification";
  title: string;
  status: string;
  priority?: "low" | "medium" | "high" | "urgent";
  createdAt: Date;
  updatedAt?: Date;
}

export interface SuggestedTalkingPoint {
  id: string;
  category: "account" | "billing" | "support" | "follow_up" | "general";
  point: string;
  priority: number;
  context?: string;
}

export interface CallContext {
  customer: CustomerInfo | null;
  recentInteractions: RecentInteraction[];
  openTickets: OpenTicket[];
  suggestedTalkingPoints: SuggestedTalkingPoint[];
  callHistory: {
    totalCalls: number;
    recentCalls: CallRecord[];
    lastCallDate: Date | null;
  };
  fetchedAt: Date;
}

export interface CallContextFilters {
  interactionsLimit?: number;
  ticketsLimit?: number;
  callHistoryLimit?: number;
  includeResolvedTickets?: boolean;
  daysBack?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine account status based on user data
 */
function determineAccountStatus(userData: User): AccountStatus {
  if (!userData.emailVerified) {
    return "pending";
  }

  const subscriptionStatus = userData.subscriptionStatus;
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return "active";
  }

  if (subscriptionStatus === "past_due" || subscriptionStatus === "unpaid") {
    return "suspended";
  }

  if (userData.plan === "free") {
    return "active";
  }

  return "inactive";
}

/**
 * Generate talking points based on customer context
 */
function generateTalkingPoints(
  customer: CustomerInfo | null,
  recentInteractions: RecentInteraction[],
  openTickets: OpenTicket[],
  callHistory: CallRecord[]
): SuggestedTalkingPoint[] {
  const points: SuggestedTalkingPoint[] = [];
  let priorityCounter = 1;

  // Account status related points
  if (customer) {
    if (customer.accountStatus === "pending") {
      points.push({
        id: crypto.randomUUID(),
        category: "account",
        point: "Verify email address to complete account setup",
        priority: priorityCounter++,
        context: "Customer has not verified their email yet",
      });
    }

    if (customer.accountStatus === "suspended") {
      points.push({
        id: crypto.randomUUID(),
        category: "billing",
        point: "Address outstanding payment issue to restore full access",
        priority: priorityCounter++,
        context: `Subscription status: ${customer.subscriptionStatus}`,
      });
    }

    if (customer.subscriptionExpiresAt) {
      const daysUntilExpiry = Math.ceil(
        (customer.subscriptionExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry > 0 && daysUntilExpiry <= 30) {
        points.push({
          id: crypto.randomUUID(),
          category: "billing",
          point: `Subscription expires in ${daysUntilExpiry} days - discuss renewal options`,
          priority: priorityCounter++,
          context: `Expiry date: ${customer.subscriptionExpiresAt.toLocaleDateString()}`,
        });
      }
    }

    if (customer.plan === "free") {
      points.push({
        id: crypto.randomUUID(),
        category: "account",
        point: "Opportunity to discuss premium plan benefits",
        priority: priorityCounter++,
        context: "Customer is on free plan",
      });
    }
  }

  // Open tickets related points
  if (openTickets.length > 0) {
    const highPriorityTickets = openTickets.filter(
      (t) => t.priority === "high" || t.priority === "urgent"
    );

    if (highPriorityTickets.length > 0) {
      points.push({
        id: crypto.randomUUID(),
        category: "support",
        point: `Address ${highPriorityTickets.length} high-priority open issue(s)`,
        priority: priorityCounter++,
        context: highPriorityTickets.map((t) => t.title).join(", "),
      });
    }

    if (openTickets.length > highPriorityTickets.length) {
      points.push({
        id: crypto.randomUUID(),
        category: "support",
        point: `Review ${openTickets.length - highPriorityTickets.length} other pending request(s)`,
        priority: priorityCounter++,
      });
    }
  }

  // Recent interactions follow-up
  const recentCallInteractions = recentInteractions.filter((i) => i.type === "call");
  if (recentCallInteractions.length > 0) {
    const lastCall = recentCallInteractions[0];
    const daysSinceLastCall = Math.ceil(
      (Date.now() - lastCall.timestamp.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastCall <= 7 && lastCall.summary) {
      points.push({
        id: crypto.randomUUID(),
        category: "follow_up",
        point: "Follow up on previous conversation",
        priority: priorityCounter++,
        context: `Last call ${daysSinceLastCall} day(s) ago: ${lastCall.summary.substring(0, 100)}...`,
      });
    }
  }

  // First-time caller
  if (callHistory.length === 0) {
    points.push({
      id: crypto.randomUUID(),
      category: "general",
      point: "First-time caller - provide warm welcome and overview",
      priority: priorityCounter++,
    });
  }

  // Frequent caller
  if (callHistory.length >= 5) {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const recentCallCount = callHistory.filter(
      (c) => c.callTimestamp >= lastMonth
    ).length;

    if (recentCallCount >= 3) {
      points.push({
        id: crypto.randomUUID(),
        category: "support",
        point: "Frequent caller - consider proactive issue resolution",
        priority: priorityCounter++,
        context: `${recentCallCount} calls in the last month`,
      });
    }
  }

  return points.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// Data Access Functions
// ============================================================================

/**
 * Find customer by phone number or identifier
 */
export async function findCustomerByPhone(
  phoneOrId: string
): Promise<CustomerInfo | null> {
  // Try to find by exact user ID first
  const [byId] = await database
    .select()
    .from(user)
    .where(eq(user.id, phoneOrId))
    .limit(1);

  if (byId) {
    return {
      id: byId.id,
      name: byId.name,
      email: byId.email,
      image: byId.image,
      plan: byId.plan,
      subscriptionStatus: byId.subscriptionStatus,
      subscriptionExpiresAt: byId.subscriptionExpiresAt,
      accountStatus: determineAccountStatus(byId),
      createdAt: byId.createdAt,
    };
  }

  // Try to find in call records by caller ID (phone number)
  const [callWithUser] = await database
    .select({
      user: user,
    })
    .from(callRecord)
    .innerJoin(user, eq(callRecord.userId, user.id))
    .where(
      or(eq(callRecord.callerId, phoneOrId), eq(callRecord.recipientId, phoneOrId))
    )
    .orderBy(desc(callRecord.callTimestamp))
    .limit(1);

  if (callWithUser?.user) {
    const userData = callWithUser.user;
    return {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      image: userData.image,
      plan: userData.plan,
      subscriptionStatus: userData.subscriptionStatus,
      subscriptionExpiresAt: userData.subscriptionExpiresAt,
      accountStatus: determineAccountStatus(userData),
      createdAt: userData.createdAt,
    };
  }

  return null;
}

/**
 * Get recent interactions for a customer
 */
export async function getRecentInteractions(
  userId: string,
  options: { limit?: number; daysBack?: number } = {}
): Promise<RecentInteraction[]> {
  const { limit = 10, daysBack = 30 } = options;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const interactions: RecentInteraction[] = [];

  // Get recent calls
  const recentCalls = await database
    .select()
    .from(callRecord)
    .where(
      and(eq(callRecord.userId, userId), gte(callRecord.callTimestamp, cutoffDate))
    )
    .orderBy(desc(callRecord.callTimestamp))
    .limit(limit);

  for (const call of recentCalls) {
    interactions.push({
      id: call.id,
      type: "call",
      title: `${call.direction === "inbound" ? "Incoming" : "Outgoing"} call - ${call.callerName || call.callerId}`,
      summary: call.summary,
      timestamp: call.callTimestamp,
      metadata: {
        direction: call.direction,
        duration: call.duration,
        status: call.status,
      },
    });
  }

  // Get recent notifications
  const recentNotifications = await database
    .select()
    .from(notification)
    .where(
      and(eq(notification.userId, userId), gte(notification.createdAt, cutoffDate))
    )
    .orderBy(desc(notification.createdAt))
    .limit(limit);

  for (const notif of recentNotifications) {
    interactions.push({
      id: notif.id,
      type: "notification",
      title: notif.title,
      summary: notif.content,
      timestamp: notif.createdAt,
      metadata: {
        notificationType: notif.type,
        isRead: notif.isRead,
      },
    });
  }

  // Get recent AI conversations
  const recentConversations = await database
    .select()
    .from(aiConversation)
    .where(
      and(
        eq(aiConversation.userId, userId),
        gte(aiConversation.createdAt, cutoffDate),
        eq(aiConversation.status, "active")
      )
    )
    .orderBy(desc(aiConversation.lastMessageAt))
    .limit(limit);

  for (const conv of recentConversations) {
    interactions.push({
      id: conv.id,
      type: "ai_conversation",
      title: conv.title || "AI Conversation",
      summary: conv.summary,
      timestamp: conv.lastMessageAt || conv.createdAt,
      metadata: {
        messageCount: conv.totalInputTokens + conv.totalOutputTokens > 0 ? "has messages" : "empty",
      },
    });
  }

  // Get recent expense requests
  const recentExpenses = await database
    .select()
    .from(expenseRequest)
    .where(
      and(
        eq(expenseRequest.requesterId, userId),
        gte(expenseRequest.createdAt, cutoffDate)
      )
    )
    .orderBy(desc(expenseRequest.createdAt))
    .limit(limit);

  for (const expense of recentExpenses) {
    interactions.push({
      id: expense.id,
      type: "expense_request",
      title: expense.purpose,
      summary: expense.description,
      timestamp: expense.createdAt,
      metadata: {
        amount: expense.amount,
        currency: expense.currency,
        status: expense.status,
      },
    });
  }

  // Sort by timestamp and limit
  return interactions
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

/**
 * Get open tickets for a customer
 */
export async function getOpenTickets(
  userId: string,
  options: { limit?: number; includeResolved?: boolean } = {}
): Promise<OpenTicket[]> {
  const { limit = 20, includeResolved = false } = options;
  const tickets: OpenTicket[] = [];

  // Get pending expense requests as tickets
  const expenseConditions = [eq(expenseRequest.requesterId, userId)];
  if (!includeResolved) {
    expenseConditions.push(eq(expenseRequest.status, "pending"));
  }

  const pendingExpenses = await database
    .select()
    .from(expenseRequest)
    .where(and(...expenseConditions))
    .orderBy(desc(expenseRequest.createdAt))
    .limit(limit);

  for (const expense of pendingExpenses) {
    tickets.push({
      id: expense.id,
      type: "expense_request",
      title: `Expense Request: ${expense.purpose}`,
      status: expense.status,
      priority: parseFloat(expense.amount) > 1000 ? "high" : "medium",
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    });
  }

  // Get unread notifications as tickets
  const unreadNotifications = await database
    .select()
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.isRead, false)))
    .orderBy(desc(notification.createdAt))
    .limit(limit);

  for (const notif of unreadNotifications) {
    tickets.push({
      id: notif.id,
      type: "notification",
      title: notif.title,
      status: "unread",
      priority: notif.type === "system" ? "high" : "low",
      createdAt: notif.createdAt,
    });
  }

  return tickets.slice(0, limit);
}

/**
 * Get call history for a customer
 */
export async function getCallHistory(
  userId: string,
  options: { limit?: number } = {}
): Promise<{
  totalCalls: number;
  recentCalls: CallRecord[];
  lastCallDate: Date | null;
}> {
  const { limit = 10 } = options;

  // Get total count
  const [countResult] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(callRecord)
    .where(eq(callRecord.userId, userId));

  const totalCalls = countResult?.count || 0;

  // Get recent calls
  const recentCalls = await database
    .select()
    .from(callRecord)
    .where(eq(callRecord.userId, userId))
    .orderBy(desc(callRecord.callTimestamp))
    .limit(limit);

  const lastCallDate = recentCalls.length > 0 ? recentCalls[0].callTimestamp : null;

  return {
    totalCalls,
    recentCalls,
    lastCallDate,
  };
}

/**
 * Get full call context for a customer
 * Main function that aggregates all context data
 */
export async function getCallContext(
  phoneOrUserId: string,
  filters: CallContextFilters = {}
): Promise<CallContext> {
  const {
    interactionsLimit = 15,
    ticketsLimit = 10,
    callHistoryLimit = 10,
    includeResolvedTickets = false,
    daysBack = 30,
  } = filters;

  // Find customer
  const customer = await findCustomerByPhone(phoneOrUserId);

  // If no customer found, return empty context
  if (!customer) {
    return {
      customer: null,
      recentInteractions: [],
      openTickets: [],
      suggestedTalkingPoints: [
        {
          id: crypto.randomUUID(),
          category: "general",
          point: "New caller - collect customer information",
          priority: 1,
        },
      ],
      callHistory: {
        totalCalls: 0,
        recentCalls: [],
        lastCallDate: null,
      },
      fetchedAt: new Date(),
    };
  }

  // Fetch all context data in parallel
  const [recentInteractions, openTickets, callHistory] = await Promise.all([
    getRecentInteractions(customer.id, { limit: interactionsLimit, daysBack }),
    getOpenTickets(customer.id, {
      limit: ticketsLimit,
      includeResolved: includeResolvedTickets,
    }),
    getCallHistory(customer.id, { limit: callHistoryLimit }),
  ]);

  // Generate talking points based on context
  const suggestedTalkingPoints = generateTalkingPoints(
    customer,
    recentInteractions,
    openTickets,
    callHistory.recentCalls
  );

  return {
    customer,
    recentInteractions,
    openTickets,
    suggestedTalkingPoints,
    callHistory,
    fetchedAt: new Date(),
  };
}

/**
 * Search for customers by name, email, or phone
 */
export async function searchCustomers(
  query: string,
  limit: number = 10
): Promise<CustomerInfo[]> {
  const searchTerm = `%${query.trim()}%`;

  const results = await database
    .select()
    .from(user)
    .where(
      or(
        ilike(user.name, searchTerm),
        ilike(user.email, searchTerm)
      )
    )
    .limit(limit);

  return results.map((userData) => ({
    id: userData.id,
    name: userData.name,
    email: userData.email,
    image: userData.image,
    plan: userData.plan,
    subscriptionStatus: userData.subscriptionStatus,
    subscriptionExpiresAt: userData.subscriptionExpiresAt,
    accountStatus: determineAccountStatus(userData),
    createdAt: userData.createdAt,
  }));
}
