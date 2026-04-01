import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Send,
  Search,
  Building2,
  ExternalLink,
  FileText,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { Link } from "wouter";

interface InboxMessage {
  id: string;
  typingJobId: string;
  authorType: "Internal" | "Vendor";
  authorUserId: string | null;
  message: string;
  createdAt: string;
  jobCode: string | null;
  vendorId: string | null;
  vendorName: string | null;
  woNumber: string | null;
  applicantName: string | null;
}

type ConversationThread = {
  typingJobId: string;
  jobCode: string | null;
  vendorId: string | null;
  vendorName: string | null;
  woNumber: string | null;
  applicantName: string | null;
  messages: InboxMessage[];
  lastMessage: InboxMessage;
  vendorMessageCount: number;
};

export default function MessagesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const { data: messages = [], isLoading } = useQuery<InboxMessage[]>({
    queryKey: ["/api/messages/inbox"],
    refetchInterval: 30000,
  });

  const threads = useMemo<ConversationThread[]>(() => {
    const map = new Map<string, ConversationThread>();
    for (const msg of messages) {
      const key = msg.typingJobId;
      if (!map.has(key)) {
        map.set(key, {
          typingJobId: msg.typingJobId,
          jobCode: msg.jobCode,
          vendorId: msg.vendorId,
          vendorName: msg.vendorName,
          woNumber: msg.woNumber,
          applicantName: msg.applicantName,
          messages: [],
          lastMessage: msg,
          vendorMessageCount: 0,
        });
      }
      const thread = map.get(key)!;
      thread.messages.push(msg);
      if (msg.authorType === "Vendor") thread.vendorMessageCount++;
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime()
    );
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.vendorName?.toLowerCase().includes(q) ||
        t.jobCode?.toLowerCase().includes(q) ||
        t.woNumber?.toLowerCase().includes(q) ||
        t.applicantName?.toLowerCase().includes(q)
    );
  }, [threads, search]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.typingJobId === selectedJobId) || null,
    [threads, selectedJobId]
  );

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJobId || !reply.trim()) return;
      await apiRequest("POST", `/api/typing-jobs/${selectedJobId}/comments`, {
        authorType: "Internal",
        message: reply.trim(),
      });
    },
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  const handleSend = () => {
    if (!reply.trim() || !selectedJobId) return;
    sendMutation.mutate();
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen overflow-hidden">
        <div className="px-4 lg:px-6 pt-4 pb-3 border-b border-border/50 shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vendor Messages</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Unified inbox across all typing job conversations
          </p>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — thread list */}
          <div
            className={cn(
              "w-full lg:w-80 xl:w-96 border-r border-border/50 flex flex-col shrink-0",
              selectedJobId && "hidden lg:flex"
            )}
          >
            <div className="p-3 border-b border-border/30">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                  data-testid="input-message-search"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                  <Inbox className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {filtered.map((thread) => {
                    const isSelected = selectedJobId === thread.typingJobId;
                    const hasVendorMsgs = thread.vendorMessageCount > 0;
                    return (
                      <button
                        key={thread.typingJobId}
                        onClick={() => setSelectedJobId(thread.typingJobId)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                          isSelected && "bg-primary/5 border-l-2 border-primary"
                        )}
                        data-testid={`thread-item-${thread.typingJobId}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-foreground truncate">
                                {thread.vendorName || "Unknown Vendor"}
                              </span>
                              {hasVendorMsgs && (
                                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-500 text-white border-0">
                                  {thread.vendorMessageCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <FileText className="h-3 w-3 shrink-0" />
                              {thread.jobCode || "—"} · {thread.woNumber || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {thread.lastMessage.authorType === "Vendor" ? "Vendor: " : "You: "}
                              {thread.lastMessage.message}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(thread.lastMessage.createdAt), { addSuffix: true })}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Main area — conversation */}
          <div className={cn("flex-1 flex flex-col overflow-hidden", !selectedJobId && "hidden lg:flex")}>
            {!selectedThread ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Select a conversation</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Choose a vendor conversation from the list
                </p>
              </div>
            ) : (
              <>
                {/* Conversation header */}
                <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setSelectedJobId(null)}
                      className="lg:hidden p-1 rounded-md hover:bg-muted transition-colors"
                      data-testid="button-back-to-inbox"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180 text-muted-foreground" />
                    </button>
                    <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4.5 w-4.5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {selectedThread.vendorName || "Unknown Vendor"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedThread.jobCode} · {selectedThread.applicantName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/typing-jobs/${selectedThread.typingJobId}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        data-testid="button-open-typing-job"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Job
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {[...selectedThread.messages].reverse().map((msg) => {
                    const isInternal = msg.authorType === "Internal";
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex", isInternal ? "justify-end" : "justify-start")}
                        data-testid={`message-${msg.id}`}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                            isInternal
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          )}
                        >
                          <p className="leading-relaxed">{msg.message}</p>
                          <p
                            className={cn(
                              "text-[10px] mt-1",
                              isInternal ? "text-primary-foreground/60 text-right" : "text-muted-foreground"
                            )}
                          >
                            {isInternal ? "You" : msg.vendorName || "Vendor"} ·{" "}
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply bar */}
                <div className="px-4 py-3 border-t border-border/50 shrink-0">
                  <div className="flex gap-2 items-end">
                    <Textarea
                      placeholder="Type a message to the vendor..."
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      className="min-h-[2.5rem] max-h-32 resize-none text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      data-testid="input-reply-message"
                    />
                    <Button
                      size="sm"
                      className="h-10 gap-1.5 shrink-0"
                      onClick={handleSend}
                      disabled={!reply.trim() || sendMutation.isPending}
                      data-testid="button-send-message"
                    >
                      <Send className="h-4 w-4" />
                      {sendMutation.isPending ? "Sending..." : "Send"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Press Enter to send · Shift+Enter for new line
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
