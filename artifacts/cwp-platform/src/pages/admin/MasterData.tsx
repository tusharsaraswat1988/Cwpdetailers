import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useMasterList, useMasterMutations } from "@/features/master-data/api";
import { Plus, Database, Car, MapPin, Wrench, PowerOff, CheckCircle2, Pencil, Loader2 } from "lucide-react";

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
  const [openCreate, setOpenCreate] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [form, setForm] = useState<Record<string, string>>({});
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [mutatingId, setMutatingId] = useState<number | null>(null);

  const params: Record<string, string> = {};
  if (search.trim()) params.q = search.trim();
  if (statusFilter === "active") params.isActive = "true";
  if (statusFilter === "inactive") params.isActive = "false";

  const { data, isLoading } = useMasterList<Record<string, unknown>>(
    config.key,
    Object.keys(params).length ? params : undefined
  );
  const { create, update, remove } = useMasterMutations(config.key);

  const handleCreate = () => {
    const payload: Record<string, unknown> = {};
    for (const f of config.fields) {
      const val = form[f.key];
      if (val === undefined || val === "") {
        toast({ title: `${f.label} is required`, variant: "destructive" });
        return;
      }
      payload[f.key] = f.type === "number" ? parseInt(val, 10) : val;
    }
    create.mutate(payload, {
      onSuccess: () => {
        setOpenCreate(false);
        setForm({});
        toast({ title: `${config.label.replace(/s$/, "")} created successfully` });
      },
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  const handleStartEdit = (row: Record<string, unknown>) => {
    setEditingRow(row);
    const initial: Record<string, string> = {};
    for (const f of config.fields) {
      initial[f.key] = row[f.key] !== undefined && row[f.key] !== null ? String(row[f.key]) : "";
    }
    setEditForm(initial);
  };

  const handleSaveEdit = () => {
    if (!editingRow) return;
    const payload: Record<string, unknown> = {};
    for (const f of config.fields) {
      const val = editForm[f.key];
      if (val === undefined || val === "") {
        toast({ title: `${f.label} is required`, variant: "destructive" });
        return;
      }
      payload[f.key] = f.type === "number" ? parseInt(val, 10) : val;
    }
    const id = editingRow.id as number;
    update.mutate({ id, ...payload }, {
      onSuccess: () => {
        setEditingRow(null);
        setEditForm({});
        toast({ title: `${config.label.replace(/s$/, "")} updated successfully` });
      },
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  const handleToggleActive = (row: Record<string, unknown>, targetActive: boolean) => {
    const id = row.id as number;
    const name = (row.name as string) || (row.pincode as string) || (row.code as string) || `#${id}`;
    setMutatingId(id);

    if (!targetActive) {
      remove.mutate(id, {
        onSuccess: () => {
          toast({
            title: `${name} deactivated`,
            description: `${config.label.replace(/s$/, "")} is now inactive.`,
          });
          setMutatingId(null);
        },
        onError: (err: Error) => {
          toast({
            title: `Failed to deactivate ${name}`,
            description: err.message,
            variant: "destructive",
          });
          setMutatingId(null);
        },
      });
    } else {
      update.mutate({ id, isActive: true }, {
        onSuccess: () => {
          toast({
            title: `${name} activated`,
            description: `${config.label.replace(/s$/, "")} is now active.`,
          });
          setMutatingId(null);
        },
        onError: (err: Error) => {
          toast({
            title: `Failed to activate ${name}`,
            description: err.message,
            variant: "destructive",
          });
          setMutatingId(null);
        },
      });
    }
  };

  const displayFields = config.fields.map(f => f.key);

  const renderCellValue = (row: Record<string, unknown>, fieldKey: string) => {
    if (fieldKey === "brandId" && row.brandName) {
      return `${row.brandName} (#${row.brandId})`;
    }
    if (fieldKey === "stateId" && row.stateName) {
      return `${row.stateName} (#${row.stateId})`;
    }
    if (fieldKey === "cityId" && row.cityName) {
      return `${row.cityName} (#${row.cityId})`;
    }
    if (fieldKey === "serviceAreaId" && row.areaName) {
      return `${row.areaName} (#${row.serviceAreaId})`;
    }
    return String(row[fieldKey] ?? "—");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Input
            placeholder={`Search ${config.label.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                statusFilter === "active"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                statusFilter === "inactive"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Inactive
            </button>
          </div>

          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus size={14} /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New {config.label.replace(/s$/, "")}</DialogTitle>
              </DialogHeader>
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
      </div>

      <div className="border border-border rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">ID</th>
              {displayFields.map(f => (
                <th key={f} className="text-left px-4 py-2.5 font-medium capitalize">
                  {f.replace(/([A-Z])/g, " $1")}
                </th>
              ))}
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-right px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={displayFields.length + 3} className="px-4 py-6">
                  <Skeleton className="h-8 w-full" />
                </td>
              </tr>
            ) : (data ?? []).length === 0 ? (
              <tr>
                <td colSpan={displayFields.length + 3} className="px-4 py-8 text-center text-muted-foreground">
                  No {statusFilter !== "all" ? statusFilter : ""} records found.
                  {statusFilter !== "all" && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setStatusFilter("all")}
                      className="ml-2 text-xs"
                    >
                      Show all records
                    </Button>
                  )}
                </td>
              </tr>
            ) : (
              (data ?? []).map((row: Record<string, unknown>) => {
                const isActive = row.isActive !== false;
                const isMutating = mutatingId === row.id;

                return (
                  <tr
                    key={row.id as number}
                    className={`border-t border-border transition-colors ${
                      isActive
                        ? "hover:bg-muted/30"
                        : "opacity-75 bg-muted/15 hover:opacity-100"
                    }`}
                  >
                    <td className="px-4 py-2 text-muted-foreground font-mono text-xs">
                      {row.id as number}
                    </td>
                    {displayFields.map(f => (
                      <td key={f} className="px-4 py-2">
                        {renderCellValue(row, f)}
                      </td>
                    ))}
                    <td className="px-4 py-2">
                      {isActive ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium text-xs px-2 py-0.5"
                        >
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-muted text-muted-foreground border border-border text-xs px-2 py-0.5"
                        >
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleStartEdit(row)}
                          title="Edit"
                        >
                          <Pencil size={13} className="mr-1" /> Edit
                        </Button>

                        {isActive ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                            disabled={isMutating}
                            onClick={() => handleToggleActive(row, false)}
                            title="Deactivate item"
                          >
                            {isMutating ? (
                              <>
                                <Loader2 size={13} className="animate-spin mr-1" />
                                Deactivating...
                              </>
                            ) : (
                              <>
                                <PowerOff size={13} className="mr-1" />
                                Deactivate
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-medium"
                            disabled={isMutating}
                            onClick={() => handleToggleActive(row, true)}
                            title="Activate item"
                          >
                            {isMutating ? (
                              <>
                                <Loader2 size={13} className="animate-spin mr-1" />
                                Activating...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={13} className="mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingRow} onOpenChange={open => !open && setEditingRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {config.label.replace(/s$/, "")} #{editingRow?.id as number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {config.fields.map(f => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Input
                  type={f.type ?? "text"}
                  className="mt-1"
                  value={editForm[f.key] ?? ""}
                  onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <Button onClick={handleSaveEdit} disabled={update.isPending} className="w-full">
              {update.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
