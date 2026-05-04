import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Briefcase, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { JobType } from "@shared/schema";
import { toProperCase } from "@/lib/proper-case";

const jobTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.enum(["Medical", "EID"]),
  cost: z.coerce.number().int("Cost must be a whole number").min(0, "Cost must be positive"),
});

export function AdminJobTypesTab() {
  const [jobTypeDialogOpen, setJobTypeDialogOpen] = useState(false);
  const [editJobTypeDialogOpen, setEditJobTypeDialogOpen] = useState(false);
  const [editingJobType, setEditingJobType] = useState<JobType | null>(null);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: jobTypes, isLoading: jobTypesLoading } = useQuery<JobType[]>({
    queryKey: ["/api/job-types"],
  });

  const jobTypeForm = useForm<z.infer<typeof jobTypeSchema>>({ resolver: zodResolver(jobTypeSchema), defaultValues: { name: "", category: "Medical", cost: 0 } });
  const editJobTypeForm = useForm<z.infer<typeof jobTypeSchema>>({ resolver: zodResolver(jobTypeSchema), defaultValues: { name: "", category: "Medical", cost: 0 } });

  const createJobTypeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof jobTypeSchema>) => apiRequest("POST", "/api/job-types", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/job-types"] }); toast({ title: "Job type added successfully" }); setJobTypeDialogOpen(false); jobTypeForm.reset(); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateJobTypeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof jobTypeSchema> & { id: string }) => { const { id, ...rest } = data; return apiRequest("PUT", `/api/job-types/${id}`, rest); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/job-types"] }); toast({ title: "Job type updated successfully" }); setEditJobTypeDialogOpen(false); setEditingJobType(null); editJobTypeForm.reset(); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteJobTypeMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/job-types/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/job-types"] }); toast({ title: "Job type deleted successfully" }); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const bulkDeleteJobTypesMutation = useMutation({
    mutationFn: async (ids: string[]) => apiRequest("DELETE", "/api/job-types/bulk", { ids }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/job-types"] }); toast({ title: `${selectedJobTypes.length} job types deleted successfully` }); setSelectedJobTypes([]); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const handleEditJobType = (jobType: JobType) => {
    setEditingJobType(jobType);
    editJobTypeForm.reset({ name: jobType.name, category: jobType.category as "Medical" | "EID", cost: jobType.cost });
    setEditJobTypeDialogOpen(true);
  };

  function JobTypeFormFields({ form }: { form: typeof editJobTypeForm }) {
    return (
      <>
        <FormField control={form.control} name="category" render={({ field }) => (
          <FormItem>
            <FormLabel>Category</FormLabel>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className={`flex-1 rounded-lg ${field.value === "Medical" ? "bg-green-600 text-white border-green-600" : ""}`} onClick={() => field.onChange("Medical")} data-testid="button-category-medical">Medical</Button>
              <Button type="button" variant="outline" size="sm" className={`flex-1 rounded-lg ${(field.value as string) === "EID" ? "bg-blue-600 text-white border-blue-600" : ""}`} onClick={() => field.onChange("EID")} data-testid="button-category-eid">EID</Button>
            </div>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="col-span-2"><FormLabel>Vendor Job Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Medical Application Normal" className="h-11 rounded-xl" onBlur={(e) => { field.onBlur(); if (e.target.value) form.setValue("name", toProperCase(e.target.value)); }} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="cost" render={({ field }) => (
            <FormItem className="col-span-1"><FormLabel>Cost (AED)</FormLabel><FormControl><Input {...field} type="number" placeholder="0" className="h-11 rounded-xl" onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
      </>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-foreground">Vendor Jobs & Pricing</h3>
          {selectedJobTypes.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl" data-testid="button-bulk-delete-jobtypes"><Trash2 className="h-3.5 w-3.5" /> Delete ({selectedJobTypes.length})</Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader><AlertDialogTitle>Delete Selected Vendor Jobs</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete {selectedJobTypes.length} vendor jobs? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction className="rounded-xl" onClick={() => bulkDeleteJobTypesMutation.mutate(selectedJobTypes)}>Delete All</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <Dialog open={jobTypeDialogOpen} onOpenChange={setJobTypeDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 rounded-xl" data-testid="button-add-jobtype"><Plus className="h-4 w-4" /> Add Vendor Job</Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle>Add Vendor Job</DialogTitle></DialogHeader>
            <Form {...jobTypeForm}>
              <form onSubmit={jobTypeForm.handleSubmit((data) => createJobTypeMutation.mutate(data))} className="space-y-3">
                <JobTypeFormFields form={jobTypeForm} />
                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => setJobTypeDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="rounded-xl" disabled={createJobTypeMutation.isPending}>{createJobTypeMutation.isPending ? "Adding..." : "Add Vendor Job"}</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editJobTypeDialogOpen} onOpenChange={setEditJobTypeDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Edit Vendor Job</DialogTitle></DialogHeader>
          <Form {...editJobTypeForm}>
            <form onSubmit={editJobTypeForm.handleSubmit((data) => editingJobType && updateJobTypeMutation.mutate({ ...data, id: editingJobType.id }))} className="space-y-3">
              <JobTypeFormFields form={editJobTypeForm} />
              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditJobTypeDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="rounded-xl" disabled={updateJobTypeMutation.isPending}>{updateJobTypeMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {jobTypesLoading ? (
          <><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></>
        ) : jobTypes && jobTypes.length > 0 ? (
          jobTypes.map((job, index) => (
            <div key={job.id} className="flex items-center justify-between gap-2 p-4 rounded-xl bg-muted/30 border border-border/30 opacity-0 animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="flex items-center gap-3">
                <Checkbox checked={selectedJobTypes.includes(job.id)} onCheckedChange={(checked) => { if (checked) setSelectedJobTypes([...selectedJobTypes, job.id]); else setSelectedJobTypes(selectedJobTypes.filter(id => id !== job.id)); }} data-testid={`checkbox-jobtype-${job.id}`} />
                <div className="icon-container"><Briefcase className="h-4 w-4" /></div>
                <div>
                  <p className="font-medium text-foreground">{job.name}</p>
                  <div className="flex items-center gap-2 mt-1"><StatusBadge status={job.category as any} /></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground">AED {job.cost}</p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => handleEditJobType(job)} data-testid={`button-edit-jobtype-${job.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="rounded-xl text-destructive" data-testid={`button-delete-jobtype-${job.id}`}><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader><AlertDialogTitle>Delete Vendor Job</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{job.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction className="rounded-xl" onClick={() => deleteJobTypeMutation.mutate(job.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={<Briefcase className="h-6 w-6" />} title="No vendor jobs" description="Vendor jobs define pricing for typing work." />
        )}
      </div>
    </div>
  );
}
