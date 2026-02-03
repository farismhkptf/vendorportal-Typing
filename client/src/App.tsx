import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageTransition } from "@/components/ui/page-transition";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
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

function Router() {
  return (
    <PageTransition>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/login" component={Login} />
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
        <Route component={NotFound} />
      </Switch>
    </PageTransition>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
