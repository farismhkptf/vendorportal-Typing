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
  Clock,
  Fingerprint,
  ArrowUpDown,
  CornerDownLeft,
} from "lucide-react";
import { toProperCase } from "@/lib/proper-case";

interface SearchResult {
  workOrders: Array<{ id: string; woNumber: string; applicantName: string; status: string; companyName?: string }>;
  typingJobs: Array<{ id: string; jobCode: string; woNumber: string; applicantName: string; status: string }>;
  companies: Array<{ id: string; name: string }>;
  staff: Array<{ id: string; name: string; role: string }>;
}

interface RecentItem {
  id: string;
  type: "wo" | "company" | "page";
  label: string;
  sublabel?: string;
  href: string;
  timestamp: number;
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

const QUICK_ACTIONS = [
  { name: "New WO", href: "/work-orders/new", icon: Plus, color: "text-blue-500" },
  { name: "Schedule Medical", href: "/appointments/schedule-medical", icon: Stethoscope, color: "text-emerald-500" },
  { name: "Schedule EID", href: "/appointments/schedule-eid", icon: Fingerprint, color: "text-violet-500" },
  { name: "Top Up Wallet", href: "/vendor-wallet", icon: Wallet, color: "text-amber-500" },
];

const RECENTS_KEY = "spotlight-recents";
const MAX_RECENTS = 5;

function getRecents(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function addRecent(item: RecentItem) {
  try {
    const recents = getRecents().filter(r => r.href !== item.href);
    recents.unshift({ ...item, timestamp: Date.now() });
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
  } catch {}
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  const [recents, setRecents] = useState<RecentItem[]>([]);

  const { data: searchResults } = useQuery<SearchResult>({
    queryKey: [`/api/search?q=${encodeURIComponent(search)}`],
    enabled: open && search.length >= 2,
    staleTime: 1000,
  });

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (open) {
      setRecents(getRecents());
      setSearch("");
    }
  }, [open]);

  const handleSelect = useCallback((href: string, recentItem?: Omit<RecentItem, "timestamp">) => {
    setOpen(false);
    setSearch("");
    if (recentItem) {
      addRecent({ ...recentItem, timestamp: Date.now() });
    }
    navigate(href);
  }, [navigate]);

  const hasSearchResults = searchResults && (
    searchResults.workOrders.length > 0 ||
    searchResults.typingJobs.length > 0 ||
    searchResults.companies.length > 0 ||
    searchResults.staff.length > 0
  );

  const showDefaultView = !search || search.length < 2;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search work orders, companies, or navigate..."
        value={search}
        onValueChange={setSearch}
        data-testid="input-command-search"
      />

      <CommandList>
        {showDefaultView ? (
          <>
            <CommandGroup heading="Quick Actions">
              {QUICK_ACTIONS.map((action) => (
                <CommandItem
                  key={action.href}
                  value={`quick-${action.name}`}
                  onSelect={() => handleSelect(action.href, {
                    id: action.href,
                    type: "page",
                    label: action.name,
                    href: action.href,
                  })}
                  className="spotlight-quick-action"
                  data-testid={`cmd-quick-${action.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <action.icon className={`h-4 w-4 ${action.color}`} />
                  <span className="font-medium">{action.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            {recents.length > 0 && (
              <CommandGroup heading="Recent">
                {recents.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`recent-${item.label}`}
                    onSelect={() => handleSelect(item.href, item)}
                    data-testid={`cmd-recent-${item.id}`}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground/50" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-[11px] text-muted-foreground/60 truncate">{item.sublabel}</span>
                      )}
                    </div>
                    <span className="ml-auto text-[10px] text-muted-foreground/40 capitalize">{item.type === "wo" ? "Work Order" : item.type === "company" ? "Company" : "Page"}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />

            <CommandGroup heading="Navigate">
              {PAGES.map((page) => (
                <CommandItem
                  key={page.href}
                  value={`page-${page.name} ${page.keywords}`}
                  onSelect={() => handleSelect(page.href, {
                    id: page.href,
                    type: "page",
                    label: page.name,
                    href: page.href,
                  })}
                  data-testid={`cmd-page-${page.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <page.icon className="h-4 w-4 text-muted-foreground/60" />
                  <span>{page.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/30">{page.keywords.split(" ").slice(0, 2).join(", ")}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : (
          <>
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
                    onSelect={() => handleSelect(`/work-orders/${wo.id}`, {
                      id: wo.id,
                      type: "wo",
                      label: `${wo.woNumber} — ${toProperCase(wo.applicantName)}`,
                      sublabel: wo.companyName ? toProperCase(wo.companyName) : undefined,
                      href: `/work-orders/${wo.id}`,
                    })}
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
                    <span className="ml-auto shrink-0"><StatusBadge status={wo.status as any} className="text-[10px] h-5" /></span>
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
                    onSelect={() => handleSelect(`/typing-jobs/${job.id}`, {
                      id: job.id,
                      type: "wo",
                      label: `${job.jobCode} — ${toProperCase(job.applicantName)}`,
                      sublabel: job.woNumber,
                      href: `/typing-jobs/${job.id}`,
                    })}
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
                    onSelect={() => handleSelect(`/companies/${c.id}`, {
                      id: c.id,
                      type: "company",
                      label: toProperCase(c.name),
                      href: `/companies/${c.id}`,
                    })}
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
                  onSelect={() => handleSelect(page.href, {
                    id: page.href,
                    type: "page",
                    label: page.name,
                    href: page.href,
                  })}
                  data-testid={`cmd-page-${page.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <page.icon className="h-4 w-4 text-muted-foreground/60" />
                  <span>{page.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>

      <div className="spotlight-footer flex items-center justify-center gap-4 px-4 py-2">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
          <ArrowUpDown className="h-3 w-3" /> Navigate
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
          <CornerDownLeft className="h-3 w-3" /> Open
        </span>
        <span className="text-[11px] text-muted-foreground/50">
          <kbd className="font-mono">esc</kbd> Close
        </span>
      </div>
    </CommandDialog>
  );
}
