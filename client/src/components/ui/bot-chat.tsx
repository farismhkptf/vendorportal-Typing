import { ReactNode, useEffect, useRef, useState, useCallback } from "react";
import { Send, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "bot" | "user";
  content: string | ReactNode;
  timestamp: Date;
}

interface BotMessageProps {
  children: ReactNode;
}

export function BotMessage({ children }: BotMessageProps) {
  return (
    <div className="flex justify-start" data-testid="bot-message">
      <div className="max-w-[80%] rounded-2xl bg-muted/50 px-4 py-3 text-sm text-foreground">
        <p className="text-xs text-muted-foreground mb-1">Bot</p>
        {children}
      </div>
    </div>
  );
}

interface UserMessageProps {
  children: ReactNode;
}

export function UserMessage({ children }: UserMessageProps) {
  return (
    <div className="flex justify-end" data-testid="user-message">
      <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground">
        <p className="text-xs text-primary-foreground/70 mb-1">You</p>
        {children}
      </div>
    </div>
  );
}

interface ChatContainerProps {
  messages: ChatMessage[];
  children?: ReactNode;
}

export function ChatContainer({ messages, children }: ChatContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, children]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
      data-testid="chat-container"
    >
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.role === "bot" ? (
            <BotMessage>{msg.content}</BotMessage>
          ) : (
            <UserMessage>{msg.content}</UserMessage>
          )}
        </div>
      ))}
      {children}
    </div>
  );
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  placeholder = "Type a message...",
  disabled = false,
  multiline = false,
}: ChatInputProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (value.trim()) {
          onSend();
        }
      }
    },
    [value, onSend]
  );

  if (multiline) {
    return (
      <div className="border-t border-border/50 p-4 bg-background/80 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 min-h-[80px] max-h-[200px] resize-none rounded-xl border border-border/60 bg-background px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            data-testid="chat-input-multiline"
          />
          <Button
            size="icon"
            onClick={onSend}
            disabled={disabled || !value.trim()}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border/50 p-4 bg-background/80 backdrop-blur-sm">
      <div className="flex gap-2 items-center">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1"
          data-testid="chat-input"
        />
        <Button
          size="icon"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          data-testid="button-send-message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface OptionButtonsProps {
  options: { label: string; value: string; variant?: "default" | "outline" | "secondary" | "destructive" | "ghost" }[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export function OptionButtons({ options, onSelect, disabled = false }: OptionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-3" data-testid="option-buttons">
      {options.map((opt) => (
        <Button
          key={opt.value}
          variant={opt.variant || "outline"}
          size="sm"
          onClick={() => onSelect(opt.value)}
          disabled={disabled}
          data-testid={`button-option-${opt.value}`}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

interface CopyBlockProps {
  title: string;
  content: string;
  testId?: string;
}

export function CopyBlock({ title, content, testId }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [content]);

  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 mt-3" data-testid={testId || "copy-block"}>
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border/30">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5"
          data-testid={`button-copy-${testId || "block"}`}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy {title}
            </>
          )}
        </Button>
      </div>
      <pre className="p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground/80 max-h-[300px] overflow-y-auto">
        {content}
      </pre>
    </div>
  );
}
