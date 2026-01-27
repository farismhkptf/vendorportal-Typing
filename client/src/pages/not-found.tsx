import { Link } from "wouter";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="fixed inset-0 gradient-header opacity-30" />
      
      <Card className="relative z-10 glass-strong border-0 shadow-xl max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="text-6xl font-bold text-primary/20 mb-4">404</div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Page Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button className="gap-2 w-full sm:w-auto" data-testid="button-go-home">
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
