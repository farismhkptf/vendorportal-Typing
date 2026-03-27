import { useState } from "react";
import { Send, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface EmailPreviewStepProps {
  emailPreview: string;
}

export function EmailPreviewStep({ emailPreview }: EmailPreviewStepProps) {
  const { toast } = useToast();
  const [messageCopied, setMessageCopied] = useState(false);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(emailPreview);
      setMessageCopied(true);
      toast({ title: "Email copied to clipboard" });
      setTimeout(() => setMessageCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Email Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <pre className="text-sm whitespace-pre-wrap font-mono text-foreground">
            {emailPreview}
          </pre>
        </div>
        
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyEmail}
            className="gap-2"
            data-testid="button-copy-email"
          >
            {messageCopied ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Email
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
