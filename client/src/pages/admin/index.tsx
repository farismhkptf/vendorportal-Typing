import { useState, useRef, useMemo, useEffect, type ChangeEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Settings, 
  MapPin, 
  Users, 
  FileText, 
  Briefcase,
  Building2,
  Mail,
  User,
  Plus,
  Pencil,
  Search,
  Trash2,
  Calendar,
  ChevronDown,
  Star,
  CreditCard,
  Stethoscope,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  UserPlus,
  ArrowLeft,
  KeyRound,
  Shield,
  Clock,
  Bot,
  Cloud,
  CloudOff,
  ExternalLink,
  RefreshCw,
  Camera,
  Lock,
  CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Center, Staff, ServiceType, JobType, AppSettings, Company, CompanyEmail, Vendor } from "@shared/schema";
import { toProperCase } from "@/lib/proper-case";
import { formatDate } from "@/lib/format-date";


interface CompanyWithRelations extends Company {
  rmStaff?: Staff;
  assistStaff?: Staff;
  preferredMedicalCenter?: Center;
  preferredEidCenter?: Center;
  emails?: CompanyEmail[];
}

const centerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["Medical", "EID", "Both"]),
  authority: z.enum(["DHA", "EHS", "ICP"]).optional().nullable(),
  tier: z.enum(["Normal", "VIP"]).optional().nullable(),
  address: z.string().optional(),
  area: z.string().optional(),
  googleMapsUrl: z.string().url().optional().or(z.literal("")),
  timingText: z.string().optional(),
  notes: z.string().optional(),
});

const staffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  roleTitle: z.string().min(1, "Role is required"),
  staffType: z.enum(["Permanent", "Temporary"]).default("Permanent"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  status: z.enum(["Active", "OnLeave", "Cancelled", "TempActive", "TempInactive"]).default("Active"),
  replacementId: z.string().optional().nullable(),
  leaveEndDate: z.string().optional().nullable(),
});

const serviceTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  requiresMedicalTyping: z.boolean().default(false),
  requiresMedicalScheduling: z.boolean().default(false),
  requiresIdTyping2Years: z.boolean().default(false),
  requiresIdTyping1Year: z.boolean().default(false),
  requiresIdTyping10Years: z.boolean().default(false),
  requiresIdBiometrics: z.boolean().default(false),
});

const jobTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.enum(["Medical", "EID"]),
  cost: z.coerce.number().min(0, "Cost must be positive"),
});

const ccRecipientsSchema = z.object({
  alwaysCc: z.string(),
});

const thresholdSchema = z.object({
  lowBalanceThreshold: z.coerce.number().min(0, "Must be 0 or greater"),
});

const userFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(4, "Min 4 characters").optional().or(z.literal("")),
  role: z.string().min(1, "Role is required"),
  staffId: z.string().optional().or(z.literal("")),
  vendorId: z.string().optional().or(z.literal("")),
});

const vendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

type ImportResult = {
  imported: number;
  failed: number;
  errors: string[];
};

type ImportResponse = {
  results: Record<string, ImportResult>;
  totalImported: number;
  totalFailed: number;
};

type GSheetPreviewRow = {
  rowNum: number;
  woNumber: string;
  companyName: string;
  staffName: string;
  workValue: string;
  date: string;
  designation: string;
  serviceTypeMatch: { id: string; name: string; confidence: 'exact' | 'fuzzy' | 'none' };
  companyMatch: { id: string; name: string; confidence: 'exact' | 'fuzzy' | 'none' };
  canImport: boolean;
  skipReason?: string;
};

type GSheetPreview = {
  totalRows: number;
  importableCount: number;
  skippedCount: number;
  headers: string[];
  rows: GSheetPreviewRow[];
};

const MONTHS_2026 = [
  { label: 'Jan', value: '2026-01' }, { label: 'Feb', value: '2026-02' },
  { label: 'Mar', value: '2026-03' }, { label: 'Apr', value: '2026-04' },
  { label: 'May', value: '2026-05' }, { label: 'Jun', value: '2026-06' },
  { label: 'Jul', value: '2026-07' }, { label: 'Aug', value: '2026-08' },
  { label: 'Sep', value: '2026-09' }, { label: 'Oct', value: '2026-10' },
  { label: 'Nov', value: '2026-11' }, { label: 'Dec', value: '2026-12' },
];

type SheetMonthRecord = {
  id: string; monthYear: string; sheetUrl: string | null;
  status: string; importedCount: number; lastRefreshedAt: string | null; createdAt: string;
};

function MonthlySheetSection() {
  const { toast } = useToast();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const clampedDefault = MONTHS_2026.find(m => m.value === defaultMonth) ? defaultMonth : '2026-01';
  const [selectedMonth, setSelectedMonth] = useState(clampedDefault);
  const [urlInput, setUrlInput] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState<GSheetPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);

  const { data: sheetMonths = [], refetch: refetchMonths } = useQuery<SheetMonthRecord[]>({
    queryKey: ['/api/admin/sheet-months'],
  });

  const currentMonth = sheetMonths.find(m => m.monthYear === selectedMonth);
  const isClosed = currentMonth?.status === 'closed';

  useEffect(() => {
    setUrlInput(currentMonth?.sheetUrl || '');
    setPreview(null);
    setImportResult(null);
  }, [selectedMonth]);

  const handleSaveUrl = async () => {
    if (!urlInput.trim()) return;
    setSavingUrl(true);
    try {
      const res = await fetch('/api/admin/sheet-months/upsert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthYear: selectedMonth, sheetUrl: urlInput.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      await refetchMonths();
      toast({ title: 'URL saved', description: 'You can now click Refresh to parse.' });
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    } finally { setSavingUrl(false); }
  };

  const handleRefresh = async () => {
    if (!currentMonth?.id) {
      toast({ title: 'Save URL first', description: 'Paste the URL and click Save before refreshing.', variant: 'destructive' });
      return;
    }
    setRefreshing(true); setPreview(null); setImportResult(null);
    try {
      const res = await fetch(`/api/admin/sheet-months/${currentMonth.id}/refresh`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Refresh failed' }))).message);
      const data: GSheetPreview = await res.json();
      setPreview(data);
      await refetchMonths();
      if (data.totalRows === 0) toast({ title: 'Sheet appears empty' });
    } catch (e: any) {
      toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' });
    } finally { setRefreshing(false); }
  };

  const handleImport = async () => {
    if (!preview || !currentMonth) return;
    const importableRows = preview.rows.filter(r => r.canImport);
    if (!importableRows.length) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/admin/sheet-months/${currentMonth.id}/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importableRows }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] });
      await refetchMonths();
      if (data.imported > 0) toast({ title: `${data.imported} work orders imported`, description: 'Created as Draft.' });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally { setImporting(false); }
  };

  const monthLabel = MONTHS_2026.find(m => m.value === selectedMonth)?.label;

  return (
    <div className="p-6 rounded-xl bg-muted/30 border border-border/30 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-500/10">
          <CalendarDays className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h3 className="font-medium text-foreground">Monthly Sheet Import — 2026</h3>
          <p className="text-sm text-muted-foreground">Each month links to a Google Sheet. Refresh to pick up new entries. Close a month to lock it permanently.</p>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {MONTHS_2026.map((m) => {
          const rec = sheetMonths.find(s => s.monthYear === m.value);
          const active = m.value === selectedMonth;
          const closed = rec?.status === 'closed';
          return (
            <button
              key={m.value}
              onClick={() => setSelectedMonth(m.value)}
              data-testid={`btn-month-${m.value}`}
              className={[
                'relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                active
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background/60 text-muted-foreground border-border/40 hover:border-border hover:text-foreground',
              ].join(' ')}
            >
              {m.label}
              {rec && !closed && rec.importedCount > 0 && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-500 text-[8px] text-white flex items-center justify-center font-bold">{rec.importedCount > 9 ? '9+' : rec.importedCount}</span>
              )}
              {closed && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-muted-foreground/40 flex items-center justify-center">
                  <Lock className="h-2 w-2 text-muted-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 rounded-xl bg-background/50 border border-border/30 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground">{monthLabel} 2026</span>
            {isClosed ? (
              <Badge variant="secondary" className="gap-1 text-xs"><Lock className="h-2.5 w-2.5" />Closed</Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-green-600 border-green-500/40 dark:text-green-400">Open</Badge>
            )}
            {currentMonth && currentMonth.importedCount > 0 && (
              <span className="text-xs text-muted-foreground">{currentMonth.importedCount} imported</span>
            )}
            {currentMonth?.lastRefreshedAt && (
              <span className="text-xs text-muted-foreground hidden sm:inline">· Last refreshed {new Date(currentMonth.lastRefreshedAt).toLocaleString()}</span>
            )}
          </div>
          {!isClosed && currentMonth && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive text-xs" data-testid={`btn-close-month-${selectedMonth}`}>
                  <Lock className="h-3.5 w-3.5 mr-1.5" />Close Month
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close {monthLabel} 2026?</AlertDialogTitle>
                  <AlertDialogDescription>This will lock the month permanently. No further parsing or importing will be allowed. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={async () => {
                    if (!currentMonth) return;
                    try {
                      const res = await fetch(`/api/admin/sheet-months/${currentMonth.id}/close`, { method: 'POST' });
                      if (!res.ok) throw new Error((await res.json()).message);
                      await refetchMonths();
                      toast({ title: `${monthLabel} 2026 closed`, description: 'No further imports allowed for this month.' });
                    } catch (e: any) {
                      toast({ title: 'Failed to close month', description: e.message, variant: 'destructive' });
                    }
                  }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Close Month</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {isClosed ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Lock className="h-4 w-4" />
            <span>This month is closed. No further parsing or importing is allowed.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveUrl()}
                className="flex-1 text-sm"
                data-testid={`input-sheet-url-${selectedMonth}`}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveUrl}
                disabled={savingUrl || !urlInput.trim() || urlInput.trim() === (currentMonth?.sheetUrl || '')}
                data-testid={`btn-save-url-${selectedMonth}`}
              >
                {savingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
              </Button>
              <Button
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing || !currentMonth?.sheetUrl}
                data-testid={`btn-refresh-${selectedMonth}`}
              >
                {refreshing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                {refreshing ? 'Parsing...' : 'Refresh'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Expected columns: <span className="font-mono">Work Order, Company Name, Staff Name, Work</span>. Rows with empty or unrecognized "Work" values will be skipped automatically.</p>
          </div>
        )}
      </div>

      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="text-muted-foreground">{preview.totalRows} rows found</span>
              <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />{preview.importableCount} ready
              </span>
              {preview.skippedCount > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />{preview.skippedCount} skipped
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Row</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">WO Number</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Applicant</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Company</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Service Type</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNum} className={`border-b border-border/20 ${!row.canImport ? 'opacity-50' : ''}`} data-testid={`row-monthly-${row.rowNum}`}>
                    <td className="py-2 px-3 text-muted-foreground text-xs">{row.rowNum}</td>
                    <td className="py-2 px-3 font-mono text-xs">{row.woNumber || '—'}</td>
                    <td className="py-2 px-3">{row.staffName || '—'}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{row.companyName || '—'}</span>
                        {row.companyMatch.confidence === 'exact' && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{row.companyMatch.name}</Badge>}
                        {row.companyMatch.confidence === 'fuzzy' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600 dark:text-amber-400">~{row.companyMatch.name}</Badge>}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{row.workValue || '—'}</span>
                        {row.serviceTypeMatch.confidence === 'exact' && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{row.serviceTypeMatch.name}</Badge>}
                        {row.serviceTypeMatch.confidence === 'fuzzy' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600 dark:text-amber-400">~{row.serviceTypeMatch.name}</Badge>}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {row.canImport ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" />Ready</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"><AlertCircle className="h-3.5 w-3.5" />{row.skipReason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.importableCount > 0 && !importResult && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-sm text-muted-foreground">{preview.importableCount} work orders will be created as Draft.</p>
              <Button onClick={handleImport} disabled={importing} data-testid={`btn-import-${selectedMonth}`}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {importing ? 'Importing...' : `Import ${preview.importableCount} Work Orders`}
              </Button>
            </div>
          )}

          {importResult && (
            <div className="p-4 rounded-lg border border-border/30 bg-background/50 space-y-2">
              <div className="flex items-center gap-4 text-sm flex-wrap">
                {importResult.imported > 0 && <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400"><CheckCircle2 className="h-4 w-4" />{importResult.imported} imported</span>}
                {importResult.failed > 0 && <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400"><XCircle className="h-4 w-4" />{importResult.failed} failed</span>}
              </div>
              {importResult.errors.length > 0 && (
                <div className="space-y-1 mt-2">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImportExportSection() {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResponse | null>(null);

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch("/api/admin/template");
      if (!response.ok) throw new Error("Failed to download template");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "PRO_Company_Import_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Template downloaded", description: "Fill in your data and upload it back using the Import button." });
    } catch {
      toast({ title: "Download failed", description: "Could not download the template file.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast({ title: "Invalid file", description: "Please upload an Excel file (.xlsx or .xls).", variant: "destructive" });
      e.target.value = "";
      return;
    }

    setIsImporting(true);
    setImportResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/import", { method: "POST", body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Import failed" }));
        throw new Error(err.message || "Import failed");
      }
      const data: ImportResponse = await response.json();
      setImportResults(data);
      
      if (data.totalImported > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
        queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
        queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
        queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      }

      if (data.totalFailed === 0 && data.totalImported > 0) {
        toast({ title: "Import successful", description: `${data.totalImported} records imported successfully.` });
      } else if (data.totalImported > 0 && data.totalFailed > 0) {
        toast({ title: "Partial import", description: `${data.totalImported} imported, ${data.totalFailed} failed. Check details below.`, variant: "destructive" });
      } else if (data.totalImported === 0 && data.totalFailed > 0) {
        toast({ title: "Import failed", description: `All ${data.totalFailed} rows failed. Check details below.`, variant: "destructive" });
      } else {
        toast({ title: "No data found", description: "The uploaded file didn't contain any recognizable data rows." });
      }
    } catch (error: any) {
      toast({ title: "Import error", description: error.message || "Something went wrong during import.", variant: "destructive" });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const sheetNames = importResults ? Object.keys(importResults.results) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-muted/30 border border-border/30 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground" data-testid="text-download-title">Download Template</h3>
              <p className="text-sm text-muted-foreground">Get a pre-formatted Excel file to fill in your data</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            The template includes sheets for Centers, Companies, Staff, Service Types, and Job Types with example rows showing the expected format.
          </p>
          <Button onClick={handleDownloadTemplate} disabled={isDownloading} data-testid="button-download-template">
            {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {isDownloading ? "Downloading..." : "Download Template"}
          </Button>
        </div>

        <div className="p-6 rounded-xl bg-muted/30 border border-border/30 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground" data-testid="text-upload-title">Import Data</h3>
              <p className="text-sm text-muted-foreground">Upload a filled Excel file to bulk-load records</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload your completed template. Each sheet will be processed independently — failed rows won't block successful ones.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => document.getElementById("import-file-input")?.click()}
              disabled={isImporting}
              data-testid="button-upload-import"
            >
              {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {isImporting ? "Importing..." : "Choose File & Import"}
            </Button>
            <input
              id="import-file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
              data-testid="input-import-file"
            />
          </div>
        </div>
      </div>

      <MonthlySheetSection />

      {importResults && (
        <div className="p-6 rounded-xl bg-muted/30 border border-border/30 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium text-foreground" data-testid="text-import-results-title">Import Results</h3>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-foreground font-medium" data-testid="text-total-imported">{importResults.totalImported}</span>
              <span className="text-muted-foreground">imported</span>
            </div>
            {importResults.totalFailed > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-foreground font-medium" data-testid="text-total-failed">{importResults.totalFailed}</span>
                <span className="text-muted-foreground">failed</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {sheetNames.map((sheet) => {
              const result = importResults.results[sheet];
              return (
                <div key={sheet} className="p-4 rounded-lg border border-border/30 bg-background/50" data-testid={`card-import-result-${sheet.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{sheet}</span>
                    <div className="flex items-center gap-3 text-xs">
                      {result.imported > 0 && (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {result.imported} imported
                        </span>
                      )}
                      {result.failed > 0 && (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <XCircle className="h-3.5 w-3.5" />
                          {result.failed} failed
                        </span>
                      )}
                      {result.imported === 0 && result.failed === 0 && (
                        <span className="text-muted-foreground">No data</span>
                      )}
                    </div>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {result.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("companies");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [centerDialogOpen, setCenterDialogOpen] = useState(false);
  const [editCenterDialogOpen, setEditCenterDialogOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editStaffDialogOpen, setEditStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editServiceDialogOpen, setEditServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [jobTypeDialogOpen, setJobTypeDialogOpen] = useState(false);
  const [editJobTypeDialogOpen, setEditJobTypeDialogOpen] = useState(false);
  const [editingJobType, setEditingJobType] = useState<JobType | null>(null);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editVendorDialogOpen, setEditVendorDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorLogoPreview, setVendorLogoPreview] = useState<string | null>(null);
  const [vendorLogoUploading, setVendorLogoUploading] = useState(false);
  const vendorLogoInputRef = useRef<HTMLInputElement>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [editCcDialogOpen, setEditCcDialogOpen] = useState(false);
  const [editThresholdDialogOpen, setEditThresholdDialogOpen] = useState(false);
  const [editMaintenanceMsgOpen, setEditMaintenanceMsgOpen] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [editWhatsappOpen, setEditWhatsappOpen] = useState(false);
  const [whatsappNum, setWhatsappNum] = useState("");
  const [editFollowUpCenterOpen, setEditFollowUpCenterOpen] = useState(false);
  const [followUpCenterVal, setFollowUpCenterVal] = useState("");
  const [editLegalOpen, setEditLegalOpen] = useState(false);
  const [legalContent, setLegalContent] = useState("");
  const [legalType, setLegalType] = useState<"privacy" | "terms">("privacy");
  const [companySearch, setCompanySearch] = useState("");
  const [centerSearch, setCenterSearch] = useState("");
  const [adminStaffSearch, setAdminStaffSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [bulkServiceDialogOpen, setBulkServiceDialogOpen] = useState(false);
  const [bulkServiceNames, setBulkServiceNames] = useState("");
  const [selectedCenters, setSelectedCenters] = useState<string[]>([]);
  const [centerSectionsOpen, setCenterSectionsOpen] = useState({
    medicalVip: false,
    medicalNormal: false,
    eidVip: false,
    eidNormal: false
  });
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [statusPopoverId, setStatusPopoverId] = useState<string | null>(null);
  const [statusChangeData, setStatusChangeData] = useState<{
    status: string;
    leaveEndDate: string;
    replacementId: string;
  }>({ status: "", leaveEndDate: "", replacementId: "" });
  const { toast } = useToast();

  const { data: companies, isLoading: companiesLoading } = useQuery<CompanyWithRelations[]>({
    queryKey: ["/api/companies"],
  });

  const { data: centers, isLoading: centersLoading } = useQuery<Center[]>({
    queryKey: ["/api/centers"],
  });

  const { data: staffList, isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const { data: serviceTypes, isLoading: servicesLoading } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const { data: jobTypes, isLoading: jobTypesLoading } = useQuery<JobType[]>({
    queryKey: ["/api/job-types"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: vendors, isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: userAccounts, isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const filteredCompanies = companies?.filter((company) =>
    !companySearch || company.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const filteredAdminCenters = useMemo(() => {
    if (!centers) return [];
    if (!centerSearch.trim()) return centers;
    const q = centerSearch.toLowerCase();
    return centers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.area || "").toLowerCase().includes(q) ||
      (c.address || "").toLowerCase().includes(q)
    );
  }, [centers, centerSearch]);

  const filteredAdminStaff = useMemo(() => {
    if (!staffList) return [];
    if (!adminStaffSearch.trim()) return staffList;
    const q = adminStaffSearch.toLowerCase();
    return staffList.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.roleTitle || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.phone || "").toLowerCase().includes(q)
    );
  }, [staffList, adminStaffSearch]);

  const filteredAdminServices = useMemo(() => {
    if (!serviceTypes) return [];
    if (!serviceSearch.trim()) return serviceTypes;
    const q = serviceSearch.toLowerCase();
    return serviceTypes.filter(s =>
      s.name.toLowerCase().includes(q)
    );
  }, [serviceTypes, serviceSearch]);

  const filteredAdminAccounts = useMemo(() => {
    if (!userAccounts) return [];
    if (!accountSearch.trim()) return userAccounts;
    const q = accountSearch.toLowerCase();
    return userAccounts.filter((u: any) =>
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  }, [userAccounts, accountSearch]);

  const centerForm = useForm({
    resolver: zodResolver(centerSchema),
    defaultValues: {
      name: "",
      type: "Both" as const,
      authority: null as "DHA" | "EHS" | null,
      tier: null as "Normal" | "VIP" | null,
      address: "",
      area: "",
      googleMapsUrl: "",
      timingText: "",
      notes: "",
    },
  });

  const editCenterForm = useForm<z.infer<typeof centerSchema>>({
    resolver: zodResolver(centerSchema),
    defaultValues: {
      name: "",
      type: "Both",
      authority: null,
      tier: null,
      address: "",
      area: "",
      googleMapsUrl: "",
      timingText: "",
      notes: "",
    },
  });

  const staffForm = useForm<z.infer<typeof staffSchema>>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      roleTitle: "",
      staffType: "Permanent",
      phone: "",
      email: "",
      status: "Active",
      replacementId: null,
    },
  });

  const editStaffForm = useForm<z.infer<typeof staffSchema>>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      roleTitle: "",
      staffType: "Permanent",
      phone: "",
      email: "",
      status: "Active",
      replacementId: null,
    },
  });

  const serviceForm = useForm({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: "",
      requiresMedicalTyping: false,
      requiresMedicalScheduling: false,
      requiresIdTyping2Years: false,
      requiresIdTyping1Year: false,
      requiresIdTyping10Years: false,
      requiresIdBiometrics: false,
    },
  });

  const editServiceForm = useForm({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: "",
      requiresMedicalTyping: false,
      requiresMedicalScheduling: false,
      requiresIdTyping2Years: false,
      requiresIdTyping1Year: false,
      requiresIdTyping10Years: false,
      requiresIdBiometrics: false,
    },
  });

  const jobTypeForm = useForm({
    resolver: zodResolver(jobTypeSchema),
    defaultValues: {
      name: "",
      category: "Medical" as const,
      cost: 0,
    },
  });

  const editJobTypeForm = useForm<z.infer<typeof jobTypeSchema>>({
    resolver: zodResolver(jobTypeSchema),
    defaultValues: {
      name: "",
      category: "Medical",
      cost: 0,
    },
  });

  const ccForm = useForm({
    resolver: zodResolver(ccRecipientsSchema),
    defaultValues: {
      alwaysCc: "",
    },
  });

  const thresholdForm = useForm({
    resolver: zodResolver(thresholdSchema),
    defaultValues: {
      lowBalanceThreshold: 1000,
    },
  });

  const vendorForm = useForm<z.infer<typeof vendorSchema>>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
    },
  });

  const userForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "",
      staffId: "",
      vendorId: "",
    },
  });

  const editUserForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "",
      staffId: "",
      vendorId: "",
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userFormSchema>) => {
      const payload: any = { ...data };
      if (payload.staffId === "") delete payload.staffId;
      if (payload.vendorId === "") delete payload.vendorId;
      if (payload.password === "") delete payload.password;
      return apiRequest("POST", "/api/users", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created successfully" });
      setUserDialogOpen(false);
      userForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userFormSchema> & { id: string }) => {
      const { id, ...rest } = data;
      const payload: any = { ...rest };
      if (payload.staffId === "") delete payload.staffId;
      if (payload.vendorId === "") delete payload.vendorId;
      if (payload.password === "") delete payload.password;
      return apiRequest("PATCH", `/api/users/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated successfully" });
      setEditingUser(null);
      editUserForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; newPassword: string }) => {
      const res = await apiRequest("PUT", "/api/admin/reset-user-password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password reset successfully" });
      setResetPasswordUser(null);
      setResetPasswordValue("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reset password", description: error.message, variant: "destructive" });
    },
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      return apiRequest("PATCH", `/api/users/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const editVendorForm = useForm<z.infer<typeof vendorSchema>>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
    },
  });

  const createVendorMutation = useMutation({
    mutationFn: async (data: z.infer<typeof vendorSchema>) => {
      return apiRequest("POST", "/api/vendors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({ title: "Vendor added successfully" });
      setVendorDialogOpen(false);
      vendorForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateVendorMutation = useMutation({
    mutationFn: async (data: z.infer<typeof vendorSchema> & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", `/api/vendors/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({ title: "Vendor updated successfully" });
      setEditVendorDialogOpen(false);
      setEditingVendor(null);
      editVendorForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/vendors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({ title: "Vendor deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  async function handleVendorLogoUpload(file: File) {
    if (!editingVendor) return;
    setVendorLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch(`/api/vendors/${editingVendor.id}/logo`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { logoUrl } = await res.json();
      setVendorLogoPreview(logoUrl + "?t=" + Date.now());
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({ title: "Logo updated", description: "Vendor logo has been saved." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload logo.", variant: "destructive" });
    } finally {
      setVendorLogoUploading(false);
    }
  }

  const createCenterMutation = useMutation({
    mutationFn: async (data: z.infer<typeof centerSchema>) => {
      return apiRequest("POST", "/api/centers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      toast({ title: "Center added successfully" });
      setCenterDialogOpen(false);
      centerForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCenterMutation = useMutation({
    mutationFn: async (data: z.infer<typeof centerSchema> & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", `/api/centers/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      toast({ title: "Center updated successfully" });
      setEditCenterDialogOpen(false);
      setEditingCenter(null);
      editCenterForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: z.infer<typeof staffSchema>) => {
      return apiRequest("POST", "/api/staff", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff added successfully" });
      setStaffDialogOpen(false);
      staffForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: async (data: z.infer<typeof staffSchema> & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", `/api/staff/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff updated successfully" });
      setEditStaffDialogOpen(false);
      setEditingStaff(null);
      editStaffForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStaffStatusMutation = useMutation({
    mutationFn: async (data: { 
      id: string; 
      status: string; 
      leaveEndDate?: string; 
      replacementId?: string;
    }) => {
      const { id, ...rest } = data;
      // Update the staff member's status
      await apiRequest("PUT", `/api/staff/${id}`, rest);
      
      // If a replacement is selected and they are temporary, activate them
      if (rest.status === "OnLeave" && rest.replacementId) {
        const replacement = staffList?.find((s: Staff) => s.id === rest.replacementId);
        if (replacement && replacement.staffType === "Temporary") {
          await apiRequest("PUT", `/api/staff/${rest.replacementId}`, { status: "TempActive" });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff status updated successfully" });
      setStatusPopoverId(null);
      setStatusChangeData({ status: "", leaveEndDate: "", replacementId: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof serviceTypeSchema>) => {
      return apiRequest("POST", "/api/service-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: "Service type added successfully" });
      setServiceDialogOpen(false);
      serviceForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof serviceTypeSchema> & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", `/api/service-types/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: "Service type updated successfully" });
      setEditServiceDialogOpen(false);
      setEditingService(null);
      editServiceForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createJobTypeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof jobTypeSchema>) => {
      return apiRequest("POST", "/api/job-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      toast({ title: "Job type added successfully" });
      setJobTypeDialogOpen(false);
      jobTypeForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateJobTypeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof jobTypeSchema> & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PUT", `/api/job-types/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      toast({ title: "Job type updated successfully" });
      setEditJobTypeDialogOpen(false);
      setEditingJobType(null);
      editJobTypeForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<AppSettings>) => {
      return apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings updated successfully" });
      setEditCcDialogOpen(false);
      setEditThresholdDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const maintenanceToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PUT", "/api/settings", { maintenanceMode: enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Maintenance mode updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const deleteCenterMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/centers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      toast({ title: "Center deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/service-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: "Service type deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteJobTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/job-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      toast({ title: "Job type deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkCreateServicesMutation = useMutation({
    mutationFn: async (names: string[]) => {
      return apiRequest("POST", "/api/service-types/bulk", { names });
    },
    onSuccess: (_, names) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: `${names.length} service types added successfully` });
      setBulkServiceDialogOpen(false);
      setBulkServiceNames("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteCentersMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/centers/bulk", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      toast({ title: `${selectedCenters.length} centers deleted successfully` });
      setSelectedCenters([]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteStaffMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/staff/bulk", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: `${selectedStaff.length} staff members deleted successfully` });
      setSelectedStaff([]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteServicesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/service-types/bulk", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: `${selectedServices.length} service types deleted successfully` });
      setSelectedServices([]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteJobTypesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/job-types/bulk", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-types"] });
      toast({ title: `${selectedJobTypes.length} job types deleted successfully` });
      setSelectedJobTypes([]);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditCenter = (center: Center) => {
    setEditingCenter(center);
    editCenterForm.reset({
      name: center.name,
      type: center.type as "Medical" | "EID" | "Both",
      authority: center.authority as "DHA" | "EHS" | null,
      tier: center.tier as "Normal" | "VIP" | null,
      address: center.address || "",
      area: center.area || "",
      googleMapsUrl: center.googleMapsUrl || "",
      timingText: center.timingText || "",
      notes: center.notes || "",
    });
    setEditCenterDialogOpen(true);
  };

  const handleEditStaff = (member: Staff) => {
    setEditingStaff(member);
    editStaffForm.reset({
      name: member.name,
      roleTitle: member.roleTitle,
      staffType: member.staffType || "Permanent",
      phone: member.phone || "",
      email: member.email || "",
      status: member.status || "Active",
      replacementId: member.replacementId ?? null,
    });
    setEditStaffDialogOpen(true);
  };

  const handleEditService = (service: ServiceType) => {
    setEditingService(service);
    editServiceForm.reset({
      name: service.name,
      requiresMedicalTyping: service.requiresMedicalTyping,
      requiresMedicalScheduling: service.requiresMedicalScheduling,
      requiresIdTyping2Years: service.requiresIdTyping2Years,
      requiresIdTyping1Year: service.requiresIdTyping1Year,
      requiresIdTyping10Years: service.requiresIdTyping10Years,
      requiresIdBiometrics: service.requiresIdBiometrics,
    });
    setEditServiceDialogOpen(true);
  };

  const handleEditJobType = (jobType: JobType) => {
    setEditingJobType(jobType);
    editJobTypeForm.reset({
      name: jobType.name,
      category: jobType.category as "Medical" | "EID",
      cost: jobType.cost,
    });
    setEditJobTypeDialogOpen(true);
  };

  const handleEditCc = () => {
    ccForm.reset({
      alwaysCc: settings?.alwaysCc?.join(", ") || "",
    });
    setEditCcDialogOpen(true);
  };

  const handleEditThreshold = () => {
    thresholdForm.reset({
      lowBalanceThreshold: settings?.lowBalanceThreshold || 1000,
    });
    setEditThresholdDialogOpen(true);
  };

  const handleSubmitCc = (data: z.infer<typeof ccRecipientsSchema>) => {
    const emails = data.alwaysCc
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
    updateSettingsMutation.mutate({ alwaysCc: emails });
  };

  const handleSubmitThreshold = (data: z.infer<typeof thresholdSchema>) => {
    updateSettingsMutation.mutate({ lowBalanceThreshold: data.lowBalanceThreshold });
  };

  return (
    <AppLayout>
      {/* Header Section */}
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
            <h1 className="text-xl font-semibold text-foreground">
              {activeSection === "organization" ? "Organization" :
               activeSection === "vendor" ? "Vendor Management" :
               activeSection === "admin" ? "Administration" :
               activeSection === "settings" ? "Settings" :
               activeSection === "future" ? "Future Updates" :
               "Admin Console"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeSection === "organization" ? "Manage companies, centers, staff, and services" :
               activeSection === "vendor" ? "Manage vendors and job types" :
               activeSection === "admin" ? "User accounts, data import/export, and change log" :
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
              { key: "settings", icon: Settings, title: "Settings", desc: "Email & system configuration", defaultTab: "settings", count: null },
              { key: "future", icon: Clock, title: "Future Updates", desc: "Bots, Manager Console (coming soon)", defaultTab: "future", count: null },
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
                    <h3 className="font-medium text-foreground">{section.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{section.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : activeSection === "settings" ? (
          <div className="premium-card overflow-hidden p-6">
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-foreground mb-4">Email Configuration</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">Always CC Recipients</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {settings?.alwaysCc?.join(", ") || "No CC recipients configured"}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-xl"
                        onClick={handleEditCc}
                        data-testid="button-edit-cc"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">Low Balance Threshold</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          AED {settings?.lowBalanceThreshold?.toLocaleString() || "1,000"}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-xl"
                        onClick={handleEditThreshold}
                        data-testid="button-edit-threshold"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-4">System Status</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">Maintenance Mode</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          When enabled, a maintenance banner will appear on login pages.
                        </p>
                      </div>
                      <Switch
                        checked={settings?.maintenanceMode || false}
                        onCheckedChange={(checked) => maintenanceToggleMutation.mutate(checked)}
                        data-testid="switch-maintenance-mode"
                      />
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">Maintenance Message</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {settings?.maintenanceMessage || "Default message will be shown"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => {
                          setMaintenanceMsg(settings?.maintenanceMessage || "");
                          setEditMaintenanceMsgOpen(true);
                        }}
                        data-testid="button-edit-maintenance-msg"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">WhatsApp Support Number</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {settings?.whatsappNumber || "Not configured"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => {
                          setWhatsappNum(settings?.whatsappNumber || "");
                          setEditWhatsappOpen(true);
                        }}
                        data-testid="button-edit-whatsapp"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">Follow-Up Center</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {settings?.followUpCenter || "Not configured"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Default center for medical follow-up appointments</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => {
                          setFollowUpCenterVal(settings?.followUpCenter || "");
                          setEditFollowUpCenterOpen(true);
                        }}
                        data-testid="button-edit-followup-center"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-4">Legal Pages</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">Privacy Policy</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {settings?.privacyPolicyHtml ? "Content configured" : "Not yet configured"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => {
                          setLegalContent(settings?.privacyPolicyHtml || "");
                          setLegalType("privacy");
                          setEditLegalOpen(true);
                        }}
                        data-testid="button-edit-privacy-policy"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">Terms of Service</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {settings?.termsOfServiceHtml ? "Content configured" : "Not yet configured"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => {
                          setLegalContent(settings?.termsOfServiceHtml || "");
                          setLegalType("terms");
                          setEditLegalOpen(true);
                        }}
                        data-testid="button-edit-terms-of-service"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Dialog open={editCcDialogOpen} onOpenChange={setEditCcDialogOpen}>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Edit CC Recipients</DialogTitle>
                </DialogHeader>
                <Form {...ccForm}>
                  <form onSubmit={ccForm.handleSubmit(handleSubmitCc)} className="space-y-4">
                    <FormField
                      control={ccForm.control}
                      name="alwaysCc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Addresses</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="email1@example.com, email2@example.com" 
                              className="rounded-xl"
                              rows={3}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditCcDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="rounded-xl" disabled={updateSettingsMutation.isPending}>
                        {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={editThresholdDialogOpen} onOpenChange={setEditThresholdDialogOpen}>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Low Balance Threshold</DialogTitle>
                </DialogHeader>
                <Form {...thresholdForm}>
                  <form onSubmit={thresholdForm.handleSubmit(handleSubmitThreshold)} className="space-y-4">
                    <FormField
                      control={thresholdForm.control}
                      name="lowBalanceThreshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Threshold Amount (AED)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              placeholder="1000" 
                              className="h-11 rounded-xl"
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">You'll be warned when balance falls below this amount</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditThresholdDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="rounded-xl" disabled={updateSettingsMutation.isPending}>
                        {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={editMaintenanceMsgOpen} onOpenChange={setEditMaintenanceMsgOpen}>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Maintenance Message</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    value={maintenanceMsg}
                    onChange={(e) => setMaintenanceMsg(e.target.value)}
                    placeholder="System maintenance in progress..."
                    rows={3}
                    className="rounded-xl"
                    data-testid="input-maintenance-message"
                  />
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" className="rounded-xl" onClick={() => setEditMaintenanceMsgOpen(false)}>Cancel</Button>
                    <Button
                      className="rounded-xl"
                      onClick={async () => {
                        try {
                          await apiRequest("PUT", "/api/settings", { maintenanceMessage: maintenanceMsg });
                          queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                          toast({ title: "Maintenance message updated" });
                          setEditMaintenanceMsgOpen(false);
                        } catch (e) {
                          toast({ title: "Failed to update", variant: "destructive" });
                        }
                      }}
                      data-testid="button-save-maintenance-msg"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={editWhatsappOpen} onOpenChange={setEditWhatsappOpen}>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Edit WhatsApp Number</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    value={whatsappNum}
                    onChange={(e) => setWhatsappNum(e.target.value)}
                    placeholder="+971000000000"
                    className="h-11 rounded-xl"
                    data-testid="input-whatsapp-number"
                  />
                  <p className="text-xs text-muted-foreground">Include country code (e.g., +971 for UAE)</p>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" className="rounded-xl" onClick={() => setEditWhatsappOpen(false)}>Cancel</Button>
                    <Button
                      className="rounded-xl"
                      onClick={async () => {
                        try {
                          await apiRequest("PUT", "/api/settings", { whatsappNumber: whatsappNum });
                          queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                          toast({ title: "WhatsApp number updated" });
                          setEditWhatsappOpen(false);
                        } catch (e) {
                          toast({ title: "Failed to update", variant: "destructive" });
                        }
                      }}
                      data-testid="button-save-whatsapp"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={editFollowUpCenterOpen} onOpenChange={setEditFollowUpCenterOpen}>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Follow-Up Center</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    value={followUpCenterVal}
                    onChange={(e) => setFollowUpCenterVal(e.target.value)}
                    placeholder="Center name for follow-up appointments"
                    className="h-11 rounded-xl"
                    data-testid="input-followup-center"
                  />
                  <p className="text-xs text-muted-foreground">The default center used when scheduling medical follow-up appointments (e.g. retests)</p>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" className="rounded-xl" onClick={() => setEditFollowUpCenterOpen(false)}>Cancel</Button>
                    <Button
                      className="rounded-xl"
                      onClick={async () => {
                        try {
                          await apiRequest("PUT", "/api/settings", { followUpCenter: followUpCenterVal || null });
                          queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                          toast({ title: "Follow-up center updated" });
                          setEditFollowUpCenterOpen(false);
                        } catch (e) {
                          toast({ title: "Failed to update", variant: "destructive" });
                        }
                      }}
                      data-testid="button-save-followup-center"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={editLegalOpen} onOpenChange={setEditLegalOpen}>
              <DialogContent className="rounded-2xl max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{legalType === "privacy" ? "Privacy Policy" : "Terms of Service"}</DialogTitle>
                  <DialogDescription>Enter the content in HTML format. This will be displayed on the public-facing page.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    value={legalContent}
                    onChange={(e) => setLegalContent(e.target.value)}
                    placeholder="<h2>Section Title</h2><p>Content here...</p>"
                    rows={12}
                    className="rounded-xl font-mono text-sm"
                    data-testid="input-legal-content"
                  />
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" className="rounded-xl" onClick={() => setEditLegalOpen(false)}>Cancel</Button>
                    <Button
                      className="rounded-xl"
                      onClick={async () => {
                        try {
                          const field = legalType === "privacy" ? "privacyPolicyHtml" : "termsOfServiceHtml";
                          await apiRequest("PUT", "/api/settings", { [field]: legalContent });
                          queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                          toast({ title: `${legalType === "privacy" ? "Privacy Policy" : "Terms of Service"} updated` });
                          setEditLegalOpen(false);
                        } catch (e) {
                          toast({ title: "Failed to update", variant: "destructive" });
                        }
                      }}
                      data-testid="button-save-legal"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : activeSection === "future" ? (
          <div className="premium-card overflow-hidden p-6">
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Bots</p>
                    <p className="text-sm text-muted-foreground">Quick Paste WO and Appointment Scheduler bots for streamlined workflows</p>
                  </div>
                  <span className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded-lg">Coming Soon</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Manager Console</p>
                    <p className="text-sm text-muted-foreground">PIN-protected console for CRM managers to manage system configuration</p>
                  </div>
                  <span className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded-lg">Coming Soon</span>
                </div>
              </div>
            </div>
          </div>
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
                  </>
                )}
              </TabsList>

            {/* Companies Tab */}
            <TabsContent value="companies" className="p-4">
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
            </TabsContent>

            {/* Centers Tab */}
            <TabsContent value="centers" className="p-4">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground text-sm">Medical & EID Centers</h3>
                  {selectedCenters.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl" data-testid="button-bulk-delete-centers">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete ({selectedCenters.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Centers</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedCenters.length} centers? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="rounded-xl"
                            onClick={() => bulkDeleteCentersMutation.mutate(selectedCenters)}
                          >
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <Dialog open={centerDialogOpen} onOpenChange={setCenterDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-center">
                      <Plus className="h-4 w-4" />
                      Add Center
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Center</DialogTitle>
                    </DialogHeader>
                    <Form {...centerForm}>
                      <form onSubmit={centerForm.handleSubmit((data) => createCenterMutation.mutate(data))} className="space-y-3">
                        <FormField
                          control={centerForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Center Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., AMER Center Dubai" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) centerForm.setValue("name", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={centerForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="Medical">Medical</SelectItem>
                                  <SelectItem value="EID">Emirates ID</SelectItem>
                                  <SelectItem value="Both">Both</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={centerForm.control}
                          name="authority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Authority</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue placeholder="Select authority" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  {((centerForm.watch("type") as string) === "EID") ? (
                                    <SelectItem value="ICP">ICP</SelectItem>
                                  ) : ((centerForm.watch("type") as string) === "Medical") ? (
                                    <>
                                      <SelectItem value="DHA">DHA</SelectItem>
                                      <SelectItem value="EHS">EHS</SelectItem>
                                    </>
                                  ) : (
                                    <>
                                      <SelectItem value="DHA">DHA</SelectItem>
                                      <SelectItem value="EHS">EHS</SelectItem>
                                      <SelectItem value="ICP">ICP</SelectItem>
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>
                        <FormField
                          control={centerForm.control}
                          name="tier"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tier</FormLabel>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={`flex-1 rounded-lg ${field.value === "Normal" ? "bg-primary text-primary-foreground border-primary" : ""}`}
                                  onClick={() => field.onChange("Normal")}
                                  data-testid="button-tier-normal"
                                >
                                  Normal
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={`flex-1 rounded-lg ${field.value === "VIP" ? "bg-amber-500 text-white border-amber-500" : ""}`}
                                  onClick={() => field.onChange("VIP")}
                                  data-testid="button-tier-vip"
                                >
                                  VIP
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={centerForm.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Full address" className="h-11 rounded-xl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={centerForm.control}
                          name="area"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Area</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Downtown Dubai" className="h-11 rounded-xl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>
                        <FormField
                          control={centerForm.control}
                          name="googleMapsUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Google Maps URL</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="https://maps.google.com/..." className="h-11 rounded-xl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={centerForm.control}
                          name="timingText"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Timing Text</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Sun-Thu 8AM-4PM" className="h-11 rounded-xl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={centerForm.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Additional notes..." className="rounded-xl min-h-[38px] max-h-[80px]" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>
                        <div className="flex justify-end gap-2 pt-3">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCenterDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" className="rounded-xl" disabled={createCenterMutation.isPending}>
                            {createCenterMutation.isPending ? "Adding..." : "Add Center"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Edit Center Dialog */}
              <Dialog open={editCenterDialogOpen} onOpenChange={setEditCenterDialogOpen}>
                <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Center</DialogTitle>
                  </DialogHeader>
                  <Form {...editCenterForm}>
                    <form onSubmit={editCenterForm.handleSubmit((data) => editingCenter && updateCenterMutation.mutate({ ...data, id: editingCenter.id }))} className="space-y-3">
                      <FormField
                        control={editCenterForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Center Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., AMER Center Dubai" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) editCenterForm.setValue("name", toProperCase(e.target.value)); }} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={editCenterForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="Medical">Medical</SelectItem>
                                <SelectItem value="EID">Emirates ID</SelectItem>
                                <SelectItem value="Both">Both</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCenterForm.control}
                        name="authority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Authority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl">
                                  <SelectValue placeholder="Select authority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                {((editCenterForm.watch("type") as string) === "EID") ? (
                                  <SelectItem value="ICP">ICP</SelectItem>
                                ) : ((editCenterForm.watch("type") as string) === "Medical") ? (
                                  <>
                                    <SelectItem value="DHA">DHA</SelectItem>
                                    <SelectItem value="EHS">EHS</SelectItem>
                                  </>
                                ) : (
                                  <>
                                    <SelectItem value="DHA">DHA</SelectItem>
                                    <SelectItem value="EHS">EHS</SelectItem>
                                    <SelectItem value="ICP">ICP</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      </div>
                      <FormField
                        control={editCenterForm.control}
                        name="tier"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tier</FormLabel>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={`flex-1 rounded-lg ${field.value === "Normal" ? "bg-primary text-primary-foreground border-primary" : ""}`}
                                onClick={() => field.onChange("Normal")}
                                data-testid="button-tier-normal"
                              >
                                Normal
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={`flex-1 rounded-lg ${field.value === "VIP" ? "bg-amber-500 text-white border-amber-500" : ""}`}
                                onClick={() => field.onChange("VIP")}
                                data-testid="button-tier-vip"
                              >
                                VIP
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={editCenterForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Full address" className="h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCenterForm.control}
                        name="area"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Area</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Downtown Dubai" className="h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      </div>
                      <FormField
                        control={editCenterForm.control}
                        name="googleMapsUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Google Maps URL</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://maps.google.com/..." className="h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={editCenterForm.control}
                        name="timingText"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timing Text</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Sun-Thu 8AM-4PM" className="h-11 rounded-xl" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editCenterForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Additional notes..." className="rounded-xl min-h-[38px] max-h-[80px]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      </div>
                      <div className="flex justify-end gap-2 pt-3">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditCenterDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="rounded-xl" disabled={updateCenterMutation.isPending}>
                          {updateCenterMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search centers..."
                  value={centerSearch}
                  onChange={(e) => setCenterSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-admin-centers"
                />
              </div>

              {centersLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                </div>
              ) : filteredAdminCenters && filteredAdminCenters.length > 0 ? (
                <div className="space-y-4">
                  {/* Medical Centers Group */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                      <Stethoscope className="h-3 w-3 text-white" />
                    </div>
                    <span className="font-semibold text-sm text-foreground">Medical Centers</span>
                  </div>

                  {/* Medical Centers (VIP) */}
                  {(() => {
                    const medicalVipCenters = filteredAdminCenters.filter((c: Center) => (c.type === "Medical" || c.type === "Both") && c.tier === "VIP");
                    if (medicalVipCenters.length === 0) return null;
                    return (
                      <Collapsible 
                        open={centerSectionsOpen.medicalVip} 
                        onOpenChange={(open) => setCenterSectionsOpen(prev => ({ ...prev, medicalVip: open }))}
                      >
                        <CollapsibleTrigger 
                          className="flex items-center justify-between gap-2 w-full p-3 rounded-lg bg-amber-500/5 border border-amber-400/30"
                          data-testid="button-toggle-section-medical-vip"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                              <Star className="h-3 w-3 text-white fill-white" />
                            </div>
                            <span className="font-medium text-sm">Medical Centers (VIP)</span>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-xs" data-testid="text-center-count-medical-vip">
                              {medicalVipCenters.length}
                            </Badge>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${centerSectionsOpen.medicalVip ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 space-y-2">
                          {medicalVipCenters.map((center: Center, index: number) => (
                            <div
                              key={center.id}
                              className="flex items-center justify-between gap-2 p-3 rounded-lg bg-gradient-to-r from-amber-500/5 to-amber-400/10 border-2 border-amber-400/40 opacity-0 animate-fade-in"
                              style={{ animationDelay: `${index * 0.03}s` }}
                            >
                              <div className="flex items-center gap-2.5">
                                <Checkbox
                                  checked={selectedCenters.includes(center.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedCenters([...selectedCenters, center.id]);
                                    } else {
                                      setSelectedCenters(selectedCenters.filter(id => id !== center.id));
                                    }
                                  }}
                                  data-testid={`checkbox-center-${center.id}`}
                                />
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center ring-2 ring-amber-300/50">
                                  <MapPin className="h-3.5 w-3.5 text-white" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-foreground text-sm">{center.name}</p>
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-[10px] px-1.5 py-0" data-testid={`badge-medical-vip-${center.id}`}>
                                      Medical VIP
                                    </Badge>
                                  </div>
                                  {center.area && (
                                    <span className="text-xs text-muted-foreground">{center.area}</span>
                                  )}
                                  {(center.authority || center.timingText) && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {center.authority && <span>{center.authority}</span>}
                                      {center.authority && center.timingText && <span>·</span>}
                                      {center.timingText && <span>{center.timingText}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="rounded-lg"
                                  onClick={() => handleEditCenter(center)}
                                  data-testid={`button-edit-center-${center.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="rounded-lg text-destructive"
                                      data-testid={`button-delete-center-${center.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Center</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{center.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        className="rounded-xl"
                                        onClick={() => deleteCenterMutation.mutate(center.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })()}

                  {/* Medical Centers (Normal) */}
                  {(() => {
                    const medicalNormalCenters = filteredAdminCenters.filter((c: Center) => (c.type === "Medical" || c.type === "Both") && c.tier !== "VIP");
                    if (medicalNormalCenters.length === 0) return null;
                    return (
                      <Collapsible 
                        open={centerSectionsOpen.medicalNormal} 
                        onOpenChange={(open) => setCenterSectionsOpen(prev => ({ ...prev, medicalNormal: open }))}
                      >
                        <CollapsibleTrigger 
                          className="flex items-center justify-between gap-2 w-full p-3 rounded-lg bg-muted/30 border border-border/30"
                          data-testid="button-toggle-section-medical-normal"
                        >
                          <div className="flex items-center gap-2">
                            <div className="icon-container icon-container-sm">
                              <MapPin className="h-3.5 w-3.5" />
                            </div>
                            <span className="font-medium text-sm">Medical Centers (Normal)</span>
                            <Badge variant="outline" className="text-xs" data-testid="text-center-count-medical-normal">
                              {medicalNormalCenters.length}
                            </Badge>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${centerSectionsOpen.medicalNormal ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 space-y-2">
                          {medicalNormalCenters.map((center: Center, index: number) => (
                            <div
                              key={center.id}
                              className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/30 border border-border/30 opacity-0 animate-fade-in"
                              style={{ animationDelay: `${index * 0.03}s` }}
                            >
                              <div className="flex items-center gap-2.5">
                                <Checkbox
                                  checked={selectedCenters.includes(center.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedCenters([...selectedCenters, center.id]);
                                    } else {
                                      setSelectedCenters(selectedCenters.filter(id => id !== center.id));
                                    }
                                  }}
                                  data-testid={`checkbox-center-${center.id}`}
                                />
                                <div className="icon-container icon-container-sm">
                                  <MapPin className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground text-sm">{center.name}</p>
                                  {center.area && (
                                    <span className="text-xs text-muted-foreground">{center.area}</span>
                                  )}
                                  {(center.authority || center.timingText) && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {center.authority && <span>{center.authority}</span>}
                                      {center.authority && center.timingText && <span>·</span>}
                                      {center.timingText && <span>{center.timingText}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="rounded-lg"
                                  onClick={() => handleEditCenter(center)}
                                  data-testid={`button-edit-center-${center.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="rounded-lg text-destructive"
                                      data-testid={`button-delete-center-${center.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Center</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{center.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        className="rounded-xl"
                                        onClick={() => deleteCenterMutation.mutate(center.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })()}

                  {/* ID Centers Group */}
                  <div className="flex items-center gap-2 mb-2 mt-4">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <CreditCard className="h-3 w-3 text-white" />
                    </div>
                    <span className="font-semibold text-sm text-foreground">ID Centers</span>
                  </div>

                  {/* ID Centers (VIP) */}
                  {(() => {
                    const eidVipCenters = filteredAdminCenters.filter((c: Center) => (c.type === "EID" || c.type === "Both") && c.tier === "VIP");
                    if (eidVipCenters.length === 0) return null;
                    return (
                      <Collapsible 
                        open={centerSectionsOpen.eidVip} 
                        onOpenChange={(open) => setCenterSectionsOpen(prev => ({ ...prev, eidVip: open }))}
                      >
                        <CollapsibleTrigger 
                          className="flex items-center justify-between gap-2 w-full p-3 rounded-lg bg-amber-500/5 border border-amber-400/30"
                          data-testid="button-toggle-section-eid-vip"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                              <Star className="h-3 w-3 text-white fill-white" />
                            </div>
                            <span className="font-medium text-sm">ID Centers (VIP)</span>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-xs" data-testid="text-center-count-eid-vip">
                              {eidVipCenters.length}
                            </Badge>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${centerSectionsOpen.eidVip ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 space-y-2">
                          {eidVipCenters.map((center: Center, index: number) => (
                            <div
                              key={center.id}
                              className="flex items-center justify-between gap-2 p-3 rounded-lg bg-gradient-to-r from-amber-500/5 to-amber-400/10 border-2 border-amber-400/40 opacity-0 animate-fade-in"
                              style={{ animationDelay: `${index * 0.03}s` }}
                            >
                              <div className="flex items-center gap-2.5">
                                <Checkbox
                                  checked={selectedCenters.includes(center.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedCenters([...selectedCenters, center.id]);
                                    } else {
                                      setSelectedCenters(selectedCenters.filter(id => id !== center.id));
                                    }
                                  }}
                                  data-testid={`checkbox-center-${center.id}`}
                                />
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center ring-2 ring-amber-300/50">
                                  <MapPin className="h-3.5 w-3.5 text-white" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-foreground text-sm">{center.name}</p>
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-[10px] px-1.5 py-0" data-testid={`badge-eid-vip-${center.id}`}>
                                      ID VIP
                                    </Badge>
                                  </div>
                                  {center.area && (
                                    <span className="text-xs text-muted-foreground">{center.area}</span>
                                  )}
                                  {(center.authority || center.timingText) && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {center.authority && <span>{center.authority}</span>}
                                      {center.authority && center.timingText && <span>·</span>}
                                      {center.timingText && <span>{center.timingText}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="rounded-lg"
                                  onClick={() => handleEditCenter(center)}
                                  data-testid={`button-edit-center-${center.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="rounded-lg text-destructive"
                                      data-testid={`button-delete-center-${center.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Center</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{center.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        className="rounded-xl"
                                        onClick={() => deleteCenterMutation.mutate(center.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })()}

                  {/* ID Centers (Normal) */}
                  {(() => {
                    const eidNormalCenters = filteredAdminCenters.filter((c: Center) => (c.type === "EID" || c.type === "Both") && c.tier !== "VIP");
                    if (eidNormalCenters.length === 0) return null;
                    return (
                      <Collapsible 
                        open={centerSectionsOpen.eidNormal} 
                        onOpenChange={(open) => setCenterSectionsOpen(prev => ({ ...prev, eidNormal: open }))}
                      >
                        <CollapsibleTrigger 
                          className="flex items-center justify-between gap-2 w-full p-3 rounded-lg bg-blue-500/5 border border-blue-400/30"
                          data-testid="button-toggle-section-eid-normal"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                              <CreditCard className="h-3 w-3 text-white" />
                            </div>
                            <span className="font-medium text-sm">ID Centers (Normal)</span>
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-300 text-xs" data-testid="text-center-count-eid-normal">
                              {eidNormalCenters.length}
                            </Badge>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${centerSectionsOpen.eidNormal ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2 space-y-2">
                          {eidNormalCenters.map((center: Center, index: number) => (
                            <div
                              key={center.id}
                              className="flex items-center justify-between gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-400/20 opacity-0 animate-fade-in"
                              style={{ animationDelay: `${index * 0.03}s` }}
                            >
                              <div className="flex items-center gap-2.5">
                                <Checkbox
                                  checked={selectedCenters.includes(center.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedCenters([...selectedCenters, center.id]);
                                    } else {
                                      setSelectedCenters(selectedCenters.filter(id => id !== center.id));
                                    }
                                  }}
                                  data-testid={`checkbox-center-${center.id}`}
                                />
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                                  <CreditCard className="h-3.5 w-3.5 text-white" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground text-sm">{center.name}</p>
                                  {center.area && (
                                    <span className="text-xs text-muted-foreground">{center.area}</span>
                                  )}
                                  {(center.authority || center.timingText) && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {center.authority && <span>{center.authority}</span>}
                                      {center.authority && center.timingText && <span>·</span>}
                                      {center.timingText && <span>{center.timingText}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="rounded-lg"
                                  onClick={() => handleEditCenter(center)}
                                  data-testid={`button-edit-center-${center.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="rounded-lg text-destructive"
                                      data-testid={`button-delete-center-${center.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Center</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{center.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        className="rounded-xl"
                                        onClick={() => deleteCenterMutation.mutate(center.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })()}
                </div>
              ) : (
                <EmptyState
                  icon={<MapPin className="h-6 w-6" />}
                  title="No centers added"
                  description="Add medical and EID centers to get started."
                />
              )}
            </TabsContent>

            {/* Staff Tab */}
            <TabsContent value="staff" className="p-6">
              <div className="flex items-center justify-between gap-2 mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground">Staff Members</h3>
                  {selectedStaff.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl" data-testid="button-bulk-delete-staff">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete ({selectedStaff.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Staff</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedStaff.length} staff members? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="rounded-xl"
                            onClick={() => bulkDeleteStaffMutation.mutate(selectedStaff)}
                          >
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <Dialog open={staffDialogOpen} onOpenChange={setStaffDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-staff">
                      <Plus className="h-4 w-4" />
                      Add Staff
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Staff Member</DialogTitle>
                    </DialogHeader>
                    <Form {...staffForm}>
                      <form onSubmit={staffForm.handleSubmit((data) => createStaffMutation.mutate(data))} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={staffForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., John Smith" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) staffForm.setValue("name", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={staffForm.control}
                          name="roleTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role Title</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., PRO, Ops Manager" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) staffForm.setValue("roleTitle", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>
                        <FormField
                          control={staffForm.control}
                          name="staffType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Staff Type</FormLabel>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={`flex-1 rounded-lg ${field.value === "Permanent" ? "bg-primary text-primary-foreground border-primary" : ""}`}
                                  onClick={() => field.onChange("Permanent")}
                                  data-testid="button-staff-type-permanent"
                                >
                                  Permanent
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={`flex-1 rounded-lg ${field.value === "Temporary" ? "bg-amber-500 text-white border-amber-500" : ""}`}
                                  onClick={() => field.onChange("Temporary")}
                                  data-testid="button-staff-type-temporary"
                                >
                                  Temporary
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          control={staffForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="phone"
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="+971 50 000 0000"
                                  className="h-11 rounded-xl"
                                  aria-label="Staff phone number"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={staffForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="name@company.com" className="h-11 rounded-xl" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>
                        <FormField
                          control={staffForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="Active">Active</SelectItem>
                                  <SelectItem value="OnLeave">On Leave</SelectItem>
                                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                                  <SelectItem value="TempActive">Temporarily Active</SelectItem>
                                  <SelectItem value="TempInactive">Temporarily Inactive</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {staffForm.watch("status") === "OnLeave" && (
                          <FormField
                            control={staffForm.control}
                            name="replacementId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Replacement Staff</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger className="h-11 rounded-xl">
                                      <SelectValue placeholder="Select replacement..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="rounded-xl">
                                    {staffList?.filter((s: Staff) => s.status === "Active").map((s: Staff) => (
                                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        <div className="flex justify-end gap-2 pt-3">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStaffDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" className="rounded-xl" disabled={createStaffMutation.isPending}>
                            {createStaffMutation.isPending ? "Adding..." : "Add Staff"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Edit Staff Dialog - Modern Compact Design */}
              <Dialog open={editStaffDialogOpen} onOpenChange={setEditStaffDialogOpen}>
                <DialogContent className="rounded-2xl max-w-md p-0 gap-0 overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 border-b">
                    <DialogHeader>
                      <DialogTitle className="text-base font-semibold">Edit Staff Member</DialogTitle>
                    </DialogHeader>
                  </div>
                  <Form {...editStaffForm}>
                    <form onSubmit={editStaffForm.handleSubmit((data) => editingStaff && updateStaffMutation.mutate({ ...data, id: editingStaff.id }))} className="p-5 space-y-4">
                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                        <FormField
                          control={editStaffForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel className="text-xs text-muted-foreground">Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., John Smith" className="h-9 rounded-lg" onBlur={(e) => { field.onBlur(); if (e.target.value) editStaffForm.setValue("name", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editStaffForm.control}
                          name="roleTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Role Title</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., P.R.O." className="h-9 rounded-lg" onBlur={(e) => { field.onBlur(); if (e.target.value) editStaffForm.setValue("roleTitle", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editStaffForm.control}
                          name="staffType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Staff Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9 rounded-lg">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-lg">
                                  <SelectItem value="Permanent">Permanent</SelectItem>
                                  <SelectItem value="Temporary">Temporary</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editStaffForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Phone</FormLabel>
                              <FormControl>
                                <MaskedInput
                                  mask="phone"
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="050 000 0000"
                                  className="h-9 rounded-lg"
                                  aria-label="Staff phone number"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editStaffForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">Email</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="name@company.com" className="h-9 rounded-lg" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                        <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => setEditStaffDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" size="sm" className="rounded-lg" disabled={updateStaffMutation.isPending}>
                          {updateStaffMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search staff..."
                  value={adminStaffSearch}
                  onChange={(e) => setAdminStaffSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-admin-staff"
                />
              </div>

              <div className="space-y-4">
                {staffLoading ? (
                  <>
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                  </>
                ) : filteredAdminStaff && filteredAdminStaff.length > 0 ? (
                  <>
                  {/* Permanent Staff Section */}
                  {(() => {
                    const permanentStaff = filteredAdminStaff.filter((s: Staff) => s.staffType === "Permanent");
                    return (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
                            <Users className="h-3 w-3 text-primary-foreground" />
                          </div>
                          <span className="font-semibold text-sm text-foreground">Permanent Staff</span>
                          <Badge variant="outline" className="text-xs">{permanentStaff.length}</Badge>
                        </div>
                        <div className="space-y-3">
                          {permanentStaff.length > 0 ? permanentStaff.map((member, index) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between gap-2 p-4 rounded-xl bg-muted/30 border border-border/30 opacity-0 animate-fade-in"
                              style={{ animationDelay: `${index * 0.05}s` }}
                            >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedStaff.includes(member.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStaff([...selectedStaff, member.id]);
                            } else {
                              setSelectedStaff(selectedStaff.filter(id => id !== member.id));
                            }
                          }}
                          data-testid={`checkbox-staff-${member.id}`}
                        />
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/10">
                          <span className="text-sm font-medium text-primary">
                            {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{member.name}</p>
                            {member.staffType === "Temporary" && (
                              <Badge 
                                variant="outline" 
                                className="text-xs rounded-full bg-red-500/10 text-red-600 border-red-200"
                              >
                                Temp
                              </Badge>
                            )}
                            <Popover 
                              open={statusPopoverId === member.id} 
                              onOpenChange={(open) => {
                                if (open) {
                                  setStatusPopoverId(member.id);
                                  setStatusChangeData({ 
                                    status: member.status, 
                                    leaveEndDate: (member as any).leaveEndDate || "", 
                                    replacementId: member.replacementId || "" 
                                  });
                                } else {
                                  setStatusPopoverId(null);
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  className={`h-auto py-0.5 px-2 text-xs rounded-full gap-1 ${
                                    member.status === "Active" ? "bg-green-500/10 text-green-700 border-green-200" :
                                    member.status === "OnLeave" ? "bg-amber-500/10 text-amber-700 border-amber-200" :
                                    member.status === "Cancelled" ? "bg-red-500/10 text-red-700 border-red-200" :
                                    member.status === "TempActive" ? "bg-cyan-500/10 text-cyan-700 border-cyan-200" :
                                    "bg-gray-500/10 text-gray-700 border-gray-200"
                                  }`}
                                  data-testid={`button-status-${member.id}`}
                                >
                                  {member.status === "OnLeave" ? "On Leave" :
                                   member.status === "TempActive" ? "Temp Active" :
                                   member.status === "TempInactive" ? "Inactive" :
                                   member.status}
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 rounded-xl p-4" align="start">
                                <div className="space-y-4">
                                  <div className="font-medium text-sm">Change Status</div>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Status</Label>
                                    <Select
                                      value={statusChangeData.status}
                                      onValueChange={(value) => setStatusChangeData(prev => ({ ...prev, status: value }))}
                                    >
                                      <SelectTrigger className="h-9 rounded-lg">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-lg">
                                        {member.staffType === "Permanent" ? (
                                          <>
                                            <SelectItem value="Active">Active</SelectItem>
                                            <SelectItem value="OnLeave">On Leave</SelectItem>
                                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                                          </>
                                        ) : (
                                          <>
                                            <SelectItem value="TempActive">Temp Active</SelectItem>
                                            <SelectItem value="TempInactive">Inactive</SelectItem>
                                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                                          </>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {statusChangeData.status === "OnLeave" && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Leave Ends On</Label>
                                        <Input
                                          type="date"
                                          value={statusChangeData.leaveEndDate}
                                          onChange={(e) => setStatusChangeData(prev => ({ ...prev, leaveEndDate: e.target.value }))}
                                          className="h-9 rounded-lg"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Replacement</Label>
                                        <Select
                                          value={statusChangeData.replacementId}
                                          onValueChange={(value) => setStatusChangeData(prev => ({ ...prev, replacementId: value }))}
                                        >
                                          <SelectTrigger className="h-9 rounded-lg">
                                            <SelectValue placeholder="Select replacement" />
                                          </SelectTrigger>
                                          <SelectContent className="rounded-lg">
                                            {staffList?.filter((s: Staff) => s.id !== member.id).map((s: Staff) => (
                                              <SelectItem key={s.id} value={s.id}>
                                                {s.name} {s.staffType === "Temporary" ? "(Temp)" : ""}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  )}
                                  
                                  <div className="flex gap-2 pt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 rounded-lg"
                                      onClick={() => setStatusPopoverId(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="flex-1 rounded-lg"
                                      disabled={updateStaffStatusMutation.isPending}
                                      onClick={() => {
                                        updateStaffStatusMutation.mutate({
                                          id: member.id,
                                          status: statusChangeData.status,
                                          leaveEndDate: statusChangeData.leaveEndDate || undefined,
                                          replacementId: statusChangeData.replacementId || undefined,
                                        });
                                      }}
                                    >
                                      {updateStaffStatusMutation.isPending ? "Saving..." : "Save"}
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span>{member.roleTitle}</span>
                            {member.phone && <span>{member.phone}</span>}
                            {member.email && <span>{member.email}</span>}
                          </div>
                          {member.status === "OnLeave" && member.replacementId && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Covered by: {staffList?.find((s: Staff) => s.id === member.replacementId)?.name || "Unknown"}
                              {(member as any).leaveEndDate && ` (until ${formatDate((member as any).leaveEndDate)})`}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-xl"
                          onClick={() => handleEditStaff(member)}
                          data-testid={`button-edit-staff-${member.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-xl text-destructive"
                              data-testid={`button-delete-staff-${member.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{member.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                className="rounded-xl"
                                onClick={() => deleteStaffMutation.mutate(member.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground py-3">No permanent staff members.</p>
                  )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Temporary Staff Section */}
                  {(() => {
                    const temporaryStaff = filteredAdminStaff.filter((s: Staff) => s.staffType === "Temporary");
                    return (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                            <Users className="h-3 w-3 text-white" />
                          </div>
                          <span className="font-semibold text-sm text-foreground">Temporary Staff</span>
                          <Badge variant="outline" className="text-xs">{temporaryStaff.length}</Badge>
                        </div>
                        <div className="space-y-3">
                          {temporaryStaff.length > 0 ? temporaryStaff.map((member, index) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between gap-2 p-4 rounded-xl bg-muted/30 border border-border/30 opacity-0 animate-fade-in"
                              style={{ animationDelay: `${index * 0.05}s` }}
                            >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedStaff.includes(member.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStaff([...selectedStaff, member.id]);
                            } else {
                              setSelectedStaff(selectedStaff.filter(id => id !== member.id));
                            }
                          }}
                          data-testid={`checkbox-staff-temp-${member.id}`}
                        />
                        <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center ring-1 ring-amber-500/10">
                          <span className="text-sm font-medium text-amber-600">
                            {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{member.name}</p>
                            <Badge 
                              variant="outline" 
                              className="text-xs rounded-full bg-amber-500/10 text-amber-600 border-amber-200"
                            >
                              Temp
                            </Badge>
                            <Popover 
                              open={statusPopoverId === member.id} 
                              onOpenChange={(open) => {
                                if (open) {
                                  setStatusPopoverId(member.id);
                                  setStatusChangeData({ 
                                    status: member.status, 
                                    leaveEndDate: (member as any).leaveEndDate || "", 
                                    replacementId: member.replacementId || "" 
                                  });
                                } else {
                                  setStatusPopoverId(null);
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  className={`h-auto py-0.5 px-2 text-xs rounded-full gap-1 ${
                                    member.status === "TempActive" ? "bg-cyan-500/10 text-cyan-700 border-cyan-200" :
                                    member.status === "Cancelled" ? "bg-red-500/10 text-red-700 border-red-200" :
                                    "bg-gray-500/10 text-gray-700 border-gray-200"
                                  }`}
                                  data-testid={`button-status-temp-${member.id}`}
                                >
                                  {member.status === "TempActive" ? "Temp Active" :
                                   member.status === "TempInactive" ? "Inactive" :
                                   member.status}
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 rounded-xl p-4" align="start">
                                <div className="space-y-4">
                                  <div className="font-medium text-sm">Change Status</div>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Status</Label>
                                    <Select
                                      value={statusChangeData.status}
                                      onValueChange={(value) => setStatusChangeData(prev => ({ ...prev, status: value }))}
                                    >
                                      <SelectTrigger className="h-9 rounded-lg">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-lg">
                                        <SelectItem value="TempActive">Temp Active</SelectItem>
                                        <SelectItem value="TempInactive">Inactive</SelectItem>
                                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex gap-2 pt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 rounded-lg"
                                      onClick={() => setStatusPopoverId(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="flex-1 rounded-lg"
                                      disabled={updateStaffStatusMutation.isPending}
                                      onClick={() => {
                                        updateStaffStatusMutation.mutate({
                                          id: member.id,
                                          status: statusChangeData.status,
                                        });
                                      }}
                                    >
                                      {updateStaffStatusMutation.isPending ? "Saving..." : "Save"}
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span>{member.roleTitle}</span>
                            {member.phone && <span>{member.phone}</span>}
                            {member.email && <span>{member.email}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-xl"
                          onClick={() => handleEditStaff(member)}
                          data-testid={`button-edit-staff-temp-${member.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-xl text-destructive"
                              data-testid={`button-delete-staff-temp-${member.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{member.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                className="rounded-xl"
                                onClick={() => deleteStaffMutation.mutate(member.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                            </div>
                          )) : (
                            <p className="text-sm text-muted-foreground py-3">No temporary staff members.</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  </>
                ) : (
                  <EmptyState
                    icon={<Users className="h-6 w-6" />}
                    title="No staff members"
                    description="Add your team members to assign them to work orders."
                  />
                )}
              </div>
            </TabsContent>

            {/* Service Types Tab */}
            <TabsContent value="services" className="p-6">
              <div className="flex items-center justify-between gap-2 mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground">Service Types</h3>
                  {selectedServices.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl" data-testid="button-bulk-delete-services">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete ({selectedServices.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Services</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedServices.length} service types? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="rounded-xl"
                            onClick={() => bulkDeleteServicesMutation.mutate(selectedServices)}
                          >
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Dialog open={bulkServiceDialogOpen} onOpenChange={setBulkServiceDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-2 rounded-xl" data-testid="button-bulk-add-service">
                        <Plus className="h-4 w-4" />
                        Bulk Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                      <DialogHeader>
                        <DialogTitle>Bulk Import Services</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Enter one service name per line
                        </p>
                        <Textarea
                          value={bulkServiceNames}
                          onChange={(e) => setBulkServiceNames(e.target.value)}
                          placeholder={"New Visa\nVisa Renewal\nLabour Card\n..."}
                          className="min-h-[200px] rounded-xl"
                          data-testid="textarea-bulk-services"
                        />
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setBulkServiceDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            className="rounded-xl" 
                            disabled={bulkCreateServicesMutation.isPending || !bulkServiceNames.trim()}
                            onClick={() => {
                              const names = bulkServiceNames.split('\n').map(n => n.trim()).filter(n => n.length > 0);
                              if (names.length > 0) {
                                bulkCreateServicesMutation.mutate(names);
                              }
                            }}
                            data-testid="button-submit-bulk-services"
                          >
                            {bulkCreateServicesMutation.isPending ? "Importing..." : `Import ${bulkServiceNames.split('\n').filter(n => n.trim()).length} Services`}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-service">
                        <Plus className="h-4 w-4" />
                        Add Service
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="rounded-2xl max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Service Type</DialogTitle>
                    </DialogHeader>
                    <Form {...serviceForm}>
                      <form onSubmit={serviceForm.handleSubmit((data) => createServiceMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={serviceForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Service Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., New Employment Visa - Inside" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) serviceForm.setValue("name", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="space-y-3">
                          <FormLabel className="text-sm font-medium">Requirements</FormLabel>
                          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                            <FormField
                              control={serviceForm.control}
                              name="requiresMedicalTyping"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">Medical Typing</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={serviceForm.control}
                              name="requiresMedicalScheduling"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">Medical Scheduling</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={serviceForm.control}
                              name="requiresIdTyping2Years"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (2 Years)</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={serviceForm.control}
                              name="requiresIdTyping1Year"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (1 Year)</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={serviceForm.control}
                              name="requiresIdTyping10Years"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (10 Years)</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={serviceForm.control}
                              name="requiresIdBiometrics"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">ID Biometrics</FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setServiceDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" className="rounded-xl" disabled={createServiceMutation.isPending}>
                            {createServiceMutation.isPending ? "Adding..." : "Add Service"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                </div>
              </div>

              {/* Edit Service Dialog */}
              <Dialog open={editServiceDialogOpen} onOpenChange={setEditServiceDialogOpen}>
                <DialogContent className="rounded-2xl max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Edit Service Type</DialogTitle>
                  </DialogHeader>
                  <Form {...editServiceForm}>
                    <form onSubmit={editServiceForm.handleSubmit((data) => editingService && updateServiceMutation.mutate({ ...data, id: editingService.id }))} className="space-y-4">
                      <FormField
                        control={editServiceForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Service Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., New Employment Visa - Inside" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) editServiceForm.setValue("name", toProperCase(e.target.value)); }} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-3">
                        <FormLabel className="text-sm font-medium">Requirements</FormLabel>
                        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                          <FormField
                            control={editServiceForm.control}
                            name="requiresMedicalTyping"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">Medical Typing</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editServiceForm.control}
                            name="requiresMedicalScheduling"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">Medical Scheduling</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editServiceForm.control}
                            name="requiresIdTyping2Years"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (2 Years)</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editServiceForm.control}
                            name="requiresIdTyping1Year"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (1 Year)</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editServiceForm.control}
                            name="requiresIdTyping10Years"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">ID Typing (10 Years)</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editServiceForm.control}
                            name="requiresIdBiometrics"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">ID Biometrics</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditServiceDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="rounded-xl" disabled={updateServiceMutation.isPending}>
                          {updateServiceMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search services..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-admin-services"
                />
              </div>

              <div className="space-y-3">
                {servicesLoading ? (
                  <Skeleton className="h-16 rounded-xl" />
                ) : filteredAdminServices && filteredAdminServices.length > 0 ? (
                  filteredAdminServices.map((service, index) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between gap-2 p-4 rounded-xl bg-muted/30 border border-border/30 opacity-0 animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedServices.includes(service.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedServices([...selectedServices, service.id]);
                            } else {
                              setSelectedServices(selectedServices.filter(id => id !== service.id));
                            }
                          }}
                          data-testid={`checkbox-service-${service.id}`}
                        />
                        <div className="icon-container">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <p className="font-medium text-foreground">{service.name}</p>
                          <div className="flex flex-wrap gap-1">
                            {service.requiresMedicalTyping && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">Med Typing</Badge>
                            )}
                            {service.requiresMedicalScheduling && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">Med Sched</Badge>
                            )}
                            {service.requiresIdTyping2Years && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">ID 2Y</Badge>
                            )}
                            {service.requiresIdTyping1Year && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">ID 1Y</Badge>
                            )}
                            {service.requiresIdTyping10Years && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">ID 10Y</Badge>
                            )}
                            {service.requiresIdBiometrics && (
                              <Badge variant="outline" className="text-xs rounded-full px-2 py-0">Biometrics</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-xl"
                          onClick={() => handleEditService(service)}
                          data-testid={`button-edit-service-${service.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-xl text-destructive"
                              data-testid={`button-delete-service-${service.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Service Type</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{service.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                className="rounded-xl"
                                onClick={() => deleteServiceMutation.mutate(service.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={<FileText className="h-6 w-6" />}
                    title="No service types"
                    description="Add service types for work orders."
                  />
                )}
              </div>
            </TabsContent>

            {/* Vendor Jobs Tab */}
            <TabsContent value="jobtypes" className="p-6">
              <div className="flex items-center justify-between gap-2 mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-foreground">Vendor Jobs & Pricing</h3>
                  {selectedJobTypes.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl" data-testid="button-bulk-delete-jobtypes">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete ({selectedJobTypes.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Vendor Jobs</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedJobTypes.length} vendor jobs? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="rounded-xl"
                            onClick={() => bulkDeleteJobTypesMutation.mutate(selectedJobTypes)}
                          >
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <Dialog open={jobTypeDialogOpen} onOpenChange={setJobTypeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-jobtype">
                      <Plus className="h-4 w-4" />
                      Add Vendor Job
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Vendor Job</DialogTitle>
                    </DialogHeader>
                    <Form {...jobTypeForm}>
                      <form onSubmit={jobTypeForm.handleSubmit((data) => createJobTypeMutation.mutate(data))} className="space-y-3">
                        <FormField
                          control={jobTypeForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={`flex-1 rounded-lg ${field.value === "Medical" ? "bg-green-600 text-white border-green-600" : ""}`}
                                  onClick={() => field.onChange("Medical")}
                                  data-testid="button-category-medical"
                                >
                                  Medical
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={`flex-1 rounded-lg ${(field.value as string) === "EID" ? "bg-blue-600 text-white border-blue-600" : ""}`}
                                  onClick={() => field.onChange("EID")}
                                  data-testid="button-category-eid"
                                >
                                  EID
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <FormField
                          control={jobTypeForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Vendor Job Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Medical Application Normal" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) jobTypeForm.setValue("name", toProperCase(e.target.value)); }} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={jobTypeForm.control}
                          name="cost"
                          render={({ field }) => (
                            <FormItem className="col-span-1">
                              <FormLabel>Cost (AED)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  placeholder="0" 
                                  className="h-11 rounded-xl"
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>
                        <div className="flex justify-end gap-2 pt-3">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setJobTypeDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" className="rounded-xl" disabled={createJobTypeMutation.isPending}>
                            {createJobTypeMutation.isPending ? "Adding..." : "Add Vendor Job"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Edit Vendor Job Dialog */}
              <Dialog open={editJobTypeDialogOpen} onOpenChange={setEditJobTypeDialogOpen}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit Vendor Job</DialogTitle>
                  </DialogHeader>
                  <Form {...editJobTypeForm}>
                    <form onSubmit={editJobTypeForm.handleSubmit((data) => editingJobType && updateJobTypeMutation.mutate({ ...data, id: editingJobType.id }))} className="space-y-3">
                      <FormField
                        control={editJobTypeForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={`flex-1 rounded-lg ${field.value === "Medical" ? "bg-green-600 text-white border-green-600" : ""}`}
                                onClick={() => field.onChange("Medical")}
                                data-testid="button-category-medical"
                              >
                                Medical
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={`flex-1 rounded-lg ${field.value === "EID" ? "bg-blue-600 text-white border-blue-600" : ""}`}
                                onClick={() => field.onChange("EID")}
                                data-testid="button-category-eid"
                              >
                                EID
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <FormField
                        control={editJobTypeForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Vendor Job Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Medical Application Normal" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) editJobTypeForm.setValue("name", toProperCase(e.target.value)); }} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editJobTypeForm.control}
                        name="cost"
                        render={({ field }) => (
                          <FormItem className="col-span-1">
                            <FormLabel>Cost (AED)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                placeholder="0" 
                                className="h-11 rounded-xl"
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      </div>
                      <div className="flex justify-end gap-2 pt-3">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditJobTypeDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="rounded-xl" disabled={updateJobTypeMutation.isPending}>
                          {updateJobTypeMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <div className="space-y-3">
                {jobTypesLoading ? (
                  <>
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                  </>
                ) : jobTypes && jobTypes.length > 0 ? (
                  jobTypes.map((job, index) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-2 p-4 rounded-xl bg-muted/30 border border-border/30 opacity-0 animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedJobTypes.includes(job.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedJobTypes([...selectedJobTypes, job.id]);
                            } else {
                              setSelectedJobTypes(selectedJobTypes.filter(id => id !== job.id));
                            }
                          }}
                          data-testid={`checkbox-jobtype-${job.id}`}
                        />
                        <div className="icon-container">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{job.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <StatusBadge status={job.category as any} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">AED {job.cost}</p>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-xl"
                            onClick={() => handleEditJobType(job)}
                            data-testid={`button-edit-jobtype-${job.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-xl text-destructive"
                                data-testid={`button-delete-jobtype-${job.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Vendor Job</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{job.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  className="rounded-xl"
                                  onClick={() => deleteJobTypeMutation.mutate(job.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={<Briefcase className="h-6 w-6" />}
                    title="No vendor jobs"
                    description="Vendor jobs define pricing for typing work."
                  />
                )}
              </div>
            </TabsContent>

            {/* Vendors Tab */}
            <TabsContent value="vendors" className="p-4">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-medium text-foreground">Typing Vendors</h3>
                <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5" data-testid="button-add-vendor">
                      <Plus className="h-4 w-4" />
                      Add Vendor
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Vendor</DialogTitle>
                    </DialogHeader>
                    <Form {...vendorForm}>
                      <form onSubmit={vendorForm.handleSubmit((data) => createVendorMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={vendorForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vendor Name</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  onBlur={(e) => {
                                    field.onBlur();
                                    field.onChange(toProperCase(e.target.value));
                                  }}
                                  data-testid="input-vendor-name" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={vendorForm.control}
                          name="contactPerson"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Person</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  onBlur={(e) => {
                                    field.onBlur();
                                    field.onChange(toProperCase(e.target.value));
                                  }}
                                  data-testid="input-vendor-contact" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={vendorForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <MaskedInput mask="phone" {...field} data-testid="input-vendor-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={vendorForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} data-testid="input-vendor-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end">
                          <Button type="submit" disabled={createVendorMutation.isPending} data-testid="button-save-vendor">
                            {createVendorMutation.isPending ? "Adding..." : "Add Vendor"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Edit Vendor Dialog */}
              <Dialog open={editVendorDialogOpen} onOpenChange={setEditVendorDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Vendor</DialogTitle>
                  </DialogHeader>
                  <Form {...editVendorForm}>
                    <form onSubmit={editVendorForm.handleSubmit((data) => updateVendorMutation.mutate({ ...data, id: editingVendor?.id || "" }))} className="space-y-4">
                      <FormField
                        control={editVendorForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vendor Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                onBlur={(e) => {
                                  field.onBlur();
                                  field.onChange(toProperCase(e.target.value));
                                }}
                                data-testid="input-edit-vendor-name" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editVendorForm.control}
                        name="contactPerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Person</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                onBlur={(e) => {
                                  field.onBlur();
                                  field.onChange(toProperCase(e.target.value));
                                }}
                                data-testid="input-edit-vendor-contact" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editVendorForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <MaskedInput mask="phone" {...field} data-testid="input-edit-vendor-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editVendorForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} data-testid="input-edit-vendor-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {/* Logo Upload */}
                      <div>
                        <label className="text-sm font-medium">Vendor Logo</label>
                        <div className="mt-2 flex items-center gap-4">
                          <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border/40">
                            {vendorLogoPreview ? (
                              <img src={vendorLogoPreview} alt="Logo" className="h-full w-full object-cover" />
                            ) : (
                              <Building2 className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <input
                            ref={vendorLogoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVendorLogoUpload(file);
                            }}
                            data-testid="input-vendor-logo"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => vendorLogoInputRef.current?.click()}
                            disabled={vendorLogoUploading}
                            data-testid="button-upload-vendor-logo"
                          >
                            {vendorLogoUploading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Camera className="h-4 w-4 mr-2" />
                                {vendorLogoPreview ? "Change Logo" : "Upload Logo"}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button type="submit" disabled={updateVendorMutation.isPending} data-testid="button-update-vendor">
                          {updateVendorMutation.isPending ? "Updating..." : "Update Vendor"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <div className="space-y-3">
                {vendorsLoading ? (
                  <>
                    <Skeleton className="h-20 rounded-lg" />
                    <Skeleton className="h-20 rounded-lg" />
                  </>
                ) : vendors && vendors.length > 0 ? (
                  vendors.map((vendor) => (
                    <div
                      key={vendor.id}
                      className="p-4 rounded-xl bg-muted/30 border border-border/30"
                      data-testid={`vendor-card-${vendor.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="icon-container icon-container-sm shrink-0 overflow-hidden">
                            {vendor.logoUrl ? (
                              <img src={vendor.logoUrl} alt={vendor.name} className="h-full w-full object-cover" />
                            ) : (
                              <Building2 className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-foreground">{vendor.name}</h4>
                            {vendor.contactPerson && (
                              <p className="text-sm text-muted-foreground">{vendor.contactPerson}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                              {vendor.phone && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {vendor.phone}
                                </span>
                              )}
                              {vendor.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {vendor.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => {
                              setEditingVendor(vendor);
                              setVendorLogoPreview(vendor.logoUrl || null);
                              editVendorForm.reset({
                                name: vendor.name,
                                contactPerson: vendor.contactPerson || "",
                                phone: vendor.phone || "",
                                email: vendor.email || "",
                              });
                              setEditVendorDialogOpen(true);
                            }}
                            data-testid={`button-edit-vendor-${vendor.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                data-testid={`button-delete-vendor-${vendor.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete &quot;{vendor.name}&quot;? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteVendorMutation.mutate(vendor.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={<Building2 className="h-6 w-6" />}
                    title="No vendors"
                    description="Add a typing vendor to assign typing jobs."
                  />
                )}
              </div>
            </TabsContent>

            {/* User Accounts Tab */}
            <TabsContent value="accounts" className="p-4">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-medium text-foreground" data-testid="text-user-accounts-title">User Accounts</h3>
                <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5" data-testid="button-create-user">
                      <Plus className="h-4 w-4" />
                      Create User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create User</DialogTitle>
                    </DialogHeader>
                    <Form {...userForm}>
                      <form onSubmit={userForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={userForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Full name" data-testid="input-user-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={userForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="email@example.com" data-testid="input-user-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={userForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input {...field} type="password" placeholder="Min 4 characters" data-testid="input-user-password" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={userForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-user-role">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Admin">Admin</SelectItem>
                                  <SelectItem value="Client Relationship Manager">Client Relationship Manager</SelectItem>
                                  <SelectItem value="Medical Support">Medical Support</SelectItem>
                                  <SelectItem value="Medical Support - Temporary">Medical Support - Temporary</SelectItem>
                                  <SelectItem value="Vendor">Vendor</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {["Vendor"].includes(userForm.watch("role")) && (
                          <FormField
                            control={userForm.control}
                            name="vendorId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Linked Vendor</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-user-vendor">
                                      <SelectValue placeholder="Select vendor" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {vendors?.map((v: Vendor) => (
                                      <SelectItem key={v.id} value={v.id}>
                                        {v.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        {["Admin", "Client Relationship Manager", "Medical Support", "Medical Support - Temporary"].includes(userForm.watch("role")) && (
                          <FormField
                            control={userForm.control}
                            name="staffId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Linked Staff Member</FormLabel>
                                <Select onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} value={field.value || "__none__"}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-user-staff">
                                      <SelectValue placeholder="Link to staff member" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="__none__">None</SelectItem>
                                    {staffList?.map((s: Staff) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.name} — {s.roleTitle}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-save-user">
                            {createUserMutation.isPending ? "Creating..." : "Create User"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search accounts..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-admin-accounts"
                />
              </div>

              {usersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : filteredAdminAccounts && filteredAdminAccounts.length > 0 ? (
                <div className="space-y-3">
                  {filteredAdminAccounts.map((user: any) => (
                    <div
                      key={user.id}
                      className="p-4 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-between gap-4 flex-wrap"
                      data-testid={`row-user-${user.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground" data-testid={`text-user-name-${user.id}`}>{user.name}</span>
                          <Badge variant="secondary" data-testid={`badge-user-role-${user.id}`}>{user.role}</Badge>
                          {!user.active && (
                            <Badge variant="outline" className="text-muted-foreground" data-testid={`badge-user-inactive-${user.id}`}>Inactive</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                          <span data-testid={`text-user-email-${user.id}`}>{user.email}</span>
                          {user.staffName && (
                            <span data-testid={`text-user-staff-${user.id}`}>
                              Staff: {user.staffName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`user-active-${user.id}`} className="text-sm text-muted-foreground">Active</Label>
                          <Switch
                            id={`user-active-${user.id}`}
                            checked={user.active !== false}
                            onCheckedChange={(checked) => toggleUserActiveMutation.mutate({ id: user.id, active: checked })}
                            data-testid={`switch-user-active-${user.id}`}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setResetPasswordUser(user)}
                          data-testid={`button-reset-password-${user.id}`}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingUser(user);
                            editUserForm.reset({
                              name: user.name || "",
                              email: user.email || "",
                              password: "",
                              role: user.role || "",
                              staffId: user.staffId || "",
                              vendorId: user.vendorId || "",
                            });
                          }}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<UserPlus className="h-6 w-6" />}
                  title="No user accounts"
                  description="Create a user account to get started."
                />
              )}

              <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                  </DialogHeader>
                  <Form {...editUserForm}>
                    <form onSubmit={editUserForm.handleSubmit((data) => updateUserMutation.mutate({ ...data, id: editingUser?.id }))} className="space-y-4">
                      <FormField
                        control={editUserForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Full name" data-testid="input-edit-user-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editUserForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="email@example.com" data-testid="input-edit-user-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editUserForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password (leave blank to keep current)</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="New password" data-testid="input-edit-user-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editUserForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-edit-user-role">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Admin">Admin</SelectItem>
                                <SelectItem value="Client Relationship Manager">Client Relationship Manager</SelectItem>
                                <SelectItem value="Medical Support">Medical Support</SelectItem>
                                <SelectItem value="Medical Support - Temporary">Medical Support - Temporary</SelectItem>
                                <SelectItem value="Vendor">Vendor</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {["Vendor"].includes(editUserForm.watch("role")) && (
                        <FormField
                          control={editUserForm.control}
                          name="vendorId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Linked Vendor</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-edit-user-vendor">
                                    <SelectValue placeholder="Select vendor" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {vendors?.map((v: Vendor) => (
                                    <SelectItem key={v.id} value={v.id}>
                                      {v.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {["Admin", "Client Relationship Manager", "Medical Support", "Medical Support - Temporary"].includes(editUserForm.watch("role")) && (
                        <FormField
                          control={editUserForm.control}
                          name="staffId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Linked Staff Member</FormLabel>
                              <Select onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} value={field.value || "__none__"}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-edit-user-staff">
                                    <SelectValue placeholder="Link to staff member" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none__">None</SelectItem>
                                  {staffList?.map((s: Staff) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name} — {s.roleTitle}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-update-user">
                          {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <Dialog open={!!resetPasswordUser} onOpenChange={(open) => { if (!open) { setResetPasswordUser(null); setResetPasswordValue(""); } }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset Password</DialogTitle>
                    <DialogDescription>
                      Set a new password for {resetPasswordUser?.name} ({resetPasswordUser?.email})
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>New Password</Label>
                      <Input
                        type="password"
                        value={resetPasswordValue}
                        onChange={(e) => setResetPasswordValue(e.target.value)}
                        placeholder="Enter new password (min 4 characters)"
                        data-testid="input-reset-password"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => { setResetPasswordUser(null); setResetPasswordValue(""); }}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => resetPasswordMutation.mutate({ userId: resetPasswordUser?.id, newPassword: resetPasswordValue })}
                        disabled={resetPasswordValue.length < 4 || resetPasswordMutation.isPending}
                        data-testid="button-confirm-reset-password"
                      >
                        {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Import / Export Tab */}
            <TabsContent value="import" className="p-6">
              <ImportExportSection />
            </TabsContent>

            {/* Change Log Tab */}
            <TabsContent value="changelog" className="p-4">
              <ChangeLogTab />
            </TabsContent>

            <TabsContent value="loginaudit" className="p-4">
              <LoginAuditTab />
            </TabsContent>

            <TabsContent value="resetrequests" className="p-4">
              <PasswordResetRequestsTab />
            </TabsContent>

            <TabsContent value="workdrive" className="p-4">
              <WorkDriveBackupSection />
            </TabsContent>
          </Tabs>
        </div>
      )}
      </div>
    </AppLayout>
  );
}

function LoginAuditTab() {
  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/login-audit"],
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>;

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-foreground" data-testid="text-login-audit-title">Login Audit Log</h3>
      {logs && logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <div key={log.id} className="p-3 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-between gap-3 flex-wrap" data-testid={`row-login-audit-${log.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground">{log.email}</span>
                  <Badge variant={log.success ? "default" : "destructive"} data-testid={`badge-login-status-${log.id}`}>
                    {log.success ? "Success" : "Failed"}
                  </Badge>
                  <Badge variant="outline" data-testid={`badge-login-portal-${log.id}`}>{log.portal}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                  <span>IP: {log.ipAddress || "unknown"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Shield className="h-6 w-6" />}
          title="No login activity"
          description="Login attempts will appear here."
        />
      )}
    </div>
  );
}

function PasswordResetRequestsTab() {
  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/password-reset-requests"],
  });
  const { toast } = useToast();

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/admin/password-reset-requests/${id}/resolve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/password-reset-requests"] });
      toast({ title: "Request resolved" });
    },
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>;

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-foreground" data-testid="text-reset-requests-title">Password Reset Requests</h3>
      {requests && requests.length > 0 ? (
        <div className="space-y-2">
          {requests.map((req: any) => (
            <div key={req.id} className="p-3 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-between gap-3 flex-wrap" data-testid={`row-reset-request-${req.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground">{req.userName || "Unknown User"}</span>
                  <span className="text-sm text-muted-foreground">{req.userEmail || ""}</span>
                  <Badge variant={req.status === "pending" ? "default" : "secondary"}>
                    {req.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Requested: {new Date(req.createdAt).toLocaleString()}
                  {req.resolvedAt && ` | Resolved: ${new Date(req.resolvedAt).toLocaleString()}`}
                </div>
              </div>
              {req.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolveMutation.mutate(req.id)}
                  disabled={resolveMutation.isPending}
                  data-testid={`button-resolve-request-${req.id}`}
                >
                  Mark Resolved
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<KeyRound className="h-6 w-6" />}
          title="No reset requests"
          description="Password reset requests from users will appear here."
        />
      )}
    </div>
  );
}

function ChangeLogTab() {
  const { toast } = useToast();
  const { data: notifications = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/change-notifications"] });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await apiRequest("PUT", `/api/change-notifications/${id}/review`, { action });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/change-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: variables.action === "keep" ? "Change accepted" : "Change reverted" });
    },
    onError: (error: Error) => {
      toast({ title: "Review failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  const pending = notifications.filter((n: any) => n.status === "pending");
  const reviewed = notifications.filter((n: any) => n.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium text-foreground mb-3">Pending Changes ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No pending changes to review</p>
        ) : (
          <div className="space-y-2">
            {pending.map((n: any) => (
              <div key={n.id} className="p-4 rounded-xl bg-muted/30 border border-border/30 space-y-2" data-testid={`notification-${n.id}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <Badge variant="secondary" className="text-xs mr-2">{n.entityType}</Badge>
                    <span className="font-medium text-sm">{n.entityName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{n.changedByName} &middot; {new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
                {n.oldData && n.newData && (
                  <div className="text-xs space-y-1 bg-background/50 p-2 rounded-lg">
                    {Object.keys(n.newData).map((key: string) => {
                      const oldVal = (n.oldData as any)?.[key];
                      const newVal = (n.newData as any)?.[key];
                      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;
                      return (
                        <div key={key} className="flex gap-2">
                          <span className="text-muted-foreground w-32 shrink-0">{key}:</span>
                          <span className="line-through text-red-500/70">{String(oldVal ?? "")}</span>
                          <span className="text-green-600">{String(newVal ?? "")}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reviewMutation.mutate({ id: n.id, action: "revert" })}
                    disabled={reviewMutation.isPending}
                    data-testid={`button-revert-${n.id}`}
                  >
                    <XCircle className="h-3 w-3 mr-1" /> Revert
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => reviewMutation.mutate({ id: n.id, action: "keep" })}
                    disabled={reviewMutation.isPending}
                    data-testid={`button-keep-${n.id}`}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Keep
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewed.length > 0 && (
        <div>
          <h3 className="font-medium text-foreground mb-3">Reviewed ({reviewed.length})</h3>
          <div className="space-y-2">
            {reviewed.slice(0, 20).map((n: any) => (
              <div key={n.id} className="p-3 rounded-xl bg-muted/20 border border-border/20 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="secondary" className="text-xs">{n.entityType}</Badge>
                  <span className="text-sm truncate">{n.entityName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={n.status === "kept" ? "default" : "secondary"} className="text-xs">
                    {n.status === "kept" ? "Kept" : "Reverted"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{n.changedByName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkDriveBackupSection() {
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading } = useQuery<{ configured: boolean; connected: boolean; error?: string }>({
    queryKey: ["/api/workdrive/status"],
  });

  const { data: docStats, isLoading: statsLoading, refetch: refetchStats } = useQuery<{ total: number; synced: number; unsynced: number }>({
    queryKey: ["/api/workdrive/document-stats"],
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/sync-all-documents"),
    onSuccess: async (res: any) => {
      const data = await res.json();
      refetchStats();
      toast({
        title: "Document Sync Complete",
        description: `${data.synced} synced, ${data.failed} failed out of ${data.total} documents.`,
      });
      setSyncResult(data);
    },
    onError: (err: any) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/export-data-to-workdrive"),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setExportResult(data);
      toast({
        title: "Data Export Complete",
        description: `${data.fileName} uploaded to WorkDrive.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    },
  });

  const [syncResult, setSyncResult] = useState<{ total: number; synced: number; failed: number; errors: string[] } | null>(null);
  const [exportResult, setExportResult] = useState<{ fileName: string; permalink: string } | null>(null);

  return (
    <div className="space-y-6" data-testid="workdrive-backup-section">
      <div>
        <h3 className="text-lg font-semibold mb-1">Zoho WorkDrive Backup</h3>
        <p className="text-sm text-muted-foreground">
          Sync documents and export business data to Zoho WorkDrive for backup.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            {statusLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : status?.connected ? (
              <Cloud className="h-5 w-5 text-green-500" />
            ) : (
              <CloudOff className="h-5 w-5 text-red-500" />
            )}
            <span className="font-medium text-sm">Connection Status</span>
          </div>
          <p className="text-xs text-muted-foreground" data-testid="text-workdrive-status">
            {statusLoading ? "Checking..." : status?.connected ? "Connected to WorkDrive" : status?.error || "Not connected"}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <span className="font-medium text-sm">Total Documents</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-total-documents">
            {statsLoading ? "..." : docStats?.total ?? 0}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="font-medium text-sm">Synced to WorkDrive</span>
          </div>
          <p className="text-sm" data-testid="text-synced-documents">
            <span className="text-2xl font-bold text-green-600">{statsLoading ? "..." : docStats?.synced ?? 0}</span>
            {!statsLoading && docStats && docStats.unsynced > 0 && (
              <span className="text-muted-foreground ml-2">/ {docStats.unsynced} pending</span>
            )}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <RefreshCw className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium text-sm">Sync All Documents</h4>
              <p className="text-xs text-muted-foreground">
                Upload all unsynced documents to WorkDrive with the Company → Applicant folder structure.
              </p>
            </div>
          </div>
          <Button
            onClick={() => { setSyncResult(null); syncMutation.mutate(); }}
            disabled={syncMutation.isPending || !status?.connected || (docStats?.unsynced === 0)}
            className="w-full"
            data-testid="button-sync-all-documents"
          >
            {syncMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing Documents...
              </>
            ) : docStats?.unsynced === 0 ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                All Documents Synced
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync {docStats?.unsynced ?? 0} Documents
              </>
            )}
          </Button>

          {syncResult && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm space-y-1" data-testid="sync-result">
              <p className="font-medium">
                {syncResult.synced} synced, {syncResult.failed} failed
              </p>
              {syncResult.errors.length > 0 && (
                <div className="text-xs text-destructive space-y-0.5 max-h-32 overflow-y-auto">
                  {syncResult.errors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Download className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium text-sm">Export Business Data</h4>
              <p className="text-xs text-muted-foreground">
                Generate an Excel file with all work orders, companies, typing jobs, appointments, and vendors.
              </p>
            </div>
          </div>
          <Button
            onClick={() => { setExportResult(null); exportMutation.mutate(); }}
            disabled={exportMutation.isPending || !status?.connected}
            className="w-full"
            data-testid="button-export-data"
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting Data...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export to WorkDrive
              </>
            )}
          </Button>

          {exportResult && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm" data-testid="export-result">
              <p className="font-medium mb-1">{exportResult.fileName}</p>
              <a
                href={exportResult.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                data-testid="link-export-workdrive"
              >
                <ExternalLink className="h-3 w-3" />
                Open in WorkDrive
              </a>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
