import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageTransition } from "@/components/ui/page-transition";
import NotFound from "@/pages/not-found";
import { CommandPalette } from "@/components/command-palette";
import { MobileBottomNav } from "@/components/mobile-nav";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

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
import StaffList from "@/pages/staff/index";
import VendorWallet from "@/pages/vendor-wallet";
import AdminPage from "@/pages/admin/index";
import VendorLogin from "@/pages/vendor/login";
import VendorJobs from "@/pages/vendor/jobs";
import VendorJobDetail from "@/pages/vendor/job-detail";
import ReschedulePage from "@/pages/reschedule";
import AppointmentsIndex from "@/pages/appointments/index";
import ScheduleMedical from "@/pages/appointments/schedule-medical";
import ScheduleEid from "@/pages/appointments/schedule-eid";
import BotsHub from "@/pages/bots/index";
import QuickPasteBot from "@/pages/bots/quick-paste-bot";
import SchedulerBot from "@/pages/bots/scheduler-bot";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const isPublicPath =
    location === "/login" ||
    location.startsWith("/vendor/") ||
    location.startsWith("/reschedule/");

  if (!user && !isPublicPath) {
    return <Redirect to="/login" />;
  }

  if (user && location.startsWith("/admin") && user.role !== "Admin") {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <AuthGuard>
      <PageTransition>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/login" component={Login} />
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
          <Route path="/staff" component={StaffList} />
          <Route path="/vendor-wallet" component={VendorWallet} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/vendor/login" component={VendorLogin} />
          <Route path="/vendor/jobs" component={VendorJobs} />
          <Route path="/vendor/jobs/:id" component={VendorJobDetail} />
          <Route path="/reschedule/:token" component={ReschedulePage} />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CommandPalette />
          <MobileBottomNav />
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
