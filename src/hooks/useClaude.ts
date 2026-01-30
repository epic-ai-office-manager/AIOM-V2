/**
 * Claude API React Hooks
 * Custom hooks for interacting with Claude API
 */

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { claudeModelsQueryOptions, claudeConfigQueryOptions } from "~/queries/claude";
import {
  sendClaudeMessageFn,
  sendClaudeMessageWithToolsFn,
  completeWithClaudeFn,
  type SendClaudeMessageResult,
  type SendClaudeMessageWithToolsResult,
  type CompleteWithClaudeResult,
} from "~/fn/claude";
import type {
  Message,
  Tool,
  ToolChoice,
  ClaudeModel,
  ContentBlock,
  CacheStats,
} from "~/lib/claude";

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to get available Claude models
 */
export function useClaudeModels() {
  return useQuery(claudeModelsQueryOptions());
}

/**
 * Hook to check Claude configuration status
 */
export function useClaudeConfig() {
  return useQuery(claudeConfigQueryOptions());
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for sending messages to Claude
 */
export function useSendClaudeMessage() {
  return useMutation<
    SendClaudeMessageResult,
    Error,
    {
      messages: Message[];
      model?: ClaudeModel;
      maxTokens?: number;
      system?: string;
      temperature?: number;
      enableCaching?: boolean;
    }
  >({
    mutationFn: (data) => sendClaudeMessageFn({ data }),
  });
}

/**
 * Hook for sending messages to Claude with tools
 */
export function useSendClaudeMessageWithTools() {
  return useMutation<
    SendClaudeMessageWithToolsResult,
    Error,
    {
      messages: Message[];
      tools: Tool[];
      toolChoice?: ToolChoice;
      model?: ClaudeModel;
      maxTokens?: number;
      system?: string;
      temperature?: number;
    }
  >({
    mutationFn: (data) => sendClaudeMessageWithToolsFn({ data }),
  });
}

/**
 * Hook for simple text completion
 */
export function useCompleteWithClaude() {
  return useMutation<
    CompleteWithClaudeResult,
    Error,
    {
      prompt: string;
      model?: ClaudeModel;
      maxTokens?: number;
      system?: string;
      temperature?: number;
    }
  >({
    mutationFn: (data) => completeWithClaudeFn({ data }),
  });
}

// ============================================================================
// Conversation Hook
// ============================================================================

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string | ContentBlock[];
  createdAt: Date;
  isStreaming?: boolean;
}

export interface UseClaudeConversationOptions {
  model?: ClaudeModel;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  enableCaching?: boolean;
  onError?: (error: string) => void;
  onCacheStats?: (stats: CacheStats) => void;
}

export interface UseClaudeConversationReturn {
  messages: ConversationMessage[];
  isLoading: boolean;
  error: string | null;
  cacheStats: CacheStats | null;
  sendMessage: (content: string) => Promise<void>;
  clearConversation: () => void;
  regenerateLastResponse: () => Promise<void>;
}

/**
 * Hook for managing a conversation with Claude
 */
export function useClaudeConversation(
  options: UseClaudeConversationOptions = {}
): UseClaudeConversationReturn {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const messageIdCounter = useRef(0);

  const sendClaudeMutation = useSendClaudeMessage();

  const generateMessageId = useCallback(() => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      setError(null);
      setIsLoading(true);

      // Add user message
      const userMessage: ConversationMessage = {
        id: generateMessageId(),
        role: "user",
        content,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Prepare messages for API
      const apiMessages: Message[] = [
        ...messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content },
      ];

      try {
        const result = await sendClaudeMutation.mutateAsync({
          messages: apiMessages,
          model: options.model,
          system: options.system,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
          enableCaching: options.enableCaching,
        });

        if (result.success) {
          // Add assistant message
          const assistantMessage: ConversationMessage = {
            id: generateMessageId(),
            role: "assistant",
            content: result.response.content,
            createdAt: new Date(),
          };

          setMessages((prev) => [...prev, assistantMessage]);

          // Update cache stats
          if (result.cacheStats) {
            setCacheStats(result.cacheStats);
            options.onCacheStats?.(result.cacheStats);
          }
        } else {
          setError(result.error);
          options.onError?.(result.error);
          // Remove the user message on error
          setMessages((prev) => prev.slice(0, -1));
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to send message";
        setError(errorMessage);
        options.onError?.(errorMessage);
        // Remove the user message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options, sendClaudeMutation, generateMessageId]
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    setCacheStats(null);
  }, []);

  const regenerateLastResponse = useCallback(async () => {
    if (messages.length < 2) return;

    // Remove last assistant message
    const lastUserMessageIndex = messages
      .map((m, i) => ({ role: m.role, index: i }))
      .filter((m) => m.role === "user")
      .pop()?.index;

    if (lastUserMessageIndex === undefined) return;

    const userMessage = messages[lastUserMessageIndex];
    const messagesBeforeLastExchange = messages.slice(0, lastUserMessageIndex);

    setMessages(messagesBeforeLastExchange);

    // Get the content as string
    const content = typeof userMessage.content === "string"
      ? userMessage.content
      : userMessage.content
          .filter((block): block is { type: "text"; text: string } => block.type === "text")
          .map((block) => block.text)
          .join("");

    await sendMessage(content);
  }, [messages, sendMessage]);

  return {
    messages,
    isLoading,
    error,
    cacheStats,
    sendMessage,
    clearConversation,
    regenerateLastResponse,
  };
}

// ============================================================================
// Tool Use Hook
// ============================================================================

export interface UseClaudeWithToolsOptions {
  tools: Tool[];
  toolHandlers: Record<string, (input: Record<string, unknown>) => Promise<unknown>>;
  model?: ClaudeModel;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  onToolCall?: (toolName: string, input: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, result: unknown) => void;
  onError?: (error: string) => void;
}

export interface UseClaudeWithToolsReturn {
  messages: ConversationMessage[];
  isLoading: boolean;
  error: string | null;
  toolCalls: Array<{ name: string; input: Record<string, unknown>; result?: unknown }>;
  sendMessage: (content: string) => Promise<void>;
  clearConversation: () => void;
}

/**
 * Hook for managing a conversation with Claude that uses tools
 */
export function useClaudeWithTools(
  options: UseClaudeWithToolsOptions
): UseClaudeWithToolsReturn {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<
    Array<{ name: string; input: Record<string, unknown>; result?: unknown }>
  >([]);
  const messageIdCounter = useRef(0);

  const sendClaudeMutation = useSendClaudeMessageWithTools();

  const generateMessageId = useCallback(() => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      setError(null);
      setIsLoading(true);

      // Add user message
      const userMessage: ConversationMessage = {
        id: generateMessageId(),
        role: "user",
        content,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Prepare messages for API
      let apiMessages: Message[] = [
        ...messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content },
      ];

      try {
        // Loop for tool use
        let continueLoop = true;
        while (continueLoop) {
          const result = await sendClaudeMutation.mutateAsync({
            messages: apiMessages,
            tools: options.tools,
            toolChoice: { type: "auto" },
            model: options.model,
            system: options.system,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
          });

          if (!result.success) {
            setError(result.error || "Failed to get response");
            options.onError?.(result.error || "Failed to get response");
            break;
          }

          if (!result.response) break;

          // Check for tool use
          const toolUseBlocks = result.response.content.filter(
            (block): block is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
              block.type === "tool_use"
          );

          if (toolUseBlocks.length === 0) {
            // No tool calls, add final response
            const assistantMessage: ConversationMessage = {
              id: generateMessageId(),
              role: "assistant",
              content: result.response.content,
              createdAt: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
            continueLoop = false;
          } else {
            // Process tool calls
            const toolResults: ContentBlock[] = [];
            for (const toolUse of toolUseBlocks) {
              options.onToolCall?.(toolUse.name, toolUse.input);

              const handler = options.toolHandlers[toolUse.name];
              if (!handler) {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: `Unknown tool: ${toolUse.name}`,
                  is_error: true,
                });
                continue;
              }

              try {
                const toolResult = await handler(toolUse.input);
                options.onToolResult?.(toolUse.name, toolResult);

                setToolCalls((prev) => [
                  ...prev,
                  { name: toolUse.name, input: toolUse.input, result: toolResult },
                ]);

                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
                });
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : "Tool execution failed";
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: errorMsg,
                  is_error: true,
                });
              }
            }

            // Add assistant response and tool results to messages
            apiMessages = [
              ...apiMessages,
              { role: "assistant" as const, content: result.response.content },
              { role: "user" as const, content: toolResults },
            ];
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to send message";
        setError(errorMessage);
        options.onError?.(errorMessage);
        // Remove the user message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options, sendClaudeMutation, generateMessageId]
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    setToolCalls([]);
  }, []);

  return {
    messages,
    isLoading,
    error,
    toolCalls,
    sendMessage,
    clearConversation,
  };
}
