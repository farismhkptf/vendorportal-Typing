import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ServiceType } from "@shared/schema";
import { logChange } from "./shared";

const serviceTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  requiresMedicalTyping: z.boolean().default(false),
  requiresMedicalScheduling: z.boolean().default(false),
  requiresIdTyping2Years: z.boolean().default(false),
  requiresIdTyping1Year: z.boolean().default(false),
  requiresIdTyping10Years: z.boolean().default(false),
  requiresIdBiometrics: z.boolean().default(false),
});

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <Card key={i} className="p-3">
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-3 w-32" />
        </Card>
      ))}
    </div>
  );
}

export function ServicesTab() {
  const [search, setSearch] = useState("");
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const { toast } = useToast();

  const { data: serviceTypes = [], isLoading } = useQuery<ServiceType[]>({ queryKey: ["/api/service-types"] });

  const filtered = serviceTypes.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldData }: { id: string; data: any; oldData: ServiceType }) => {
      const res = await apiRequest("PUT", `/api/service-types/${id}`, data);
      const updated = await res.json();
      await logChange("serviceType", id, oldData.name, oldData, data);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-types"] });
      toast({ title: "Service type updated" });
      setEditingService(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-services" />
      </div>
      <div className="space-y-2">
        {filtered.map(svc => {
          const autoJobs: string[] = [];
          if (svc.requiresMedicalTyping) autoJobs.push("Medical Typing");
          if (svc.requiresIdTyping2Years) autoJobs.push("EID Typing (2Y)");
          if (svc.requiresIdTyping1Year) autoJobs.push("EID Typing (1Y)");
          if (svc.requiresIdTyping10Years) autoJobs.push("EID Typing (10Y)");
          return (
            <Card key={svc.id} className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate" data-testid={`text-service-name-${svc.id}`}>{svc.name}</p>
                {autoJobs.length > 0 ? (
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    <span className="text-xs text-muted-foreground">Auto-creates:</span>
                    {autoJobs.map((label) => (
                      <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        {label}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {svc.requiresMedicalScheduling && <Badge variant="secondary" className="text-xs">Med Schedule</Badge>}
                    {svc.requiresIdBiometrics && <Badge variant="secondary" className="text-xs">EID Bio</Badge>}
                    {!svc.requiresMedicalScheduling && !svc.requiresIdBiometrics && (
                      <span className="text-xs text-muted-foreground/60">No auto-created jobs</span>
                    )}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingService(svc)} data-testid={`button-edit-service-${svc.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No services found</p>}
      </div>

      {editingService && (
        <EditServiceDialog
          service={editingService}
          onClose={() => setEditingService(null)}
          onSave={(data) => updateMutation.mutate({ id: editingService.id, data, oldData: editingService })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditServiceDialog({ service, onClose, onSave, isPending }: {
  service: ServiceType;
  onClose: () => void;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const form = useForm<z.infer<typeof serviceTypeSchema>>({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: service.name || "",
      requiresMedicalTyping: service.requiresMedicalTyping || false,
      requiresMedicalScheduling: service.requiresMedicalScheduling || false,
      requiresIdTyping2Years: service.requiresIdTyping2Years || false,
      requiresIdTyping1Year: service.requiresIdTyping1Year || false,
      requiresIdTyping10Years: service.requiresIdTyping10Years || false,
      requiresIdBiometrics: service.requiresIdBiometrics || false,
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Service Type</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input {...field} data-testid="input-service-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {(["requiresMedicalTyping", "requiresMedicalScheduling", "requiresIdTyping2Years", "requiresIdTyping1Year", "requiresIdTyping10Years", "requiresIdBiometrics"] as const).map(key => (
              <FormField key={key} control={form.control} name={key} render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-2">
                  <FormLabel className="text-sm">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace('Requires ', '')}</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid={`switch-${key}`} /></FormControl>
                </FormItem>
              )} />
            ))}
            {(() => {
              const watched = form.watch();
              const autoJobs: string[] = [];
              if (watched.requiresMedicalTyping) autoJobs.push("Medical Typing");
              if (watched.requiresIdTyping2Years) autoJobs.push("EID Typing (2Y)");
              if (watched.requiresIdTyping1Year) autoJobs.push("EID Typing (1Y)");
              if (watched.requiresIdTyping10Years) autoJobs.push("EID Typing (10Y)");
              return (
                <div className={`p-3 rounded-lg border text-sm ${autoJobs.length > 0 ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" : "bg-muted/30 border-border/30"}`} data-testid="service-auto-creation-summary">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Typing jobs that will be auto-created on WO creation:</p>
                  {autoJobs.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {autoJobs.map((label) => (
                        <span key={label} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800">
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/70">None — no typing jobs will be auto-created.</p>
                  )}
                </div>
              );
            })()}
            <Button type="submit" className="w-full" disabled={isPending} data-testid="button-save-service">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
