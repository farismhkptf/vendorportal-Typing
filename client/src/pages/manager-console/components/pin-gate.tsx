import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Lock, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const pinSchema = z.object({
  pin: z.string().length(4, "PIN must be 4 digits").regex(/^\d{4}$/, "PIN must be 4 digits"),
});

const changePinSchema = z.object({
  currentPin: z.string().length(4, "PIN must be 4 digits"),
  newPin: z.string().length(4, "PIN must be 4 digits").regex(/^\d{4}$/, "PIN must be 4 digits"),
  confirmPin: z.string().length(4, "PIN must be 4 digits"),
}).refine(data => data.newPin === data.confirmPin, {
  message: "PINs don't match",
  path: ["confirmPin"],
});

export function PinGate({ onVerified }: { onVerified: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "" },
  });

  const verifyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof pinSchema>) => {
      const res = await apiRequest("POST", "/api/manager/verify-pin", data);
      return res.json();
    },
    onSuccess: () => onVerified(),
    onError: (error: Error) => {
      toast({ title: "Incorrect PIN", description: error.message, variant: "destructive" });
      form.setValue("pin", "");
    },
  });

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="p-6 w-full max-w-sm space-y-4">
        <div className="text-center space-y-2">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">Enter PIN</h2>
          <p className="text-sm text-muted-foreground">Enter your 4-digit Manager PIN to continue</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => verifyMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="0000"
                      maxLength={4}
                      className="text-center text-2xl tracking-widest"
                      autoFocus
                      data-testid="input-pin"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={verifyMutation.isPending} data-testid="button-verify-pin">
              {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify PIN
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}

export function ChangePinButton() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof changePinSchema>>({
    resolver: zodResolver(changePinSchema),
    defaultValues: { currentPin: "", newPin: "", confirmPin: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof changePinSchema>) => {
      const res = await apiRequest("PUT", "/api/manager/change-pin", {
        currentPin: data.currentPin,
        newPin: data.newPin,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "PIN changed successfully" });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to change PIN", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="button-change-pin">
        <KeyRound className="h-4 w-4 mr-1" /> Change PIN
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Manager PIN</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
              <FormField control={form.control} name="currentPin" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current PIN</FormLabel>
                  <FormControl><Input {...field} type="password" maxLength={4} data-testid="input-current-pin" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="newPin" render={({ field }) => (
                <FormItem>
                  <FormLabel>New PIN</FormLabel>
                  <FormControl><Input {...field} type="password" maxLength={4} data-testid="input-new-pin" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirmPin" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New PIN</FormLabel>
                  <FormControl><Input {...field} type="password" maxLength={4} data-testid="input-confirm-pin" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-save-pin">
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save New PIN
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
