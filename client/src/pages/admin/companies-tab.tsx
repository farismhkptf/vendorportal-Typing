import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, Mail, User, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toProperCase } from "@/lib/proper-case";
import type { Center, Staff, Company, CompanyEmail } from "@shared/schema";

interface CompanyWithRelations extends Company {
  rmStaff?: Staff;
  assistStaff?: Staff;
  preferredMedicalCenter?: Center;
  preferredEidCenter?: Center;
  emails?: CompanyEmail[];
}

export function AdminCompaniesTab() {
  const [companySearch, setCompanySearch] = useState("");

  const { data: companies, isLoading: companiesLoading } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
  });

  const filteredCompanies = companies?.filter((company) =>
    !companySearch || company.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search companies..."
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-search-companies"
          />
        </div>
        <Link href="/companies/new">
          <Button size="sm" className="gap-1.5 rounded-lg" data-testid="button-add-company">
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {companiesLoading ? (
          <>
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </>
        ) : filteredCompanies && filteredCompanies.length > 0 ? (
          filteredCompanies.map((company, index) => (
            <Link key={company.id} href={`/companies/${company.id}`}>
              <div 
                className="p-4 rounded-lg bg-muted/30 border border-border/30 opacity-0 animate-fade-in cursor-pointer hover-elevate transition-colors"
                style={{ animationDelay: `${index * 0.03}s` }}
                data-testid={`company-card-${company.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="icon-container icon-container-sm shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground text-sm truncate">{toProperCase(company.name)}</h3>
                    {company.emails && company.emails.filter(e => e.active).length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {company.emails.filter(e => e.active).length} email(s)
                      </div>
                    )}
                    {(company.rmStaff || company.assistStaff) && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <div className="flex gap-1 flex-wrap">
                          {company.rmStaff && (
                            <Badge variant="secondary" className="text-xs rounded-md px-1.5 py-0">
                              {company.rmStaff.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full">
            <EmptyState
              icon={<Building2 className="h-5 w-5" />}
              title="No companies found"
              description={companySearch ? "Try adjusting your search" : "Add your first company to get started."}
              action={
                !companySearch && (
                  <Link href="/companies/new">
                    <Button size="sm" className="gap-1.5 rounded-lg">
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
  );
}
