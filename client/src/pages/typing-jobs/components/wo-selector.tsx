import { Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText } from "lucide-react";
import { toProperCase } from "@/lib/proper-case";
import type { WorkOrder, Company } from "@shared/schema";

interface WorkOrderWithDetails extends WorkOrder {
  company?: Company;
}

interface WoSelectorProps {
  selectedWo: WorkOrderWithDetails | null;
  selectedCompany: Company | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filteredWorkOrders: WorkOrder[];
  onSelectWo: (wo: WorkOrder) => void;
  onClearWo: () => void;
  onCreateWo: () => void;
}

export function WoSelector({
  selectedWo,
  selectedCompany,
  searchQuery,
  onSearchChange,
  filteredWorkOrders,
  onSelectWo,
  onClearWo,
  onCreateWo,
}: WoSelectorProps) {
  return (
    <Card className="border border-border/50 shadow-sm mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Select Work Order
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedWo ? (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selectedWo.woNumber}</p>
                  <p className="text-sm text-muted-foreground">{toProperCase(selectedWo.applicantName)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{selectedCompany?.name}</span>
                    {selectedWo.isVip && (
                      <Badge variant="secondary" className="text-xs">VIP</Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onClearWo}
                data-testid="button-change-wo"
              >
                Change
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Input
                placeholder="Search by WO number or applicant name..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-11"
                data-testid="input-wo-search"
              />
            </div>

            {filteredWorkOrders.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {filteredWorkOrders.map((wo) => (
                  <div
                    key={wo.id}
                    onClick={() => onSelectWo(wo)}
                    className="flex items-center justify-between gap-2 p-3 rounded-lg hover-elevate cursor-pointer"
                    data-testid={`wo-option-${wo.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-medium text-primary">{wo.woNumber}</span>
                      <span className="text-sm text-muted-foreground">{toProperCase(wo.applicantName)}</span>
                    </div>
                    {wo.isVip && <Badge variant="secondary">VIP</Badge>}
                  </div>
                ))}
              </div>
            )}

            {searchQuery && filteredWorkOrders.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No work orders found</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCreateWo}
                  data-testid="button-create-wo"
                >
                  Create New Work Order
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
