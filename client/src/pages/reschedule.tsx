import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Clock, MapPin, CheckCircle, AlertCircle } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Appointment, Center } from "@shared/schema";

interface RescheduleData {
  appointment: Appointment & {
    center?: Center;
    workOrder?: {
      applicantName: string;
      woNumber: string;
    };
  };
  availableTimes: string[];
}

const rescheduleSchema = z.object({
  date: z.date({ required_error: "Please select a date" }),
  time: z.string().min(1, "Please select a time"),
  notes: z.string().optional(),
});

type RescheduleForm = z.infer<typeof rescheduleSchema>;

export default function ReschedulePage() {
  const [, params] = useRoute("/reschedule/:token");
  const token = params?.token;
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<RescheduleData>({
    queryKey: ["/api/reschedule", token],
    enabled: !!token,
  });

  const form = useForm<RescheduleForm>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: {
      notes: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (formData: RescheduleForm) => {
      const datetime = new Date(formData.date);
      const [hours, minutes] = formData.time.split(":").map(Number);
      datetime.setHours(hours, minutes, 0, 0);
      
      return apiRequest("POST", `/api/reschedule/${token}`, {
        requestedDatetime: datetime.toISOString(),
        notes: formData.notes,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit reschedule request",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RescheduleForm) => {
    submitMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Invalid Link</h2>
            <p className="text-muted-foreground">
              This reschedule link is invalid or has expired. Please contact us for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg glass-strong border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Request Submitted</h2>
            <p className="text-muted-foreground">
              Your reschedule request has been submitted successfully. Our team will review and confirm your new appointment time shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { appointment } = data;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mx-auto mb-4">
            <span className="text-lg font-bold text-white">P</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">The P.R.O. Company</h1>
          <p className="text-sm text-muted-foreground mt-1">Appointment Reschedule</p>
        </div>

        {/* Current Appointment */}
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Current Appointment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">
                  {new Date(appointment.datetime).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(appointment.datetime).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            {appointment.center && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">{appointment.center.name}</p>
                  {appointment.center.area && (
                    <p className="text-sm text-muted-foreground">{appointment.center.area}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reschedule Form */}
        <Card className="glass-strong border-0 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Request New Time</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">Preferred Date</FormLabel>
                      <FormControl>
                        <CalendarPicker
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          className="rounded-xl border"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">Preferred Time</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <SelectValue placeholder="Select a time" />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="09:00">9:00 AM</SelectItem>
                          <SelectItem value="09:30">9:30 AM</SelectItem>
                          <SelectItem value="10:00">10:00 AM</SelectItem>
                          <SelectItem value="10:30">10:30 AM</SelectItem>
                          <SelectItem value="11:00">11:00 AM</SelectItem>
                          <SelectItem value="11:30">11:30 AM</SelectItem>
                          <SelectItem value="12:00">12:00 PM</SelectItem>
                          <SelectItem value="14:00">2:00 PM</SelectItem>
                          <SelectItem value="14:30">2:30 PM</SelectItem>
                          <SelectItem value="15:00">3:00 PM</SelectItem>
                          <SelectItem value="15:30">3:30 PM</SelectItem>
                          <SelectItem value="16:00">4:00 PM</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">Additional Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Any additional information..."
                          className="min-h-20 rounded-xl resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-base"
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-reschedule"
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit Reschedule Request"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground">
          Our team will confirm your new appointment time within 24 hours.
        </p>
      </div>
    </div>
  );
}
