import { MessageSquare, Send } from "lucide-react";
import { formatDateTime } from "@/lib/format-date";
import type { TypingJobComment } from "@shared/schema";

interface CommentsSectionProps {
  comments: TypingJobComment[];
  newComment: string;
  setNewComment: (v: string) => void;
  onAddComment: (message: string) => void;
  addCommentPending: boolean;
}

export function CommentsSection({ comments, newComment, setNewComment, onAddComment, addCommentPending }: CommentsSectionProps) {
  return (
    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-white/80 flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4" /> Comments
      </h3>
      <div className="flex gap-2 mb-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a message..."
          className="glass-input flex-1 px-3 py-2.5 text-sm min-h-[60px] resize-none"
          data-testid="v2-input-comment"
        />
        <button
          onClick={() => { if (newComment.trim()) onAddComment(newComment.trim()); }}
          disabled={!newComment.trim() || addCommentPending}
          className="glass-btn-primary p-2.5 self-end rounded-xl"
          data-testid="v2-button-send-comment"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {comments.length > 0 ? (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {comments.map(comment => (
            <div
              key={comment.id}
              className={`p-3 rounded-xl ${comment.authorType === "Vendor" ? "bg-purple-50 dark:bg-purple-500/15 ml-8" : "bg-slate-50 dark:bg-white/5 mr-8"}`}
              data-testid={`v2-comment-${comment.id}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-medium text-slate-400 dark:text-white/40">{comment.authorType === "Vendor" ? "You" : "Team"}</span>
                <span className="text-[10px] text-slate-300 dark:text-white/25">{comment.createdAt ? formatDateTime(comment.createdAt) : ""}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-white/70">{comment.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 dark:text-white/30 text-center py-4">No comments yet.</p>
      )}
    </div>
  );
}
