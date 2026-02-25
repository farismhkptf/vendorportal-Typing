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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
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
    case "Medical Support":
    case "Medical Support - Temporary":
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
    case "Medical Support": return "Medical";
    case "Medical Support - Temporary": return "Medical (Temp)";
    default: return role;
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
      <div className="login-fullscreen">
        <div className="login-bg-gradient" aria-hidden="true" />
        <div className="login-bg-grain" aria-hidden="true" />
        <div className="login-bg-overlay" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="animate-spin h-8 w-8 border-4 border-white/40 border-t-white rounded-full" />
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="login-fullscreen">
      <div className="login-bg-gradient" aria-hidden="true" />
      <div className="login-bg-grain" aria-hidden="true" />
      <div className="login-bg-overlay" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">
        <div className="w-full max-w-[400px]">

          <div className="login-glass-card-v2 rounded-2xl overflow-hidden" data-testid="login-card">
            <div className="px-8 pt-10 pb-8">

              <div className="flex flex-col items-center mb-8">
                <img
                  src={proLogo}
                  alt="The P.R.O. Company"
                  className="h-14 w-14 rounded-2xl object-contain opacity-90 mb-5 shadow-lg"
                  data-testid="img-pro-logo"
                />
                <h1 className="text-[22px] font-bold tracking-tight text-white mb-1.5">
                  <CompanyName />
                </h1>
                <p className="text-sm text-white/60">Internal Portal</p>
              </div>

              {publicSettings?.maintenanceMode && (
                <div className="mb-5 p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 text-center" data-testid="banner-maintenance">
                  <p className="text-sm font-medium text-amber-400">
                    {publicSettings.maintenanceMessage || "System maintenance in progress. Some features may be temporarily unavailable."}
                  </p>
                </div>
              )}

              {!showManualLogin ? (
                <div className="space-y-2">
                  {staffAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleQuickLogin(account)}
                      disabled={quickLoginId !== null}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-left disabled:opacity-50"
                      data-testid={`button-quick-login-${account.id}`}
                    >
                      <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        {quickLoginId === account.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                        ) : (
                          <User className="h-4 w-4 text-white/60" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{account.name}</p>
                        <p className="text-xs text-white/50 truncate">{account.email}</p>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 bg-white/10 text-white/70">
                        {getRoleLabel(account.role)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/40 shrink-0" />
                    </button>
                  ))}

                  {staffAccounts.length === 0 && (
                    <p className="text-sm text-white/50 text-center py-4">
                      No accounts available
                    </p>
                  )}

                  <div className="pt-3 border-t border-white/10 mt-3">
                    <button
                      onClick={() => setShowManualLogin(true)}
                      className="w-full text-sm text-white/50 hover:text-white/80 transition-colors py-2 rounded-lg"
                      data-testid="button-manual-login"
                    >
                      Sign in with email &amp; password instead
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
                            <label className="text-xs font-medium text-white/70 uppercase tracking-wider">
                              Email
                            </label>
                            <FormControl>
                              <div className="relative mt-1.5">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                                <input
                                  {...field}
                                  type="email"
                                  autoComplete="email"
                                  placeholder="you@company.com"
                                  className="login-glass-input w-full rounded-md pl-10 pr-3 py-2 h-10 border"
                                  data-testid="input-email"
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <label className="text-xs font-medium text-white/70 uppercase tracking-wider">
                              Password
                            </label>
                            <FormControl>
                              <div className="relative mt-1.5">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                                <input
                                  {...field}
                                  type={showPassword ? "text" : "password"}
                                  autoComplete="current-password"
                                  placeholder="Enter your password"
                                  className="login-glass-input w-full rounded-md pl-10 pr-10 py-2 h-10 border"
                                  onKeyDown={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                                  onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                                  data-testid="input-password"
                                />
                                <button
                                  type="button"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white/80 transition-colors"
                                  onClick={() => setShowPassword(!showPassword)}
                                  data-testid="button-toggle-password"
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage className="text-red-400" />
                            {capsLockOn && (
                              <p className="text-xs text-amber-400 mt-1" data-testid="text-caps-lock-warning">
                                Caps Lock is on
                              </p>
                            )}
                          </FormItem>
                        )}
                      />

                      <div className="mt-6">
                        <button
                          type="submit"
                          className="login-brand-button w-full py-2.5 rounded-md"
                          disabled={isSubmitting}
                          data-testid="button-login"
                        >
                          {isSubmitting ? "Signing in..." : "Sign in"}
                        </button>
                      </div>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="text-sm text-white/50 hover:text-white/80 transition-colors"
                          data-testid="button-forgot-password"
                        >
                          Forgot your password?
                        </button>
                      </div>
                    </form>
                  </Form>

                  <div className="pt-3 border-t border-white/10 mt-4">
                    <button
                      onClick={() => setShowManualLogin(false)}
                      className="w-full text-sm text-white/50 hover:text-white/80 transition-colors py-2 rounded-lg"
                      data-testid="button-back-to-accounts"
                    >
                      Back to account list
                    </button>
                  </div>
                </>
              )}

              <div className="mt-5 text-center">
                <p className="text-xs text-white/50">
                  Vendor access?{" "}
                  <a href="/vendor/login" className="text-blue-400 hover:text-blue-300 transition-colors" data-testid="link-vendor-login">
                    Sign in here
                  </a>
                </p>
              </div>

            </div>
          </div>

          <div className="text-center mt-6 space-y-2">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <a
                href={`https://wa.me/${publicSettings?.whatsappNumber?.replace(/[^0-9]/g, '') || '971000000000'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
                data-testid="link-need-help"
              >
                Need help?
              </a>
              <span className="text-white/20">|</span>
              <a
                href="/privacy-policy"
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
                data-testid="link-privacy-policy"
              >
                Privacy Policy
              </a>
              <span className="text-white/20">|</span>
              <a
                href="/terms-of-service"
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
                data-testid="link-terms-of-service"
              >
                Terms of Service
              </a>
            </div>
            <p className="text-xs text-white/30">
              &copy; {new Date().getFullYear()} <CompanyName />. All rights reserved.
            </p>
          </div>

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
