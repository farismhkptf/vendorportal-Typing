import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail, User, ChevronRight, Loader2 } from "lucide-react";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import proLogo from "@assets/Our_Logo_1771503275390.png";
import { CompanyName } from "@/components/ui/company-name";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

function getRedirectForRole(role: string): string {
  switch (role) {
    case "Admin":
      return "/";
    case "Client Relationship Manager":
      return "/crm";
    case "Medical Assistance Support":
    case "Medical Assistance Support - Temporary Staff":
      return "/medical";
    default:
      return "/";
  }
}

type AccountInfo = { id: string; name: string; email: string; role: string };

function getRoleLabel(role: string): string {
  switch (role) {
    case "Admin": return "Admin";
    case "Client Relationship Manager": return "CRM";
    case "Medical Assistance Support": return "Medical";
    case "Medical Assistance Support - Temporary Staff": return "Medical (Temp)";
    default: return role;
  }
}

function getRoleColor(role: string): string {
  switch (role) {
    case "Admin": return "bg-primary/10 text-primary";
    case "Client Relationship Manager": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "Medical Assistance Support":
    case "Medical Assistance Support - Temporary Staff":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showManualLogin, setShowManualLogin] = useState(false);
  const [quickLoginId, setQuickLoginId] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const { toast } = useToast();
  const { user, isLoading, login, quickLogin } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request submitted", description: "If an account exists, the administrator has been notified." });
      setShowForgotPassword(false);
      setForgotEmail("");
    },
    onError: () => {
      toast({ title: "Request submitted", description: "If an account exists, the administrator has been notified." });
      setShowForgotPassword(false);
      setForgotEmail("");
    },
  });

  const { data: accounts = [] } = useQuery<AccountInfo[]>({
    queryKey: ["/api/auth/accounts"],
    enabled: !user,
  });

  const { data: publicSettings } = useQuery<{ maintenanceMode: boolean; maintenanceMessage: string | null; whatsappNumber: string | null }>({
    queryKey: ["/api/public/settings"],
  });

  const staffAccounts = accounts.filter(
    a => !["Vendor", "Vendor Accountant", "Vendor Manager"].includes(a.role)
  );

  useEffect(() => {
    if (!isLoading && user) {
      setLocation(getRedirectForRole(user.role));
    }
  }, [user, isLoading, setLocation]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleQuickLogin = async (account: AccountInfo) => {
    setQuickLoginId(account.id);
    try {
      const loggedInUser = await quickLogin(account.id);
      toast({
        title: "Welcome back!",
        description: `Signed in as ${loggedInUser.name}`,
      });
      setLocation(getRedirectForRole(loggedInUser.role));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setQuickLoginId(null);
    }
  };

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(data.email, data.password);
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      setLocation(getRedirectForRole(loggedInUser.role));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid email or password";
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 gradient-header opacity-50" />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={proLogo} alt="The P.R.O. Company" className="h-16 w-16 rounded-2xl object-contain mb-4 shadow-lg" data-testid="img-pro-logo" />
          <h1 className="text-2xl font-semibold text-foreground"><CompanyName /></h1>
          <p className="text-sm text-muted-foreground mt-1">Internal Portal</p>
        </div>

        {publicSettings?.maintenanceMode && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center" data-testid="banner-maintenance">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {publicSettings.maintenanceMessage || "System maintenance in progress. Some features may be temporarily unavailable."}
            </p>
          </div>
        )}

        <Card className="glass-strong border-0 shadow-xl" data-testid="login-card">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-semibold">Welcome back</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {showManualLogin ? "Sign in with your credentials" : "Choose your account to continue"}
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            {!showManualLogin ? (
              <div className="space-y-2">
                {staffAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => handleQuickLogin(account)}
                    disabled={quickLoginId !== null}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/60 hover-elevate active-elevate-2 transition-colors text-left disabled:opacity-50"
                    data-testid={`button-quick-login-${account.id}`}
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {quickLoginId === account.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{account.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{account.email}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${getRoleColor(account.role)}`}>
                      {getRoleLabel(account.role)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}

                {staffAccounts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No accounts available
                  </p>
                )}

                <div className="pt-3 border-t border-border/40 mt-3">
                  <button
                    onClick={() => setShowManualLogin(true)}
                    className="w-full text-sm text-muted-foreground hover-elevate transition-colors py-2 rounded-lg"
                    data-testid="button-manual-login"
                  >
                    Sign in with email & password instead
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-muted-foreground">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="email"
                                autoComplete="email"
                                placeholder="you@company.com"
                                className="pl-10 h-12 rounded-xl"
                                data-testid="input-email"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-muted-foreground">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                className="pl-10 pr-10 h-12 rounded-xl"
                                onKeyDown={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                                onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                                data-testid="input-password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                onClick={() => setShowPassword(!showPassword)}
                                data-testid="button-toggle-password"
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                          {capsLockOn && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1" data-testid="text-caps-lock-warning">
                              Caps Lock is on
                            </p>
                          )}
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full h-12 rounded-xl text-base font-medium"
                      disabled={isSubmitting}
                      data-testid="button-login"
                    >
                      {isSubmitting ? "Signing in..." : "Sign in"}
                    </Button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-forgot-password"
                      >
                        Forgot your password?
                      </button>
                    </div>
                  </form>
                </Form>

                <div className="pt-3 border-t border-border/40 mt-4">
                  <button
                    onClick={() => setShowManualLogin(false)}
                    className="w-full text-sm text-muted-foreground hover-elevate transition-colors py-2 rounded-lg"
                    data-testid="button-back-to-accounts"
                  >
                    Back to account list
                  </button>
                </div>
              </>
            )}

            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Vendor access? <a href="/vendor/login" className="text-primary hover:underline" data-testid="link-vendor-login">Sign in here</a>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8 space-y-2">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href={`https://wa.me/${publicSettings?.whatsappNumber?.replace(/[^0-9]/g, '') || '971000000000'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-need-help"
            >
              Need help?
            </a>
            <span className="text-muted-foreground/30">|</span>
            <a
              href="/privacy-policy"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-privacy-policy"
            >
              Privacy Policy
            </a>
            <span className="text-muted-foreground/30">|</span>
            <a
              href="/terms-of-service"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-terms-of-service"
            >
              Terms of Service
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} <CompanyName />. All rights reserved.
          </p>
        </div>
      </div>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forgot Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll notify the administrator to reset your password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email Address</Label>
              <Input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="Enter your email"
                data-testid="input-forgot-email"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForgotPassword(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => forgotPasswordMutation.mutate(forgotEmail)}
                disabled={!forgotEmail || forgotPasswordMutation.isPending}
                data-testid="button-submit-forgot-password"
              >
                {forgotPasswordMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
