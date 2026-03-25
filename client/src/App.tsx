import { Component, type ErrorInfo, type ReactNode } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageTransition } from "@/components/ui/page-transition";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import NotFound from "@/pages/not-found";
import AccessDenied from "@/pages/access-denied";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { MobileBottomNav } from "@/components/mobile-nav";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { VendorAuthProvider, useVendorAuth } from "@/hooks/use-vendor-auth";
import { AttestationVendorAuthProvider, useAttestationVendorAuth } from "@/hooks/use-attestation-vendor-auth";
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
import AttestationSRList from "@/pages/attestation-sr/index";
import NewAttestationSR from "@/pages/attestation-sr/new";
import AttestationSRDetail from "@/pages/attestation-sr/detail";
import AdminPage from "@/pages/admin/index";
import VendorLogin from "@/pages/vendor/login";
import V2Dashboard from "@/pages/vendor-v2/dashboard";
import V2EidJobs from "@/pages/vendor-v2/eid-jobs";
import V2MedicalJobs from "@/pages/vendor-v2/medical-jobs";
import V2JobDetail from "@/pages/vendor-v2/job-detail";
import V2WalletPage from "@/pages/vendor-v2/wallet";
import { V2Layout } from "@/components/vendor-v2/layout";
import { AttestationVendorLayout } from "@/pages/vendor-attestation/layout";
import AttestationVendorDashboard from "@/pages/vendor-attestation/dashboard";
import AttestationVendorInquiries from "@/pages/vendor-attestation/inquiries";
import AttestationVendorJobs from "@/pages/vendor-attestation/jobs";
import AttestationInquiriesPage from "@/pages/attestation/inquiries";
import NewAttestationInquiry from "@/pages/attestation/new-inquiry";
import InquiryDetailPage from "@/pages/attestation/inquiry-detail";
import AppointmentsIndex from "@/pages/appointments/index";
import ScheduleMedical from "@/pages/appointments/schedule-medical";
import ScheduleEid from "@/pages/appointments/schedule-eid";
import BotsHub from "@/pages/bots/index";
import QuickPasteBot from "@/pages/bots/quick-paste-bot";
import SchedulerBot from "@/pages/bots/scheduler-bot";
import ManagerConsole from "@/pages/manager-console";
import ReportsPage from "@/pages/reports";
import ExpiringDocuments from "@/pages/expiring-documents";
import AccountSecurity from "@/pages/account-security";
import LegalPage from "@/pages/legal";
import CardPage from "@/pages/card";
import CustodyQueuePage from "@/pages/attestation/custody-queue";
import AttestationSrDetailPage from "@/pages/attestation/sr-detail";
import NewCustodyQueuePage from "@/pages/custody/queue";
import CustodyDetailPage from "@/pages/custody/detail";
import AttestationVendorLogin from "@/pages/vendor-attestation/login";
import AttestationVendorJobsPage from "@/pages/vendor-attestation/jobs";

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
  { path: "/bots", roles: ["Admin", "Client Relationship Manager"] },
  { path: "/attestation", roles: ["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"] },
  { path: "/custody-queue", roles: ["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"] },
  { path: "/custody", roles: ["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"] },
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
    location === "/vendor-v2" ||
    location.startsWith("/vendor-v2/") ||
    location === "/vendor-attestation" ||
    location.startsWith("/vendor-attestation/") ||
    location.startsWith("/reschedule/") ||
    location.startsWith("/card/") ||
    location === "/vendor-attestation/login" ||
    location === "/vendor-attestation/jobs" ||
    location.startsWith("/vendor-attestation/");

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

  if (isLoading) {
    return <BrandedSplash variant="vendor" />;
  }

  if (!user) {
    window.location.href = "/vendor/login";
    return <BrandedSplash variant="vendor" />;
  }

  return <>{children}</>;
}

function TypingVendorGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useVendorAuth();

  if (isLoading) {
    return <BrandedSplash variant="vendor" />;
  }

  if (user && user.vendorType === "Attestation") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground font-medium">Access restricted to typing vendors</p>
          <button
            className="mt-4 text-sm text-primary underline"
            onClick={() => window.location.href = "/vendor-attestation"}
          >
            Go to your portal
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function VendorV2Layout() {
  return (
    <VendorAuthProvider>
      <VendorAuthGuard>
        <TypingVendorGuard>
        <V2Layout>
          <Switch>
            <Route path="/" component={V2Dashboard} />
            <Route path="/dashboard">{() => <Redirect to="/vendor-v2" />}</Route>
            <Route path="/eid" component={V2EidJobs} />
            <Route path="/eid/:id" component={V2JobDetail} />
            <Route path="/medical" component={V2MedicalJobs} />
            <Route path="/medical/:id" component={V2JobDetail} />
            <Route path="/wallet" component={V2WalletPage} />
            <Route component={NotFound} />
          </Switch>
        </V2Layout>
        </TypingVendorGuard>
      </VendorAuthGuard>
    </VendorAuthProvider>
  );
}

function AttestationVendorGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAttestationVendorAuth();

  if (isLoading) {
    return <BrandedSplash variant="vendor" />;
  }

  if (!user) {
    window.location.href = "/vendor-attestation/login";
    return <BrandedSplash variant="vendor" />;
  }

  if (user.vendorType !== "Attestation") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground font-medium">Access restricted to attestation vendors</p>
          <button
            className="mt-4 text-sm text-primary underline"
            onClick={() => window.location.href = "/vendor-v2"}
          >
            Go to your portal
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function VendorAttestationLayout() {
  return (
    <AttestationVendorAuthProvider>
      <AttestationVendorGuard>
        <AttestationVendorLayout>
          <Switch>
            <Route path="/" component={AttestationVendorDashboard} />
            <Route path="/inquiries" component={AttestationVendorInquiries} />
            <Route path="/jobs" component={AttestationVendorJobs} />
            <Route component={NotFound} />
          </Switch>
        </AttestationVendorLayout>
      </AttestationVendorGuard>
    </AttestationVendorAuthProvider>
  );
}

function VendorRedirect() {
  const [location] = useLocation();
  const subPath = location.replace(/^\//, "");
  const target = subPath ? `/vendor-v2/${subPath}` : "/vendor-v2";
  return <Redirect to={target} />;
}

function AppRoutes() {
  return (
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
      <Route path="/attestation-sr" component={AttestationSRList} />
      <Route path="/attestation-sr/new" component={NewAttestationSR} />
      <Route path="/attestation-sr/:id" component={AttestationSRDetail} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/manager-console" component={ManagerConsole} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/expiring-documents" component={ExpiringDocuments} />
      <Route path="/account/security" component={AccountSecurity} />
      <Route path="/vendor/login" component={VendorLogin} />
      <Route path="/vendor-v2" nest component={VendorV2Layout} />
      <Route path="/vendor-attestation" nest component={VendorAttestationLayout} />
      <Route path="/vendor" nest component={VendorRedirect} />
      <Route path="/attestation/inquiries/new" component={NewAttestationInquiry} />
      <Route path="/attestation/inquiries/:id" component={InquiryDetailPage} />
      <Route path="/attestation/inquiries" component={AttestationInquiriesPage} />
      <Route path="/appointments" component={AppointmentsIndex} />
      <Route path="/appointments/schedule-medical" component={ScheduleMedical} />
      <Route path="/appointments/schedule-eid" component={ScheduleEid} />
      <Route path="/bots" component={BotsHub} />
      <Route path="/bots/quick-paste" component={QuickPasteBot} />
      <Route path="/bots/scheduler" component={SchedulerBot} />
      <Route path="/card/:token" component={CardPage} />
      <Route path="/attestation/custody-queue" component={CustodyQueuePage} />
      <Route path="/attestation/sr/:id" component={AttestationSrDetailPage} />
      <Route path="/vendor-attestation/login" component={AttestationVendorLogin} />
      <Route path="/vendor-attestation/jobs" component={AttestationVendorJobsPage} />
      <Route path="/custody-queue" component={NewCustodyQueuePage} />
      <Route path="/custody/:id" component={CustodyDetailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const [location] = useLocation();
  const isV2Portal = location === "/vendor-v2" || location.startsWith("/vendor-v2/");

  return (
    <AuthGuard>
      <ScrollToTop />
      {isV2Portal ? <AppRoutes /> : <PageTransition><AppRoutes /></PageTransition>}
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
              <KeyboardShortcutsModal>
                <MobileBottomNav />
                <Toaster />
                <Router />
              </KeyboardShortcutsModal>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
