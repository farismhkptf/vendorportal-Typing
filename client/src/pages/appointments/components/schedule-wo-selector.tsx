import {
  Building2, User, Phone, Mail, Star, Stethoscope, Shield,
  FileText, Search, Package, CheckCircle2, Clock, MapPin, Calendar,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toProperCase } from "@/lib/proper-case";
import { cn, getInitials } from "@/lib/utils";
import type { WorkOrder, Company } from "@shared/schema";
import type { SchedulingQueueItem, SchedulerType } from "./schedule-shared-types";
import { getTimeSince } from "./schedule-shared-types";

interface ScheduleWoSelectorProps {
  schedulerType: SchedulerType;
  selectedQueueItem: SchedulingQueueItem | null;
  selectedCompany: Company | null;
  queue: SchedulingQueueItem[];
  queueLoading: boolean;
  showManualSearch: boolean;
  setShowManualSearch: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filteredWorkOrders: WorkOrder[];
  companies: Company[] | undefined;
  photoMap: Record<string, string> | undefined;
  selectedWoId: string | null;
  onSelectQueueItem: (item: SchedulingQueueItem) => void;
  onSelectManualWo: (wo: WorkOrder) => void;
  onClearSelection: () => void;
}

export function ScheduleWoSelector({
  schedulerType,
  selectedQueueItem,
  selectedCompany,
  queue,
  queueLoading,
  showManualSearch,
  setShowManualSearch,
  searchQuery,
  setSearchQuery,
  filteredWorkOrders,
  companies,
  photoMap,
  selectedWoId,
  onSelectQueueItem,
  onSelectManualWo,
  onClearSelection,
}: ScheduleWoSelectorProps) {
  const isMedical = schedulerType === "Medical";
  const prefix = isMedical ? "" : "eid-";
  const EmptyIcon = isMedical ? Stethoscope : Shield;
  const emptyTitle = isMedical
    ? "No medical appointments pending scheduling"
    : "No EID appointments to schedule right now";
  const emptySubtitle = isMedical
    ? "Search for a work order manually"
    : "Only WOs with biometrics required appear here";

  if (isMedical && selectedQueueItem) {
    return (
      <>
        <Card className="border-primary/20 bg-primary/5" data-testid="card-selected-wo">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {selectedQueueItem.woNumber}
                {selectedQueueItem.isVip && (
                  <Badge className="bg-amber-500 text-white">VIP</Badge>
                )}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={onClearSelection}
                data-testid="button-change-wo"
              >
                Change
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0" data-testid={`avatar-medical-${selectedQueueItem.woNumber}`}>
                {photoMap?.[selectedQueueItem.woId] ? (
                  <AvatarImage src={photoMap[selectedQueueItem.woId]} alt={selectedQueueItem.applicantName} />
                ) : null}
                <AvatarFallback className="text-xs font-medium">
                  {getInitials(selectedQueueItem.applicantName)}
                </AvatarFallback>
              </Avatar>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{toProperCase(selectedQueueItem.applicantName)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{toProperCase(selectedCompany?.name || selectedQueueItem.companyName || "—")}</span>
              </div>
              {selectedQueueItem.applicantPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedQueueItem.applicantPhone}</span>
                </div>
              )}
              {selectedQueueItem.applicantEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedQueueItem.applicantEmail}</span>
                </div>
              )}
              </div>
            </div>
          </CardContent>
        </Card>

        {(selectedQueueItem.applicationRefNo || selectedQueueItem.completedAt || selectedQueueItem.notes) && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20" data-testid="card-job-context">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Job Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {selectedQueueItem.applicationRefNo && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">App Ref No:</span>
                    <span className="font-medium text-blue-700 dark:text-blue-300">{selectedQueueItem.applicationRefNo}</span>
                  </div>
                )}
                {selectedQueueItem.completedAt && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Completed:</span>
                    <span>{new Date(selectedQueueItem.completedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                )}
              </div>
              {selectedQueueItem.notes && (
                <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                  <span className="text-xs text-muted-foreground">Notes:</span>
                  <p className="text-sm mt-0.5">{selectedQueueItem.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </>
    );
  }

  const renderQueue = () => {
    if (queueLoading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      );
    }

    if (queue.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground" data-testid={`${prefix}queue-empty`}>
          <EmptyIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">{emptyTitle}</p>
          {isMedical ? (
            <button
              onClick={() => setShowManualSearch(true)}
              className="text-xs text-primary hover:underline mt-2"
              data-testid="button-show-manual-empty"
            >
              {emptySubtitle}
            </button>
          ) : (
            <p className="text-xs mt-1">{emptySubtitle}</p>
          )}
        </div>
      );
    }

    if (isMedical) {
      return (
        <div className="space-y-2 max-h-64 overflow-auto" data-testid="list-scheduling-queue">
          {queue.map((item) => {
            const timeSince = getTimeSince(item.completedAt);
            return (
              <button
                key={item.typingJobId}
                onClick={() => onSelectQueueItem(item)}
                className="w-full p-3 text-left rounded-lg border hover-elevate transition-colors"
                data-testid={`button-queue-item-${item.woNumber}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm">{item.woNumber}</span>
                    {item.isVip && (
                      <Badge className="bg-amber-500 text-white text-[10px]">VIP</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {timeSince && (
                      <span className="text-[11px] text-muted-foreground">{timeSince}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 mt-1">
                  <span className="text-sm text-foreground truncate">{toProperCase(item.applicantName)}</span>
                  <span className="text-xs text-muted-foreground truncate">{toProperCase(item.companyName || "")}</span>
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-1.5" data-testid="eid-scheduling-queue">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Ready to Schedule ({queue.length})
          </span>
          <Badge variant="outline" className="text-xs">Biometrics Required</Badge>
        </div>
        {queue.map((item) => {
          const isSelected = selectedWoId === item.woId;
          const timeSince = getTimeSince(item.completedAt);
          return (
            <button
              key={item.typingJobId}
              onClick={() => onSelectQueueItem(item)}
              className={cn(
                "w-full p-3 text-left rounded-lg flex items-center justify-between gap-3 transition-all",
                isSelected
                  ? "bg-primary/10 border border-primary/30 shadow-sm"
                  : "hover-elevate border border-transparent"
              )}
              data-testid={`eid-queue-item-${item.woNumber}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  <span className="font-medium text-sm">{item.woNumber}</span>
                  {item.isVip && (
                    <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">VIP</Badge>
                  )}
                </div>
                <span className="text-sm truncate">{toProperCase(item.applicantName)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{toProperCase(item.companyName || "")}</span>
                {timeSince && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{timeSince}</Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderEidContextCard = () => {
    if (schedulerType !== "EID" || !selectedQueueItem) return null;
    if (!selectedQueueItem.biometricsDatetime && !selectedQueueItem.biometricsCenter && !selectedQueueItem.completedAt && !selectedQueueItem.applicationRefNo && !selectedQueueItem.notes) return null;

    return (
      <Card className="border-amber-500/20 bg-amber-500/5" data-testid="eid-schedule-context">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-amber-500/10 flex items-center justify-center">
              <Calendar className="h-3 w-3 text-amber-600" />
            </div>
            Suggested Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {selectedQueueItem.applicationRefNo && (
              <div className="flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">App Ref No:</span>
                <span className="font-medium">{selectedQueueItem.applicationRefNo}</span>
              </div>
            )}
            {selectedQueueItem.completedAt && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Completed:</span>
                <span className="font-medium">{new Date(selectedQueueItem.completedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
            )}
            {selectedQueueItem.biometricsCenter && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Suggested Center:</span>
                <span className="font-medium">{selectedQueueItem.biometricsCenter}</span>
              </div>
            )}
            {selectedQueueItem.biometricsDatetime && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Suggested Date:</span>
                <span className="font-medium">
                  {new Date(selectedQueueItem.biometricsDatetime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  {" "}
                  {new Date(selectedQueueItem.biometricsDatetime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                </span>
              </div>
            )}
          </div>
          {selectedQueueItem.notes && (
            <div className="text-xs p-2 rounded bg-background/50 border border-amber-500/10">
              <span className="text-muted-foreground">Notes: </span>
              <span>{selectedQueueItem.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderManualSearch = () => {
    if (isMedical) {
      if (!showManualSearch) return null;
      return (
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Search className="h-4 w-4" />
            Manual Search
          </h3>
          <div className="relative">
            <Input
              placeholder="Search WO number or applicant name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-wo-search"
            />
            {filteredWorkOrders.length > 0 && (
              <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto">
                <CardContent className="p-2">
                  {filteredWorkOrders.map((wo) => {
                    const company = companies?.find(c => c.id === wo.companyId);
                    return (
                      <button
                        key={wo.id}
                        onClick={() => onSelectManualWo(wo)}
                        className="w-full p-3 text-left rounded-lg hover-elevate flex items-center justify-between gap-3"
                        data-testid={`button-select-wo-${wo.woNumber}`}
                      >
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {wo.woNumber}
                            {wo.isVip && (
                              <Badge className="bg-amber-500 text-white text-xs">VIP</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{toProperCase(wo.applicantName)}</div>
                        </div>
                        <div className="text-sm text-muted-foreground">{toProperCase(company?.name || "")}</div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      );
    }

    if (!showManualSearch) {
      return (
        <button
          onClick={() => setShowManualSearch(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
          data-testid="eid-link-manual-search"
        >
          <Search className="h-3 w-3" />
          Schedule for a different WO
        </button>
      );
    }

    return (
      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Manual Search</span>
          <Button variant="ghost" size="sm" onClick={() => setShowManualSearch(false)} className="text-xs">
            <X className="h-3 w-3 mr-1" />
            Close
          </Button>
        </div>
        <div className="relative">
          <Input
            placeholder="Search WO number or applicant name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="eid-input-manual-search"
          />
          {filteredWorkOrders.length > 0 && (
            <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto">
              <CardContent className="p-2">
                {filteredWorkOrders.map((wo) => {
                  const company = companies?.find(c => c.id === wo.companyId);
                  return (
                    <button
                      key={wo.id}
                      onClick={() => onSelectManualWo(wo)}
                      className="w-full p-2 text-left rounded hover-elevate flex items-center justify-between gap-3 text-sm"
                      data-testid={`eid-manual-wo-${wo.woNumber}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{wo.woNumber}</span>
                        {wo.isVip && <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">VIP</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground truncate">{toProperCase(wo.applicantName)}</span>
                        <span className="text-xs text-muted-foreground">{toProperCase(company?.name || "")}</span>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {isMedical && !selectedQueueItem && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Ready to Schedule
              {queue.length > 0 && (
                <Badge variant="secondary" className="text-xs">{queue.length}</Badge>
              )}
            </h3>
            <button
              onClick={() => setShowManualSearch(!showManualSearch)}
              className="text-xs text-primary hover:underline"
              data-testid="button-manual-search-toggle"
            >
              {showManualSearch ? "Hide manual search" : "Schedule for a different WO"}
            </button>
          </div>
          {renderQueue()}
        </div>
      )}
      {!isMedical && renderQueue()}
      {renderManualSearch()}
      {renderEidContextCard()}
    </>
  );
}
