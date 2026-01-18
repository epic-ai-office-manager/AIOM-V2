/**
 * Customer Issue Monitor Use Cases
 *
 * Business logic for AI-powered customer issue analysis including
 * risk assessment, escalation prediction, and satisfaction analysis.
 */

import { getClaudeClient } from "~/lib/claude/migration-wrapper";
import {
  getOpenCustomerIssues,
  getCustomerIssueStats,
  getCustomerRiskProfiles,
  getEscalationTrends,
  getRecentCustomerIssues,
  type CustomerIssue,
  type CustomerIssueStats,
  type CustomerRiskProfile,
  type EscalationTrend,
  type CustomerIssueSummary,
} from "~/data-access/customer-issue-monitor";

// =============================================================================
// Types
// =============================================================================

export interface CustomerIssueAnalysis {
  summary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  keyFindings: {
    finding: string;
    severity: "info" | "warning" | "critical";
  }[];
  recommendations: {
    action: string;
    priority: "low" | "medium" | "high";
    reasoning: string;
  }[];
  predictedEscalations: {
    issueId: string;
    customerName: string | null;
    probability: number;
    reason: string;
  }[];
  satisfactionRisks: {
    customerId: string;
    customerName: string | null;
    riskScore: number;
    factors: string[];
  }[];
  slaInsights: {
    complianceRate: number;
    atRiskCount: number;
    breachedCount: number;
    recommendation: string;
  };
}

export interface MonitorDashboardData {
  stats: CustomerIssueStats;
  openIssues: CustomerIssue[];
  riskProfiles: CustomerRiskProfile[];
  escalationTrends: EscalationTrend[];
  recentIssues: CustomerIssueSummary[];
  analysis: CustomerIssueAnalysis | null;
}

export interface AnalyzeCustomerIssuesOptions {
  includeAiAnalysis?: boolean;
  issueLimit?: number;
  trendDays?: number;
}

// =============================================================================
// System Prompt for Customer Issue Analysis
// =============================================================================

const CUSTOMER_ISSUE_ANALYSIS_PROMPT = `You are an expert customer service analyst specializing in identifying escalating issues, SLA risks, and customer satisfaction problems. Your role is to analyze customer support data and provide actionable insights.

When analyzing customer issues, you should:

1. **Risk Assessment**: Evaluate the overall risk level of the current customer issue landscape based on:
   - Number and severity of open escalations
   - SLA compliance rates
   - Customer sentiment trends
   - Unresolved issue backlog

2. **Key Findings**: Identify the most critical findings that need immediate attention, categorized by severity.

3. **Recommendations**: Provide actionable recommendations to improve customer satisfaction and reduce escalations.

4. **Escalation Prediction**: Based on current patterns, identify issues that are likely to escalate soon.

5. **Satisfaction Risks**: Identify customers who are at risk of churn or severe dissatisfaction.

6. **SLA Insights**: Analyze SLA performance and provide recommendations for improvement.

Always respond with valid JSON in the exact format specified. Be objective, data-driven, and focus on actionable insights.`;

// =============================================================================
// Use Cases
// =============================================================================

/**
 * Get complete customer issue monitor dashboard data
 */
export async function getCustomerIssueMonitorData(
  options: AnalyzeCustomerIssuesOptions = {}
): Promise<MonitorDashboardData> {
  const {
    includeAiAnalysis = true,
    issueLimit = 50,
    trendDays = 7,
  } = options;

  // Fetch all data in parallel
  const [stats, openIssues, riskProfiles, escalationTrends, recentIssues] =
    await Promise.all([
      getCustomerIssueStats(),
      getOpenCustomerIssues(),
      getCustomerRiskProfiles(),
      getEscalationTrends(trendDays),
      getRecentCustomerIssues(issueLimit),
    ]);

  // Generate AI analysis if requested and there's data to analyze
  let analysis: CustomerIssueAnalysis | null = null;
  if (
    includeAiAnalysis &&
    (openIssues.length > 0 || riskProfiles.length > 0)
  ) {
    try {
      analysis = await analyzeCustomerIssues({
        stats,
        openIssues: openIssues.slice(0, 20), // Limit for AI analysis
        riskProfiles: riskProfiles.slice(0, 10),
        escalationTrends,
      });
    } catch (error) {
      console.error("Error generating AI analysis:", error);
      // Return fallback analysis
      analysis = generateFallbackAnalysis(stats, openIssues, riskProfiles);
    }
  }

  return {
    stats,
    openIssues,
    riskProfiles,
    escalationTrends,
    recentIssues,
    analysis,
  };
}

/**
 * Analyze customer issues using Claude AI
 */
export async function analyzeCustomerIssues(data: {
  stats: CustomerIssueStats;
  openIssues: CustomerIssue[];
  riskProfiles: CustomerRiskProfile[];
  escalationTrends: EscalationTrend[];
}): Promise<CustomerIssueAnalysis> {
  const { stats, openIssues, riskProfiles, escalationTrends } = data;

  // Build context for Claude
  const context = buildAnalysisContext(
    stats,
    openIssues,
    riskProfiles,
    escalationTrends
  );

  const claude = getClaudeClient();
  const response = await claude.createMessage({
    messages: [
      {
        role: "user",
        content: buildAnalysisPrompt(context),
      },
    ],
    system: CUSTOMER_ISSUE_ANALYSIS_PROMPT,
    maxTokens: 2000,
    temperature: 0.3,
  });

  // Extract text response
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Parse the JSON response
  const parsed = parseAnalysisResponse(textContent.text);
  if (!parsed) {
    throw new Error("Failed to parse Claude response");
  }

  return parsed;
}

/**
 * Get high-risk customers requiring immediate attention
 */
export async function getHighRiskCustomers(): Promise<CustomerRiskProfile[]> {
  const profiles = await getCustomerRiskProfiles();
  return profiles.filter(
    (p) => p.riskLevel === "high" || p.riskLevel === "critical"
  );
}

/**
 * Get SLA at-risk issues
 */
export async function getSLAAtRiskIssues(): Promise<CustomerIssue[]> {
  const issues = await getOpenCustomerIssues();
  return issues.filter(
    (i) => i.slaStatus === "at_risk" || i.slaStatus === "breached"
  );
}

/**
 * Get escalation summary for alerts
 */
export async function getEscalationSummary(): Promise<{
  totalOpen: number;
  urgent: number;
  high: number;
  breachedSla: number;
  newToday: number;
}> {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const issues = await getOpenCustomerIssues();
  const escalations = issues.filter((i) => i.issueType === "escalation");

  return {
    totalOpen: escalations.length,
    urgent: escalations.filter((i) => i.priority === "urgent").length,
    high: escalations.filter((i) => i.priority === "high").length,
    breachedSla: escalations.filter((i) => i.slaStatus === "breached").length,
    newToday: escalations.filter((i) => i.createdAt >= todayStart).length,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build context string for Claude analysis
 */
function buildAnalysisContext(
  stats: CustomerIssueStats,
  openIssues: CustomerIssue[],
  riskProfiles: CustomerRiskProfile[],
  escalationTrends: EscalationTrend[]
): string {
  const parts: string[] = [];

  // Summary stats
  parts.push("## Customer Issue Statistics");
  parts.push(`- Total Open Issues: ${stats.totalOpenIssues}`);
  parts.push(`- Active Escalations: ${stats.totalEscalations}`);
  parts.push(`- Pending Follow-ups: ${stats.totalPendingFollowUps}`);
  parts.push(`- Overdue Issues: ${stats.overdueIssues}`);
  parts.push(`- SLA Compliance Rate: ${stats.slaComplianceRate}%`);
  parts.push(`- Avg Resolution Time: ${stats.avgResolutionTimeHours || "N/A"} hours`);
  parts.push(`- Resolved Today: ${stats.resolvedToday}`);
  parts.push(`- Resolved This Week: ${stats.resolvedThisWeek}`);

  // Sentiment distribution
  if (stats.sentimentDistribution.length > 0) {
    parts.push("\n## Sentiment Distribution");
    for (const s of stats.sentimentDistribution) {
      parts.push(`- ${s.sentiment}: ${s.count} (${s.percentage}%)`);
    }
  }

  // Open issues summary
  if (openIssues.length > 0) {
    parts.push("\n## Open Issues Summary");
    const escalations = openIssues.filter((i) => i.issueType === "escalation");
    const followUps = openIssues.filter((i) => i.issueType === "follow_up");
    const breached = openIssues.filter((i) => i.slaStatus === "breached");
    const atRisk = openIssues.filter((i) => i.slaStatus === "at_risk");

    parts.push(`- Escalations: ${escalations.length}`);
    parts.push(`- Follow-ups: ${followUps.length}`);
    parts.push(`- SLA Breached: ${breached.length}`);
    parts.push(`- SLA At Risk: ${atRisk.length}`);

    // Top issues
    parts.push("\n### Top Priority Issues:");
    const topIssues = openIssues
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 5);

    for (const issue of topIssues) {
      parts.push(
        `- [${issue.priority.toUpperCase()}] ${issue.customerName || "Unknown Customer"}: ` +
          `${issue.issueType}, ${issue.hoursOpen}h open, SLA: ${issue.slaStatus}`
      );
    }
  }

  // Risk profiles
  if (riskProfiles.length > 0) {
    parts.push("\n## Customer Risk Profiles");
    const highRisk = riskProfiles.filter(
      (p) => p.riskLevel === "high" || p.riskLevel === "critical"
    );
    parts.push(`- High/Critical Risk Customers: ${highRisk.length}`);

    parts.push("\n### Top At-Risk Customers:");
    for (const profile of riskProfiles.slice(0, 5)) {
      parts.push(
        `- ${profile.customerName || profile.customerId}: Risk Score ${profile.riskScore}, ` +
          `${profile.escalationCount} escalations, ${profile.negativeInteractions} negative interactions`
      );
    }
  }

  // Escalation trends
  if (escalationTrends.length > 0) {
    parts.push("\n## Escalation Trends (Last 7 Days)");
    const totalNew = escalationTrends.reduce((s, t) => s + t.newEscalations, 0);
    const totalResolved = escalationTrends.reduce(
      (s, t) => s + t.resolvedEscalations,
      0
    );
    parts.push(`- New Escalations: ${totalNew}`);
    parts.push(`- Resolved Escalations: ${totalResolved}`);
    parts.push(`- Net Change: ${totalNew - totalResolved}`);

    const latest = escalationTrends[escalationTrends.length - 1];
    if (latest) {
      parts.push(`- Current Open: ${latest.openEscalations}`);
    }
  }

  return parts.join("\n");
}

/**
 * Build the prompt for Claude analysis
 */
function buildAnalysisPrompt(context: string): string {
  return `Please analyze the following customer issue data and provide insights.

${context}

Respond with a JSON object in the following exact format:
{
  "summary": "A 2-3 sentence executive summary of the current customer issue landscape",
  "riskLevel": "low" | "medium" | "high" | "critical",
  "keyFindings": [
    {
      "finding": "Description of the finding",
      "severity": "info" | "warning" | "critical"
    }
  ],
  "recommendations": [
    {
      "action": "Specific action to take",
      "priority": "low" | "medium" | "high",
      "reasoning": "Why this action is recommended"
    }
  ],
  "predictedEscalations": [
    {
      "issueId": "issue ID if available",
      "customerName": "customer name",
      "probability": 0.0-1.0,
      "reason": "Why this is likely to escalate"
    }
  ],
  "satisfactionRisks": [
    {
      "customerId": "customer ID",
      "customerName": "customer name",
      "riskScore": 0-100,
      "factors": ["factor1", "factor2"]
    }
  ],
  "slaInsights": {
    "complianceRate": 0-100,
    "atRiskCount": number,
    "breachedCount": number,
    "recommendation": "Specific recommendation for SLA improvement"
  }
}

Provide 2-5 key findings, 2-4 recommendations, and identify any customers at significant risk.
Ensure your response is valid JSON only, with no additional text before or after.`;
}

/**
 * Parse Claude's response into structured data
 */
function parseAnalysisResponse(text: string): CustomerIssueAnalysis | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Claude response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as CustomerIssueAnalysis;

    // Validate required fields
    if (!parsed.summary || !parsed.riskLevel) {
      console.error("Missing required fields in Claude response");
      return null;
    }

    // Set defaults for optional arrays
    if (!Array.isArray(parsed.keyFindings)) {
      parsed.keyFindings = [];
    }
    if (!Array.isArray(parsed.recommendations)) {
      parsed.recommendations = [];
    }
    if (!Array.isArray(parsed.predictedEscalations)) {
      parsed.predictedEscalations = [];
    }
    if (!Array.isArray(parsed.satisfactionRisks)) {
      parsed.satisfactionRisks = [];
    }
    if (!parsed.slaInsights) {
      parsed.slaInsights = {
        complianceRate: 0,
        atRiskCount: 0,
        breachedCount: 0,
        recommendation: "No SLA data available",
      };
    }

    return parsed;
  } catch (error) {
    console.error("Failed to parse Claude response:", error);
    return null;
  }
}

/**
 * Generate fallback analysis when AI is unavailable
 */
function generateFallbackAnalysis(
  stats: CustomerIssueStats,
  openIssues: CustomerIssue[],
  riskProfiles: CustomerRiskProfile[]
): CustomerIssueAnalysis {
  // Determine risk level based on stats
  let riskLevel: "low" | "medium" | "high" | "critical" = "low";
  if (stats.slaComplianceRate < 50 || stats.overdueIssues > 10) {
    riskLevel = "critical";
  } else if (stats.slaComplianceRate < 70 || stats.overdueIssues > 5) {
    riskLevel = "high";
  } else if (stats.slaComplianceRate < 85 || stats.overdueIssues > 2) {
    riskLevel = "medium";
  }

  const keyFindings: CustomerIssueAnalysis["keyFindings"] = [];

  if (stats.overdueIssues > 0) {
    keyFindings.push({
      finding: `${stats.overdueIssues} issues are overdue and require immediate attention`,
      severity: stats.overdueIssues > 5 ? "critical" : "warning",
    });
  }

  if (stats.slaComplianceRate < 80) {
    keyFindings.push({
      finding: `SLA compliance is at ${stats.slaComplianceRate}%, below the target of 80%`,
      severity: stats.slaComplianceRate < 60 ? "critical" : "warning",
    });
  }

  if (stats.totalEscalations > 0) {
    keyFindings.push({
      finding: `${stats.totalEscalations} active escalation(s) need resolution`,
      severity: stats.totalEscalations > 3 ? "critical" : "warning",
    });
  }

  const recommendations: CustomerIssueAnalysis["recommendations"] = [];

  if (stats.overdueIssues > 0) {
    recommendations.push({
      action: "Address overdue issues immediately to improve SLA compliance",
      priority: "high",
      reasoning: `${stats.overdueIssues} overdue issues are impacting customer satisfaction`,
    });
  }

  if (stats.totalEscalations > 0) {
    recommendations.push({
      action: "Review and prioritize active escalations",
      priority: "high",
      reasoning: "Escalated issues represent highest-risk customer interactions",
    });
  }

  const highRiskCustomers = riskProfiles.filter(
    (p) => p.riskLevel === "high" || p.riskLevel === "critical"
  );
  const satisfactionRisks = highRiskCustomers.slice(0, 5).map((p) => ({
    customerId: p.customerId,
    customerName: p.customerName,
    riskScore: p.riskScore,
    factors: p.riskFactors,
  }));

  const breachedIssues = openIssues.filter((i) => i.slaStatus === "breached");
  const atRiskIssues = openIssues.filter((i) => i.slaStatus === "at_risk");

  return {
    summary: `There are ${stats.totalOpenIssues} open customer issues with ${stats.totalEscalations} escalations. ` +
      `SLA compliance is at ${stats.slaComplianceRate}% with ${stats.overdueIssues} overdue issues requiring attention.`,
    riskLevel,
    keyFindings,
    recommendations,
    predictedEscalations: [],
    satisfactionRisks,
    slaInsights: {
      complianceRate: stats.slaComplianceRate,
      atRiskCount: atRiskIssues.length,
      breachedCount: breachedIssues.length,
      recommendation:
        breachedIssues.length > 0
          ? "Focus on resolving SLA-breached issues first to prevent further customer dissatisfaction"
          : "Maintain current response times to keep SLA compliance healthy",
    },
  };
}
