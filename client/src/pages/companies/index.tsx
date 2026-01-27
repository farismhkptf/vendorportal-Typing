import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Search, Building2, Mail, MapPin, User, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Company, Staff, Center, CompanyEmail } from "@shared/schema";

type SortByOption = "name_asc" | "name_desc";

interface CompanyWithRelations extends Company {
  rmStaff?: Staff;
  assistStaff?: Staff;
  preferredMedicalCenter?: Center;
  preferredMedicalCenterVip?: Center;
  preferredBiometricsCenter?: Center;
  emails?: CompanyEmail[];
}

export default function CompaniesList() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortByOption>("name_asc");

  const { data: companies, isLoading } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
  });

  const filteredAndSortedCompanies = useMemo(() => {
    let result = companies?.filter((company) =>
      !search || company.name.toLowerCase().includes(search.toLowerCase())
    );
    
    if (result) {
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case "name_asc":
            return a.name.localeCompare(b.name);
          case "name_desc":
            return b.name.localeCompare(a.name);
          default:
            return 0;
        }
      });
    }
    
    return result;
  }, [companies, search, sortBy]);

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="px-6 lg:px-10 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
              Companies
            </h1>
            <p className="text-muted-foreground">
              Manage client companies and their preferences
            </p>
          </div>
          <Link href="/companies/new">
            <Button className="gap-2 rounded-xl h-11 px-5" data-testid="button-new-company">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Company</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-6 lg:px-10 pb-10 space-y-6">
        {/* Search and Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="premium-card p-1.5 flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 shadow-none pl-11 focus-visible:ring-0"
                data-testid="input-search-companies"
              />
            </div>
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortByOption)}>
            <SelectTrigger className="w-36 h-10 rounded-xl" data-testid="select-sort-by">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="name_asc">Name A-Z</SelectItem>
              <SelectItem value="name_desc">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Companies Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading ? (
            <>
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </>
          ) : filteredAndSortedCompanies && filteredAndSortedCompanies.length > 0 ? (
            filteredAndSortedCompanies.map((company, index) => (
              <Link key={company.id} href={`/companies/${company.id}`}>
                <div 
                  className="premium-card p-5 h-full opacity-0 animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                  data-testid={`company-card-${company.id}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="icon-container icon-container-md shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{company.name}</h3>
                        {company.emails && company.emails.filter(e => e.active).length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {company.emails.filter(e => e.active).length} email(s)
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {company.preferredMedicalCenter && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">Medical: {company.preferredMedicalCenter.name}</span>
                        </div>
                      )}
                      {company.preferredMedicalCenterVip && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">VIP Medical: {company.preferredMedicalCenterVip.name}</span>
                        </div>
                      )}
                      {company.preferredBiometricsCenter && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">Biometrics: {company.preferredBiometricsCenter.name}</span>
                        </div>
                      )}
                    </div>

                    {(company.rmStaff || company.assistStaff) && (
                      <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="flex gap-1.5 flex-wrap">
                          {company.rmStaff && (
                            <Badge variant="secondary" className="text-xs rounded-full">
                              {company.rmStaff.name}
                            </Badge>
                          )}
                          {company.assistStaff && (
                            <Badge variant="secondary" className="text-xs rounded-full">
                              {company.assistStaff.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
                      <Button size="sm" className="gap-2 rounded-xl">
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
