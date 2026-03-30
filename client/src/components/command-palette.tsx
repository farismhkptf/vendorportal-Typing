import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  LayoutDashboard,
  FileText,
  Stethoscope,
  ClipboardList,
  Building2,
  Wallet,
  Bot,
  Settings,
  Plus,
  Search,
  Users,
  Calendar,
  BarChart3,
} from "lucide-react";
import { toProperCase } from "@/lib/proper-case";

interface SearchResult {
  workOrders: Array<{ id: string; woNumber: string; applicantName: string; status: string; companyName?: string }>;
  typingJobs: Array<{ id: string; jobCode: string; woNumber: string; applicantName: string; status: string }>;
  companies: Array<{ id: string; name: string }>;
  staff: Array<{ id: string; name: string; role: string }>;
}

const PAGES = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, keywords: "home overview stats" },
  { name: "Work Orders", href: "/work-orders", icon: FileText, keywords: "wo list" },
  { name: "New Work Order", href: "/work-orders/new", icon: Plus, keywords: "create add" },
  { name: "Appointments", href: "/appointments", icon: Stethoscope, keywords: "medical eid schedule" },
  { name: "Schedule Medical", href: "/appointments/schedule-medical", icon: Calendar, keywords: "medical appointment" },
  { name: "Schedule EID", href: "/appointments/schedule-eid", icon: Calendar, keywords: "emirates id appointment" },
  { name: "Typing Jobs", href: "/typing-jobs", icon: ClipboardList, keywords: "typing vendor" },
  { name: "Companies", href: "/companies", icon: Building2, keywords: "clients company" },
  { name: "Add Company", href: "/companies/new", icon: Plus, keywords: "create new company" },
  { name: "Staff", href: "/staff", icon: Users, keywords: "team members employees" },
  { name: "Vendor Wallet", href: "/vendor-wallet", icon: Wallet, keywords: "balance money" },
  { name: "Reports", href: "/reports", icon: BarChart3, keywords: "analytics stats charts" },
  { name: "Bots", href: "/bots", icon: Bot, keywords: "quick paste scheduler" },
  { name: "Admin Console", href: "/admin", icon: Settings, keywords: "settings configuration import" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [location, navigate] = useLocation();
  const isV2 = location === "/vendor-v2" || location.startsWith("/vendor-v2/");

  const isSearching = search.length >= 2;

  const { data: searchResults } = useQuery<SearchResult>({
    queryKey: [`/api/search?q=${encodeURIComponent(search)}`],
    enabled: open && isSearching && !isV2,
    staleTime: 1000,
  });

  useEffect(() => {
    if (isV2) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === " " && e.ctrlKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isV2]);

  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  const handleSelect = useCallback((href: string) => {
    setOpen(false);
    setSearch("");
    navigate(href);
  }, [navigate]);

  const hasSearchResults = searchResults && (
    searchResults.workOrders.length > 0 ||
    searchResults.typingJobs.length > 0 ||
    searchResults.companies.length > 0 ||
    searchResults.staff.length > 0
  );

  if (isV2) return null;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search..."
        value={search}
        onValueChange={setSearch}
        data-testid="input-command-search"
      />

      {isSearching && (
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                <Search className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">No results found</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Try a different search term</p>
              </div>
            </div>
          </CommandEmpty>

          {searchResults?.workOrders && searchResults.workOrders.length > 0 && (
            <CommandGroup heading="Work Orders">
              {searchResults.workOrders.map((wo) => (
                <CommandItem
                  key={wo.id}
                  value={`wo-${wo.woNumber}-${wo.applicantName}`}
                  onSelect={() => handleSelect(`/work-orders/${wo.id}`)}
                  data-testid={`cmd-wo-${wo.woNumber}`}
                >
                  <FileText className="h-4 w-4 text-blue-500/70" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{wo.woNumber}</span>
                      <span className="text-sm truncate">{toProperCase(wo.applicantName)}</span>
                    </div>
                    {wo.companyName && (
                      <span className="text-[11px] text-muted-foreground/60 truncate">{toProperCase(wo.companyName)}</span>
                    )}
                  </div>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{wo.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searchResults?.typingJobs && searchResults.typingJobs.length > 0 && (
            <CommandGroup heading="Typing Jobs">
              {searchResults.typingJobs.map((job) => (
                <CommandItem
                  key={job.id}
                  value={`tj-${job.jobCode}-${job.applicantName}`}
                  onSelect={() => handleSelect(`/typing-jobs/${job.id}`)}
                  data-testid={`cmd-tj-${job.jobCode}`}
                >
                  <ClipboardList className="h-4 w-4 text-amber-500/70" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{job.jobCode}</span>
                      <span className="text-sm truncate">{toProperCase(job.applicantName)}</span>
                    </div>
                    {job.woNumber && (
                      <span className="text-[11px] text-muted-foreground/60 truncate">{job.woNumber}</span>
                    )}
                  </div>
                  <span className="ml-auto shrink-0"><StatusBadge status={job.status as any} className="text-[10px] h-5" /></span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searchResults?.companies && searchResults.companies.length > 0 && (
            <CommandGroup heading="Companies">
              {searchResults.companies.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`company-${c.name}`}
                  onSelect={() => handleSelect(`/companies/${c.id}`)}
                  data-testid={`cmd-company-${c.id}`}
                >
                  <Building2 className="h-4 w-4 text-emerald-500/70" />
                  <span>{toProperCase(c.name)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searchResults?.staff && searchResults.staff.length > 0 && (
            <CommandGroup heading="Staff">
              {searchResults.staff.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`staff-${s.name}`}
                  onSelect={() => handleSelect("/staff")}
                  data-testid={`cmd-staff-${s.id}`}
                >
                  <Users className="h-4 w-4 text-violet-500/70" />
                  <span>{toProperCase(s.name)}</span>
                  {s.role && <span className="text-xs text-muted-foreground/50">{s.role}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {hasSearchResults && <CommandSeparator />}

          <CommandGroup heading="Pages">
            {PAGES.map((page) => (
              <CommandItem
                key={page.href}
                value={`page-${page.name} ${page.keywords}`}
                onSelect={() => handleSelect(page.href)}
                data-testid={`cmd-page-${page.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <page.icon className="h-4 w-4 text-muted-foreground/60" />
                <span>{page.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      )}
    </CommandDialog>
  );
}
