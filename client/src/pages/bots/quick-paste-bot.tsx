import { ClipboardPaste, Lock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";

export default function QuickPasteBot() {
  return (
    <AppLayout>
      <PageHeader title="Quick Paste WO" subtitle="Bots" />
      <div className="p-4 lg:p-8 max-w-2xl">
        <Card className="opacity-70" data-testid="card-quick-paste-coming-soon">
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <ClipboardPaste className="h-8 w-8 text-blue-500/40" />
            </div>
            <Badge variant="secondary" className="text-xs px-3 py-1 gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Coming Soon
            </Badge>
            <p className="text-sm text-muted-foreground max-w-sm">
              This bot is being rebuilt with new functionality. Check back soon.
            </p>
            <Link href="/bots">
              <Button variant="outline" size="sm" className="gap-1.5 mt-2" data-testid="button-back-to-bots">
                <ArrowLeft className="h-4 w-4" />
                Back to Bots
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
