/**
 * Odoo Discuss View Component
 *
 * Complete view for Odoo Discuss integration showing
 * channels list and message view.
 */

import { useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { OdooChannelList } from "./OdooChannelList";
import { OdooMessageList } from "./OdooMessageList";
import { OdooMessageInput } from "./OdooMessageInput";
import {
  useOdooChannelView,
  useOdooRealtimePolling,
} from "~/hooks/useOdooDiscuss";
import type { OdooChannel } from "~/db/schema";

interface OdooDiscussViewProps {
  enableRealtime?: boolean;
  pollingInterval?: number;
}

export function OdooDiscussView({
  enableRealtime = true,
  pollingInterval = 5000,
}: OdooDiscussViewProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Selected channel view
  const channelView = useOdooChannelView(selectedChannelId || "");

  // Real-time polling
  useOdooRealtimePolling({
    enabled: enableRealtime,
    pollingInterval,
  });

  const handleChannelSelect = (channel: OdooChannel) => {
    setSelectedChannelId(channel.id);
  };

  return (
    <div className="flex h-full" data-testid="odoo-discuss-view">
      {/* Channels Sidebar */}
      <div className="w-80 border-r flex flex-col">
        <OdooChannelList
          selectedChannelId={selectedChannelId || undefined}
          onSelectChannel={handleChannelSelect}
        />
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannelId ? (
          <>
            {/* Channel Header */}
            <div className="h-14 border-b flex items-center px-4">
              <MessageSquare className="h-5 w-5 mr-2 text-muted-foreground" />
              <h2 className="font-semibold" data-testid="channel-name">
                {channelView.channel?.name || "Channel"}
              </h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <OdooMessageList
                messages={channelView.messages}
                isLoading={channelView.isLoading}
                hasMore={channelView.hasMore}
                onRefresh={channelView.refreshMessages}
                isRefreshing={false}
              />
            </div>

            {/* Message Input */}
            <OdooMessageInput
              onSend={channelView.sendMessage}
              onTyping={channelView.setTyping}
              isSending={channelView.isSending}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a channel to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OdooDiscussView;
