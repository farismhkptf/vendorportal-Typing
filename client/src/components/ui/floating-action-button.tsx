import { Link } from "wouter";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  href: string;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  testId?: string;
}

export function FloatingActionButton({
  href,
  label = "Add New",
  icon,
  className,
  testId = "fab-primary-action",
}: FloatingActionButtonProps) {
  return (
    <div className={cn("fixed bottom-6 right-6 z-50 md:hidden", className)}>
      <Link href={href}>
        <Button
          size="icon"
          className="rounded-full shadow-lg"
          data-testid={testId}
          aria-label={label}
        >
          {icon || <Plus className="h-5 w-5" />}
        </Button>
      </Link>
    </div>
  );
}
