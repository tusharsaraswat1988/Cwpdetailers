import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commApi, type CommConversation } from "../api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Inbox, User, Users, AlertTriangle, CheckCircle2, HelpCircle,
  MessageSquare, Send, Sparkles, Clock, Tag, StickyNote,
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
  const [note, setNote] = useState("");
  const [tag, setTag] = useState("");
  const [assignTeamId, setAssignTeamId] = useState("");

  const { data: counts } = useQuery({
    queryKey: ["comm-inbox-counts"],
    queryFn: commApi.getInboxCounts,
  });

  const { data: teams } = useQuery({
    queryKey: ["comm-teams"],
    queryFn: commApi.getTeams,
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

  const invalidateConv = () => {
    qc.invalidateQueries({ queryKey: ["comm-conversation", selectedId] });
    qc.invalidateQueries({ queryKey: ["comm-inbox"] });
    qc.invalidateQueries({ queryKey: ["comm-inbox-counts"] });
  };

  const replyMut = useMutation({
    mutationFn: () => commApi.replyToConversation(selectedId!, reply),
    onSuccess: () => { setReply(""); invalidateConv(); toast({ title: "Reply sent" }); },
    onError: (e: Error) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const closeMut = useMutation({
    mutationFn: () => commApi.closeConversation(selectedId!),
    onSuccess: () => { invalidateConv(); toast({ title: "Conversation closed" }); },
  });

  const noteMut = useMutation({
    mutationFn: () => commApi.addConversationNote(selectedId!, note),
    onSuccess: () => { setNote(""); invalidateConv(); toast({ title: "Note added" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const tagMut = useMutation({
    mutationFn: () => commApi.addConversationTag(selectedId!, tag),
    onSuccess: () => { setTag(""); invalidateConv(); toast({ title: "Tag added" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const assignMut = useMutation({
    mutationFn: () => commApi.assignConversation(selectedId!, { teamId: parseInt(assignTeamId) }),
    onSuccess: () => { invalidateConv(); toast({ title: "Conversation assigned" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="grid lg:grid-cols-12 gap-4 min-h-[600px]">
      <div className="lg:col-span-3 space-y-2">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Card className="p-2"><p className="text-xs text-muted-foreground">Open</p><p className="font-bold">{counts?.open ?? 0}</p></Card>
          <Card className="p-2"><p className="text-xs text-muted-foreground">SLA Breach</p><p className="font-bold text-red-600">{counts?.slaBreaches ?? 0}</p></Card>
        </div>
        {INBOX_FILTERS.map(f => (
          <Button key={f.id} variant={filter === f.id ? "default" : "ghost"} className="w-full justify-start gap-2" onClick={() => setFilter(f.id)}>
            <f.icon size={14} />{f.label}
          </Button>
        ))}
      </div>

      <div className="lg:col-span-4 border rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b font-medium text-sm">Conversations</div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? <Skeleton className="h-20 m-2" /> : (inbox?.items ?? []).map((c: CommConversation) => (
            <button key={c.id} type="button"
              className={`w-full text-left p-3 border-b hover:bg-muted/50 ${selectedId === c.id ? "bg-muted" : ""}`}
              onClick={() => setSelectedId(c.id)}>
              <div className="flex justify-between items-start gap-2">
                <p className="font-medium text-sm truncate">{c.subject ?? c.lastMessagePreview ?? `Conversation #${c.id}`}</p>
                <Badge variant="outline" className="text-[10px] shrink-0">{c.primaryChannel}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessagePreview}</p>
              <div className="flex gap-1 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">{c.status}</Badge>
                {c.slaStatus !== "within_sla" && <Badge variant="destructive" className="text-[10px]">{c.slaStatus}</Badge>}
              </div>
            </button>
          ))}
          {!isLoading && !inbox?.items?.length && <p className="p-4 text-sm text-muted-foreground text-center">No conversations</p>}
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
            <div className="p-3 border-b space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium">{conversation?.subject ?? `Conversation #${selectedId}`}</p>
                  <p className="text-xs text-muted-foreground">{conversation?.status} · {conversation?.primaryChannel}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(conversation?.tags ?? []).map(t => (
                      <Badge key={t.id} variant="outline" className="text-[10px]"><Tag size={8} className="mr-0.5" />{t.tag}</Badge>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>Close</Button>
              </div>
              <div className="flex gap-2">
                <Select value={assignTeamId} onValueChange={setAssignTeamId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Assign to team" /></SelectTrigger>
                  <SelectContent>{(teams ?? []).map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="secondary" onClick={() => assignMut.mutate()} disabled={!assignTeamId || assignMut.isPending}>Assign</Button>
              </div>
            </div>

            {ai && (
              <div className="p-3 bg-primary/5 border-b text-xs space-y-1">
                <p className="flex items-center gap-1 font-medium"><Sparkles size={12} /> AI Suggestions</p>
                {ai.sentiment && <p>Sentiment: {ai.sentiment} · Intent: {ai.intent ?? "—"} · Priority: {ai.priority}</p>}
                {(ai.replySuggestions as string[] | undefined)?.slice(0, 2).map((s, i) => (
                  <button key={i} type="button" className="block text-left text-primary hover:underline" onClick={() => setReply(s)}>{s}</button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
              {(conversation?.messages ?? []).map(m => (
                <div key={m.id} className={`max-w-[85%] p-2 rounded-lg text-sm ${m.direction === "outgoing" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p>{m.message}</p>
                  <p className="text-[10px] opacity-70 mt-1 flex items-center gap-1">
                    <Clock size={10} /> {new Date(m.createdAt).toLocaleString("en-IN")} · {m.status}
                  </p>
                </div>
              ))}
              {(conversation?.notes ?? []).map(n => (
                <div key={n.id} className="p-2 border border-dashed rounded-lg bg-yellow-500/5 text-xs">
                  <p className="font-medium text-yellow-700 flex items-center gap-1"><StickyNote size={10} /> Internal note</p>
                  <p>{n.body}</p>
                </div>
              ))}
            </div>

            <div className="p-3 border-t space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Type a reply…" value={reply} onChange={e => setReply(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && reply.trim() && replyMut.mutate()} />
                <Button onClick={() => replyMut.mutate()} disabled={!reply.trim() || replyMut.isPending}><Send size={14} /></Button>
              </div>
              <div className="flex gap-2">
                <Input placeholder="Internal note…" value={note} onChange={e => setNote(e.target.value)} className="text-xs" />
                <Button size="sm" variant="outline" onClick={() => noteMut.mutate()} disabled={!note.trim() || noteMut.isPending}>Note</Button>
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add tag…" value={tag} onChange={e => setTag(e.target.value)} className="text-xs" />
                <Button size="sm" variant="outline" onClick={() => tagMut.mutate()} disabled={!tag.trim() || tagMut.isPending}>Tag</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
