import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useMasterList, useMasterMutations } from "@/features/master-data/api";
import { Plus, Database, Car, MapPin, Wrench } from "lucide-react";

type EntityConfig = {
  key: "vehicle-brands" | "vehicle-models" | "vehicle-categories" | "seat-categories" | "states" | "cities" | "service-areas" | "pincodes" | "service-categories";
  label: string;
  fields: Array<{ key: string; label: string; type?: string }>;
};

const ENTITIES: EntityConfig[] = [
  { key: "vehicle-brands", label: "Vehicle Brands", fields: [{ key: "name", label: "Name" }, { key: "slug", label: "Slug" }] },
  { key: "vehicle-models", label: "Vehicle Models", fields: [{ key: "brandId", label: "Brand ID", type: "number" }, { key: "name", label: "Name" }, { key: "slug", label: "Slug" }] },
  { key: "vehicle-categories", label: "Vehicle Categories", fields: [{ key: "name", label: "Name" }, { key: "slug", label: "Slug" }] },
  { key: "seat-categories", label: "Seat Categories", fields: [{ key: "name", label: "Name" }, { key: "slug", label: "Slug" }, { key: "seatCount", label: "Seat Count", type: "number" }] },
  { key: "states", label: "States", fields: [{ key: "name", label: "Name" }, { key: "code", label: "Code" }] },
  { key: "cities", label: "Cities", fields: [{ key: "stateId", label: "State ID", type: "number" }, { key: "name", label: "Name" }, { key: "slug", label: "Slug" }] },
  { key: "service-areas", label: "Service Areas", fields: [{ key: "cityId", label: "City ID", type: "number" }, { key: "name", label: "Name" }] },
  { key: "pincodes", label: "Pincodes", fields: [{ key: "serviceAreaId", label: "Service Area ID", type: "number" }, { key: "pincode", label: "Pincode" }] },
  { key: "service-categories", label: "Service Categories", fields: [{ key: "name", label: "Name" }, { key: "slug", label: "Slug" }, { key: "legacyCategory", label: "Legacy Category" }] },
];

function MasterEntityPanel({ config }: { config: EntityConfig }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});

  const params = search ? { q: search } : undefined;
  const { data, isLoading } = useMasterList<Record<string, unknown>>(config.key, params as Record<string, string>);
  const { create, update, remove } = useMasterMutations(config.key);

  const handleCreate = () => {
    const payload: Record<string, unknown> = {};
    for (const f of config.fields) {
      const val = form[f.key];
      if (!val) { toast({ title: `${f.label} is required`, variant: "destructive" }); return; }
      payload[f.key] = f.type === "number" ? parseInt(val) : val;
    }
    create.mutate(payload, {
      onSuccess: () => { setOpen(false); setForm({}); toast({ title: `${config.label} created` }); },
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  const displayFields = config.fields.map(f => f.key);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder={`Search ${config.label.toLowerCase()}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus size={14} /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New {config.label.replace(/s$/, "")}</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              {config.fields.map(f => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input
                    type={f.type ?? "text"}
                    className="mt-1"
                    value={form[f.key] ?? ""}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <Button onClick={handleCreate} disabled={create.isPending} className="w-full">
                {create.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">ID</th>
              {displayFields.map(f => (
                <th key={f} className="text-left px-4 py-2 font-medium capitalize">{f.replace(/([A-Z])/g, " $1")}</th>
              ))}
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={displayFields.length + 2} className="px-4 py-6"><Skeleton className="h-8 w-full" /></td></tr>
            ) : (data ?? []).length === 0 ? (
              <tr><td colSpan={displayFields.length + 2} className="px-4 py-6 text-center text-muted-foreground">
                No records. If this is a fresh database, run{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cd scripts && pnpm run seed:master-data</code>
                {" "}or restart the API server (auto-seeds when empty).
              </td></tr>
            ) : (
              (data ?? []).map((row: Record<string, unknown>) => (
                <tr key={row.id as number} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground">{row.id as number}</td>
                  {displayFields.map(f => (
                    <td key={f} className="px-4 py-2">{String(row[f] ?? "—")}</td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive text-xs"
                      onClick={() => remove.mutate(row.id as number, {
                        onSuccess: () => toast({ title: "Deactivated" }),
                      })}
                    >
                      Deactivate
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminMasterData() {
  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="font-display font-bold text-2xl flex items-center gap-2">
            <Database size={22} className="text-primary" />
            Master Data
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage vehicle database, cities, service areas, and service categories.
          </p>
        </div>

        <Tabs defaultValue="vehicle-brands">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="vehicle-brands" className="gap-1"><Car size={12} /> Brands</TabsTrigger>
            <TabsTrigger value="vehicle-models">Models</TabsTrigger>
            <TabsTrigger value="vehicle-categories">Categories</TabsTrigger>
            <TabsTrigger value="seat-categories">Seats</TabsTrigger>
            <TabsTrigger value="states" className="gap-1"><MapPin size={12} /> States</TabsTrigger>
            <TabsTrigger value="cities">Cities</TabsTrigger>
            <TabsTrigger value="service-areas">Areas</TabsTrigger>
            <TabsTrigger value="pincodes">Pincodes</TabsTrigger>
            <TabsTrigger value="service-categories" className="gap-1"><Wrench size={12} /> Services</TabsTrigger>
          </TabsList>

          {ENTITIES.map(e => (
            <TabsContent key={e.key} value={e.key} className="mt-4">
              <MasterEntityPanel config={e} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
