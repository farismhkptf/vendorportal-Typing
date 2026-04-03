import { UseFormReturn, useWatch } from "react-hook-form";
import {
  Calendar, MapPin, Star, AlertTriangle, ExternalLink,
  Stethoscope, Phone, UserCheck, CheckCircle2, CreditCard,
  Building2, FileText
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { formatTime12h } from "@/lib/format-date";
import { toProperCase } from "@/lib/proper-case";
import type { Center, Staff, Company } from "@shared/schema";
import { TIME_SLOTS, getSchedulerConfig, getPreferredCenterId, getTodayUAE } from "./schedule-shared-types";
import type { AppointmentForm, SchedulingQueueItem, SchedulerType } from "./schedule-shared-types";

interface ScheduleAppointmentFormProps {
  schedulerType: SchedulerType;
  form: UseFormReturn<AppointmentForm>;
  selectedQueueItem: SchedulingQueueItem;
  selectedCompany: Company | null;
  filteredCenters: Center[];
  selectedCenter: Center | undefined;
  staffList?: Staff[];
  companyAssist: Staff | null;
  companyCRM: Staff | null;
  photoMap?: Record<string, string>;
  appNumberAutoFilled?: boolean;
  setAppNumberAutoFilled?: (v: boolean) => void;
}

export function ScheduleAppointmentForm({
  schedulerType,
  form,
  selectedQueueItem,
  selectedCompany,
  filteredCenters,
  selectedCenter,
  staffList,
  companyAssist,
  companyCRM,
  photoMap,
  appNumberAutoFilled,
  setAppNumberAutoFilled,
}: ScheduleAppointmentFormProps) {
  const config = getSchedulerConfig(schedulerType);
  const watchedIsVip = useWatch({ control: form.control, name: "isVip" });
  const prefix = schedulerType === "EID" ? "eid-" : "";
  const isEid = schedulerType === "EID";
  const AssistIcon = isEid ? CreditCard : Stethoscope;
  const assistLabel = isEid ? "Field Assistant" : "Medical Assistant Support";

  return (
    <Form {...form}>
      <div className="space-y-4">
        {isEid && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-8 w-8 shrink-0" data-testid={`avatar-eid-${selectedQueueItem.woNumber}`}>
                {photoMap?.[selectedQueueItem.woId] ? (
                  <AvatarImage src={photoMap[selectedQueueItem.woId]} alt={selectedQueueItem.applicantName} />
                ) : null}
                <AvatarFallback className="text-xs font-medium">
                  {getInitials(selectedQueueItem.applicantName)}
                </AvatarFallback>
              </Avatar>
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm">{selectedQueueItem.woNumber}</span>
              {selectedQueueItem.isVip && <Badge className="bg-amber-500 text-white text-xs">VIP</Badge>}
              <span className="text-sm text-muted-foreground truncate">{toProperCase(selectedQueueItem.applicantName)}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{toProperCase(selectedQueueItem.companyName || "")}</span>
            </div>
          </div>
        )}

        {!isEid && (
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Appointment Details
          </h3>
        )}

        <FormField
          control={form.control}
          name="isVip"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{config.typeLabel}</FormLabel>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!field.value ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => {
                    field.onChange(false);
                    form.setValue("centerId", "");
                  }}
                  disabled={selectedQueueItem?.isVip}
                  data-testid={`${prefix}button-normal-${schedulerType.toLowerCase()}`}
                >
                  {config.normalLabel}
                </Button>
                <Button
                  type="button"
                  variant={field.value ? "default" : "outline"}
                  className={cn("flex-1", field.value && "bg-amber-500 text-white border-amber-500")}
                  onClick={() => {
                    field.onChange(true);
                    form.setValue("centerId", "");
                  }}
                  data-testid={`${prefix}button-vip-${schedulerType.toLowerCase()}`}
                >
                  <Star className={cn("h-4 w-4 mr-2", field.value && "fill-current")} />
                  {config.vipLabel}
                </Button>
              </div>
              {selectedQueueItem?.isVip && (
                <p className="text-xs text-amber-600 mt-1">VIP locked based on work order</p>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="centerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{config.centerLabel}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid={`${prefix}select-center`}>
                    <SelectValue placeholder={config.centerPlaceholder} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {filteredCenters.map((center) => (
                    <SelectItem key={center.id} value={center.id}>
                      <div className="flex items-center gap-2">
                        {center.name}
                        {center.id === getPreferredCenterId(selectedQueueItem, watchedIsVip, schedulerType) && (
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedCenter?.googleMapsUrl && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <a
              href={selectedCenter.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              View on Google Maps
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <FormField
          control={form.control}
          name="applicationNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{config.appNumberLabel}</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter application number"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    if (setAppNumberAutoFilled) setAppNumberAutoFilled(false);
                  }}
                  data-testid={`${prefix}input-application-number`}
                />
              </FormControl>
              {appNumberAutoFilled && (
                <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-app-number-autofilled">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Auto-filled from vendor submission
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="appointmentDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    min={getTodayUAE()}
                    {...field}
                    data-testid={`${prefix}input-date`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="appointmentTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid={`${prefix}select-time`}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TIME_SLOTS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {formatTime12h(time)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isEid && (
          <FormField
            control={form.control}
            name="assignedStaffId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned Staff</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="eid-select-staff">
                      <SelectValue placeholder="Select staff member" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {staffList?.filter(s => s.status === "Active" || s.status === "TempActive").map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          {s.name}
                          {s.id === selectedQueueItem?.assistStaffId && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="space-y-2">
          <span className="text-sm font-medium">Company Team Contacts</span>
          {!companyAssist && !companyCRM && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span>No team members assigned to this company.{!isEid && " Please update the company profile."}</span>
            </div>
          )}
          <div className="grid gap-2">
            {companyAssist ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AssistIcon className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{companyAssist.name}</p>
                    <p className="text-xs text-muted-foreground">{assistLabel}</p>
                  </div>
                </div>
                {companyAssist.phone && (
                  <div className="flex items-center gap-1 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{companyAssist.phone}</span>
                  </div>
                )}
              </div>
            ) : !isEid ? (
              <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                No Medical Assistant assigned to this company
              </div>
            ) : null}
            {companyCRM ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{companyCRM.name}</p>
                    <p className="text-xs text-muted-foreground">Client Relation Manager</p>
                  </div>
                </div>
                {companyCRM.phone && (
                  <div className="flex items-center gap-1 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{companyCRM.phone}</span>
                  </div>
                )}
              </div>
            ) : !isEid ? (
              <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                No Client Relation Manager assigned to this company
              </div>
            ) : null}
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Special instructions..."
                  className="min-h-[80px]"
                  {...field}
                  data-testid={`${prefix}input-notes`}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </Form>
  );
}
