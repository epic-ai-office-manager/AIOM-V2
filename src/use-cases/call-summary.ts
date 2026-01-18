/**
 * Call Summary Use Cases
 *
 * Business logic for generating AI-powered call summaries including
 * key points extraction, action items identification, and sentiment analysis.
 */

import { getClaudeClient } from "~/lib/claude/migration-wrapper";
import { findCallRecordById } from "~/data-access/call-records";
import { findCallDispositionByCallRecordId } from "~/data-access/call-dispositions";
import {
  createCallSummary,
  findCallSummaryByCallRecordId,
  updateCallSummary,
  updateCallSummaryStatus,
  stringifyCallSummaryFields,
  type ParsedCallSummary,
  parseCallSummary,
} from "~/data-access/call-summaries";
import type {
  CallKeyPoint,
  CallActionItem,
  CallSentimentDetails,
  CallSentiment,
  CallSummary,
} from "~/db/schema";

// =============================================================================
// Types
// =============================================================================

export interface GenerateCallSummaryOptions {
  callRecordId: string;
  userId: string;
  notes?: string; // Optional notes to include in the analysis
  transcription?: string; // Optional transcription if available
  forceRegenerate?: boolean; // Force regeneration even if summary exists
}

export interface GenerateCallSummaryResult {
  success: boolean;
  summary?: ParsedCallSummary;
  error?: string;
  isExisting?: boolean; // True if returning existing summary instead of generating new
}

// Response structure from Claude
interface ClaudeSummaryResponse {
  summary: string;
  keyPoints: {
    content: string;
    importance: "high" | "medium" | "low";
  }[];
  actionItems: {
    title: string;
    description?: string;
    assignee?: string;
    dueDate?: string;
    priority: "high" | "medium" | "low";
  }[];
  sentiment: {
    overall: CallSentiment;
    score: number;
    confidence: number;
    customerMood?: string;
    agentMood?: string;
    emotions: string[];
    keywords: string[];
  };
}

// =============================================================================
// System Prompt for Call Summarization
// =============================================================================

const CALL_SUMMARY_SYSTEM_PROMPT = `You are an expert call analysis assistant specializing in extracting insights from business calls. Your role is to analyze call information and provide structured summaries that help teams understand call outcomes and follow up effectively.

When analyzing a call, you should:

1. **Summary**: Write a concise 2-4 sentence summary that captures the essence of the call, including the main topic, key decisions, and outcome.

2. **Key Points**: Extract 3-7 most important points discussed during the call. Categorize each by importance (high, medium, low) based on business impact.

3. **Action Items**: Identify any tasks, follow-ups, or commitments mentioned. For each action item:
   - Provide a clear, actionable title
   - Add description if needed for context
   - Suggest priority based on urgency and importance
   - Note the assignee if mentioned
   - Suggest due date if timeline was discussed

4. **Sentiment Analysis**: Analyze the overall sentiment of the interaction:
   - Overall sentiment: positive, neutral, negative, or mixed
   - Score: A number from -1.0 (very negative) to 1.0 (very positive)
   - Confidence: Your confidence in the sentiment assessment (0.0 to 1.0)
   - Customer mood: Brief description of how the customer/caller seemed
   - Agent mood: Brief description of the agent/recipient's demeanor
   - Key emotions detected
   - Important keywords that influenced sentiment

Always respond with valid JSON in the exact format specified. Be objective and professional in your analysis.`;

// =============================================================================
// Use Cases
// =============================================================================

/**
 * Generate a call summary using Claude AI
 */
export async function generateCallSummary(
  options: GenerateCallSummaryOptions
): Promise<GenerateCallSummaryResult> {
  const { callRecordId, userId, notes, transcription, forceRegenerate = false } = options;
  const startTime = Date.now();

  try {
    // Check if summary already exists
    if (!forceRegenerate) {
      const existingSummary = await findCallSummaryByCallRecordId(callRecordId);
      if (existingSummary && existingSummary.status === "completed") {
        return {
          success: true,
          summary: parseCallSummary(existingSummary),
          isExisting: true,
        };
      }
    }

    // Get call record
    const callRecord = await findCallRecordById(callRecordId);
    if (!callRecord) {
      return {
        success: false,
        error: "Call record not found",
      };
    }

    // Get call disposition if available (for additional context)
    const disposition = await findCallDispositionByCallRecordId(callRecordId);

    // Build the context for Claude
    const callContext = buildCallContext(callRecord, disposition, notes, transcription);

    // Create pending summary record
    const pendingSummary = await createCallSummary({
      id: crypto.randomUUID(),
      callRecordId,
      userId,
      summary: "Generating...",
      status: "processing",
      sourceType: transcription ? "transcription" : notes ? "notes" : "metadata",
      notesUsed: notes || null,
    });

    try {
      // Call Claude API
      const claude = getClaudeClient();
      const response = await claude.createMessage({
        messages: [
          {
            role: "user",
            content: buildPrompt(callContext),
          },
        ],
        system: CALL_SUMMARY_SYSTEM_PROMPT,
        maxTokens: 2000,
        temperature: 0.3, // Lower temperature for more consistent output
      });

      // Extract text response
      const textContent = response.content.find((block) => block.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response from Claude");
      }

      // Parse the JSON response
      const parsedResponse = parseClaudeResponse(textContent.text);
      if (!parsedResponse) {
        throw new Error("Failed to parse Claude response");
      }

      // Transform response to our data structure
      const keyPoints: CallKeyPoint[] = parsedResponse.keyPoints.map((kp, index) => ({
        id: `kp-${index + 1}`,
        content: kp.content,
        importance: kp.importance,
      }));

      const actionItems: CallActionItem[] = parsedResponse.actionItems.map((ai, index) => ({
        id: `ai-${index + 1}`,
        title: ai.title,
        description: ai.description,
        assignee: ai.assignee,
        dueDate: ai.dueDate,
        priority: ai.priority,
        completed: false,
      }));

      const sentimentDetails: CallSentimentDetails = {
        overall: parsedResponse.sentiment.overall,
        score: parsedResponse.sentiment.score,
        confidence: parsedResponse.sentiment.confidence,
        customerMood: parsedResponse.sentiment.customerMood,
        agentMood: parsedResponse.sentiment.agentMood,
        emotions: parsedResponse.sentiment.emotions,
        keywords: parsedResponse.sentiment.keywords,
      };

      const generationTimeMs = Date.now() - startTime;

      // Update the summary with generated content
      const { keyPoints: kpJson, actionItems: aiJson, sentimentDetails: sdJson } = stringifyCallSummaryFields({
        keyPoints,
        actionItems,
        sentimentDetails,
      });

      const updatedSummary = await updateCallSummary(pendingSummary.id, {
        summary: parsedResponse.summary,
        keyPoints: kpJson,
        actionItems: aiJson,
        sentiment: parsedResponse.sentiment.overall,
        sentimentScore: parsedResponse.sentiment.score,
        sentimentDetails: sdJson,
        status: "completed",
        model: response.model,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        generationTimeMs,
      });

      if (!updatedSummary) {
        throw new Error("Failed to update summary");
      }

      return {
        success: true,
        summary: parseCallSummary(updatedSummary),
      };
    } catch (error) {
      // Update summary with error status
      await updateCallSummaryStatus(
        pendingSummary.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );

      throw error;
    }
  } catch (error) {
    console.error("Error generating call summary:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate summary",
    };
  }
}

/**
 * Regenerate a call summary (delete old and create new)
 */
export async function regenerateCallSummary(
  callRecordId: string,
  userId: string,
  notes?: string
): Promise<GenerateCallSummaryResult> {
  return generateCallSummary({
    callRecordId,
    userId,
    notes,
    forceRegenerate: true,
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build context string from call record and related data
 */
function buildCallContext(
  callRecord: NonNullable<Awaited<ReturnType<typeof findCallRecordById>>>,
  disposition: Awaited<ReturnType<typeof findCallDispositionByCallRecordId>>,
  notes?: string,
  transcription?: string
): string {
  const parts: string[] = [];

  // Call metadata
  parts.push("## Call Information");
  parts.push(`- Direction: ${callRecord.direction}`);
  parts.push(`- Duration: ${formatDuration(callRecord.duration)}`);
  parts.push(`- Date/Time: ${callRecord.callTimestamp.toISOString()}`);
  parts.push(`- Status: ${callRecord.status}`);

  // Participants
  parts.push("\n## Participants");
  parts.push(`- Caller: ${callRecord.callerName || callRecord.callerId}`);
  if (callRecord.recipientId) {
    parts.push(`- Recipient: ${callRecord.recipientName || callRecord.recipientId}`);
  }

  // Existing summary if any
  if (callRecord.summary) {
    parts.push("\n## Existing Summary");
    parts.push(callRecord.summary);
  }

  // Disposition information
  if (disposition) {
    parts.push("\n## Call Disposition");
    parts.push(`- Outcome: ${disposition.disposition}`);
    if (disposition.notes) {
      parts.push(`- Notes: ${disposition.notes}`);
    }
    if (disposition.customerSentiment) {
      parts.push(`- Recorded Customer Sentiment: ${disposition.customerSentiment}`);
    }
    if (disposition.followUpReason) {
      parts.push(`- Follow-up Reason: ${disposition.followUpReason}`);
    }
    if (disposition.escalationReason) {
      parts.push(`- Escalation Reason: ${disposition.escalationReason}`);
    }
  }

  // User-provided notes
  if (notes) {
    parts.push("\n## Additional Notes");
    parts.push(notes);
  }

  // Transcription
  if (transcription) {
    parts.push("\n## Call Transcription");
    parts.push(transcription);
  }

  return parts.join("\n");
}

/**
 * Build the prompt for Claude
 */
function buildPrompt(context: string): string {
  return `Please analyze the following call information and provide a structured summary.

${context}

Respond with a JSON object in the following exact format:
{
  "summary": "A concise 2-4 sentence summary of the call",
  "keyPoints": [
    {
      "content": "Key point text",
      "importance": "high" | "medium" | "low"
    }
  ],
  "actionItems": [
    {
      "title": "Action item title",
      "description": "Optional description",
      "assignee": "Optional assignee name",
      "dueDate": "Optional due date (YYYY-MM-DD format)",
      "priority": "high" | "medium" | "low"
    }
  ],
  "sentiment": {
    "overall": "positive" | "neutral" | "negative" | "mixed",
    "score": 0.0,
    "confidence": 0.0,
    "customerMood": "Description of customer mood",
    "agentMood": "Description of agent mood",
    "emotions": ["emotion1", "emotion2"],
    "keywords": ["keyword1", "keyword2"]
  }
}

Ensure your response is valid JSON only, with no additional text before or after.`;
}

/**
 * Parse Claude's response into structured data
 */
function parseClaudeResponse(text: string): ClaudeSummaryResponse | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in Claude response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as ClaudeSummaryResponse;

    // Validate required fields
    if (!parsed.summary || !parsed.keyPoints || !parsed.sentiment) {
      console.error("Missing required fields in Claude response");
      return null;
    }

    // Set defaults for optional arrays
    if (!Array.isArray(parsed.keyPoints)) {
      parsed.keyPoints = [];
    }
    if (!Array.isArray(parsed.actionItems)) {
      parsed.actionItems = [];
    }

    // Validate sentiment fields
    if (!parsed.sentiment.overall) {
      parsed.sentiment.overall = "neutral";
    }
    if (typeof parsed.sentiment.score !== "number") {
      parsed.sentiment.score = 0;
    }
    if (typeof parsed.sentiment.confidence !== "number") {
      parsed.sentiment.confidence = 0.5;
    }
    if (!Array.isArray(parsed.sentiment.emotions)) {
      parsed.sentiment.emotions = [];
    }
    if (!Array.isArray(parsed.sentiment.keywords)) {
      parsed.sentiment.keywords = [];
    }

    return parsed;
  } catch (error) {
    console.error("Failed to parse Claude response:", error);
    return null;
  }
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds} seconds`;
  }

  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  return `${minutes} minute${minutes !== 1 ? "s" : ""} ${remainingSeconds} second${remainingSeconds !== 1 ? "s" : ""}`;
}
