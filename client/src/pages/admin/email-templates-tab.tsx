import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Search, Eye, ChevronDown, ChevronRight, X, Users, Building2, Briefcase, Shield, Server, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface EmailTemplateInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  recipientLabel: string;
  previewHtml: string;
}

interface TemplatesResponse {
  categories: Record<string, string>;
  templates: EmailTemplateInfo[];
}

const CATEGORY_ICONS: Record<string, typeof Mail> = {
  client: Building2,
  vendor: Briefcase,
  crm_staff: UserCheck,
  pro_staff: Users,
  admin: Shield,
  system: Server,
};

const CATEGORY_COLORS: Record<string, string> = {
  client: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  vendor: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  crm_staff: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  pro_staff: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  system: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
};

const CATEGORY_ORDER = ["client", "vendor", "crm_staff", "pro_staff", "admin", "system"];

function PreviewIframe({ template }: { template: EmailTemplateInfo }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          setHeight(Math.max(400, doc.body.scrollHeight + 40));
        }
      } catch {
        setHeight(600);
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [template.id]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={template.previewHtml}
      title="Email Template Preview"
      className="w-full border-0 rounded-lg bg-[#f5f5f7] dark:bg-[#1c1c1e]"
      style={{ height: `${height}px`, minHeight: "400px" }}
      sandbox=""
      data-testid={`iframe-preview-${template.id}`}
    />
  );
}

export function EmailTemplatesTab() {
  const [search, setSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplateInfo | null>(null);

  const { data, isLoading, isError } = useQuery<TemplatesResponse>({
    queryKey: ["/api/admin/email-templates"],
  });

  const filteredTemplates = useMemo(() => {
    if (!data?.templates) return [];
    if (!search.trim()) return data.templates;
    const q = search.toLowerCase();
    return data.templates.filter(
      t => t.name.toLowerCase().includes(q) ||
           t.description.toLowerCase().includes(q) ||
           t.recipientLabel.toLowerCase().includes(q) ||
           (data.categories[t.category] || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const groupedTemplates = useMemo(() => {
    const groups: Record<string, EmailTemplateInfo[]> = {};
    for (const cat of CATEGORY_ORDER) {
      const items = filteredTemplates.filter(t => t.category === cat);
      if (items.length > 0) {
        groups[cat] = items;
      }
    }
    return groups;
  }, [filteredTemplates]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<Mail className="h-6 w-6" />}
        title="Failed to load templates"
        description="Could not fetch email templates. Please try refreshing the page."
      />
    );
  }

  const totalCount = data?.templates.length ?? 0;
  const shownCount = filteredTemplates.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-medium text-foreground" data-testid="text-email-templates-title">
            Email Templates
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-email-templates-count">
            {shownCount === totalCount
              ? `${totalCount} templates across ${Object.keys(groupedTemplates).length} categories`
              : `Showing ${shownCount} of ${totalCount} templates`}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates by name, description, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
          data-testid="input-search-templates"
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {Object.keys(groupedTemplates).length === 0 ? (
        <EmptyState
          icon={<Mail className="h-6 w-6" />}
          title="No templates found"
          description={search ? "Try adjusting your search terms." : "No email templates available."}
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedTemplates).map(([category, templates]) => {
            const Icon = CATEGORY_ICONS[category] || Mail;
            const categoryLabel = data?.categories[category] || category;
            const isCollapsed = collapsedCategories.has(category);

            return (
              <div key={category} className="rounded-xl border border-border/30 overflow-hidden" data-testid={`section-category-${category}`}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => toggleCategory(category)}
                  data-testid={`button-toggle-category-${category}`}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground flex-1">{categoryLabel}</span>
                  <Badge variant="secondary" className="text-xs" data-testid={`badge-category-count-${category}`}>
                    {templates.length}
                  </Badge>
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-border/20">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="px-4 py-3 hover:bg-muted/10 transition-colors flex items-start gap-3"
                        data-testid={`card-template-${template.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium text-foreground" data-testid={`text-template-name-${template.id}`}>
                              {template.name}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[template.category] || CATEGORY_COLORS.system}`}>
                              {template.recipientLabel}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-template-desc-${template.id}`}>
                            {template.description}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1.5"
                          onClick={() => setPreviewTemplate(template)}
                          data-testid={`button-preview-${template.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-preview-dialog-title">
              <Mail className="h-4 w-4" />
              {previewTemplate?.name}
            </DialogTitle>
            {previewTemplate && (
              <p className="text-sm text-muted-foreground" data-testid="text-preview-dialog-desc">
                {previewTemplate.description}
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {previewTemplate && <PreviewIframe template={previewTemplate} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
