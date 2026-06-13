import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commApi, type CommConversation } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Inbox, User, Users, AlertTriangle, CheckCircle2, HelpCircle,
  MessageSquare, Send, Sparkles, Clock,
} from "lucide-react";

const INBOX_FILTERS = [
  { id: "all", label: "Inbox", icon: Inbox },
  { id: "my_queue", label: "My Queue", icon: User },
  { id: "unassigned", label: "Unassigned", icon: Users },
  { id: "assigned", label: "Assigned", icon: CheckCircle2 },
  { id: "escalated", label: "Escalated", icon: AlertTriangle },
  { id: "unknown", label: "Unknown", icon: HelpCircle },
  { id: "closed", label: "Closed", icon: CheckCircle2 },
] as const;

export default function ConversationInbox() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");

  const { data: counts } = useQuery({
    queryKey: ["comm-inbox-counts"],
    queryFn: commApi.getInboxCounts,
  });

  const { data: inbox, isLoading } = useQuery({
    queryKey: ["comm-inbox", filter],
    queryFn: () => commApi.getInbox(filter),
  });

  const { data: conversation, isLoading: convLoading } = useQuery({
    queryKey: ["comm-conversation", selectedId],
    queryFn: () => commApi.getConversation(selectedId!),
    enabled: selectedId != null,
  });

  const { data: ai } = useQuery({
    queryKey: ["comm-ai", selectedId],
    queryFn: () => commApi.getConversationAi(selectedId!),
    enabled: selectedId != null,
  });

  const replyMut = useMutation({
    mutationFn: () => commApi.replyToConversation(selectedId!, reply),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["comm-conversation", selectedId] });
      qc.invalidateQueries({ queryKey: ["comm-inbox"] });
      toast({ title: "Reply sent" });
    },
    onError: (e: Error) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const closeMut = useMutation({
    mutationFn: () => commApi.closeConversation(selectedId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comm-inbox"] });
      toast({ title: "Conversation closed" });
    },
  });

  return (
    <div className="grid lg:grid-cols-12 gap-4 min-h-[600px]">
      <div className="lg:col-span-3 space-y-2">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Card className="p-2"><p className="text-xs text-muted-foreground">Open</p><p className="font-bold">{counts?.open ?? 0}</p></Card>
          <Card className="p-2"><p className="text-xs text-muted-foreground">SLA Breach</p><p className="font-bold text-red-600">{counts?.slaBreaches ?? 0}</p></Card>
        </div>
        {INBOX_FILTERS.map(f => (
          <Button
            key={f.id}
            variant={filter === f.id ? "default" : "ghost"}
            className="w-full justify-start gap-2"
            onClick={() => setFilter(f.id)}
          >
            <f.icon size={14} />
            {f.label}
          </Button>
        ))}
      </div>

      <div className="lg:col-span-4 border rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b font-medium text-sm">Conversations</div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? <Skeleton className="h-20 m-2" /> : (
            (inbox?.items ?? []).map((c: CommConversation) => (
              <button
                key={c.id}
                type="button"
                className={`w-full text-left p-3 border-b hover:bg-muted/50 ${selectedId === c.id ? "bg-muted" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="font-medium text-sm truncate">
                    {c.subject ?? c.lastMessagePreview ?? `Conversation #${c.id}`}
                  </p>
                  <Badge variant="outline" className="text-[10px] shrink-0">{c.primaryChannel}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessagePreview}</p>
                <div className="flex gap-1 mt-1">
                  <Badge variant="secondary" className="text-[10px]">{c.status}</Badge>
                  {c.slaStatus !== "within_sla" && (
                    <Badge variant="destructive" className="text-[10px]">{c.slaStatus}</Badge>
                  )}
                </div>
              </button>
            ))
          )}
          {!isLoading && !inbox?.items?.length && (
            <p className="p-4 text-sm text-muted-foreground text-center">No conversations</p>
          )}
        </div>
      </div>

      <div className="lg:col-span-5 border rounded-lg flex flex-col">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            <MessageSquare className="mr-2" size={18} /> Select a conversation
          </div>
        ) : convLoading ? (
          <Skeleton className="flex-1 m-4" />
        ) : (
          <>
            <div className="p-3 border-b flex justify-between items-center">
              <div>
                <p className="font-medium">{conversation?.subject ?? `Conversation #${selectedId}`}</p>
                <p className="text-xs text-muted-foreground">{conversation?.status} · {conversation?.primaryChannel}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>
                Close
              </Button>
            </div>

            {ai && (
              <div className="p-3 bg-primary/5 border-b text-xs space-y-1">
                <p className="flex items-center gap-1 font-medium"><Sparkles size={12} /> AI Suggestions</p>
                {ai.sentiment && <p>Sentiment: {ai.sentiment} · Intent: {ai.intent ?? "—"} · Priority: {ai.priority}</p>}
                {(ai.replySuggestions as string[] | undefined)?.slice(0, 2).map((s, i) => (
                  <button key={i} type="button" className="block text-left text-primary hover:underline" onClick={() => setReply(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {(conversation?.messages ?? []).map(m => (
                <div
                  key={m.id}
                  className={`max-w-[85%] p-2 rounded-lg text-sm ${
                    m.direction === "outgoing" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <p>{m.message}</p>
                  <p className="text-[10px] opacity-70 mt-1 flex items-center gap-1">
                    <Clock size={10} /> {new Date(m.createdAt).toLocaleString("en-IN")} · {m.status}
                  </p>
                </div>
              ))}
              {(conversation?.notes ?? []).map(n => (
                <div key={n.id} className="p-2 border border-dashed rounded-lg bg-yellow-500/5 text-xs">
                  <p className="font-medium text-yellow-700">Internal note</p>
                  <p>{n.body}</p>
                </div>
              ))}
            </div>

            <div className="p-3 border-t flex gap-2">
              <Input
                placeholder="Type a reply…"
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => e.key === "Enter" && reply.trim() && replyMut.mutate()}
              />
              <Button onClick={() => replyMut.mutate()} disabled={!reply.trim() || replyMut.isPending}>
                <Send size={14} />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
