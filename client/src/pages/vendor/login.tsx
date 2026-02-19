import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import vendorLogo from "@assets/Vendor_Logo_1771503175243.jpg";
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-500/10 to-indigo-500/10" />
      
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={vendorLogo} alt="Advanced Solutions" className="h-16 w-16 rounded-2xl object-cover mb-4 shadow-lg" data-testid="img-vendor-logo" />
          <h1 className="text-2xl font-semibold text-foreground">Advanced Solutions</h1>
          <p className="text-sm text-muted-foreground mt-1">Vendor Portal · <CompanyName /></p>
        </div>

        {publicSettings?.maintenanceMode && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center" data-testid="banner-maintenance">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {publicSettings.maintenanceMessage || "System maintenance in progress. Some features may be temporarily unavailable."}
            </p>
          </div>
        )}

        <Card className="glass-strong border-0 shadow-xl" data-testid="vendor-login-card">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-semibold">Vendor Sign In</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Access your assigned typing jobs
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">Username</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            autoComplete="username"
                            placeholder="Enter your username"
                            className="pl-10 h-12 rounded-xl"
                            data-testid="input-vendor-username"
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
                            data-testid="input-vendor-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                            onClick={() => setShowPassword(!showPassword)}
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
                  className="w-full h-12 rounded-xl text-base font-medium bg-gradient-to-r from-violet-600 to-indigo-600"
                  disabled={loginMutation.isPending}
                  data-testid="button-vendor-login"
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign in"}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-vendor-forgot-password"
                  >
                    Forgot your password?
                  </button>
                </div>
              </form>
            </Form>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                Internal staff? <a href="/login" className="text-primary hover:underline">Sign in here</a>
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
