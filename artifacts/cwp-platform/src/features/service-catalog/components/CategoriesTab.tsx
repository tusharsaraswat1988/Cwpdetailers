import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useServiceCategories, useMasterMutations } from "@/features/master-data/api";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function CategoriesTab() {
  const { toast } = useToast();
  const { data: categories } = useServiceCategories();
  const mutations = useMasterMutations("service-categories");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", sortOrder: "0" });

  const create = () => {
    mutations.create.mutate({
      name: form.name,
      slug: form.slug || slugify(form.name),
      sortOrder: parseInt(form.sortOrder) || 0,
      showOnWebsite: true,
      showInBooking: true,
      showInSeo: true,
      isActive: true,
    }, {
      onSuccess: () => { setOpen(false); toast({ title: "Category created" }); },
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Service Categories</CardTitle>
          <CardDescription>Sortable, enable/disable, website & booking display</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus size={14} className="mr-1" />Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
              <div><Label>Slug</Label><Input value={form.slug} placeholder={slugify(form.name)} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="mt-1" /></div>
              <div><Label>Sort Order</Label><Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} className="mt-1" /></div>
              <Button onClick={create} disabled={!form.name || mutations.create.isPending} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {(categories ?? []).map(cat => (
          <div key={cat.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg">
            <div className="flex-1">
              <p className="font-medium">{cat.name}</p>
              <p className="text-xs text-muted-foreground">/{cat.slug}</p>
            </div>
            <Switch checked={cat.isActive} onCheckedChange={v => mutations.update.mutate({ id: cat.id, isActive: v })} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
