import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Center } from "@shared/schema";
import { logChange } from "./shared";

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

export function CentersTab() {
  const [search, setSearch] = useState("");
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const { toast } = useToast();

  const { data: centersList = [], isLoading } = useQuery<Center[]>({ queryKey: ["/api/centers"] });

  const filtered = centersList.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
      (c.area || "").toLowerCase().includes(q) ||
      (c.type || "").toLowerCase().includes(q) ||
      (c.authority || "").toLowerCase().includes(q);
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldData }: { id: string; data: any; oldData: Center }) => {
      const res = await apiRequest("PUT", `/api/centers/${id}`, data);
      const updated = await res.json();
      await logChange("center", id, oldData.name, oldData, data);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/centers"] });
      toast({ title: "Center updated" });
      setEditingCenter(null);
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
        <Input placeholder="Search centers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-centers" />
      </div>
      <div className="space-y-2">
        {filtered.map(center => (
          <Card key={center.id} className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate" data-testid={`text-center-name-${center.id}`}>{center.name}</p>
              <div className="flex items-center gap-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">{center.type}</Badge>
                {center.authority && <Badge variant="outline" className="text-xs">{center.authority}</Badge>}
                {center.tier && <Badge variant="outline" className="text-xs">{center.tier}</Badge>}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditingCenter(center)} data-testid={`button-edit-center-${center.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No centers found</p>}
      </div>

      {editingCenter && (
        <EditCenterDialog
          center={editingCenter}
          onClose={() => setEditingCenter(null)}
          onSave={(data) => updateMutation.mutate({ id: editingCenter.id, data, oldData: editingCenter })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditCenterDialog({ center, onClose, onSave, isPending }: {
  center: Center;
  onClose: () => void;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const form = useForm<z.infer<typeof centerSchema>>({
    resolver: zodResolver(centerSchema),
    defaultValues: {
      name: center.name || "",
      type: (center.type as "Medical" | "EID" | "Both") || "Medical",
      authority: (center.authority as "DHA" | "EHS" | "ICP" | null) || null,
      tier: (center.tier as "Normal" | "VIP" | null) || null,
      address: center.address || "",
      area: center.area || "",
      googleMapsUrl: center.googleMapsUrl || "",
      timingText: center.timingText || "",
      notes: center.notes || "",
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Center</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input {...field} data-testid="input-center-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger data-testid="select-center-type"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Medical">Medical</SelectItem>
                    <SelectItem value="EID">EID</SelectItem>
                    <SelectItem value="Both">Both</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="authority" render={({ field }) => (
              <FormItem>
                <FormLabel>Authority</FormLabel>
                <Select onValueChange={v => field.onChange(v === "none" ? null : v)} defaultValue={field.value || "none"}>
                  <FormControl><SelectTrigger data-testid="select-center-authority"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="DHA">DHA</SelectItem>
                    <SelectItem value="EHS">EHS</SelectItem>
                    <SelectItem value="ICP">ICP</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="tier" render={({ field }) => (
              <FormItem>
                <FormLabel>Tier</FormLabel>
                <Select onValueChange={v => field.onChange(v === "none" ? null : v)} defaultValue={field.value || "none"}>
                  <FormControl><SelectTrigger data-testid="select-center-tier"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl><Input {...field} data-testid="input-center-address" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="area" render={({ field }) => (
              <FormItem>
                <FormLabel>Area</FormLabel>
                <FormControl><Input {...field} data-testid="input-center-area" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="googleMapsUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>Google Maps URL</FormLabel>
                <FormControl><Input {...field} data-testid="input-center-maps" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="timingText" render={({ field }) => (
              <FormItem>
                <FormLabel>Timing</FormLabel>
                <FormControl><Input {...field} data-testid="input-center-timing" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea {...field} data-testid="input-center-notes" /></FormControl>
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={isPending} data-testid="button-save-center">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
