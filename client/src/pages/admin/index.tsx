import { useState } from "react";
import {
  Settings,
  MapPin,
  Users,
  FileText,
  Briefcase,
  Building2,
  UserPlus,
  ArrowLeft,
  AlertCircle,
  FileSpreadsheet,
  Inbox,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/app-layout";

import { AdminCompaniesTab } from "./companies-tab";
import { AdminCentersTab } from "./centers-tab";
import { AdminStaffTab } from "./staff-tab";
import { AdminServicesTab } from "./services-tab";
import { AdminJobTypesTab } from "./job-types-tab";
import { AdminVendorsTab } from "./vendors-tab";
import { AdminAccountsTab } from "./accounts-tab";
import { AdminSettingsSection } from "./settings-section";
import { ApiKeysTab } from "./api-keys-tab";
import { AttestationServicesTab } from "./attestation-services-tab";
import { ImportExportSection } from "./import-export-section";
import { LoginAuditTab } from "./login-audit-tab";
import { PasswordResetRequestsTab } from "./password-reset-requests-tab";
import { ChangeLogTab } from "./change-log-tab";
import { WorkDriveBackupSection } from "./workdrive-backup-section";
import { DeletionRequestsBadge, DeletionRequestsTab } from "./deletion-requests-tab";
import { EmailTemplatesTab } from "./email-templates-tab";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("companies");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center gap-3">
          {activeSection && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveSection(null)}
              data-testid="button-back-sections"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">
              {activeSection === "organization" ? "Organization" :
               activeSection === "vendor" ? "Vendor Management" :
               activeSection === "admin" ? "Administration" :
               activeSection === "communications" ? "Communications" :
               activeSection === "settings" ? "Settings" :
               activeSection === "future" ? "Future Updates" :
               "Admin Console"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeSection === "organization" ? "Manage companies, centers, staff, and services" :
               activeSection === "vendor" ? "Manage vendors and job types" :
               activeSection === "admin" ? "User accounts, data import/export, and change log" :
               activeSection === "communications" ? "Email templates and notification management" :
               activeSection === "settings" ? "Email and system configuration" :
               activeSection === "future" ? "Features under development" :
               "System configuration and data management"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6">
        {!activeSection ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "organization", icon: Building2, title: "Organization", desc: "Companies, Centers, Staff, Services", defaultTab: "companies", count: null },
              { key: "vendor", icon: Briefcase, title: "Vendor Management", desc: "Vendors, Job Types", defaultTab: "vendors", count: null },
              { key: "admin", icon: UserPlus, title: "Administration", desc: "User Accounts, Import / Export, Change Log", defaultTab: "accounts", count: null },
              { key: "communications", icon: Mail, title: "Communications", desc: "Email templates and notifications", defaultTab: "email-templates", count: null },
              { key: "settings", icon: Settings, title: "Settings", desc: "Email & system configuration", defaultTab: "settings", count: null },
            ].map((section) => (
              <Card
                key={section.key}
                className="hover-elevate cursor-pointer p-5"
                onClick={() => {
                  setActiveSection(section.key);
                  setActiveTab(section.defaultTab);
                }}
                data-testid={`card-section-${section.key}`}
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{section.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : activeSection === "settings" ? (
          <AdminSettingsSection />
        ) : (
          <div className="premium-card overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full justify-start border-b border-border/50 rounded-none bg-transparent p-0 h-auto overflow-x-auto scroll-fade-x">
                {activeSection === "organization" && (
                  <>
                    <TabsTrigger value="companies" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-companies">
                      <Building2 className="h-4 w-4 mr-2" /> Companies
                    </TabsTrigger>
                    <TabsTrigger value="centers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-centers">
                      <MapPin className="h-4 w-4 mr-2" /> Centers
                    </TabsTrigger>
                    <TabsTrigger value="staff" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-staff">
                      <Users className="h-4 w-4 mr-2" /> Staff
                    </TabsTrigger>
                    <TabsTrigger value="services" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-services">
                      <FileText className="h-4 w-4 mr-2" /> Services
                    </TabsTrigger>
                  </>
                )}
                {activeSection === "vendor" && (
                  <>
                    <TabsTrigger value="vendors" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-vendors">
                      <Building2 className="h-4 w-4 mr-2" /> Vendors
                    </TabsTrigger>
                    <TabsTrigger value="jobtypes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-jobtypes">
                      <Briefcase className="h-4 w-4 mr-2" /> Vendor Jobs
                    </TabsTrigger>
                  </>
                )}
                {activeSection === "communications" && (
                  <>
                    <TabsTrigger value="email-templates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-email-templates">
                      <Mail className="h-4 w-4 mr-2" /> Email Templates
                    </TabsTrigger>
                  </>
                )}
                {activeSection === "admin" && (
                  <>
                    <TabsTrigger value="accounts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-accounts">
                      <UserPlus className="h-4 w-4 mr-2" /> User Accounts
                    </TabsTrigger>
                    <TabsTrigger value="import" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-import">
                      <FileSpreadsheet className="h-4 w-4 mr-2" /> Import / Export
                    </TabsTrigger>
                    <TabsTrigger value="changelog" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-changelog">
                      <AlertCircle className="h-4 w-4 mr-2" /> Change Log
                    </TabsTrigger>
                    <TabsTrigger value="loginaudit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-loginaudit">
                      Login Audit
                    </TabsTrigger>
                    <TabsTrigger value="resetrequests" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-resetrequests">
                      Reset Requests
                    </TabsTrigger>
                    <TabsTrigger value="workdrive" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-workdrive">
                      WorkDrive Backup
                    </TabsTrigger>
                    <TabsTrigger value="apikeys" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-apikeys">
                      API Keys
                    </TabsTrigger>
                    <TabsTrigger value="deletionrequests" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-deletionrequests">
                      <Inbox className="h-4 w-4 mr-1.5" />
                      Deletion Requests
                      <DeletionRequestsBadge />
                    </TabsTrigger>
                    <TabsTrigger value="attestation-services" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 whitespace-nowrap text-sm" data-testid="tab-attestation-services">
                      Attestation Services
                    </TabsTrigger>
                  </>
                )}
              </TabsList>

              <TabsContent value="email-templates" className="p-4"><EmailTemplatesTab /></TabsContent>
              <TabsContent value="companies"><AdminCompaniesTab /></TabsContent>
              <TabsContent value="centers"><AdminCentersTab /></TabsContent>
              <TabsContent value="staff"><AdminStaffTab /></TabsContent>
              <TabsContent value="services"><AdminServicesTab /></TabsContent>
              <TabsContent value="vendors"><AdminVendorsTab /></TabsContent>
              <TabsContent value="jobtypes"><AdminJobTypesTab /></TabsContent>
              <TabsContent value="accounts"><AdminAccountsTab /></TabsContent>
              <TabsContent value="import" className="p-4"><ImportExportSection /></TabsContent>
              <TabsContent value="changelog" className="p-4"><ChangeLogTab /></TabsContent>
              <TabsContent value="loginaudit" className="p-4"><LoginAuditTab /></TabsContent>
              <TabsContent value="resetrequests" className="p-4"><PasswordResetRequestsTab /></TabsContent>
              <TabsContent value="workdrive" className="p-4"><WorkDriveBackupSection /></TabsContent>
              <TabsContent value="apikeys" className="p-4"><ApiKeysTab /></TabsContent>
              <TabsContent value="deletionrequests" className="p-4"><DeletionRequestsTab /></TabsContent>
              <TabsContent value="attestation-services" className="p-4"><AttestationServicesTab /></TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
