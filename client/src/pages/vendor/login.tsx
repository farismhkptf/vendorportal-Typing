import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Eye, EyeOff, Lock, User, Building2, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import dubaiSkyline from "@assets/stock_images/dubai-skyline-login-bg.jpg";
import { CompanyName } from "@/components/ui/company-name";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function VendorLogin() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [vendorBrand, setVendorBrand] = useState<{ vendorName: string; logoUrl: string | null } | null>(null);
  const [brandLookupLoading, setBrandLookupLoading] = useState(false);
  const { toast } = useToast();

  const { data: publicSettings } = useQuery<{ maintenanceMode: boolean; maintenanceMessage: string | null; whatsappNumber: string | null }>({
    queryKey: ["/api/public/settings"],
  });

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

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      return apiRequest("POST", "/api/vendor/auth/login", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/auth/me"] });
      toast({
        title: "Welcome!",
        description: "You have successfully logged in.",
      });
      setLocation("/vendor");
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  async function lookupVendorBrand(email: string) {
    if (!email.trim()) return;
    setBrandLookupLoading(true);
    try {
      const res = await fetch(`/api/public/vendor-lookup?email=${encodeURIComponent(email.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setVendorBrand(data);
      } else {
        setVendorBrand(null);
      }
    } catch {
      setVendorBrand(null);
    } finally {
      setBrandLookupLoading(false);
    }
  }

  const displayName = vendorBrand?.vendorName || "Vendor Portal";
  const displaySubtitle = vendorBrand ? `Vendor Portal · ` : null;

  return (
    <div className="login-fullscreen">
      <img src={dubaiSkyline} alt="" className="login-bg-photo" aria-hidden="true" />
      <div className="login-bg-grain" aria-hidden="true" />
      <div className="login-bg-overlay" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">
        <div className="w-full max-w-[400px]">

          <div className="login-glass-card-v2 rounded-2xl overflow-hidden" data-testid="vendor-login-card">
            <div className="px-8 pt-10 pb-8">

              <div className="flex flex-col items-center mb-8">
                {brandLookupLoading ? (
                  <Loader2 className="h-10 w-10 animate-spin text-white/60 mb-5" />
                ) : vendorBrand?.logoUrl ? (
                  <img
                    src={vendorBrand.logoUrl}
                    alt={displayName}
                    className="h-14 w-14 rounded-2xl object-contain mb-5 opacity-90 shadow-lg"
                    data-testid="img-vendor-logo"
                  />
                ) : (
                  <Building2 className="h-10 w-10 text-white/50 mb-5" />
                )}
                <h1 className="text-[22px] font-bold tracking-tight text-white mb-1.5" data-testid="text-vendor-name">
                  {displayName}
                </h1>
                <p className="text-sm text-white/60">
                  {displaySubtitle ? (
                    <>{displaySubtitle}<CompanyName /></>
                  ) : (
                    <CompanyName />
                  )}
                </p>
              </div>

              {publicSettings?.maintenanceMode && (
                <div className="mb-5 p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 text-center" data-testid="banner-maintenance">
                  <p className="text-sm font-medium text-amber-400">
                    {publicSettings.maintenanceMessage || "System maintenance in progress. Some features may be temporarily unavailable."}
                  </p>
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <div>
                        <label className="text-xs font-medium text-white/70 uppercase tracking-wider">
                          Username
                        </label>
                        <FormControl>
                          <div className="relative mt-1.5">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                            <input
                              {...field}
                              autoComplete="username"
                              placeholder="Enter your username"
                              className="login-glass-input w-full rounded-md pl-10 pr-3 py-2 h-10 border"
                              onBlur={(e) => {
                                field.onBlur();
                                lookupVendorBrand(e.target.value);
                              }}
                              data-testid="input-vendor-username"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400 text-xs mt-1" />
                      </div>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <div>
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
                              data-testid="input-vendor-password"
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white/80 transition-colors"
                              onClick={() => setShowPassword(!showPassword)}
                              data-testid="button-toggle-vendor-password"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-400 text-xs mt-1" />
                        {capsLockOn && (
                          <p className="text-xs text-amber-400 mt-1" data-testid="text-caps-lock-warning">
                            Caps Lock is on
                          </p>
                        )}
                      </div>
                    )}
                  />

                  <div className="mt-6">
                    <button
                      type="submit"
                      className="login-brand-button w-full py-2.5 rounded-md"
                      disabled={loginMutation.isPending}
                      data-testid="button-vendor-login"
                    >
                      {loginMutation.isPending ? "Signing in..." : "Sign in"}
                    </button>
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-white/50 hover:text-white/80 transition-colors"
                      data-testid="button-vendor-forgot-password"
                    >
                      Forgot your password?
                    </button>
                  </div>
                </form>
              </Form>

              <div className="mt-5 text-center">
                <p className="text-xs text-white/50">
                  Internal staff?{" "}
                  <a href="/login" className="text-blue-400 hover:text-blue-300 transition-colors" data-testid="link-staff-login">
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
