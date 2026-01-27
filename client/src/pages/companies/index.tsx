import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Search, Building2, Mail, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableRow } from "@/components/ui/data-table-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Company, Staff, Center, CompanyEmail } from "@shared/schema";

interface CompanyWithRelations extends Company {
  rmStaff?: Staff;
  assistStaff?: Staff;
  preferredMedicalCenter?: Center;
  preferredEidCenter?: Center;
  emails?: CompanyEmail[];
}

export default function CompaniesList() {
  const [search, setSearch] = useState("");

  const { data: companies, isLoading } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
  });

  const filteredCompanies = companies?.filter((company) =>
    !search || company.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <PageHeader
        title="Companies"
        subtitle="Manage client companies and their preferences"
        actions={
          <Link href="/companies/new">
            <Button className="gap-2" data-testid="button-new-company">
              <Plus className="h-4 w-4" />
              Add Company
            </Button>
          </Link>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl"
            data-testid="input-search-companies"
          />
        </div>

        {/* Companies Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </>
          ) : filteredCompanies && filteredCompanies.length > 0 ? (
            filteredCompanies.map((company) => (
              <Link key={company.id} href={`/companies/${company.id}`}>
                <DataTableRow className="h-full" data-testid={`company-card-${company.id}`}>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{company.name}</h3>
                        {company.emails && company.emails.filter(e => e.active).length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {company.emails.filter(e => e.active).length} email(s)
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {company.preferredMedicalCenter && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">Medical: {company.preferredMedicalCenter.name}</span>
                        </div>
                      )}
                      {company.preferredEidCenter && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">EID: {company.preferredEidCenter.name}</span>
                        </div>
                      )}
                    </div>

                    {(company.rmStaff || company.assistStaff) && (
                      <div className="flex items-center gap-2 pt-3 border-t border-border">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="flex gap-1.5">
                          {company.rmStaff && (
                            <Badge variant="secondary" className="text-xs">
                              {company.rmStaff.name}
                            </Badge>
                          )}
                          {company.assistStaff && (
                            <Badge variant="secondary" className="text-xs">
                              {company.assistStaff.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </DataTableRow>
              </Link>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title="No companies found"
                description={search ? "Try adjusting your search" : "Add your first company to get started."}
                action={
                  !search && (
                    <Link href="/companies/new">
                      <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Company
                      </Button>
                    </Link>
                  )
                }
              />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
