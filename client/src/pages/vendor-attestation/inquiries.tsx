import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileQuestion, Clock, CheckCircle2, Send, AlertCircle, Loader2
} from "lucide-react";
import { GlassCard, GlassSection, GlassSkeleton, GlassEmpty } from "@/components/vendor-v2/layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/format-date";

interface VendorInquiry {
  id: string;
  documentType: string;
  documentNameDescription: string;
  documentClass: string;
  homeCountry: string | null;
  descriptionOfNeed: string;
  externalWoNumber: string | null;
  status: string;
  createdAt: string;
  latestQuote: {
    amountAed: number;
    timelineDays: number;
    quoteVersion: number;
  } | null;
}

interface QuoteForm {
  amountAed: string;
  timelineDays: string;
  notes: string;
}

const STATUS_LABELS: Record<string, string> = {
  Open: "Awaiting Quote",
  QuoteReceived: "Quote Submitted",
  Accepted: "Accepted",
  Rejected: "Rejected",
  Converted: "Converted to Job",
};

export default function AttestationVendorInquiries() {
  const { toast } = useToast();
  const [quoteTarget, setQuoteTarget] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState<QuoteForm>({ amountAed: "", timelineDays: "", notes: "" });

  const { data: inquiries = [], isLoading } = useQuery<VendorInquiry[]>({
    queryKey: ["/api/attestation-vendor/inquiries"],
    queryFn: async () => {
      const res = await fetch("/api/attestation-vendor/inquiries", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load inquiries");
      return res.json();
    },
  });

  const quoteMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      const res = await apiRequest("POST", `/api/attestation-vendor/inquiries/${inquiryId}/quote`, {
        amountAed: parseInt(quoteForm.amountAed),
        timelineDays: parseInt(quoteForm.timelineDays),
        notes: quoteForm.notes || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation-vendor/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attestation-vendor/dashboard"] });
      toast({ title: "Quote submitted", description: "Your quote has been sent to CRM for review." });
      setQuoteTarget(null);
      setQuoteForm({ amountAed: "", timelineDays: "", notes: "" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to submit quote", variant: "destructive" });
    },
  });

  const openInquiries = inquiries.filter(i => i.status === "Open" || i.status === "QuoteReceived");
  const closedInquiries = inquiries.filter(i => i.status !== "Open" && i.status !== "QuoteReceived");

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pt-4">
        {[1, 2, 3].map(i => <GlassSkeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pt-2 pb-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="page-title-attest-inquiries">Inquiries</h1>
        <p className="text-slate-500 dark:text-white/50 text-sm">Attestation requests assigned to you</p>
      </div>

      {openInquiries.length === 0 && closedInquiries.length === 0 ? (
        <GlassEmpty
          icon={<FileQuestion className="h-8 w-8" />}
          title="No inquiries yet"
          description="Open inquiries assigned to you will appear here"
        />
      ) : (
        <>
          {openInquiries.length > 0 && (
            <GlassSection title="Pending Your Action">
              <div className="space-y-3">
                {openInquiries.map(inquiry => (
                  <GlassCard key={inquiry.id} className="p-4" data-testid={`inquiry-card-${inquiry.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{inquiry.documentType}</p>
                        <p className="text-xs text-slate-500 dark:text-white/50">{inquiry.documentNameDescription}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        inquiry.status === "Open"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`} data-testid={`status-badge-${inquiry.id}`}>
                        {STATUS_LABELS[inquiry.status] || inquiry.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-white/50">
                        <span>{inquiry.documentClass}</span>
                        {inquiry.homeCountry && <span>· {inquiry.homeCountry}</span>}
                        {inquiry.externalWoNumber && (
                          <span className="font-mono">· WO: {inquiry.externalWoNumber}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-white/60 line-clamp-2">{inquiry.descriptionOfNeed}</p>
                    </div>

                    {inquiry.latestQuote && (
                      <div className="mb-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30">
                        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                          Your quote: {inquiry.latestQuote.amountAed.toLocaleString()} AED · {inquiry.latestQuote.timelineDays} days
                        </p>
                      </div>
                    )}

                    {quoteTarget === inquiry.id ? (
                      <div className="space-y-3 mt-3 pt-3 border-t border-slate-100 dark:border-white/10">
                        <p className="text-xs font-semibold text-slate-500 dark:text-white/50 uppercase tracking-wider">Submit Quote</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-500 dark:text-white/50 mb-1 block">Amount (AED) *</label>
                            <input
                              type="number"
                              min="1"
                              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-sm text-slate-900 dark:text-white border-0 outline-none focus:ring-2 ring-purple-400/50"
                              placeholder="e.g. 500"
                              value={quoteForm.amountAed}
                              onChange={e => setQuoteForm(f => ({ ...f, amountAed: e.target.value }))}
                              data-testid="input-quote-amount"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 dark:text-white/50 mb-1 block">Timeline (days) *</label>
                            <input
                              type="number"
                              min="1"
                              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-sm text-slate-900 dark:text-white border-0 outline-none focus:ring-2 ring-purple-400/50"
                              placeholder="e.g. 5"
                              value={quoteForm.timelineDays}
                              onChange={e => setQuoteForm(f => ({ ...f, timelineDays: e.target.value }))}
                              data-testid="input-quote-timeline"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 dark:text-white/50 mb-1 block">Notes (optional)</label>
                          <textarea
                            className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-sm text-slate-900 dark:text-white border-0 outline-none focus:ring-2 ring-purple-400/50 resize-none"
                            rows={2}
                            placeholder="Any additional info..."
                            value={quoteForm.notes}
                            onChange={e => setQuoteForm(f => ({ ...f, notes: e.target.value }))}
                            data-testid="textarea-quote-notes"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => quoteMutation.mutate(inquiry.id)}
                            disabled={!quoteForm.amountAed || !quoteForm.timelineDays || quoteMutation.isPending}
                            className="flex-1 glass-btn-primary text-sm py-2 px-4 flex items-center justify-center gap-2 disabled:opacity-50"
                            data-testid="button-submit-quote"
                          >
                            {quoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Submit Quote
                          </button>
                          <button
                            onClick={() => { setQuoteTarget(null); setQuoteForm({ amountAed: "", timelineDays: "", notes: "" }); }}
                            className="px-4 py-2 rounded-xl text-sm text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/10"
                            data-testid="button-cancel-quote"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setQuoteTarget(inquiry.id)}
                        className="w-full glass-btn-primary text-sm py-2"
                        data-testid={`button-open-quote-${inquiry.id}`}
                      >
                        {inquiry.latestQuote ? "Revise Quote" : "Submit Quote"}
                      </button>
                    )}
                  </GlassCard>
                ))}
              </div>
            </GlassSection>
          )}

          {closedInquiries.length > 0 && (
            <GlassSection title="Closed">
              <div className="space-y-2">
                {closedInquiries.map(inquiry => (
                  <GlassCard key={inquiry.id} className="p-4 opacity-70" data-testid={`inquiry-closed-${inquiry.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{inquiry.documentType}</p>
                        <p className="text-xs text-slate-400 dark:text-white/40">{inquiry.documentClass}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        inquiry.status === "Converted"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/50"
                      }`}>
                        {STATUS_LABELS[inquiry.status] || inquiry.status}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </GlassSection>
          )}
        </>
      )}
    </div>
  );
}
