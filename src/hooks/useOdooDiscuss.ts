/**
 * React Hooks for Odoo Discuss Integration
 *
 * Provides hooks for managing Odoo Discuss channels, messages,
 * and real-time subscriptions.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  odooChannelsQueryOptions,
  odooChannelQueryOptions,
  odooMessagesQueryOptions,
  odooTotalUnreadCountQueryOptions,
  odooSubscriptionStatusQueryOptions,
  odooConnectionStatusQueryOptions,
} from "~/queries/odoo-discuss";
import {
  syncOdooChannelsFn,
  syncOdooMessagesFn,
  postOdooMessageFn,
  markOdooChannelAsReadFn,
  joinOdooChannelFn,
  leaveOdooChannelFn,
  startOdooPollingFn,
  stopOdooPollingFn,
  pollOdooNotificationsFn,
  sendOdooTypingIndicatorFn,
} from "~/fn/odoo-discuss";
import { getErrorMessage } from "~/utils/error";

// =============================================================================
// Channel Hooks
// =============================================================================

/**
 * Hook to get all channels
 */
export function useOdooChannels(options?: { limit?: number; offset?: number }) {
  return useQuery(odooChannelsQueryOptions(options));
}

/**
 * Hook to get a specific channel
 */
export function useOdooChannel(channelId: string) {
  return useQuery(odooChannelQueryOptions(channelId));
}

/**
 * Hook to sync channels from Odoo
 */
export function useSyncOdooChannels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => syncOdooChannelsFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "channels"],
      });
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "unread-count"],
      });
      toast.success("Channels synced successfully");
    },
    onError: (error) => {
      toast.error("Failed to sync channels", {
        description: getErrorMessage(error),
      });
    },
  });
}

/**
 * Hook to join a channel
 */
export function useJoinOdooChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (odooChannelId: number) =>
      joinOdooChannelFn({ data: { odooChannelId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "channels"],
      });
      toast.success("Joined channel successfully");
    },
    onError: (error) => {
      toast.error("Failed to join channel", {
        description: getErrorMessage(error),
      });
    },
  });
}

/**
 * Hook to leave a channel
 */
export function useLeaveOdooChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) =>
      leaveOdooChannelFn({ data: { channelId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "channels"],
      });
      toast.success("Left channel successfully");
    },
    onError: (error) => {
      toast.error("Failed to leave channel", {
        description: getErrorMessage(error),
      });
    },
  });
}

// =============================================================================
// Message Hooks
// =============================================================================

/**
 * Hook to get messages for a channel
 */
export function useOdooMessages(
  channelId: string,
  options?: { limit?: number; offset?: number }
) {
  return useQuery({
    ...odooMessagesQueryOptions(channelId, options),
    enabled: !!channelId,
  });
}

/**
 * Hook to sync messages from Odoo
 */
export function useSyncOdooMessages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channelId, limit }: { channelId: string; limit?: number }) =>
      syncOdooMessagesFn({ data: { channelId, limit } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "messages", variables.channelId],
      });
    },
    onError: (error) => {
      toast.error("Failed to sync messages", {
        description: getErrorMessage(error),
      });
    },
  });
}

/**
 * Hook to post a new message
 */
export function usePostOdooMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channelId, content }: { channelId: string; content: string }) =>
      postOdooMessageFn({ data: { channelId, content } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "messages", variables.channelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "channels"],
      });
    },
    onError: (error) => {
      toast.error("Failed to send message", {
        description: getErrorMessage(error),
      });
    },
  });
}

/**
 * Hook to mark a channel as read
 */
export function useMarkOdooChannelAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channelId: string) =>
      markOdooChannelAsReadFn({ data: { channelId } }),
    onSuccess: (_, channelId) => {
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "channel", channelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "channels"],
      });
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "unread-count"],
      });
    },
  });
}

// =============================================================================
// Unread Count Hooks
// =============================================================================

/**
 * Hook to get total unread count
 */
export function useOdooTotalUnreadCount() {
  return useQuery(odooTotalUnreadCountQueryOptions());
}

// =============================================================================
// Connection Status Hooks
// =============================================================================

/**
 * Hook to check Odoo connection status
 */
export function useOdooConnectionStatus() {
  return useQuery(odooConnectionStatusQueryOptions());
}

// =============================================================================
// Real-Time Polling Hooks
// =============================================================================

/**
 * Hook to get subscription status
 */
export function useOdooSubscriptionStatus() {
  return useQuery(odooSubscriptionStatusQueryOptions());
}

/**
 * Hook to start real-time polling
 */
export function useStartOdooPolling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pollingInterval?: number) =>
      startOdooPollingFn({ data: pollingInterval ? { pollingInterval } : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "subscription-status"],
      });
    },
    onError: (error) => {
      toast.error("Failed to start real-time updates", {
        description: getErrorMessage(error),
      });
    },
  });
}

/**
 * Hook to stop real-time polling
 */
export function useStopOdooPolling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => stopOdooPollingFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "subscription-status"],
      });
    },
  });
}

/**
 * Hook for managing real-time polling with automatic reconnection
 */
export function useOdooRealtimePolling(options?: {
  enabled?: boolean;
  pollingInterval?: number;
  onNotification?: (notifications: unknown[]) => void;
}) {
  const { enabled = true, pollingInterval = 5000, onNotification } = options || {};
  const queryClient = useQueryClient();
  const isPollingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const poll = useCallback(async () => {
    if (!isPollingRef.current) return;

    try {
      const result = await pollOdooNotificationsFn({});

      if (result.notifications && result.notifications.length > 0) {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({
          queryKey: ["odoo-discuss"],
        });

        // Call notification handler
        onNotification?.(result.notifications);
      }

      if (result.shouldContinue && isPollingRef.current) {
        timeoutRef.current = setTimeout(poll, pollingInterval);
      }
    } catch {
      // Retry after a longer delay on error
      if (isPollingRef.current) {
        timeoutRef.current = setTimeout(poll, pollingInterval * 2);
      }
    }
  }, [queryClient, onNotification, pollingInterval]);

  useEffect(() => {
    if (enabled) {
      isPollingRef.current = true;

      // Start polling
      startOdooPollingFn({ data: { pollingInterval } })
        .then(() => poll())
        .catch(console.error);

      return () => {
        isPollingRef.current = false;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        stopOdooPollingFn({}).catch(console.error);
      };
    }
  }, [enabled, pollingInterval, poll]);

  return {
    isPolling: isPollingRef.current,
  };
}

// =============================================================================
// Typing Indicator Hooks
// =============================================================================

/**
 * Hook to send typing indicator
 */
export function useSendOdooTypingIndicator() {
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  return useMutation({
    mutationFn: ({ channelId, isTyping }: { channelId: string; isTyping: boolean }) => {
      // Clear any pending stop-typing timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // If typing, set a timeout to automatically stop
      if (isTyping) {
        debounceRef.current = setTimeout(() => {
          sendOdooTypingIndicatorFn({ data: { channelId, isTyping: false } });
        }, 5000);
      }

      return sendOdooTypingIndicatorFn({ data: { channelId, isTyping } });
    },
  });
}

// =============================================================================
// Combined Hook for Channel View
// =============================================================================

/**
 * Combined hook for a complete channel view experience
 */
export function useOdooChannelView(channelId: string) {
  const queryClient = useQueryClient();

  const channelQuery = useOdooChannel(channelId);
  const messagesQuery = useOdooMessages(channelId);
  const postMessage = usePostOdooMessage();
  const markAsRead = useMarkOdooChannelAsRead();
  const syncMessages = useSyncOdooMessages();
  const typingIndicator = useSendOdooTypingIndicator();

  // Mark as read when entering channel
  useEffect(() => {
    if (channelId && (channelQuery.data?.channel?.unreadCount ?? 0) > 0) {
      markAsRead.mutate(channelId);
    }
  }, [channelId, channelQuery.data?.channel?.unreadCount]);

  const sendMessage = useCallback(
    async (content: string) => {
      await postMessage.mutateAsync({ channelId, content });
    },
    [channelId, postMessage]
  );

  const refreshMessages = useCallback(async () => {
    await syncMessages.mutateAsync({ channelId });
  }, [channelId, syncMessages]);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      typingIndicator.mutate({ channelId, isTyping });
    },
    [channelId, typingIndicator]
  );

  return {
    channel: channelQuery.data?.channel,
    messages: messagesQuery.data?.messages || [],
    totalMessages: messagesQuery.data?.totalCount || 0,
    hasMore: messagesQuery.data?.hasMore || false,
    isLoading: channelQuery.isLoading || messagesQuery.isLoading,
    isError: channelQuery.isError || messagesQuery.isError,
    error: channelQuery.error || messagesQuery.error,
    isSending: postMessage.isPending,
    sendMessage,
    refreshMessages,
    setTyping,
    refetch: () => {
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "channel", channelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["odoo-discuss", "messages", channelId],
      });
    },
  };
}
