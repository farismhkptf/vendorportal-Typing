import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, ArrowRight, FileText, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CUSTODY_DOC_CATEGORY_LABELS, CUSTODY_DOC_SUBTYPE_LABELS, CUSTODY_DOC_STAGE_LABELS,
  CUSTODY_DOC_SUBTYPES_BY_CATEGORY
} from "@shared/schema";

interface CustodyRecord {
  id: string;
  referenceNumber: string;
  docCategory: string;
  docSubtype: string;
  docCustomName: string | null;
  custodyStage: string;
  createdAt: string;
}

const STAGE_COLORS: Record<string, string> = {
  WithClient: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  WithUs: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  WithVendor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ReturnedToClient: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

interface WoCustodyPanelProps {
  woId: string;
  companyId: string;
}

export function WoCustodyPanel({ woId, companyId }: WoCustodyPanelProps) {
  const { toast } = useToast();
  const [showNewForm, setShowNewForm] = useState(false);
  const [docCategory, setDocCategory] = useState("");
  const [docSubtype, setDocSubtype] = useState("");
  const [docCustomName, setDocCustomName] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notes, setNotes] = useState("");

  const { data: records, isLoading } = useQuery<CustodyRecord[]>({
    queryKey: ["/api/custody/wo", woId],
    queryFn: async () => {
      const res = await fetch(`/api/custody/wo/${woId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const availableSubtypes = docCategory ? CUSTODY_DOC_SUBTYPES_BY_CATEGORY[docCategory] || [] : [];

  const createMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/custody/records", {
        companyId,
        woId,
        docCategory,
        docSubtype,
        docCustomName: docSubtype === "Other" ? docCustomName : null,
        notifyEmail: notifyEmail || null,
        notes: notes || null,
        custodyStage: "WithClient",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custody/wo", woId] });
      queryClient.invalidateQueries({ queryKey: ["/api/custody/records"] });
      toast({ title: "Custody record linked to this work order" });
      setShowNewForm(false);
      setDocCategory(""); setDocSubtype(""); setDocCustomName(""); setNotifyEmail(""); setNotes("");
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const canSubmit = docCategory && docSubtype && (docSubtype !== "Other" || docCustomName);

  return (
    <div className="space-y-3" data-testid="wo-custody-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Package className="h-4 w-4" /> Document Custody
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-7 text-xs"
          onClick={() => setShowNewForm(true)}
          data-testid="button-add-custody-record"
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 rounded-lg" />
        </div>
      ) : !records || records.length === 0 ? (
        <p className="text-xs text-muted-foreground italic" data-testid="wo-no-custody">No custody records for this work order.</p>
      ) : (
        <div className="space-y-1.5">
          {records.map(record => {
            const docLabel = record.docSubtype === "Other" && record.docCustomName
              ? record.docCustomName
              : (CUSTODY_DOC_SUBTYPE_LABELS[record.docSubtype] || record.docSubtype);
            const stageColor = STAGE_COLORS[record.custodyStage] || "";
            const stageLabel = CUSTODY_DOC_STAGE_LABELS[record.custodyStage] || record.custodyStage;

            return (
              <Link key={record.id} href={`/custody/${record.id}`}>
                <div
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30 hover:border-primary/30 transition-colors cursor-pointer"
                  data-testid={`wo-custody-record-${record.id}`}
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{docLabel}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{record.referenceNumber}</p>
                  </div>
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", stageColor)}>
                    {stageLabel}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* New Record Dialog */}
      <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto" data-testid="dialog-wo-new-custody">
          <DialogHeader>
            <DialogTitle>Add Custody Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Document Category *</Label>
              <Select value={docCategory} onValueChange={v => { setDocCategory(v); setDocSubtype(""); }}>
                <SelectTrigger className="mt-1" data-testid="select-wo-doc-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CUSTODY_DOC_CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {docCategory && (
              <div>
                <Label className="text-xs">Document Type *</Label>
                <Select value={docSubtype} onValueChange={setDocSubtype}>
                  <SelectTrigger className="mt-1" data-testid="select-wo-doc-subtype">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubtypes.map(s => (
                      <SelectItem key={s} value={s}>{CUSTODY_DOC_SUBTYPE_LABELS[s] || s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {docSubtype === "Other" && (
              <div>
                <Label className="text-xs">Custom Name *</Label>
                <Input
                  value={docCustomName}
                  onChange={e => setDocCustomName(e.target.value)}
                  placeholder="Describe the document"
                  className="mt-1"
                  data-testid="input-wo-custom-name"
                />
              </div>
            )}

            <div>
              <Label className="text-xs">Notification Email</Label>
              <Input
                type="email"
                value={notifyEmail}
                onChange={e => setNotifyEmail(e.target.value)}
                placeholder="client@company.com"
                className="mt-1"
                data-testid="input-wo-notify-email"
              />
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes"
                rows={2}
                className="mt-1"
                data-testid="textarea-wo-notes"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowNewForm(false)} className="flex-1 h-8 text-sm" data-testid="button-cancel-wo-custody">Cancel</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
                className="flex-1 h-8 text-sm"
                data-testid="button-create-wo-custody"
              >
                {createMutation.isPending ? "Adding..." : "Add Record"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
