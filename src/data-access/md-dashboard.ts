import { eq, sql, count, gte, sum, desc, and, between } from "drizzle-orm";
import { database } from "~/db";
import { user, expenseRequest } from "~/db/schema";
import type { MDDashboardData } from "~/fn/md";

/**
 * Get MD dashboard statistics
 * Aggregates executive-level data for the MD dashboard
 */
export async function getMDDashboardStats(): Promise<MDDashboardData> {
  // Get financial overview
  const financialOverview = await getFinancialOverview();

  // Get pending approvals requiring MD attention
  const pendingApprovals = await getPendingApprovals();

  // Get team capacity and utilization
  const teamCapacity = await getTeamCapacity();

  // Get key metrics and KPIs
  const keyMetrics = await getKeyMetrics();

  // Get executive briefing items
  const executiveBriefing = await getExecutiveBriefing();

  return {
    financialOverview,
    pendingApprovals,
    teamCapacity,
    keyMetrics,
    executiveBriefing,
  };
}

/**
 * Get financial overview for the MD dashboard
 */
async function getFinancialOverview() {
  // Calculate date ranges
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Get current month expenses (approved)
  const [currentMonthExpenses] = await database
    .select({ total: sum(expenseRequest.amount) })
    .from(expenseRequest)
    .where(
      and(
        eq(expenseRequest.status, "approved"),
        gte(expenseRequest.createdAt, startOfMonth)
      )
    );

  // Get last month expenses (approved)
  const [lastMonthExpenses] = await database
    .select({ total: sum(expenseRequest.amount) })
    .from(expenseRequest)
    .where(
      and(
        eq(expenseRequest.status, "approved"),
        between(expenseRequest.createdAt, startOfLastMonth, endOfLastMonth)
      )
    );

  // Get YTD expenses (approved)
  const [ytdExpenses] = await database
    .select({ total: sum(expenseRequest.amount) })
    .from(expenseRequest)
    .where(
      and(
        eq(expenseRequest.status, "approved"),
        gte(expenseRequest.createdAt, startOfYear)
      )
    );

  // Get pending expense value
  const [pendingExpenseValue] = await database
    .select({ total: sum(expenseRequest.amount) })
    .from(expenseRequest)
    .where(eq(expenseRequest.status, "pending"));

  const currentMonth = Number(currentMonthExpenses?.total) || 0;
  const lastMonth = Number(lastMonthExpenses?.total) || 0;
  const monthOverMonthChange = lastMonth > 0
    ? Math.round(((currentMonth - lastMonth) / lastMonth) * 100)
    : 0;

  // Simulated revenue data (would come from actual revenue tables)
  const simulatedRevenue = {
    currentMonth: Math.round(Math.random() * 500000 + 800000),
    lastMonth: Math.round(Math.random() * 500000 + 750000),
    ytd: Math.round(Math.random() * 5000000 + 8000000),
  };

  const revenueMonthOverMonth = simulatedRevenue.lastMonth > 0
    ? Math.round(((simulatedRevenue.currentMonth - simulatedRevenue.lastMonth) / simulatedRevenue.lastMonth) * 100)
    : 0;

  return {
    revenue: {
      currentMonth: simulatedRevenue.currentMonth,
      lastMonth: simulatedRevenue.lastMonth,
      ytd: simulatedRevenue.ytd,
      monthOverMonthChange: revenueMonthOverMonth,
    },
    expenses: {
      currentMonth,
      lastMonth,
      ytd: Number(ytdExpenses?.total) || 0,
      monthOverMonthChange,
      pendingValue: Number(pendingExpenseValue?.total) || 0,
    },
    profitMargin: {
      currentMonth: Math.round(((simulatedRevenue.currentMonth - currentMonth) / simulatedRevenue.currentMonth) * 100),
      ytd: Math.round(((simulatedRevenue.ytd - (Number(ytdExpenses?.total) || 0)) / simulatedRevenue.ytd) * 100),
      target: 25,
    },
    cashFlow: {
      status: "positive" as const,
      runway: "18 months",
      trend: "stable" as const,
    },
  };
}

/**
 * Get pending approvals requiring MD attention
 */
async function getPendingApprovals() {
  // Get expense requests pending MD approval
  const pendingExpenses = await database
    .select({
      id: expenseRequest.id,
      purpose: expenseRequest.purpose,
      amount: expenseRequest.amount,
      createdAt: expenseRequest.createdAt,
      priority: sql<string>`
        CASE
          WHEN CAST(${expenseRequest.amount} AS NUMERIC) >= 10000 THEN 'urgent'
          WHEN CAST(${expenseRequest.amount} AS NUMERIC) >= 5000 THEN 'high'
          WHEN CAST(${expenseRequest.amount} AS NUMERIC) >= 1000 THEN 'normal'
          ELSE 'low'
        END
      `,
    })
    .from(expenseRequest)
    .where(eq(expenseRequest.status, "pending"))
    .orderBy(desc(expenseRequest.createdAt))
    .limit(5);

  // Get counts by priority
  const priorityColumn = sql<string>`
    CASE
      WHEN CAST(${expenseRequest.amount} AS NUMERIC) >= 10000 THEN 'urgent'
      WHEN CAST(${expenseRequest.amount} AS NUMERIC) >= 5000 THEN 'high'
      WHEN CAST(${expenseRequest.amount} AS NUMERIC) >= 1000 THEN 'normal'
      ELSE 'low'
    END
  `;

  const priorityCounts = await database
    .select({
      priority: priorityColumn,
      count: count(),
    })
    .from(expenseRequest)
    .where(eq(expenseRequest.status, "pending"))
    .groupBy(priorityColumn);

  const highPriority = priorityCounts.find(p => p.priority === "high")?.count ?? 0;
  const normalPriority = priorityCounts.find(p => p.priority === "normal")?.count ?? 0;
  const lowPriority = priorityCounts.find(p => p.priority === "low")?.count ?? 0;
  const urgentCount = priorityCounts.find(p => p.priority === "urgent")?.count ?? 0;

  // Get total pending value
  const [pendingValue] = await database
    .select({ total: sum(expenseRequest.amount) })
    .from(expenseRequest)
    .where(eq(expenseRequest.status, "pending"));

  return {
    total: highPriority + normalPriority + lowPriority + urgentCount,
    urgent: urgentCount,
    highPriority,
    normalPriority,
    lowPriority,
    totalValue: Number(pendingValue?.total) || 0,
    items: pendingExpenses.map(expense => ({
      id: expense.id,
      title: expense.purpose,
      amount: Number(expense.amount),
      priority: expense.priority ?? "normal",
      submittedAt: expense.createdAt,
      daysWaiting: Math.floor((Date.now() - new Date(expense.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    })),
    // Simulated non-expense approvals
    contracts: Math.floor(Math.random() * 3),
    budgetRequests: Math.floor(Math.random() * 2),
    hiringRequests: Math.floor(Math.random() * 2),
  };
}

/**
 * Get team capacity and utilization
 */
async function getTeamCapacity() {
  // Get user counts by role
  const roleCounts = await database
    .select({
      role: user.role,
      count: count(),
    })
    .from(user)
    .groupBy(user.role);

  const byRole = {
    md: 0,
    admin: 0,
    "field-tech": 0,
    sales: 0,
  };

  roleCounts.forEach((r) => {
    if (r.role && r.role in byRole) {
      byRole[r.role as keyof typeof byRole] = r.count;
    }
  });

  const totalStaff = Object.values(byRole).reduce((sum, count) => sum + count, 0);

  // Simulated capacity data (would come from actual time tracking/project management)
  return {
    totalStaff,
    byDepartment: {
      fieldTech: byRole["field-tech"],
      sales: byRole.sales,
      admin: byRole.admin + byRole.md,
    },
    utilization: {
      overall: Math.floor(Math.random() * 20 + 75), // 75-95%
      fieldTech: Math.floor(Math.random() * 15 + 80), // 80-95%
      sales: Math.floor(Math.random() * 20 + 70), // 70-90%
    },
    availability: {
      onDuty: Math.floor(totalStaff * 0.85),
      onLeave: Math.floor(totalStaff * 0.08),
      unavailable: Math.floor(totalStaff * 0.07),
    },
    openPositions: Math.floor(Math.random() * 5) + 1,
    upcomingTimeOff: Math.floor(Math.random() * 8) + 2,
  };
}

/**
 * Get key metrics and KPIs
 */
async function getKeyMetrics() {
  // Get expense approval metrics
  const approvedExpenses = await database
    .select({ count: count() })
    .from(expenseRequest)
    .where(eq(expenseRequest.status, "approved"));

  const rejectedExpenses = await database
    .select({ count: count() })
    .from(expenseRequest)
    .where(eq(expenseRequest.status, "rejected"));

  const totalExpenses = await database
    .select({ count: count() })
    .from(expenseRequest);

  const approvalRate = totalExpenses[0].count > 0
    ? Math.round((approvedExpenses[0].count / totalExpenses[0].count) * 100)
    : 0;

  // Simulated KPIs (would come from actual business metrics)
  return {
    customerSatisfaction: {
      current: Math.floor(Math.random() * 10 + 88), // 88-98%
      target: 95,
      trend: (Math.random() > 0.5 ? "up" : "stable") as "up" | "down" | "stable",
    },
    operationalEfficiency: {
      current: Math.floor(Math.random() * 15 + 82), // 82-97%
      target: 90,
      trend: (Math.random() > 0.3 ? "up" : "down") as "up" | "down" | "stable",
    },
    revenueGrowth: {
      current: Math.floor(Math.random() * 15 + 5), // 5-20%
      target: 15,
      trend: (Math.random() > 0.4 ? "up" : "stable") as "up" | "down" | "stable",
    },
    employeeRetention: {
      current: Math.floor(Math.random() * 8 + 90), // 90-98%
      target: 92,
      trend: "stable" as const,
    },
    expenseApprovalRate: {
      current: approvalRate,
      avgProcessingTime: "2.3 days",
      trend: "stable" as const,
    },
    projectCompletion: {
      onTime: Math.floor(Math.random() * 15 + 80), // 80-95%
      delayed: Math.floor(Math.random() * 10 + 3), // 3-13%
      atRisk: Math.floor(Math.random() * 5 + 2), // 2-7%
    },
  };
}

/**
 * Get executive briefing items
 */
async function getExecutiveBriefing() {
  // Simulated executive briefing (would come from actual alerts/reports system)
  const briefingItems: Array<{
    id: string;
    type: "alert" | "insight" | "action" | "update";
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    timestamp: Date;
    actionRequired: boolean;
  }> = [
    {
      id: "1",
      type: "alert",
      priority: "high",
      title: "Budget threshold approaching",
      description: "Q1 operational expenses at 85% of allocated budget. Review recommended.",
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      actionRequired: true,
    },
    {
      id: "2",
      type: "insight",
      priority: "medium",
      title: "Revenue trend positive",
      description: "Month-over-month revenue increased by 12%. Sales team exceeding targets.",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      actionRequired: false,
    },
    {
      id: "3",
      type: "action",
      priority: "high",
      title: "Contract renewal due",
      description: "3 major contracts require renewal within 30 days. Review terms needed.",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
      actionRequired: true,
    },
    {
      id: "4",
      type: "update",
      priority: "low",
      title: "New hires onboarded",
      description: "5 field technicians completed onboarding this week. Training at 100%.",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      actionRequired: false,
    },
    {
      id: "5",
      type: "insight",
      priority: "medium",
      title: "Customer satisfaction improved",
      description: "NPS score increased from 72 to 78 this quarter. Top feedback: response time.",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
      actionRequired: false,
    },
  ];

  // Get counts
  const actionRequired = briefingItems.filter(item => item.actionRequired).length;
  const highPriority = briefingItems.filter(item => item.priority === "high").length;

  return {
    items: briefingItems,
    summary: {
      total: briefingItems.length,
      actionRequired,
      highPriority,
      newToday: briefingItems.filter(
        item => Date.now() - item.timestamp.getTime() < 24 * 60 * 60 * 1000
      ).length,
    },
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}%`;
}
