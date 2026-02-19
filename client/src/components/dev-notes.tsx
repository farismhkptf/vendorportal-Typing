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
  Minus,
  X,
  GripHorizontal,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pro-dev-notes";
const POSITION_KEY = "pro-dev-notes-pos";

interface NoteEntry {
  id: string;
  page: string;
  pageLabel: string;
  content: string;
  updatedAt: string;
}

interface StickyPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
}

function isMobileView() {
  return typeof window !== "undefined" && window.innerWidth < 640;
}

const MIN_WIDTH_DESKTOP = 320;
const MIN_WIDTH_MOBILE = 260;
const MIN_HEIGHT = 280;

function getMinWidth() {
  return isMobileView() ? MIN_WIDTH_MOBILE : MIN_WIDTH_DESKTOP;
}

function getDefaultPos(): StickyPosition {
  if (typeof window === "undefined") {
    return { x: 20, y: 80, width: 480, height: 500, minimized: false };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < 640) {
    return {
      x: 8,
      y: 60,
      width: w - 16,
      height: Math.min(h - 80, 500),
      minimized: false,
    };
  }
  return {
    x: Math.max(w - 520, 20),
    y: 80,
    width: 480,
    height: Math.min(500, h - 100),
    minimized: false,
  };
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
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: NoteEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function loadPosition(): StickyPosition {
  const defaults = getDefaultPos();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (raw) {
      const pos = JSON.parse(raw);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        x: Math.max(0, Math.min(pos.x, vw - 100)),
        y: Math.max(0, Math.min(pos.y, vh - 50)),
        width: Math.max(getMinWidth(), Math.min(pos.width || defaults.width, vw - 40)),
        height: Math.max(MIN_HEIGHT, Math.min(pos.height || defaults.height, vh - 40)),
        minimized: pos.minimized ?? false,
      };
    }
  } catch {}
  return defaults;
}

function savePosition(pos: StickyPosition) {
  if (typeof window === "undefined") return;
  localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
}

function ToolbarBtn({
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
            "p-1 rounded transition-colors",
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
  const s = "h-3.5 w-3.5";

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-2 py-1 border-b bg-muted/30" data-testid="editor-toolbar">
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold">
        <Bold className={s} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic">
        <Italic className={s} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline">
        <UnderlineIcon className={s} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough">
        <Strikethrough className={s} />
      </ToolbarBtn>
      <Separator orientation="vertical" className="h-4 mx-0.5" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} title="Heading 1">
        <Heading1 className={s} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Heading 2">
        <Heading2 className={s} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} title="Heading 3">
        <Heading3 className={s} />
      </ToolbarBtn>
      <Separator orientation="vertical" className="h-4 mx-0.5" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet List">
        <List className={s} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered List">
        <ListOrdered className={s} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive("taskList")} title="Checklist">
        <ListChecks className={s} />
      </ToolbarBtn>
      <Separator orientation="vertical" className="h-4 mx-0.5" />
      <ToolbarBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table">
        <TableIcon className={s} />
      </ToolbarBtn>
      <Separator orientation="vertical" className="h-4 mx-0.5" />
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo className={s} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo className={s} />
      </ToolbarBtn>
    </div>
  );
}

function NoteEditor({
  note,
  onSave,
}: {
  note: NoteEntry;
  onSave: (id: string, content: string) => void;
}) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
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
          "prose prose-sm dark:prose-invert max-w-none p-3 focus:outline-none [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2 [&_ul[data-type=taskList]_li]:items-start [&_ul[data-type=taskList]_li_label]:mt-0.5 [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted/50 [&_th]:font-semibold",
      },
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export function DevNotesSticky({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [location] = useLocation();
  const [notes, setNotes] = useState<NoteEntry[]>(loadNotes);
  const [pos, setPos] = useState<StickyPosition>(loadPosition);
  const [activeNoteIndex, setActiveNoteIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0, posX: 0, posY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportW, setViewportW] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  const currentPage = location.split("?")[0].split("#")[0];
  const pageLabel = getPageLabel(currentPage);

  useEffect(() => {
    const handleViewportChange = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setViewportW(vw);
      setPos((p) => {
        if (vw < 640) {
          return {
            ...p,
            x: 8,
            y: Math.max(0, Math.min(p.y, vh - 40)),
            width: vw - 16,
            height: Math.max(MIN_HEIGHT, Math.min(p.height, vh - p.y - 8)),
          };
        }
        const w = Math.max(getMinWidth(), Math.min(p.width, vw - 16));
        const h = Math.max(MIN_HEIGHT, Math.min(p.height, vh - 40));
        return {
          ...p,
          x: Math.max(0, Math.min(p.x, vw - w)),
          y: Math.max(0, Math.min(p.y, vh - 40)),
          width: w,
          height: h,
        };
      });
    };
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setNotes(loadNotes());
      const interval = setInterval(() => setNotes(loadNotes()), 2000);
      return () => clearInterval(interval);
    }
  }, [open]);

  useEffect(() => {
    savePosition(pos);
  }, [pos]);

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
    setActiveNoteIndex(0);
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
      setActiveNoteIndex((i) => Math.max(0, Math.min(i, updated.length - 1)));
      return updated;
    });
  }, []);

  const getClientXY = useCallback((e: MouseEvent | TouchEvent) => {
    if ("touches" in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { clientX: t.clientX, clientY: t.clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const { clientX, clientY } = "touches" in e
      ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
      : { clientX: e.clientX, clientY: e.clientY };
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY, posX: pos.x, posY: pos.y };
  }, [pos.x, pos.y]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const { clientX, clientY } = getClientXY(e);
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      setPos((p) => {
        const minVisible = 60;
        const maxX = Math.max(0, window.innerWidth - Math.min(p.width, minVisible));
        const maxY = Math.max(0, window.innerHeight - 40);
        return {
          ...p,
          x: Math.max(0, Math.min(dragStartRef.current.posX + dx, maxX)),
          y: Math.max(0, Math.min(dragStartRef.current.posY + dy, maxY)),
        };
      });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    window.addEventListener("touchcancel", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
      window.removeEventListener("touchcancel", handleUp);
    };
  }, [isDragging, getClientXY]);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    const { clientX, clientY } = "touches" in e
      ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
      : { clientX: e.clientX, clientY: e.clientY };
    setIsResizing(direction);
    resizeStartRef.current = {
      x: clientX,
      y: clientY,
      w: pos.width,
      h: pos.height,
      posX: pos.x,
      posY: pos.y,
    };
  }, [pos]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const { clientX, clientY } = getClientXY(e);
      const dx = clientX - resizeStartRef.current.x;
      const dy = clientY - resizeStartRef.current.y;
      setPos((p) => {
        const newPos = { ...p };
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (isResizing.includes("e")) {
          const maxW = vw - newPos.x - 8;
          newPos.width = Math.max(getMinWidth(), Math.min(resizeStartRef.current.w + dx, maxW));
        }
        if (isResizing.includes("w")) {
          const newW = Math.max(getMinWidth(), resizeStartRef.current.w - dx);
          newPos.width = newW;
          newPos.x = Math.max(0, resizeStartRef.current.posX + (resizeStartRef.current.w - newW));
        }
        if (isResizing.includes("s")) {
          const maxH = vh - newPos.y - 8;
          newPos.height = Math.max(MIN_HEIGHT, Math.min(resizeStartRef.current.h + dy, maxH));
        }
        if (isResizing.includes("n")) {
          const newH = Math.max(MIN_HEIGHT, resizeStartRef.current.h - dy);
          newPos.height = newH;
          newPos.y = Math.max(0, resizeStartRef.current.posY + (resizeStartRef.current.h - newH));
        }
        return newPos;
      });
    };
    const handleUp = () => setIsResizing(null);
    window.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    window.addEventListener("touchcancel", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
      window.removeEventListener("touchcancel", handleUp);
    };
  }, [isResizing, getClientXY]);

  if (!open) return null;

  const activeNote = notes[activeNoteIndex];

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-[9999] flex flex-col",
        "bg-background border border-border rounded-lg shadow-2xl",
        "select-none",
        (isDragging || isResizing) && "pointer-events-auto"
      )}
      style={{
        left: pos.x,
        top: pos.y,
        width: pos.minimized ? Math.min(300, viewportW - 16) : pos.width,
        height: pos.minimized ? "auto" : pos.height,
      }}
      data-testid="dev-notes-sticky"
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-t-lg",
          "bg-amber-500 dark:bg-amber-600 text-white",
          "cursor-grab touch-none",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        data-testid="dev-notes-sticky-titlebar"
      >
        <GripHorizontal className="h-4 w-4 opacity-60 shrink-0" />
        <StickyNote className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium truncate flex-1">
          Dev Notes
          {notes.length > 0 && (
            <span className="opacity-75 ml-1">({notes.length})</span>
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={addNote}
            className="p-1 rounded hover:bg-white/20 transition-colors"
            title="New Note"
            data-testid="button-sticky-add-note"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setPos((p) => ({ ...p, minimized: !p.minimized }))}
            className="p-1 rounded hover:bg-white/20 transition-colors"
            title={pos.minimized ? "Expand" : "Minimize"}
            data-testid="button-sticky-minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/20 transition-colors"
            title="Close (Alt+N)"
            data-testid="button-sticky-close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!pos.minimized && (
        <>
          {notes.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/20 overflow-x-auto">
              <button
                onClick={() => setActiveNoteIndex((i) => Math.max(0, i - 1))}
                disabled={activeNoteIndex === 0}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 shrink-0"
                data-testid="button-note-prev"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
                {notes.map((note, i) => (
                  <button
                    key={note.id}
                    onClick={() => setActiveNoteIndex(i)}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs whitespace-nowrap transition-colors shrink-0",
                      i === activeNoteIndex
                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    data-testid={`button-note-tab-${i}`}
                  >
                    {note.pageLabel}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setActiveNoteIndex((i) => Math.min(notes.length - 1, i + 1))}
                disabled={activeNoteIndex >= notes.length - 1}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 shrink-0"
                data-testid="button-note-next"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {activeNote && (
                <button
                  onClick={() => deleteNote(activeNote.id)}
                  className="p-0.5 rounded text-muted-foreground hover:text-red-500 shrink-0 ml-1"
                  title="Delete this note"
                  data-testid="button-delete-active-note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-hidden min-h-0">
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4">
                <StickyNote className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  No notes yet. Click + to add one.
                </p>
                <Badge variant="outline" className="text-xs gap-1 no-default-hover-elevate no-default-active-elevate">
                  Page: {pageLabel}
                </Badge>
              </div>
            ) : activeNote ? (
              <NoteEditor
                key={activeNote.id}
                note={activeNote}
                onSave={saveNote}
              />
            ) : null}
          </div>

          {notes.length > 0 && activeNote && (
            <div className="flex items-center justify-between gap-2 px-2 py-1 border-t bg-muted/10 text-xs text-muted-foreground">
              <span className="truncate">{activeNote.pageLabel}</span>
              <span className="shrink-0">
                {new Date(activeNote.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          <div
            className="absolute bottom-0 right-0 w-6 h-6 sm:w-4 sm:h-4 cursor-se-resize touch-none"
            onMouseDown={(e) => handleResizeStart(e, "se")}
            onTouchStart={(e) => handleResizeStart(e, "se")}
            data-testid="resize-handle-se"
          >
            <svg className="w-4 h-4 absolute bottom-0 right-0 text-muted-foreground/40" viewBox="0 0 16 16">
              <path d="M14 14L8 14L14 8Z" fill="currentColor" />
              <path d="M14 14L12 14L14 12Z" fill="currentColor" opacity="0.5" />
            </svg>
          </div>
          <div
            className="absolute top-0 right-0 bottom-0 w-3 sm:w-1.5 cursor-e-resize touch-none"
            onMouseDown={(e) => handleResizeStart(e, "e")}
            onTouchStart={(e) => handleResizeStart(e, "e")}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-3 sm:h-1.5 cursor-s-resize touch-none"
            onMouseDown={(e) => handleResizeStart(e, "s")}
            onTouchStart={(e) => handleResizeStart(e, "s")}
          />
          <div
            className="absolute top-0 left-0 bottom-0 w-3 sm:w-1.5 cursor-w-resize touch-none"
            onMouseDown={(e) => handleResizeStart(e, "w")}
            onTouchStart={(e) => handleResizeStart(e, "w")}
          />
          <div
            className="absolute top-0 left-0 right-0 h-3 sm:h-1.5 cursor-n-resize touch-none"
            onMouseDown={(e) => handleResizeStart(e, "n")}
            onTouchStart={(e) => handleResizeStart(e, "n")}
          />
          <div
            className="absolute top-0 left-0 w-5 h-5 sm:w-3 sm:h-3 cursor-nw-resize touch-none"
            onMouseDown={(e) => handleResizeStart(e, "nw")}
            onTouchStart={(e) => handleResizeStart(e, "nw")}
          />
          <div
            className="absolute top-0 right-0 w-5 h-5 sm:w-3 sm:h-3 cursor-ne-resize touch-none"
            onMouseDown={(e) => handleResizeStart(e, "ne")}
            onTouchStart={(e) => handleResizeStart(e, "ne")}
          />
          <div
            className="absolute bottom-0 left-0 w-5 h-5 sm:w-3 sm:h-3 cursor-sw-resize touch-none"
            onMouseDown={(e) => handleResizeStart(e, "sw")}
            onTouchStart={(e) => handleResizeStart(e, "sw")}
          />
        </>
      )}
    </div>
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
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-50",
            "h-12 w-12 rounded-full",
            "bg-amber-500 text-white shadow-lg",
            "flex items-center justify-center",
            "transition-all duration-200",
            "hover-elevate active-elevate-2"
          )}
          data-testid="button-dev-notes-fab"
          title="Dev Notes (Alt+N)"
        >
          <StickyNote className="h-5 w-5" />
        </button>
      )}
      <DevNotesSticky open={open} onClose={() => setOpen(false)} />
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
