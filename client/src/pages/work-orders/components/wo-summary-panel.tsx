import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toProperCase } from "@/lib/proper-case";
import { Building2, Mail, MapPin, User, AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/query-keys";
import type { Company } from "@shared/schema";
import type { WorkOrderDetail } from "./types";

interface WoSummaryPanelProps {
  workOrder: WorkOrderDetail;
  companies?: Company[];
}

export function WoSummaryPanel({ workOrder, companies: companiesProp }: WoSummaryPanelProps) {
  const { toast } = useToast();
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const needsCompanySearch = !workOrder.company;

  const { data: fetchedCompanies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: queryKeys.companies,
    enabled: needsCompanySearch && !companiesProp,
  });

  const companies = companiesProp ?? fetchedCompanies;

  const filteredCompanies = useMemo(() => {
    if (!companies) return [];
    const q = companySearchQuery.trim().toLowerCase();
    if (!q) return companies.slice(0, 10);
    return companies.filter(c => c.name.toLowerCase().includes(q)).slice(0, 10);
  }, [companies, companySearchQuery]);

  const assignCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return apiRequest("PUT", `/api/work-orders/${workOrder.id}`, { companyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(workOrder.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders });
      toast({ title: "Company assigned successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSelectedCompanyId(null);
    },
  });

  const handleSelectCompany = (company: Company) => {
    setSelectedCompanyId(company.id);
    setCompanySearchQuery("");
    assignCompanyMutation.mutate(company.id);
  };

  if (workOrder.company) {
    return (
      <SectionCard title="Company Snapshot">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Company</p>
              <p className="font-medium text-foreground">{toProperCase(workOrder.company.name)}</p>
            </div>
          </div>

          {workOrder.company.emails && workOrder.company.emails.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Client Emails</p>
                <div className="space-y-1">
                  {workOrder.company.emails.filter(e => e.active).map((email, i) => (
                    <p key={i} className="text-sm text-foreground">
                      <span className="text-muted-foreground">{email.label}:</span> {email.email}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(workOrder.company.preferredMedicalCenter || workOrder.company.preferredEidCenter) && (
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Preferred Centers</p>
                {workOrder.company.preferredMedicalCenter && (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">Medical:</span> {workOrder.company.preferredMedicalCenter.name}
                  </p>
                )}
                {workOrder.company.preferredEidCenter && (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">EID:</span> {workOrder.company.preferredEidCenter.name}
                  </p>
                )}
              </div>
            </div>
          )}

          {(workOrder.company.rmStaff || workOrder.company.assistStaff) && (
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assigned Staff</p>
                {workOrder.company.rmStaff && (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">RM:</span> {workOrder.company.rmStaff.name}
                  </p>
                )}
                {workOrder.company.assistStaff && (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">Assist:</span> {workOrder.company.assistStaff.name}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    );
  }

  const pendingCompany = selectedCompanyId ? companies?.find(c => c.id === selectedCompanyId) : null;
  const isSaving = assignCompanyMutation.isPending;
  const isLoadingList = needsCompanySearch && !companiesProp && companiesLoading;

  return (
    <SectionCard title="Company Snapshot">
      <div className="space-y-3" data-testid="company-not-assigned">
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          No company assigned — search and pick one below:
        </p>

        {isSaving && pendingCompany ? (
          <div className="flex items-center gap-2" data-testid="badge-company-saving">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Saving {pendingCompany.name.substring(0, 30)}…</span>
          </div>
        ) : pendingCompany ? (
          <div className="flex items-center gap-2">
            <Badge variant="default" className="gap-1.5" data-testid="badge-company-assigned">
              <Building2 className="h-3 w-3" />
              {pendingCompany.name.substring(0, 30)}
            </Badge>
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() => setSelectedCompanyId(null)}
              data-testid="button-change-company"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Input
              placeholder="Search companies..."
              value={companySearchQuery}
              onChange={(e) => setCompanySearchQuery(e.target.value)}
              className="h-8 text-sm"
              disabled={isLoadingList}
              data-testid="input-company-search-panel"
            />
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {isLoadingList ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading companies…
                </p>
              ) : filteredCompanies.length > 0 ? (
                filteredCompanies.map(company => (
                  <button
                    key={company.id}
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSelectCompany(company)}
                    data-testid={`search-company-${company.id}`}
                  >
                    <Badge
                      variant="outline"
                      className="gap-1 cursor-pointer hover:bg-secondary/80 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Building2 className="h-3 w-3" />
                      {company.name.substring(0, 30)}
                    </Badge>
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No companies match your search.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
