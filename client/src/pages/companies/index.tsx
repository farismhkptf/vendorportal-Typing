import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Search, Building2, Mail, MapPin, User, ArrowUpDown, List, LayoutGrid, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Company, Staff, Center, CompanyEmail } from "@shared/schema";

type ViewMode = "compact" | "cards" | "table";
type SortByOption = "name_asc" | "name_desc" | "most_used";

interface CompanyWithRelations extends Company {
  rmStaff?: Staff;
  assistStaff?: Staff;
  preferredMedicalCenter?: Center;
  preferredMedicalCenterVip?: Center;
  preferredBiometricsCenter?: Center;
  emails?: CompanyEmail[];
  workOrderCount?: number;
}

export default function CompaniesList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortByOption>("name_asc");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

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
          case "most_used":
            return (b.workOrderCount || 0) - (a.workOrderCount || 0);
          default:
            return 0;
        }
      });
    }
    
    return result;
  }, [companies, search, sortBy]);

  const renderCompactList = (items: CompanyWithRelations[]) => (
    <div className="space-y-1" role="list">
      {items.map((company, index) => (
        <Link key={company.id} href={`/companies/${company.id}`}>
          <div 
            className="flex items-center justify-between py-2.5 px-3 rounded-lg hover-elevate opacity-0 animate-fade-in focus-visible:ring-2 focus-visible:ring-ring"
            style={{ animationDelay: `${index * 0.02}s` }}
            role="listitem"
            tabIndex={0}
            data-testid={`company-compact-${company.id}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground truncate">{company.name}</span>
              {company.rmStaff && (
                <span className="text-xs text-muted-foreground hidden sm:inline">• RM: {company.rmStaff.name}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {company.emails && company.emails.filter(e => e.active).length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {company.emails.filter(e => e.active).length} email(s)
                </Badge>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );

  const renderCards = (items: CompanyWithRelations[]) => (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((company, index) => (
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
      ))}
    </div>
  );

  const renderTable = (items: CompanyWithRelations[]) => (
    <div className="premium-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company Name</TableHead>
            <TableHead className="hidden md:table-cell">RM</TableHead>
            <TableHead className="hidden lg:table-cell">Medical Center</TableHead>
            <TableHead className="text-right">Emails</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((company) => (
            <TableRow 
              key={company.id} 
              className="cursor-pointer hover-elevate" 
              onClick={() => navigate(`/companies/${company.id}`)}
              data-testid={`company-table-${company.id}`}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-primary">{company.name}</span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {company.rmStaff?.name || "-"}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {company.preferredMedicalCenter?.name || "-"}
              </TableCell>
              <TableCell className="text-right">
                {company.emails && company.emails.filter(e => e.active).length > 0 ? (
                  <Badge variant="secondary" className="text-xs">
                    {company.emails.filter(e => e.active).length}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Companies
          </h1>
          <Link href="/companies/new">
            <Button size="sm" className="gap-1.5 rounded-lg" data-testid="button-new-company">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Company</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-6 space-y-4">
        {/* Search, Sort, and View Mode */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search-companies"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortByOption)}>
            <SelectTrigger className="w-36 h-9 rounded-lg" data-testid="select-sort-by">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="most_used">Most Used</SelectItem>
              <SelectItem value="name_asc">Name A-Z</SelectItem>
              <SelectItem value="name_desc">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
            <Button
              size="icon"
              variant={viewMode === "compact" ? "secondary" : "ghost"}
              onClick={() => setViewMode("compact")}
              data-testid="button-view-compact"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              onClick={() => setViewMode("cards")}
              data-testid="button-view-cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              onClick={() => setViewMode("table")}
              data-testid="button-view-table"
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Companies Display */}
        <div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : filteredAndSortedCompanies && filteredAndSortedCompanies.length > 0 ? (
            <>
              {viewMode === "compact" && renderCompactList(filteredAndSortedCompanies)}
              {viewMode === "cards" && renderCards(filteredAndSortedCompanies)}
              {viewMode === "table" && renderTable(filteredAndSortedCompanies)}
            </>
          ) : (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No companies found"
              description={search ? "Try adjusting your search" : "Add your first company to get started."}
              action={
                !search && (
                  <Link href="/companies/new">
                    <Button size="sm" className="gap-2 rounded-lg">
                      <Plus className="h-4 w-4" />
                      Add Company
                    </Button>
                  </Link>
                )
              }
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
