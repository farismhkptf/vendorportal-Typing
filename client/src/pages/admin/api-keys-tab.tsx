import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { KeyRound, Plus, Copy, Check, Trash2, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Staff, Company } from "@shared/schema";

interface ApiKeyRow {
  id: string;
  key: string;
  name: string;
  type: "client" | "crm";
  companyId: string | null;
  staffId: string | null;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  companyName?: string | null;
  staffName?: string | null;
}

export function ApiKeysTab() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyType, setNewKeyType] = useState<"client" | "crm">("client");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  const { data: apiKeys, isLoading } = useQuery<ApiKeyRow[]>({
    queryKey: ["/api/admin/api-keys"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: staffList } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; companyId?: string; staffId?: string }) => {
      const res = await apiRequest("POST", "/api/admin/api-keys", data);
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedKey(data.key);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({ title: "API key created", description: "Copy the key now — it won't be shown again." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create key", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await apiRequest("PATCH", `/api/admin/api-keys/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({ title: "API key deleted" });
    },
  });

  function handleCreate() {
    const payload: any = { name: newKeyName, type: newKeyType };
    if (newKeyType === "client") payload.companyId = selectedCompanyId;
    if (newKeyType === "crm") payload.staffId = selectedStaffId;
    createMutation.mutate(payload);
  }

  function handleCopy() {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function resetCreateDialog() {
    setNewKeyName("");
    setNewKeyType("client");
    setSelectedCompanyId("");
    setSelectedStaffId("");
    setGeneratedKey(null);
    setCopied(false);
    setShowCreate(false);
  }

  const crmStaff = staffList?.filter(s => s.roleTitle === "Client Relationship Manager" && s.active) || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-foreground" data-testid="text-api-keys-title">External API Keys</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowDocs(!showDocs)} data-testid="button-toggle-api-docs">
            {showDocs ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
            {showDocs ? "Hide" : "Show"} API Docs
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5" data-testid="button-create-api-key">
            <Plus className="h-4 w-4" />
            Generate Key
          </Button>
        </div>
      </div>

      {showDocs && (
        <div className="rounded-xl border border-border/30 bg-muted/20 p-4 text-sm space-y-3" data-testid="section-api-docs">
          <h4 className="font-medium text-foreground">API Documentation</h4>
          <div className="space-y-2 text-muted-foreground">
            <p>External applications authenticate using an API key passed in the <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">X-API-Key</code> header or <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Authorization: Bearer &lt;key&gt;</code> header.</p>

            <div className="space-y-1.5">
              <p className="font-medium text-foreground text-xs uppercase tracking-wide">Endpoints</p>
              <div className="font-mono text-xs space-y-1 bg-muted/40 rounded-lg p-3">
                <div><span className="text-green-600 dark:text-green-400">GET</span> /api/external/me — Key info &amp; scope</div>
                <div><span className="text-green-600 dark:text-green-400">GET</span> /api/external/appointments — Scoped appointments</div>
                <div><span className="text-green-600 dark:text-green-400">GET</span> /api/external/work-orders — Scoped work orders</div>
                <div><span className="text-green-600 dark:text-green-400">GET</span> /api/external/work-orders/:id — Work order detail</div>
                <div><span className="text-green-600 dark:text-green-400">GET</span> /api/external/company — Company profile (client keys only)</div>
                <div><span className="text-green-600 dark:text-green-400">GET</span> /api/external/companies — Assigned companies (CRM keys only)</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-foreground text-xs uppercase tracking-wide">Example Request</p>
              <pre className="font-mono text-xs bg-muted/40 rounded-lg p-3 overflow-x-auto whitespace-pre">
{`curl -H "X-API-Key: YOUR_KEY_HERE" \\
  ${window.location.origin}/api/external/me`}
              </pre>
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-foreground text-xs uppercase tracking-wide">Scoping</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li><strong>Client keys</strong> see only data for their assigned company</li>
                <li><strong>CRM keys</strong> see data across all companies assigned to their relationship manager</li>
              </ul>
            </div>

            <p className="text-xs">Rate limit: 100 requests per minute per key.</p>
          </div>
        </div>
      )}

      {apiKeys && apiKeys.length > 0 ? (
        <div className="space-y-2">
          {apiKeys.map((k) => (
            <div key={k.id} className="p-4 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-between gap-4 flex-wrap" data-testid={`row-api-key-${k.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm text-foreground" data-testid={`text-key-name-${k.id}`}>{k.name}</span>
                  <Badge variant={k.type === "client" ? "default" : "secondary"} data-testid={`badge-key-type-${k.id}`}>
                    {k.type === "client" ? "Client" : "CRM"}
                  </Badge>
                  {!k.active && <Badge variant="destructive" data-testid={`badge-key-inactive-${k.id}`}>Inactive</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-muted-foreground/60">{k.key}</span>
                  {k.type === "client" && k.companyName && <span>Company: {k.companyName}</span>}
                  {k.type === "crm" && k.staffName && <span>RM: {k.staffName}</span>}
                  {k.lastUsedAt && <span>Last used: {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                  <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`toggle-${k.id}`} className="text-xs text-muted-foreground">{k.active ? "Active" : "Inactive"}</Label>
                  <Switch
                    id={`toggle-${k.id}`}
                    checked={k.active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: k.id, active: checked })}
                    data-testid={`switch-key-active-${k.id}`}
                  />
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" data-testid={`button-delete-key-${k.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently revoke the key "{k.name}". Any application using this key will immediately lose access.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(k.id)} data-testid={`button-confirm-delete-key-${k.id}`}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<KeyRound className="h-6 w-6" />}
          title="No API keys"
          description="Generate API keys for external client dashboards and CRM integrations."
        />
      )}

      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) resetCreateDialog(); else setShowCreate(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{generatedKey ? "API Key Generated" : "Generate API Key"}</DialogTitle>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Copy this key now. It will not be displayed again.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={generatedKey}
                  className="font-mono text-xs"
                  data-testid="input-generated-key"
                />
                <Button size="icon" variant="outline" onClick={handleCopy} data-testid="button-copy-key">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button className="w-full" onClick={resetCreateDialog} data-testid="button-done-key">
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="e.g., Pay Ten Client Portal"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  data-testid="input-key-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Key Type</Label>
                <Select value={newKeyType} onValueChange={(v) => setNewKeyType(v as "client" | "crm")}>
                  <SelectTrigger data-testid="select-key-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client — Scoped to one company</SelectItem>
                    <SelectItem value="crm">CRM — Scoped to RM's assigned companies</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newKeyType === "client" && (
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger data-testid="select-key-company">
                      <SelectValue placeholder="Select company..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.filter(c => c.active).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {newKeyType === "crm" && (
                <div className="space-y-2">
                  <Label>Relationship Manager</Label>
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger data-testid="select-key-staff">
                      <SelectValue placeholder="Select RM..." />
                    </SelectTrigger>
                    <SelectContent>
                      {crmStaff.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={!newKeyName || (newKeyType === "client" && !selectedCompanyId) || (newKeyType === "crm" && !selectedStaffId) || createMutation.isPending}
                data-testid="button-submit-create-key"
              >
                {createMutation.isPending ? "Generating..." : "Generate Key"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
