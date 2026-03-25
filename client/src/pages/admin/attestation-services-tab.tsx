import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, ChevronDown, ChevronRight, Trash2, Loader2, Tag, GripVertical, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AttestationService, AttestationServiceVariant, AttestationServiceStepDefinition } from "@shared/schema";

type AttestationCategory = { id: string; name: string; sortOrder: number; active: boolean };

const DOC_CLASSES = ["Personal", "Business", "Both"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  MofaUAE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  MofaHomeCountry: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Embassy: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Lawyer: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Other: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
};

const FALLBACK_COLOR = "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";

function categoryBadgeColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? FALLBACK_COLOR;
}

interface ServiceFormData {
  name: string;
  category: string;
  documentClassApplicability: string;
  basePriceAed: string;
  timelineDays: string;
  description: string;
  active: boolean;
}

const defaultForm: ServiceFormData = {
  name: "",
  category: "",
  documentClassApplicability: "Both",
  basePriceAed: "0",
  timelineDays: "",
  description: "",
  active: true,
};

interface ServiceDetailPanelProps {
  service: AttestationService;
  categories: AttestationCategory[];
}

function ServiceDetailPanel({ service, categories }: ServiceDetailPanelProps) {
  const { toast } = useToast();
  const [variantLabel, setVariantLabel] = useState("");
  const [variantPrice, setVariantPrice] = useState("0");
  const [variantDays, setVariantDays] = useState("");
  const [addingVariant, setAddingVariant] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editVariantLabel, setEditVariantLabel] = useState("");
  const [editVariantPrice, setEditVariantPrice] = useState("0");
  const [stepDefs, setStepDefs] = useState<Array<{ stepName: string; stepType: string; description: string }>>([]);
  const [stepsLoaded, setStepsLoaded] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const { data: variants = [], isLoading: varLoading } = useQuery<AttestationServiceVariant[]>({
    queryKey: ["/api/attestation/services", service.id, "variants"],
    queryFn: () => fetch(`/api/attestation/services/${service.id}/variants`).then(r => r.json()),
  });

  const { data: stepDefsRemote = [] } = useQuery<AttestationServiceStepDefinition[]>({
    queryKey: ["/api/attestation/services", service.id, "step-definitions"],
    queryFn: () => fetch(`/api/attestation/services/${service.id}/step-definitions`).then(r => r.json()),
    enabled: showSteps,
  });

  const addVariantMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/attestation/services/${service.id}/variants`, {
      variantLabel, priceAed: variantPrice || "0", timelineDays: variantDays ? parseInt(variantDays) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/services", service.id, "variants"] });
      setVariantLabel(""); setVariantPrice("0"); setVariantDays(""); setAddingVariant(false);
      toast({ title: "Variant added" });
    },
    onError: () => toast({ title: "Failed to add variant", variant: "destructive" }),
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/attestation/services/variants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/services", service.id, "variants"] });
      toast({ title: "Variant removed" });
    },
  });

  const toggleVariantMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest("PATCH", `/api/attestation/services/variants/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/attestation/services", service.id, "variants"] }),
  });

  const saveStepsMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/attestation/services/${service.id}/step-definitions`, stepDefs.map((s, i) => ({
      stepOrder: i + 1,
      stepName: s.stepName,
      stepType: s.stepType,
      description: s.description || null,
    }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/services", service.id, "step-definitions"] });
      toast({ title: "Steps saved" });
    },
    onError: () => toast({ title: "Failed to save steps", variant: "destructive" }),
  });

  useEffect(() => {
    if (showSteps && stepDefsRemote.length > 0 && !stepsLoaded) {
      setStepDefs(stepDefsRemote.map(s => ({ stepName: s.stepName, stepType: s.stepType, description: s.description || "" })));
      setStepsLoaded(true);
    }
  }, [showSteps, stepDefsRemote, stepsLoaded]);

  const handleShowSteps = () => {
    setShowSteps(true);
  };

  const initStepsFromRemote = () => {
    setStepDefs(stepDefsRemote.map(s => ({ stepName: s.stepName, stepType: s.stepType, description: s.description || "" })));
  };

  return (
    <div className="pl-4 pr-2 pb-4 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">Price Variants</p>
          <Button variant="ghost" size="sm" onClick={() => setAddingVariant(v => !v)} data-testid={`button-add-variant-${service.id}`}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Variant
          </Button>
        </div>
        {addingVariant && (
          <div className="flex gap-2 mb-2 p-2 rounded-lg bg-muted/40">
            <Input placeholder="Label (e.g. Egypt)" value={variantLabel} onChange={e => setVariantLabel(e.target.value)} className="h-8 text-sm" data-testid="input-variant-label" />
            <Input placeholder="Price AED" type="number" value={variantPrice} onChange={e => setVariantPrice(e.target.value)} className="h-8 text-sm w-28" data-testid="input-variant-price" />
            <Input placeholder="Days" type="number" value={variantDays} onChange={e => setVariantDays(e.target.value)} className="h-8 text-sm w-20" data-testid="input-variant-days" />
            <Button size="sm" className="h-8" onClick={() => addVariantMutation.mutate()} disabled={!variantLabel || addVariantMutation.isPending} data-testid="button-save-variant">
              {addVariantMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        )}
        {varLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : variants.length === 0 ? (
          <p className="text-xs text-muted-foreground">No variants. Base price applies.</p>
        ) : (
          <div className="space-y-1">
            {variants.map(v => (
              <div key={v.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-muted/30" data-testid={`variant-row-${v.id}`}>
                {editingVariantId === v.id ? (
                  <>
                    <Input value={editVariantLabel} onChange={e => setEditVariantLabel(e.target.value)} className="h-7 text-xs flex-1" />
                    <Input value={editVariantPrice} onChange={e => setEditVariantPrice(e.target.value)} className="h-7 text-xs w-24" />
                    <Button size="sm" className="h-7 text-xs" onClick={async () => {
                      await apiRequest("PATCH", `/api/attestation/services/variants/${v.id}`, { variantLabel: editVariantLabel, priceAed: editVariantPrice });
                      queryClient.invalidateQueries({ queryKey: ["/api/attestation/services", service.id, "variants"] });
                      setEditingVariantId(null);
                    }}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingVariantId(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{v.variantLabel}</span>
                    <span className="text-muted-foreground">AED {v.priceAed}</span>
                    {v.timelineDays && <span className="text-muted-foreground text-xs">{v.timelineDays}d</span>}
                    <Switch checked={v.active} onCheckedChange={active => toggleVariantMutation.mutate({ id: v.id, active })} data-testid={`switch-variant-active-${v.id}`} />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingVariantId(v.id); setEditVariantLabel(v.variantLabel); setEditVariantPrice(String(v.priceAed)); }} data-testid={`button-edit-variant-${v.id}`}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteVariantMutation.mutate(v.id)} data-testid={`button-delete-variant-${v.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">Step Definitions</p>
          {!showSteps ? (
            <Button variant="ghost" size="sm" onClick={handleShowSteps} data-testid={`button-manage-steps-${service.id}`}>
              <ChevronRight className="h-3.5 w-3.5 mr-1" />
              Manage Steps
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setShowSteps(false)} data-testid={`button-hide-steps-${service.id}`}>
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
              Hide
            </Button>
          )}
        </div>
        {showSteps && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Define the ordered steps auto-created when an SR uses this service.</p>
            {stepDefs.length === 0 && stepDefsRemote.length > 0 && (
              <Button size="sm" variant="outline" onClick={initStepsFromRemote} data-testid={`button-load-steps-${service.id}`}>Load existing</Button>
            )}
            {stepDefs.map((s, i) => (
              <div key={i} className="flex gap-2 items-start" data-testid={`step-row-${i}`}>
                <span className="text-xs text-muted-foreground w-5 mt-2">{i + 1}.</span>
                <Input
                  placeholder="Step name"
                  value={s.stepName}
                  onChange={e => setStepDefs(prev => prev.map((x, j) => j === i ? { ...x, stepName: e.target.value } : x))}
                  className="h-8 text-sm flex-1"
                  data-testid={`input-step-name-${i}`}
                />
                <Select value={s.stepType} onValueChange={v => setStepDefs(prev => prev.map((x, j) => j === i ? { ...x, stepType: v } : x))}>
                  <SelectTrigger className="h-8 text-sm w-40" data-testid={`select-step-type-${i}`}>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.active).map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setStepDefs(prev => prev.filter((_, j) => j !== i))} data-testid={`button-remove-step-${i}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setStepDefs(prev => [...prev, { stepName: "", stepType: service.category, description: "" }])} data-testid={`button-add-step-${service.id}`}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Step
              </Button>
              <Button size="sm" onClick={() => saveStepsMutation.mutate()} disabled={saveStepsMutation.isPending} data-testid={`button-save-steps-${service.id}`}>
                {saveStepsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Steps"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoriesPanel() {
  const { toast } = useToast();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingCategory, setDeletingCategory] = useState<AttestationCategory | null>(null);

  const { data: categories = [], isLoading } = useQuery<AttestationCategory[]>({
    queryKey: ["/api/admin/attestation-categories"],
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/admin/attestation-categories", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/attestation-categories"] });
      setNewCategoryName("");
      toast({ title: "Category added" });
    },
    onError: async (err: any) => {
      const msg = err?.message || "Failed to add category";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest("PATCH", `/api/admin/attestation-categories/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/attestation-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/services"] });
      setEditingId(null);
      toast({ title: "Category renamed" });
    },
    onError: async (err: any) => {
      const msg = err?.message || "Failed to rename category";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest("PATCH", `/api/admin/attestation-categories/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/attestation-categories"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/attestation-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/attestation-categories"] });
      setDeletingCategory(null);
      toast({ title: "Category deleted" });
    },
    onError: async (err: any) => {
      const msg = err?.message || "Failed to delete category";
      toast({ title: msg, variant: "destructive" });
      setDeletingCategory(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => apiRequest("PUT", "/api/admin/attestation-categories/reorder", { ids }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/attestation-categories"] }),
  });

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...categories];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMutation.mutate(newOrder.map(c => c.id));
  };

  const handleMoveDown = (index: number) => {
    if (index === categories.length - 1) return;
    const newOrder = [...categories];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate(newOrder.map(c => c.id));
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Categories</span>
          <span className="text-xs text-muted-foreground">({categories.length})</span>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="divide-y">
          {categories.map((cat, index) => (
            <div key={cat.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/10" data-testid={`category-row-${cat.id}`}>
              <div className="flex flex-col gap-0.5">
                <button
                  className="h-3.5 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0 || reorderMutation.isPending}
                  data-testid={`button-move-up-${cat.id}`}
                >
                  <ChevronDown className="h-3 w-3 rotate-180" />
                </button>
                <button
                  className="h-3.5 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === categories.length - 1 || reorderMutation.isPending}
                  data-testid={`button-move-down-${cat.id}`}
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              {editingId === cat.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    onKeyDown={e => {
                      if (e.key === "Enter") updateMutation.mutate({ id: cat.id, name: editingName });
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    data-testid={`input-category-name-${cat.id}`}
                    autoFocus
                  />
                  <Button size="sm" className="h-7" onClick={() => updateMutation.mutate({ id: cat.id, name: editingName })} disabled={!editingName.trim() || updateMutation.isPending} data-testid={`button-save-category-${cat.id}`}>
                    {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingId(null)} data-testid={`button-cancel-category-${cat.id}`}>Cancel</Button>
                </>
              ) : (
                <>
                  <span className={`flex-1 text-sm font-medium ${!cat.active ? "text-muted-foreground line-through" : ""}`}>{cat.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${categoryBadgeColor(cat.name)}`}>{cat.name}</span>
                  <Switch
                    checked={cat.active}
                    onCheckedChange={active => toggleMutation.mutate({ id: cat.id, active })}
                    data-testid={`switch-category-active-${cat.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}
                    data-testid={`button-edit-category-${cat.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeletingCategory(cat)}
                    data-testid={`button-delete-category-${cat.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <Input
              placeholder="New category name..."
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              className="h-8 text-sm flex-1"
              onKeyDown={e => { if (e.key === "Enter" && newCategoryName.trim()) createMutation.mutate(newCategoryName.trim()); }}
              data-testid="input-new-category-name"
            />
            <Button
              size="sm"
              onClick={() => createMutation.mutate(newCategoryName.trim())}
              disabled={!newCategoryName.trim() || createMutation.isPending}
              data-testid="button-add-category"
            >
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" />Add</>}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deletingCategory} onOpenChange={open => { if (!open) setDeletingCategory(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingCategory?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this category. You cannot delete a category that is currently in use by any attestation service.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingCategory && deleteMutation.mutate(deletingCategory.id)}
              data-testid="button-confirm-delete-category"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function AttestationServicesTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<AttestationService | null>(null);
  const [form, setForm] = useState<ServiceFormData>(defaultForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<AttestationCategory[]>({
    queryKey: ["/api/admin/attestation-categories"],
  });

  const { data: services = [], isLoading } = useQuery<AttestationService[]>({
    queryKey: ["/api/attestation/services"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/attestation/services", {
      ...data,
      basePriceAed: data.basePriceAed || "0",
      timelineDays: data.timelineDays ? parseInt(data.timelineDays) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/services"] });
      setDialogOpen(false);
      toast({ title: "Service created" });
    },
    onError: () => toast({ title: "Failed to create service", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("PATCH", `/api/attestation/services/${editingService!.id}`, {
      ...data,
      basePriceAed: data.basePriceAed || "0",
      timelineDays: data.timelineDays ? parseInt(data.timelineDays) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attestation/services"] });
      setDialogOpen(false);
      setEditingService(null);
      toast({ title: "Service updated" });
    },
    onError: () => toast({ title: "Failed to update service", variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest("PATCH", `/api/attestation/services/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/attestation/services"] }),
  });

  const openCreate = () => {
    setEditingService(null);
    const firstActive = categories.find(c => c.active);
    setForm({ ...defaultForm, category: firstActive?.name || "" });
    setDialogOpen(true);
  };

  const openEdit = (svc: AttestationService) => {
    setEditingService(svc);
    setForm({
      name: svc.name,
      category: svc.category,
      documentClassApplicability: svc.documentClassApplicability,
      basePriceAed: String(svc.basePriceAed),
      timelineDays: svc.timelineDays ? String(svc.timelineDays) : "",
      description: svc.description || "",
      active: svc.active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name || !form.category) {
      toast({ title: "Name and category are required", variant: "destructive" });
      return;
    }
    if (editingService) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const activeCategories = categories.filter(c => c.active);

  return (
    <div className="space-y-6">
      <div>
        <CategoriesPanel />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Attestation Services</h2>
            <p className="text-sm text-muted-foreground">Manage the catalog of attestation services, pricing, and step sequences.</p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5" data-testid="button-add-attestation-service">
            <Plus className="h-4 w-4" />
            Add Service
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Tag className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No attestation services yet. Add your first service to get started.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden divide-y">
            {services.map(svc => (
              <div key={svc.id} data-testid={`service-row-${svc.id}`}>
                <div className="flex items-center gap-3 p-3 hover:bg-muted/20 cursor-pointer" onClick={() => setExpandedId(expandedId === svc.id ? null : svc.id)}>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Tag className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{svc.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${categoryBadgeColor(svc.category)}`}>{svc.category}</span>
                      {!svc.active && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      AED {svc.basePriceAed} base
                      {svc.timelineDays && ` · ${svc.timelineDays} days`}
                      {" · "}{svc.documentClassApplicability}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={svc.active}
                      onCheckedChange={active => { toggleActiveMutation.mutate({ id: svc.id, active }); }}
                      onClick={e => e.stopPropagation()}
                      data-testid={`switch-service-active-${svc.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={e => { e.stopPropagation(); openEdit(svc); }}
                      data-testid={`button-edit-service-${svc.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-muted-foreground">
                      {expandedId === svc.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  </div>
                </div>
                {expandedId === svc.id && <ServiceDetailPanel service={svc} categories={categories} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); setEditingService(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "New Attestation Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. MOFA UAE Attestation" data-testid="input-service-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger data-testid="select-service-category">
                    <SelectValue placeholder={categoriesLoading ? "Loading..." : "Select category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}{!c.active ? " (inactive)" : ""}
                      </SelectItem>
                    ))}
                    {form.category && !categories.some(c => c.name === form.category) && (
                      <SelectItem value={form.category}>{form.category} (legacy)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Document Class</Label>
                <Select value={form.documentClassApplicability} onValueChange={v => setForm(f => ({ ...f, documentClassApplicability: v }))}>
                  <SelectTrigger data-testid="select-service-doc-class">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Base Price (AED)</Label>
                <Input type="number" value={form.basePriceAed} onChange={e => setForm(f => ({ ...f, basePriceAed: e.target.value }))} placeholder="0" data-testid="input-service-price" />
              </div>
              <div className="space-y-1.5">
                <Label>Timeline (days)</Label>
                <Input type="number" value={form.timelineDays} onChange={e => setForm(f => ({ ...f, timelineDays: e.target.value }))} placeholder="Optional" data-testid="input-service-timeline" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} data-testid="textarea-service-description" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} data-testid="switch-service-active-form" />
              <Label>Active</Label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-service">Cancel</Button>
              <Button onClick={handleSubmit} disabled={isPending} data-testid="button-submit-service">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingService ? "Save Changes" : "Create Service"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
