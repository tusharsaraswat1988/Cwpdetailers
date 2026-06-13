import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commApi } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus } from "lucide-react";

export default function KnowledgeBasePanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: articles } = useQuery({ queryKey: ["comm-kb"], queryFn: () => commApi.getKnowledgeBase() });
  const [form, setForm] = useState({ title: "", category: "general", content: "" });

  const createMut = useMutation({
    mutationFn: () => commApi.createKnowledgeBaseArticle(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comm-kb"] });
      setForm({ title: "", category: "general", content: "" });
      toast({ title: "Article added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><BookOpen size={14} />Knowledge Base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
          {(articles ?? []).map(a => (
            <div key={a.id} className="p-3 border rounded-lg">
              <p className="font-medium text-sm">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.category}</p>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
            </div>
          ))}
          {!articles?.length && <p className="text-sm text-muted-foreground text-center py-6">No articles yet</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Add Article</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Input placeholder="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          <Textarea placeholder="Content" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
          <Button onClick={() => createMut.mutate()} disabled={!form.title || !form.content || createMut.isPending}>
            <Plus size={14} className="mr-1.5" />Save Article
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
