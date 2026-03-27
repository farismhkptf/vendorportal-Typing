import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  StickyNote,
  Send,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WoNote } from "@shared/schema";

export function InternalNotesSection({ workOrderId }: { workOrderId: string }) {
  const [noteText, setNoteText] = useState("");
  const [deletionRequestNote, setDeletionRequestNote] = useState<{ id: string; content: string } | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const isCrm = user?.role === "Client Relationship Manager";
  const { data: notes, isLoading } = useQuery<WoNote[]>({
    queryKey: queryKeys.woNotes(workOrderId),
    enabled: !!workOrderId,
  });

  const addNoteMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/wo-notes", { woId: workOrderId, content: noteText }),
    onSuccess: () => {
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: queryKeys.woNotes(workOrderId) });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => apiRequest("DELETE", `/api/wo-notes/${noteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.woNotes(workOrderId) });
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    },
  });

  const requestNoteDeletionMutation = useMutation({
    mutationFn: async ({ entityId, entityLabel, reason }: { entityId: string; entityLabel: string; reason: string }) => {
      const res = await apiRequest("POST", "/api/deletion-requests", {
        entityType: "wo_note",
        entityId,
        entityLabel,
        reason,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deletion request submitted", description: "Your request has been sent to Admin for review." });
      setDeletionRequestNote(null);
      setDeletionReason("");
    },
    onError: () => {
      toast({ title: "Failed to submit request", variant: "destructive" });
    },
  });

  const [deleteNoteConfirm, setDeleteNoteConfirm] = useState<{ id: string; content: string } | null>(null);

  const handleDeleteNote = (noteId: string, content: string) => {
    if (isCrm) {
      setDeletionRequestNote({ id: noteId, content });
      return;
    }
    setDeleteNoteConfirm({ id: noteId, content });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addNoteMutation.mutate();
  };

  const formatNoteDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2" data-testid="form-add-note">
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add an internal note..."
          className="min-h-[80px] resize-none flex-1"
          data-testid="input-note-text"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!noteText.trim() || addNoteMutation.isPending}
          className="self-end shrink-0"
          data-testid="button-add-note"
        >
          {addNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notes && notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group relative p-3 rounded-lg bg-muted/50 border border-border/30"
              data-testid={`note-item-${note.id}`}
            >
              <p className="text-sm text-foreground whitespace-pre-wrap pr-8">{note.content}</p>
              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-xs text-muted-foreground" title={new Date(note.createdAt).toLocaleString()}>
                  {formatNoteDate(note.createdAt)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-opacity text-muted-foreground"
                  onClick={() => handleDeleteNote(note.id, note.content)}
                  data-testid={`button-delete-note-${note.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<StickyNote className="h-6 w-6" />}
          title="No notes yet"
          description="Add internal notes for team communication about this work order."
        />
      )}
      <Dialog
        open={!!deletionRequestNote}
        onOpenChange={(open) => { if (!open) { setDeletionRequestNote(null); setDeletionReason(""); } }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Request Note Deletion</DialogTitle>
            <DialogDescription>Submit a request to Admin to delete this note.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Note content</p>
              <p className="text-sm text-foreground bg-muted/40 rounded-lg p-2 line-clamp-3">{deletionRequestNote?.content}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Reason *</p>
              <Input
                placeholder="Why should this note be deleted?"
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                data-testid="input-note-deletion-reason"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => { setDeletionRequestNote(null); setDeletionReason(""); }} data-testid="button-cancel-note-deletion">Cancel</Button>
            <Button
              disabled={!deletionReason.trim() || requestNoteDeletionMutation.isPending}
              onClick={() => {
                if (!deletionRequestNote || !deletionReason.trim()) return;
                requestNoteDeletionMutation.mutate({
                  entityId: deletionRequestNote.id,
                  entityLabel: `Note: "${deletionRequestNote.content.slice(0, 60)}${deletionRequestNote.content.length > 60 ? "..." : ""}"`,
                  reason: deletionReason.trim(),
                });
              }}
              data-testid="button-submit-note-deletion"
            >
              {requestNoteDeletionMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={!!deleteNoteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteNoteConfirm(null); }}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteNoteConfirm) {
            return new Promise<void>((resolve, reject) => {
              deleteNoteMutation.mutate(deleteNoteConfirm.id, {
                onSuccess: () => { setDeleteNoteConfirm(null); resolve(); },
                onError: () => reject(),
              });
            });
          }
        }}
      />
    </div>
  );
}
