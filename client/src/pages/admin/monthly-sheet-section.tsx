import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Lock,
  CalendarDays,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export type GSheetPreviewRow = {
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

export type GSheetPreview = {
  totalRows: number;
  importableCount: number;
  skippedCount: number;
  headers: string[];
  rows: GSheetPreviewRow[];
};

export type SheetMonthRecord = {
  id: string; monthYear: string; sheetUrl: string | null;
  status: string; importedCount: number; lastRefreshedAt: string | null; createdAt: string;
};

export const MONTHS_2026 = [
  { label: 'Jan', value: '2026-01' }, { label: 'Feb', value: '2026-02' },
  { label: 'Mar', value: '2026-03' }, { label: 'Apr', value: '2026-04' },
  { label: 'May', value: '2026-05' }, { label: 'Jun', value: '2026-06' },
  { label: 'Jul', value: '2026-07' }, { label: 'Aug', value: '2026-08' },
  { label: 'Sep', value: '2026-09' }, { label: 'Oct', value: '2026-10' },
  { label: 'Nov', value: '2026-11' }, { label: 'Dec', value: '2026-12' },
];

export function MonthlySheetSection() {
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Save failed' }))).message);
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Request failed' }))).message);
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
          <h3 className="text-base font-semibold text-foreground">Monthly Sheet Import — 2026</h3>
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
                      if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Request failed' }))).message);
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
