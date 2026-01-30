/**
 * Message Priority Scoring Use Case
 *
 * AI-powered service for scoring message importance based on:
 * - Sender information (role, relationship, frequency)
 * - Content analysis (urgency keywords, action items, deadlines)
 * - User context (patterns, preferences)
 * - Temporal factors (time sensitivity, response expectations)
 */

import { getClaudeClient } from "~/lib/claude/migration-wrapper";
import {
  updateThreadPriorityScore,
  getThreadsNeedingScoring,
  batchUpdateThreadPriorityScores,
} from "~/data-access/message-priority";
import {
  findUnifiedInboxThreadById,
  getMessagesForThread,
} from "~/data-access/unified-inbox";
import type {
  UnifiedInboxThread,
  UnifiedInboxMessage,
  PriorityLevel,
  PriorityFactors,
} from "~/db/schema";

// =============================================================================
// Constants
// =============================================================================

// Keywords that indicate high urgency
const URGENCY_KEYWORDS = [
  "urgent",
  "asap",
  "emergency",
  "critical",
  "immediately",
  "deadline",
  "due today",
  "overdue",
  "time-sensitive",
  "priority",
  "important",
  "action required",
  "respond by",
  "expires",
  "final notice",
  "last chance",
  "don't miss",
  "reminder",
];

// Keywords that indicate action items
const ACTION_KEYWORDS = [
  "please review",
  "needs approval",
  "sign off",
  "confirm",
  "schedule",
  "meeting request",
  "follow up",
  "complete by",
  "submit",
  "approve",
  "reject",
  "decision needed",
  "waiting for",
  "blocked on",
];

// System prompt for Claude priority analysis
const PRIORITY_ANALYSIS_PROMPT = `You are an AI assistant specialized in analyzing message importance for a professional communication inbox.

Analyze the provided message(s) and determine their priority level based on:

1. **Sender Importance** (0-100):
   - Role/position (executives, managers score higher)
   - Relationship frequency (frequent contacts may indicate importance)
   - External vs internal contacts

2. **Content Urgency** (0-100):
   - Explicit urgency words (urgent, ASAP, deadline)
   - Action items requiring immediate response
   - Time-sensitive information
   - Consequences of delay mentioned

3. **Keyword Relevance** (0-100):
   - Business-critical topics
   - Project-related keywords
   - Financial or legal mentions
   - Customer/client references

4. **Context Relevance** (0-100):
   - Time of day/week sensitivity
   - Thread continuation importance
   - Response expectations

Return your analysis as a JSON object with this exact structure:
{
  "priorityLevel": "critical" | "high" | "normal" | "low",
  "senderImportance": number (0-100),
  "contentUrgency": number (0-100),
  "keywordRelevance": number (0-100),
  "contextRelevance": number (0-100),
  "overallScore": number (0-100),
  "keywords": string[] (detected important keywords),
  "reasoning": string (brief explanation of the priority assessment)
}

Priority Level Guidelines:
- **critical** (score 80-100): Requires immediate attention, potential business impact
- **high** (score 60-79): Important but not immediately urgent
- **normal** (score 30-59): Standard business communication
- **low** (score 0-29): Informational, can be addressed later

Be concise in your reasoning (1-2 sentences max).
ONLY respond with the JSON object, no additional text.`;

// =============================================================================
// Types
// =============================================================================

export interface PriorityScoringResult {
  threadId: string;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  priorityFactors: PriorityFactors;
  priorityReason: string;
  success: boolean;
  error?: string;
}

export interface BatchScoringResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: PriorityScoringResult[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract keywords from message content
 */
function extractKeywords(content: string): string[] {
  const lowerContent = content.toLowerCase();
  const foundKeywords: string[] = [];

  // Check urgency keywords
  for (const keyword of URGENCY_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    }
  }

  // Check action keywords
  for (const keyword of ACTION_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    }
  }

  return [...new Set(foundKeywords)]; // Remove duplicates
}

/**
 * Calculate a quick heuristic score based on keywords (fallback if AI fails)
 */
function calculateHeuristicScore(
  messages: UnifiedInboxMessage[],
  thread: UnifiedInboxThread
): PriorityFactors {
  const allContent = messages.map((m) => m.content).join(" ");
  const keywords = extractKeywords(allContent);

  // Base scores
  let contentUrgency = 20;
  let keywordRelevance = 20;
  const contextRelevance = 30;
  const senderImportance = 30;

  // Boost for urgency keywords
  const urgencyKeywordsFound = keywords.filter((k) =>
    URGENCY_KEYWORDS.includes(k.toLowerCase())
  ).length;
  contentUrgency = Math.min(100, 20 + urgencyKeywordsFound * 15);

  // Boost for action keywords
  const actionKeywordsFound = keywords.filter((k) =>
    ACTION_KEYWORDS.includes(k.toLowerCase())
  ).length;
  keywordRelevance = Math.min(100, 20 + actionKeywordsFound * 10);

  // Boost for unread messages
  const unreadBoost = thread.unreadCount > 0 ? 10 : 0;

  const overallScore = Math.round(
    (senderImportance * 0.25 +
      contentUrgency * 0.35 +
      keywordRelevance * 0.25 +
      contextRelevance * 0.15 +
      unreadBoost)
  );

  return {
    senderImportance,
    contentUrgency,
    keywordRelevance,
    contextRelevance,
    overallScore: Math.min(100, overallScore),
    keywords,
    reasoning: `Heuristic analysis: Found ${keywords.length} priority keywords. ${
      thread.unreadCount > 0 ? `${thread.unreadCount} unread messages.` : ""
    }`,
  };
}

/**
 * Determine priority level from score
 */
function scoreToPriorityLevel(score: number): PriorityLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "normal";
  return "low";
}

/**
 * Format messages for Claude analysis
 */
function formatMessagesForAnalysis(
  messages: UnifiedInboxMessage[],
  thread: UnifiedInboxThread
): string {
  const recentMessages = messages.slice(-5); // Only analyze last 5 messages

  let formatted = `Thread: "${thread.title}"
Source: ${thread.sourceType}
Unread Count: ${thread.unreadCount}

Messages (most recent last):
`;

  for (const msg of recentMessages) {
    formatted += `
---
From: ${msg.authorName}${msg.isOwnMessage ? " (You)" : ""}
Time: ${msg.createdAt.toISOString()}
Read: ${msg.isRead ? "Yes" : "No"}

${msg.content}
`;
  }

  return formatted;
}

// =============================================================================
// Main Scoring Functions
// =============================================================================

/**
 * Score a single thread's priority using AI
 */
export async function scoreThreadPriority(
  threadId: string,
  userId: string,
  options?: {
    useAI?: boolean;
    forceRescore?: boolean;
  }
): Promise<PriorityScoringResult> {
  try {
    // Get the thread
    const thread = await findUnifiedInboxThreadById(threadId);
    if (!thread || thread.userId !== userId) {
      return {
        threadId,
        priorityScore: 0,
        priorityLevel: "normal",
        priorityFactors: {
          senderImportance: 0,
          contentUrgency: 0,
          keywordRelevance: 0,
          contextRelevance: 0,
          overallScore: 0,
          keywords: [],
          reasoning: "Thread not found or access denied",
        },
        priorityReason: "Thread not found or access denied",
        success: false,
        error: "Thread not found or access denied",
      };
    }

    // Get messages for the thread
    const messages = await getMessagesForThread(thread, userId, 10, 0);

    let priorityFactors: PriorityFactors;

    // Use AI if enabled and messages exist
    if (options?.useAI !== false && messages.length > 0) {
      try {
        const client = getClaudeClient();
        const formattedMessages = formatMessagesForAnalysis(messages, thread);

        const response = await client.createMessage({
          messages: [
            {
              role: "user",
              content: `${PRIORITY_ANALYSIS_PROMPT}

Here is the message thread to analyze:

${formattedMessages}`,
            },
          ],
          maxTokens: 500,
          temperature: 0.3, // Lower temperature for more consistent scoring
        });

        const responseText = client.extractTextFromResponse(response as any);

        // Parse the JSON response
        const parsed = JSON.parse(responseText);

        priorityFactors = {
          senderImportance: Math.max(0, Math.min(100, parsed.senderImportance || 0)),
          contentUrgency: Math.max(0, Math.min(100, parsed.contentUrgency || 0)),
          keywordRelevance: Math.max(0, Math.min(100, parsed.keywordRelevance || 0)),
          contextRelevance: Math.max(0, Math.min(100, parsed.contextRelevance || 0)),
          overallScore: Math.max(0, Math.min(100, parsed.overallScore || 0)),
          keywords: parsed.keywords || [],
          reasoning: parsed.reasoning || "AI analysis completed",
        };
      } catch (aiError) {
        // Fallback to heuristic scoring if AI fails
        console.error("AI scoring failed, using heuristics:", aiError);
        priorityFactors = calculateHeuristicScore(messages, thread);
      }
    } else {
      // Use heuristic scoring
      priorityFactors = calculateHeuristicScore(messages, thread);
    }

    const priorityLevel = scoreToPriorityLevel(priorityFactors.overallScore);

    // Update the thread in the database
    await updateThreadPriorityScore(threadId, {
      priorityScore: priorityFactors.overallScore,
      priorityLevel,
      priorityFactors,
      priorityReason: priorityFactors.reasoning,
    });

    return {
      threadId,
      priorityScore: priorityFactors.overallScore,
      priorityLevel,
      priorityFactors,
      priorityReason: priorityFactors.reasoning,
      success: true,
    };
  } catch (error) {
    console.error("Error scoring thread priority:", error);
    return {
      threadId,
      priorityScore: 0,
      priorityLevel: "normal",
      priorityFactors: {
        senderImportance: 0,
        contentUrgency: 0,
        keywordRelevance: 0,
        contextRelevance: 0,
        overallScore: 0,
        keywords: [],
        reasoning: "Error during scoring",
      },
      priorityReason: "Error during scoring",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Score multiple threads in batch
 */
export async function batchScoreThreadPriorities(
  userId: string,
  options?: {
    threadIds?: string[];
    maxThreads?: number;
    useAI?: boolean;
  }
): Promise<BatchScoringResult> {
  const results: PriorityScoringResult[] = [];

  // Get threads to score
  let threadsToScore: UnifiedInboxThread[];

  if (options?.threadIds?.length) {
    // Score specific threads
    const threads = await Promise.all(
      options.threadIds.map((id) => findUnifiedInboxThreadById(id))
    );
    threadsToScore = threads.filter(
      (t): t is UnifiedInboxThread => t !== null && t.userId === userId
    );
  } else {
    // Get threads that need scoring
    threadsToScore = await getThreadsNeedingScoring(userId, {
      limit: options?.maxThreads ?? 10,
    });
  }

  // Score each thread
  for (const thread of threadsToScore) {
    const result = await scoreThreadPriority(thread.id, userId, {
      useAI: options?.useAI,
    });
    results.push(result);
  }

  return {
    totalProcessed: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Score all threads for a user that need scoring
 */
export async function scoreAllPendingThreads(
  userId: string,
  options?: {
    useAI?: boolean;
    maxAgeMinutes?: number;
  }
): Promise<BatchScoringResult> {
  const threadsToScore = await getThreadsNeedingScoring(userId, {
    maxAgeMinutes: options?.maxAgeMinutes ?? 60,
    limit: 50, // Limit to prevent overload
  });

  return batchScoreThreadPriorities(userId, {
    threadIds: threadsToScore.map((t) => t.id),
    useAI: options?.useAI,
  });
}
