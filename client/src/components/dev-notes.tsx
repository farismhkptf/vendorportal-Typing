import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  StickyNote,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Table as TableIcon,
  Undo,
  Redo,
  Trash2,
  X,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pro-dev-notes";

interface NoteEntry {
  id: string;
  page: string;
  pageLabel: string;
  content: string;
  updatedAt: string;
}

function getPageLabel(path: string): string {
  const labels: Record<string, string> = {
    "/": "Dashboard",
    "/work-orders": "Work Orders",
    "/companies": "Companies",
    "/typing-jobs": "Typing Jobs",
    "/staff": "Staff",
    "/vendor-wallet": "Vendor Wallet",
    "/admin": "Admin",
    "/manager-console": "Manager Console",
    "/reports": "Reports",
    "/appointments": "Appointments",
    "/bots": "Bots",
    "/crm": "CRM Dashboard",
    "/medical": "Medical Dashboard",
  };
  if (path.startsWith("/vendor")) {
    if (path === "/vendor" || path === "/vendor/") return "Vendor Dashboard";
    if (path.startsWith("/vendor/eid")) return "Vendor EID Jobs";
    if (path.startsWith("/vendor/medical")) return "Vendor Medical Jobs";
    if (path.startsWith("/vendor/wallet")) return "Vendor Wallet";
    return "Vendor Portal";
  }
  for (const [key, label] of Object.entries(labels)) {
    if (path === key || path.startsWith(key + "/")) return label;
  }
  return path;
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

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            isActive
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
            disabled && "opacity-40 cursor-not-allowed"
          )}
          data-testid={`button-editor-${title.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const iconSize = "h-4 w-4";

  return (
    <div className="flex items-center gap-0.5 flex-wrap p-1.5 border-b bg-muted/30" data-testid="editor-toolbar">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold"
      >
        <Bold className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic"
      >
        <Italic className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline"
      >
        <UnderlineIcon className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className={iconSize} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className={iconSize} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <List className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered List"
      >
        <ListOrdered className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        title="Checklist"
      >
        <ListChecks className={iconSize} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        title="Insert Table"
      >
        <TableIcon className={iconSize} />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo className={iconSize} />
      </ToolbarButton>
    </div>
  );
}

function NoteEditor({
  note,
  onSave,
  onDelete,
}: {
  note: NoteEntry;
  onSave: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: note.content || "<p></p>",
    onUpdate: ({ editor: ed }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onSave(note.id, ed.getHTML());
      }, 500);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none p-3 min-h-[200px] focus:outline-none [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2 [&_ul[data-type=taskList]_li]:items-start [&_ul[data-type=taskList]_li_label]:mt-0.5 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted/50 [&_th]:font-semibold",
      },
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className="border rounded-md overflow-hidden" data-testid={`note-editor-${note.id}`}>
      <div className="flex items-center justify-between gap-2 px-2 py-1 bg-muted/20 border-b">
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
          className="shrink-0 text-muted-foreground"
          onClick={() => onDelete(note.id)}
          data-testid={`button-delete-note-${note.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

export function DevNotesDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [location] = useLocation();
  const [notes, setNotes] = useState<NoteEntry[]>(loadNotes);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setNotes(loadNotes()), 1500);
    return () => clearInterval(interval);
  }, [open]);

  const currentPage = location.split("?")[0].split("#")[0];
  const pageLabel = getPageLabel(currentPage);

  const pageNotes = notes.filter((n) => n.page === currentPage);
  const otherNotes = notes.filter((n) => n.page !== currentPage);
  const displayNotes = showAll ? notes : pageNotes;

  const addNote = useCallback(() => {
    const newNote: NoteEntry = {
      id: crypto.randomUUID(),
      page: currentPage,
      pageLabel,
      content: "",
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => {
      const updated = [newNote, ...prev];
      saveNotes(updated);
      return updated;
    });
  }, [currentPage, pageLabel]);

  const saveNote = useCallback((id: string, content: string) => {
    setNotes((prev) => {
      const updated = prev.map((n) =>
        n.id === id ? { ...n, content, updatedAt: new Date().toISOString() } : n
      );
      saveNotes(updated);
      return updated;
    });
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      saveNotes(updated);
      return updated;
    });
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] sm:max-w-[480px] p-0 flex flex-col"
        data-testid="dev-notes-drawer"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-500" />
              <SheetTitle className="text-base">Dev Notes</SheetTitle>
            </div>
            <div className="flex items-center gap-1">
              <Badge
                variant="outline"
                className="text-xs gap-1 no-default-hover-elevate no-default-active-elevate"
              >
                <Keyboard className="h-3 w-3" />
                Alt+N
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              variant={showAll ? "outline" : "default"}
              onClick={() => setShowAll(false)}
              data-testid="button-notes-this-page"
            >
              This Page ({pageNotes.length})
            </Button>
            <Button
              size="sm"
              variant={showAll ? "default" : "outline"}
              onClick={() => setShowAll(true)}
              data-testid="button-notes-all"
            >
              All Notes ({notes.length})
            </Button>
            <div className="flex-1" />
            <Button size="sm" onClick={addNote} data-testid="button-add-note">
              + New Note
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {displayNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <StickyNote className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {showAll
                  ? "No notes yet. Add your first note!"
                  : `No notes for "${pageLabel}". Click "+ New Note" to start.`}
              </p>
            </div>
          ) : (
            displayNotes.map((note) => (
              <NoteEditor
                key={note.id}
                note={note}
                onSave={saveNote}
                onDelete={deleteNote}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DevNotesButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "h-12 w-12 rounded-full",
          "bg-amber-500 hover:bg-amber-600 active:bg-amber-700",
          "text-white shadow-lg",
          "flex items-center justify-center",
          "transition-all duration-200",
          "hover:scale-105 active:scale-95",
          "group"
        )}
        data-testid="button-dev-notes-fab"
        title="Dev Notes (Alt+N)"
      >
        <StickyNote className="h-5 w-5" />
      </button>
      <DevNotesDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

export function useDevNotes() {
  return {
    notes: loadNotes(),
    getNotesByPage: (page: string) => loadNotes().filter((n) => n.page === page),
    getAllNotes: () => loadNotes(),
  };
}
