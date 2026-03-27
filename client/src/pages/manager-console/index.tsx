import { useState } from "react";
import {
  Shield,
  Building2,
  MapPin,
  Users,
  FileText,
  User,
  Link2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/layout/app-layout";
import { CustodyDashboardWidget } from "@/components/custody/dashboard-widget";
import { PinGate, ChangePinButton } from "./components/pin-gate";
import { CompaniesTab } from "./components/companies-tab";
import { CentersTab } from "./components/centers-tab";
import { StaffTab } from "./components/staff-tab";
import { ServicesTab } from "./components/services-tab";
import { UsersTab } from "./components/users-tab";
import { ImportTab } from "./components/import-tab";

export default function ManagerConsole() {
  const [verified, setVerified] = useState(false);
  const [activeTab, setActiveTab] = useState("companies");

  if (!verified) {
    return (
      <AppLayout>
        <PinGate onVerified={() => setVerified(true)} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight" data-testid="text-manager-title">Manager Console</h1>
          </div>
          <ChangePinButton />
        </div>

        <div className="max-w-xs">
          <CustodyDashboardWidget />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="companies" data-testid="tab-companies">
              <Building2 className="h-4 w-4 mr-1" /> Companies
            </TabsTrigger>
            <TabsTrigger value="centers" data-testid="tab-centers">
              <MapPin className="h-4 w-4 mr-1" /> Centers
            </TabsTrigger>
            <TabsTrigger value="staff" data-testid="tab-staff">
              <Users className="h-4 w-4 mr-1" /> Staff
            </TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">
              <FileText className="h-4 w-4 mr-1" /> Services
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <User className="h-4 w-4 mr-1" /> User Accounts
            </TabsTrigger>
            <TabsTrigger value="import" data-testid="tab-import">
              <Link2 className="h-4 w-4 mr-1" /> Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <CompaniesTab />
          </TabsContent>
          <TabsContent value="centers">
            <CentersTab />
          </TabsContent>
          <TabsContent value="staff">
            <StaffTab />
          </TabsContent>
          <TabsContent value="services">
            <ServicesTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="import">
            <ImportTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
