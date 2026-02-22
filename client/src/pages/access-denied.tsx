import { Link } from "wouter";
import { ShieldX, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

function getDashboardHref(role?: string): string {
  if (role === "Client Relationship Manager") return "/crm";
  if (role === "Medical Support" || role === "Medical Support - Temporary") return "/medical";
  return "/";
}

export default function AccessDenied() {
  const { user } = useAuth();
  const dashboardHref = getDashboardHref(user?.role);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="access-denied-page">
      <div className="fixed inset-0 gradient-header opacity-30" />

      <Card className="relative z-10 glass-strong border-0 shadow-xl max-w-md w-full">
        <CardContent className="p-4 sm:p-8 text-center">
          <div className="flex justify-center mb-4">
            <ShieldX className="h-16 w-16 text-destructive/40" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2" data-testid="text-access-denied-title">Access Denied</h1>
          <p className="text-muted-foreground mb-8" data-testid="text-access-denied-message">
            You don't have permission to view this page. Contact your administrator if you believe this is an error.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={dashboardHref}>
              <Button className="gap-2 w-full sm:w-auto" data-testid="button-go-dashboard">
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
            <Button
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              onClick={() => window.history.back()}
              data-testid="button-go-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
