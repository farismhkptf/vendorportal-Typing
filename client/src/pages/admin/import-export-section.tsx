import { useState, type ChangeEvent } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { MonthlySheetSection } from "./monthly-sheet-section";

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

export function ImportExportSection() {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/admin/export");
      if (!response.ok) throw new Error("Failed to export data");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "PRO_Company_Data_Export.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Export downloaded", description: "All data has been exported to Excel." });
    } catch {
      toast({ title: "Export failed", description: "Could not export data. Please try again.", variant: "destructive" });
    } finally {
      setIsExporting(false);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl bg-muted/30 border border-border/30 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground" data-testid="text-download-title">Download Template</h3>
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
              <h3 className="text-base font-semibold text-foreground" data-testid="text-upload-title">Import Data</h3>
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

        <div className="p-6 rounded-xl bg-muted/30 border border-border/30 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground" data-testid="text-export-title">Export All Data</h3>
              <p className="text-sm text-muted-foreground">Download all reference data as an Excel file</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Exports Companies, Centers, Staff, Service Types, Vendors, Vendor Jobs, Document Requirements, and User Accounts into a single Excel file.
          </p>
          <Button onClick={handleExportData} disabled={isExporting} data-testid="button-export-data">
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            {isExporting ? "Exporting..." : "Export All Data"}
          </Button>
        </div>
      </div>

      <MonthlySheetSection />

      {importResults && (
        <div className="p-6 rounded-xl bg-muted/30 border border-border/30 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground" data-testid="text-import-results-title">Import Results</h3>
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
