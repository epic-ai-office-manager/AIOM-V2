/**
 * Official Anthropic SDK Client for AIOM
 * 
 * Replaces custom HTTP implementation with SDK benefits:
 * - Automatic retries with exponential backoff
 * - Type safety
 * - Built-in error handling
 * - Streaming support
 * - Future-proof (SDK auto-updates)
 * - Cost tracking and analytics
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParams, MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';

// ============================================================================
// Types
// ============================================================================

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface UsageMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalCost: number;
  useCase: string;
  timestamp: Date;
  durationMs: number;
}

export interface UsageStats {
  totalCost: number;
  totalTokens: number;
  byUseCase: Record<string, { 
    cost: number; 
    tokens: number; 
    requests: number;
    avgDurationMs: number;
  }>;
  cacheEfficiency: number;
  totalRequests: number;
}

// ============================================================================
// SDK Client Class
// ============================================================================

export class ClaudeSDKClient {
  private client: Anthropic;
  private config: Required<ClaudeConfig>;
  private usageMetrics: UsageMetrics[] = [];

  constructor(config: ClaudeConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'claude-sonnet-4-20250514',
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 1.0,
      timeout: config.timeout || 60000,
    };

    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
      maxRetries: 3,
    });
  }

  // ==========================================================================
  // Core Message Methods
  // ==========================================================================

  /**
   * Create a message with automatic cost tracking
   */
  async createMessage(
    params: Omit<MessageCreateParams, 'model' | 'max_tokens'> & {
      model?: string;
      max_tokens?: number;
      useCase?: string;
    }
  ): Promise<Anthropic.Message> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.messages.create({
        model: params.model || this.config.model,
        max_tokens: params.max_tokens || this.config.maxTokens,
        temperature: this.config.temperature,
        messages: params.messages,
        system: params.system,
        tools: params.tools,
        tool_choice: params.tool_choice,
        metadata: params.metadata,
        stop_sequences: params.stop_sequences,
        top_k: params.top_k,
        top_p: params.top_p,
      });

      // Track usage
      this.trackUsage(response, params.useCase || 'unknown', Date.now() - startTime);

      return response;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Stream a message with automatic cost tracking
   */
  async *streamMessage(
    params: Omit<MessageCreateParams, 'model' | 'max_tokens' | 'stream'> & {
      model?: string;
      max_tokens?: number;
      useCase?: string;
    }
  ): AsyncGenerator<MessageStreamEvent, void, unknown> {
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;

    try {
      const stream = await this.client.messages.create({
        model: params.model || this.config.model,
        max_tokens: params.max_tokens || this.config.maxTokens,
        temperature: this.config.temperature,
        stream: true,
        messages: params.messages,
        system: params.system,
        tools: params.tools,
        tool_choice: params.tool_choice,
        metadata: params.metadata,
        stop_sequences: params.stop_sequences,
        top_k: params.top_k,
        top_p: params.top_p,
      });

      for await (const event of stream) {
        yield event;
        
        // Collect usage data from stream events
        if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
          cacheCreationTokens = event.message.usage.cache_creation_input_tokens || 0;
          cacheReadTokens = event.message.usage.cache_read_input_tokens || 0;
        } else if (event.type === 'message_delta') {
          outputTokens += event.usage.output_tokens;
        }
      }

      // Track usage after stream completes
      const mockMessage: Anthropic.Message = {
        id: 'stream',
        type: 'message',
        role: 'assistant',
        content: [],
        model: params.model || this.config.model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_creation_input_tokens: cacheCreationTokens,
          cache_read_input_tokens: cacheReadTokens,
        } as Anthropic.Usage,
      };
      this.trackUsage(mockMessage, params.useCase || 'unknown', Date.now() - startTime);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  // ==========================================================================
  // Usage Tracking
  // ==========================================================================

  /**
   * Track token usage and costs
   */
  private trackUsage(
    message: Anthropic.Message,
    useCase: string,
    durationMs: number
  ): void {
    const usage = message.usage;
    
    // Cost calculation (as of Jan 2025)
    const MODEL_COSTS = {
      'claude-sonnet-4-20250514': {
        input: 3.00 / 1_000_000,           // $3 per 1M tokens
        output: 15.00 / 1_000_000,         // $15 per 1M tokens
        cacheWrite: 3.75 / 1_000_000,      // $3.75 per 1M tokens
        cacheRead: 0.30 / 1_000_000,       // $0.30 per 1M tokens
      },
      'claude-haiku-4-20250514': {
        input: 0.25 / 1_000_000,
        output: 1.25 / 1_000_000,
        cacheWrite: 0.31 / 1_000_000,
        cacheRead: 0.03 / 1_000_000,
      },
    };

    const costs = MODEL_COSTS[this.config.model as keyof typeof MODEL_COSTS] || MODEL_COSTS['claude-sonnet-4-20250514'];
    
    const inputCost = usage.input_tokens * costs.input;
    const outputCost = usage.output_tokens * costs.output;
    const cacheWriteCost = (usage.cache_creation_input_tokens ?? 0) * costs.cacheWrite;
    const cacheReadCost = (usage.cache_read_input_tokens ?? 0) * costs.cacheRead;
    
    const totalCost = inputCost + outputCost + cacheWriteCost + cacheReadCost;

    const metric: UsageMetrics = {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreationTokens: usage.cache_creation_input_tokens ?? undefined,
      cacheReadTokens: usage.cache_read_input_tokens ?? undefined,
      totalCost,
      useCase,
      timestamp: new Date(),
      durationMs,
    };

    this.usageMetrics.push(metric);

    // Log for monitoring
    console.log(`[Claude SDK Usage] ${useCase}:`, {
      tokens: {
        input: usage.input_tokens,
        output: usage.output_tokens,
        cacheRead: usage.cache_read_input_tokens || 0,
        cacheWrite: usage.cache_creation_input_tokens || 0,
      },
      cost: `$${totalCost.toFixed(4)}`,
      duration: `${durationMs}ms`,
      cacheEfficiency: usage.cache_read_input_tokens 
        ? `${((usage.cache_read_input_tokens / usage.input_tokens) * 100).toFixed(1)}%` 
        : '0%',
    });
  }

  /**
   * Get usage statistics
   */
  getUsageStats(since?: Date): UsageStats {
    const relevantMetrics = since 
      ? this.usageMetrics.filter(m => m.timestamp >= since)
      : this.usageMetrics;

    const byUseCase: Record<string, { cost: number; tokens: number; requests: number; avgDurationMs: number; totalDurationMs: number }> = {};
    let totalCost = 0;
    let totalTokens = 0;
    let totalCacheReads = 0;
    let totalInputs = 0;

    for (const metric of relevantMetrics) {
      totalCost += metric.totalCost;
      totalTokens += metric.inputTokens + metric.outputTokens;
      totalCacheReads += metric.cacheReadTokens || 0;
      totalInputs += metric.inputTokens;

      if (!byUseCase[metric.useCase]) {
        byUseCase[metric.useCase] = { cost: 0, tokens: 0, requests: 0, avgDurationMs: 0, totalDurationMs: 0 };
      }
      byUseCase[metric.useCase].cost += metric.totalCost;
      byUseCase[metric.useCase].tokens += metric.inputTokens + metric.outputTokens;
      byUseCase[metric.useCase].requests += 1;
      byUseCase[metric.useCase].totalDurationMs += metric.durationMs;
    }

    // Calculate averages
    for (const useCase in byUseCase) {
      byUseCase[useCase].avgDurationMs = byUseCase[useCase].totalDurationMs / byUseCase[useCase].requests;
    }

    return {
      totalCost,
      totalTokens,
      byUseCase: Object.fromEntries(
        Object.entries(byUseCase).map(([key, val]) => [
          key,
          { cost: val.cost, tokens: val.tokens, requests: val.requests, avgDurationMs: val.avgDurationMs }
        ])
      ),
      cacheEfficiency: totalInputs > 0 ? (totalCacheReads / totalInputs) * 100 : 0,
      totalRequests: relevantMetrics.length,
    };
  }

  /**
   * Get raw usage metrics for detailed analysis
   */
  getRawMetrics(since?: Date): UsageMetrics[] {
    return since 
      ? this.usageMetrics.filter(m => m.timestamp >= since)
      : [...this.usageMetrics];
  }

  /**
   * Reset usage metrics (for testing/new billing period)
   */
  resetUsageMetrics(): void {
    this.usageMetrics = [];
  }

  // ==========================================================================
  // Utility Methods (for compatibility with old client)
  // ==========================================================================

  /**
   * Extract text content from a response
   */
  extractTextFromResponse(response: Anthropic.Message): string {
    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }

  /**
   * Simple text completion helper
   */
  async complete(
    prompt: string,
    options?: {
      model?: string;
      maxTokens?: number;
      system?: string;
      temperature?: number;
      useCase?: string;
    }
  ): Promise<string> {
    const response = await this.createMessage({
      messages: [{ role: 'user', content: prompt }],
      model: options?.model,
      max_tokens: options?.maxTokens,
      system: options?.system,
      temperature: options?.temperature,
      useCase: options?.useCase,
    });

    return this.extractTextFromResponse(response);
  }

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  /**
   * Enhanced error handling
   */
  private handleError(error: unknown): void {
    if (error instanceof Anthropic.APIError) {
      console.error('[Claude SDK Error]', {
        status: error.status,
        message: error.message,
      });

      // Specific error handling
      switch (error.status) {
        case 429:
          console.error('Rate limit exceeded. SDK will retry with exponential backoff.');
          break;
        case 401:
          console.error('Invalid API key. Check ANTHROPIC_API_KEY environment variable.');
          break;
        case 500:
        case 529:
          console.error('Anthropic service error. SDK will retry automatically.');
          break;
      }
    } else {
      console.error('[Claude SDK Unknown Error]', error);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: ClaudeSDKClient | null = null;

/**
 * Get or create the singleton Claude SDK client
 */
export function getClaudeSDKClient(): ClaudeSDKClient {
  if (!clientInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }
    clientInstance = new ClaudeSDKClient({ apiKey });
  }
  return clientInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetClaudeSDKClient(): void {
  clientInstance = null;
}
