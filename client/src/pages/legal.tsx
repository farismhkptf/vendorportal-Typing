import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyName } from "@/components/ui/company-name";
import proLogo from "@assets/Our_Logo_transparent.png";

interface LegalPageProps {
  type: "privacy" | "terms";
}

export default function LegalPage({ type }: LegalPageProps) {
  const [, setLocation] = useLocation();

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ["/api/public/legal", type],
    queryFn: async () => {
      const res = await fetch("/api/public/settings");
      return res.json();
    },
  });

  const title = type === "privacy" ? "Privacy Policy" : "Terms of Service";
  const content = type === "privacy" ? settings?.privacyPolicyHtml : settings?.termsOfServiceHtml;

  return (
    <div className="min-h-screen bg-background p-4" data-testid={`page-${type}`}>
      <div className="max-w-3xl mx-auto py-8">
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <img src={proLogo} alt="Logo" className="h-8 w-8 rounded-lg object-contain" />
            <div>
              <h1 className="text-xl font-semibold text-foreground" data-testid="text-legal-title">{title}</h1>
              <p className="text-sm text-muted-foreground"><CompanyName /></p>
            </div>
          </div>
        </div>

        <Card data-testid="card-legal-content">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : content ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: content }}
                data-testid="text-legal-content"
              />
            ) : (
              <div className="text-center py-12" data-testid="text-legal-empty">
                <p className="text-muted-foreground">
                  This page has not been configured yet. Please contact the administrator.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-8">
          &copy; {new Date().getFullYear()} <CompanyName />. All rights reserved.
        </p>
      </div>
    </div>
  );
}
