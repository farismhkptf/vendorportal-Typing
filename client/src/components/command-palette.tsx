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
  workOrders: Array<{ id: string; woNumber: string; applicantName: string; status: string }>;
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
  const [, navigate] = useLocation();

  const { data: searchResults } = useQuery<SearchResult>({
    queryKey: [`/api/search?q=${encodeURIComponent(search)}`],
    enabled: open && search.length >= 2,
    staleTime: 1000,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback((href: string) => {
    setOpen(false);
    setSearch("");
    navigate(href);
  }, [navigate]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search work orders, companies, or navigate..."
        value={search}
        onValueChange={setSearch}
        data-testid="input-command-search"
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-4">
            <Search className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-muted-foreground">No results found.</p>
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
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm font-medium">{wo.woNumber}</span>
                <span className="text-muted-foreground truncate">{toProperCase(wo.applicantName)}</span>
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
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm font-medium">{job.jobCode}</span>
                <span className="text-muted-foreground truncate">{toProperCase(job.applicantName)}</span>
                <span className="text-xs text-muted-foreground ml-auto">{job.status}</span>
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
                <Building2 className="h-4 w-4 text-muted-foreground" />
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
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{toProperCase(s.name)}</span>
                <span className="text-xs text-muted-foreground">{s.role}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(searchResults?.workOrders?.length || searchResults?.typingJobs?.length || searchResults?.companies?.length || searchResults?.staff?.length) && (
          <CommandSeparator />
        )}

        <CommandGroup heading="Pages">
          {PAGES.map((page) => (
            <CommandItem
              key={page.href}
              value={`page-${page.name} ${page.keywords}`}
              onSelect={() => handleSelect(page.href)}
              data-testid={`cmd-page-${page.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <page.icon className="h-4 w-4 text-muted-foreground" />
              <span>{page.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
