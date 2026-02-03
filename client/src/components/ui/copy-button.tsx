import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  className?: string;
  variant?: "ghost" | "outline" | "default";
  label?: string;
  testId?: string;
}

export function CopyButton({ 
  value, 
  className, 
  variant = "ghost",
  label = "Copy",
  testId,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [value]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="icon"
          className={cn(className)}
          onClick={handleCopy}
          data-testid={testId || `button-copy-${value?.slice(0, 10)}`}
          aria-label={copied ? "Copied" : label}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{copied ? "Copied!" : label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface CopyableTextProps {
  value: string;
  className?: string;
  children?: React.ReactNode;
  testId?: string;
}

export function CopyableText({ value, className, children, testId }: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [value]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer",
            className
          )}
          data-testid={testId || `copyable-${value?.slice(0, 10)}`}
          aria-label={`Copy ${value} to clipboard`}
        >
          {children || value}
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 opacity-50" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{copied ? "Copied!" : "Click to copy"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
