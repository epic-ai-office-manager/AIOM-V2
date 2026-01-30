/**
 * Odoo Message Input Component
 *
 * Text input for composing and sending messages to an Odoo Discuss channel.
 */

import { useState, useRef, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

interface OdooMessageInputProps {
  onSend: (content: string) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  isSending?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function OdooMessageInput({
  onSend,
  onTyping,
  isSending,
  disabled,
  placeholder = "Type a message...",
}: OdooMessageInputProps) {
  const [content, setContent] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wasTypingRef = useRef(false);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value);

      // Handle typing indicator
      if (onTyping) {
        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Send typing start if not already typing
        if (!wasTypingRef.current && e.target.value.length > 0) {
          wasTypingRef.current = true;
          onTyping(true);
        }

        // Set timeout to stop typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          if (wasTypingRef.current) {
            wasTypingRef.current = false;
            onTyping(false);
          }
        }, 2000);
      }
    },
    [onTyping]
  );

  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isSending) return;

    // Clear typing indicator
    if (onTyping && wasTypingRef.current) {
      wasTypingRef.current = false;
      onTyping(false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      await onSend(trimmedContent);
      setContent("");
    } catch {
      // Error handled by parent
    }
  }, [content, isSending, onSend, onTyping]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Send on Enter (without Shift)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const isDisabled = disabled || isSending;
  const canSend = content.trim().length > 0 && !isDisabled;

  return (
    <div className="flex gap-2 p-4 border-t">
      <Textarea
        value={content}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isDisabled}
        className="min-h-[44px] max-h-[120px] resize-none"
        rows={1}
      />
      <Button
        onClick={handleSend}
        disabled={!canSend}
        size="icon"
        className="shrink-0"
      >
        {isSending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

export default OdooMessageInput;
