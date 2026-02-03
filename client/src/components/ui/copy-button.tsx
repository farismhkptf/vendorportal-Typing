import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  className?: string;
  size?: "sm" | "default" | "icon";
  variant?: "ghost" | "outline" | "default";
  label?: string;
}

export function CopyButton({ 
  value, 
  className, 
  size = "icon", 
  variant = "ghost",
  label = "Copy"
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
          variant={variant}
          size={size}
          className={cn("h-7 w-7", className)}
          onClick={handleCopy}
          data-testid={`button-copy-${value?.slice(0, 10)}`}
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
}

export function CopyableText({ value, className, children }: CopyableTextProps) {
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
          onClick={handleCopy}
          className={cn(
            "inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer",
            className
          )}
          data-testid={`copyable-${value?.slice(0, 10)}`}
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
