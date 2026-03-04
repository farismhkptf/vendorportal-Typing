import { Component, type ErrorInfo, type ReactNode } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageTransition } from "@/components/ui/page-transition";
import NotFound from "@/pages/not-found";
import AccessDenied from "@/pages/access-denied";
import { CommandPalette } from "@/components/command-palette";
import { MobileBottomNav } from "@/components/mobile-nav";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { VendorAuthProvider, useVendorAuth } from "@/hooks/use-vendor-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import proLogo from "@assets/Our_Logo_transparent.png";
import { CompanyName } from "@/components/ui/company-name";
import { useSplash } from "@/contexts/splash-context";
import SplashScreen from "@/components/splash-screen";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center max-w-md px-6">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h1>
            <p className="text-sm text-muted-foreground mb-6">
              An unexpected error occurred. Please reload the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="button-reload"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import Dashboard from "@/pages/dashboard";
import CrmDashboard from "@/pages/crm-dashboard";
import MedicalDashboard from "@/pages/medical-dashboard";
import Login from "@/pages/login";
import WorkOrdersList from "@/pages/work-orders/index";
import NewWorkOrder from "@/pages/work-orders/new";
import WorkOrderDetail from "@/pages/work-orders/detail";
import CompaniesList from "@/pages/companies/index";
import NewCompany from "@/pages/companies/new";
import CompanyDetail from "@/pages/companies/detail";
import TypingJobsList from "@/pages/typing-jobs/index";
import NewTypingJob from "@/pages/typing-jobs/new";
import TypingJobDetail from "@/pages/typing-jobs/detail";
import VendorWallet from "@/pages/vendor-wallet";
import AdminPage from "@/pages/admin/index";
import { SidebarProvider } from "@/components/ui/sidebar";
import { VendorSidebar, VendorTopBar } from "@/components/vendor-sidebar";
import VendorLogin from "@/pages/vendor/login";
import VendorDashboard from "@/pages/vendor/dashboard";
import VendorEidJobs from "@/pages/vendor/eid-jobs";
import VendorMedicalJobs from "@/pages/vendor/medical-jobs";
import VendorJobDetail from "@/pages/vendor/job-detail";
import VendorWalletPage from "@/pages/vendor/wallet";
import AppointmentsIndex from "@/pages/appointments/index";
import ScheduleMedical from "@/pages/appointments/schedule-medical";
import ScheduleEid from "@/pages/appointments/schedule-eid";
import BotsHub from "@/pages/bots/index";
import QuickPasteBot from "@/pages/bots/quick-paste-bot";
import SchedulerBot from "@/pages/bots/scheduler-bot";
import ManagerConsole from "@/pages/manager-console";
import ReportsPage from "@/pages/reports";
import LegalPage from "@/pages/legal";

function BrandedSplash({ variant = "team" }: { variant?: "team" | "vendor" }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6" data-testid="splash-screen">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-primary/10 scale-[2.5] blur-2xl animate-pulse" />
        <div className="relative h-16 w-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center shadow-lg splash-logo-enter">
          <img
            src={proLogo}
            alt="The P.R.O. Company"
            className="h-10 w-10 object-contain"
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 splash-text-enter">
        <p className="text-sm font-medium text-foreground tracking-tight">
          {variant === "vendor" ? "Vendor Portal" : <CompanyName />}
        </p>
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">Loading</span>
          <div className="h-1 w-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.3s" }} />
        </div>
      </div>
    </div>
  );
}

const OPS_ROLES = ["Admin", "Client Relationship Manager"];

const ROUTE_ACCESS: Array<{ path: string; exact?: boolean; roles: string[] }> = [
  { path: "/work-orders", roles: OPS_ROLES },
  { path: "/companies", roles: OPS_ROLES },
  { path: "/typing-jobs", roles: OPS_ROLES },
  { path: "/vendor-wallet", roles: OPS_ROLES },
  { path: "/reports", roles: OPS_ROLES },
  { path: "/admin", roles: ["Admin"] },
  { path: "/manager-console", roles: OPS_ROLES },
  { path: "/bots", roles: ["Admin"] },
];

function getRouteRoles(location: string): string[] | null {
  for (const rule of ROUTE_ACCESS) {
    if (rule.exact ? location === rule.path : location.startsWith(rule.path)) {
      return rule.roles;
    }
  }
  return null;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <BrandedSplash variant="team" />;
  }

  const isPublicPath =
    location === "/login" ||
    location === "/privacy-policy" ||
    location === "/terms-of-service" ||
    location === "/vendor" ||
    location.startsWith("/vendor/") ||
    location.startsWith("/reschedule/");

  if (!user && !isPublicPath) {
    return <Redirect to="/login" />;
  }

  if (user) {
    const allowedRoles = getRouteRoles(location);
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <AccessDenied />;
    }
  }

  return <>{children}</>;
}

function VendorAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useVendorAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <BrandedSplash variant="vendor" />;
  }

  if (!user) {
    return <Redirect to="/vendor/login" />;
  }

  return <>{children}</>;
}

function VendorLayout() {
  return (
    <VendorAuthProvider>
      <VendorAuthGuard>
        <SidebarProvider>
          <div className="flex h-screen w-full">
            <VendorSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <VendorTopBar />
              <main className="flex-1 overflow-y-auto">
                <PageTransition>
                  <Switch>
                    <Route path="/" component={VendorDashboard} />
                    <Route path="/dashboard">{() => <Redirect to="/vendor" />}</Route>
                    <Route path="/eid" component={VendorEidJobs} />
                    <Route path="/eid/:id" component={VendorJobDetail} />
                    <Route path="/medical" component={VendorMedicalJobs} />
                    <Route path="/medical/:id" component={VendorJobDetail} />
                    <Route path="/wallet" component={VendorWalletPage} />
                    <Route component={NotFound} />
                  </Switch>
                </PageTransition>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </VendorAuthGuard>
    </VendorAuthProvider>
  );
}

function Router() {
  return (
    <AuthGuard>
      <PageTransition>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/login" component={Login} />
          <Route path="/privacy-policy">{() => <LegalPage type="privacy" />}</Route>
          <Route path="/terms-of-service">{() => <LegalPage type="terms" />}</Route>
          <Route path="/crm" component={CrmDashboard} />
          <Route path="/medical" component={MedicalDashboard} />
          <Route path="/work-orders" component={WorkOrdersList} />
          <Route path="/work-orders/new" component={NewWorkOrder} />
          <Route path="/work-orders/:id" component={WorkOrderDetail} />
          <Route path="/companies" component={CompaniesList} />
          <Route path="/companies/new" component={NewCompany} />
          <Route path="/companies/:id" component={CompanyDetail} />
          <Route path="/typing-jobs" component={TypingJobsList} />
          <Route path="/typing-jobs/new" component={NewTypingJob} />
          <Route path="/typing-jobs/:id" component={TypingJobDetail} />
          <Route path="/vendor-wallet" component={VendorWallet} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/manager-console" component={ManagerConsole} />
          <Route path="/reports" component={ReportsPage} />
          <Route path="/vendor/login" component={VendorLogin} />
          <Route path="/vendor" nest component={VendorLayout} />
          <Route path="/appointments" component={AppointmentsIndex} />
          <Route path="/appointments/schedule-medical" component={ScheduleMedical} />
          <Route path="/appointments/schedule-eid" component={ScheduleEid} />
          <Route path="/bots" component={BotsHub} />
          <Route path="/bots/quick-paste" component={QuickPasteBot} />
          <Route path="/bots/scheduler" component={SchedulerBot} />
          <Route component={NotFound} />
        </Switch>
      </PageTransition>
    </AuthGuard>
  );
}

function SplashOverlay() {
  const { splashActive, setSplashActive } = useSplash();
  if (!splashActive) return null;
  return <SplashScreen onComplete={() => setSplashActive(false)} />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <SplashOverlay />
              <CommandPalette />
              <MobileBottomNav />
              <Toaster />
              <Router />
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
