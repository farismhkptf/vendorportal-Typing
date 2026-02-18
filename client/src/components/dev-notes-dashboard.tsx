import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StickyNote, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pro-dev-notes";

interface NoteEntry {
  id: string;
  page: string;
  pageLabel: string;
  content: string;
  updatedAt: string;
}

function loadNotes(): NoteEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: NoteEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function NotePreviewCard({ note, onDelete }: { note: NoteEntry; onDelete: (id: string) => void }) {
  const preview = stripHtml(note.content).trim();
  const isEmpty = !preview;

  return (
    <div
      className="border rounded-md p-3 space-y-2 hover-elevate"
      data-testid={`dashboard-note-${note.id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="secondary" className="text-xs shrink-0 no-default-hover-elevate no-default-active-elevate">
            {note.pageLabel}
          </Badge>
          <span className="text-xs text-muted-foreground truncate">
            {new Date(note.updatedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 h-7 w-7 text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
          data-testid={`button-dashboard-delete-note-${note.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {isEmpty ? (
        <p className="text-sm text-muted-foreground italic">Empty note</p>
      ) : (
        <div
          className="text-sm text-foreground line-clamp-3 prose prose-sm dark:prose-invert max-w-none [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1 [&_td]:text-xs [&_th]:border [&_th]:border-border [&_th]:p-1 [&_th]:text-xs [&_th]:bg-muted/50"
          dangerouslySetInnerHTML={{ __html: note.content }}
        />
      )}
    </div>
  );
}

export function DevNotesDashboard() {
  const [notes, setNotes] = useState<NoteEntry[]>(loadNotes);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const handler = () => setNotes(loadNotes());
    window.addEventListener("storage", handler);
    const interval = setInterval(() => setNotes(loadNotes()), 2000);
    return () => {
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, []);

  const deleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    saveNotes(updated);
    setNotes(updated);
  };

  if (notes.length === 0) return null;

  const grouped = notes.reduce<Record<string, NoteEntry[]>>((acc, note) => {
    const key = note.pageLabel;
    if (!acc[key]) acc[key] = [];
    acc[key].push(note);
    return acc;
  }, {});

  return (
    <div className="col-span-full opacity-0 animate-fade-in animate-delay-4" data-testid="dev-notes-dashboard-section">
      <Card className="border-amber-200 dark:border-amber-800/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2"
              data-testid="button-toggle-dev-notes-section"
            >
              <StickyNote className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">Dev Notes</CardTitle>
              <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                {notes.length}
              </Badge>
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 no-default-hover-elevate no-default-active-elevate">
              Temporary
            </Badge>
          </div>
        </CardHeader>
        {expanded && (
          <CardContent className="space-y-4">
            {Object.entries(grouped).map(([pageLabel, pageNotes]) => (
              <div key={pageLabel} className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{pageLabel}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pageNotes.map((note) => (
                    <NotePreviewCard key={note.id} note={note} onDelete={deleteNote} />
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
