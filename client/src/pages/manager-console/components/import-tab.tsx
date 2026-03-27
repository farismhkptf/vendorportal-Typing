import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function ImportTab() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/preview-gsheet", { url: sheetUrl });
      return res.json();
    },
    onSuccess: (data) => setPreviewData(data),
    onError: (error: Error) => {
      toast({ title: "Preview failed", description: error.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/import-gsheet", {
        url: sheetUrl,
        rows: previewData?.rows?.filter((r: any) => r.companyMatch && r.serviceTypeMatch),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Imported ${data.imported || 0} work orders` });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setPreviewData(null);
      setSheetUrl("");
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-medium">Google Sheet Import</h3>
        <p className="text-sm text-muted-foreground">Paste a public Google Sheet URL to import work orders. Uploaded Excel files must first be converted: open in Google Sheets, then File &rarr; Save as Google Sheets.</p>
        <div className="flex gap-2">
          <Input
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetUrl}
            onChange={e => setSheetUrl(e.target.value)}
            className="flex-1"
            data-testid="input-gsheet-url"
          />
          <Button
            onClick={() => previewMutation.mutate()}
            disabled={!sheetUrl || previewMutation.isPending}
            data-testid="button-preview-gsheet"
          >
            {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Preview
          </Button>
        </div>
      </Card>

      {previewData && (
        <Card className="p-4 space-y-3">
          <h3 className="font-medium">Preview ({previewData.rows?.length || 0} rows)</h3>
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">WO Number</th>
                  <th className="text-left p-2">Company</th>
                  <th className="text-left p-2">Service</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewData.rows?.map((row: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{row.woNumber}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        {row.companyName}
                        {row.companyMatch ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        {row.serviceTypeName}
                        {row.serviceTypeMatch ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      {row.companyMatch && row.serviceTypeMatch ? (
                        <Badge variant="default" className="text-xs">Ready</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Skipped</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            data-testid="button-import-gsheet"
          >
            {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import Matched Rows
          </Button>
        </Card>
      )}
    </div>
  );
}
