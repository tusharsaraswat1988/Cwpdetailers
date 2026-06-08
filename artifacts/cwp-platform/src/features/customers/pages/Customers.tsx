import { useState } from "react";
import { useListCustomers, getListCustomersQueryKey, useCreateCustomer } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, User, Users } from "lucide-react";
import { Link } from "wouter";
import { Can } from "@/components/Can";
import { PageHeader, FilterBar, DataTable, type Column } from "@/components/shared";

const statusColor: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  inactive: "bg-white/5 text-white/50 border-white/10",
  suspended: "bg-red-500/10 text-red-400 border-red-500/20",
};

type Row = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  status: "active" | "inactive" | "suspended";
  walletBalance: string | number;
  totalDues: string | number;
};

export default function AdminCustomers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  type CustomerForm = { name: string; phone: string; email: string; city: string; address: string };
  const [form, setForm] = useState<CustomerForm>({ name: "", phone: "", email: "", city: "", address: "" });

  const { data, isLoading } = useListCustomers(
    { search: search || undefined },
    { query: { queryKey: getListCustomersQueryKey({ search: search || undefined }) } },
  );

  const createMutation = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setOpen(false);
        setForm({ name: "", phone: "", email: "", city: "", address: "" });
        toast({ title: "Customer created successfully" });
      },
      onError: () => toast({ title: "Failed to create customer", variant: "destructive" }),
    },
  });

  const columns: Column<Row>[] = [
    {
      key: "name", header: "Name",
      cell: c => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User size={13} className="text-primary" />
          </div>
          <span className="font-medium text-white">{c.name}</span>
        </div>
      ),
    },
    { key: "phone", header: "Phone", cell: c => <span className="text-white/60">{c.phone}</span> },
    { key: "city", header: "City", cell: c => <span className="text-white/60">{c.city ?? "—"}</span> },
    {
      key: "status", header: "Status",
      cell: c => <Badge variant="outline" className={`text-xs capitalize ${statusColor[c.status]}`}>{c.status}</Badge>,
    },
    { key: "wallet", header: "Wallet", align: "right", cell: c => <span className="text-primary font-medium">₹{Number(c.walletBalance).toLocaleString("en-IN")}</span> },
    { key: "dues", header: "Dues", align: "right", cell: c => Number(c.totalDues) > 0 ? <span className="text-red-400 font-medium">₹{Number(c.totalDues).toLocaleString("en-IN")}</span> : <span className="text-white/30">—</span> },
    { key: "action", header: "", align: "right", cell: c => <Link href={`/admin/customers/${c.id}`} className="text-primary hover:underline text-xs font-medium" data-testid={`btn-view-customer-${c.id}`}>View</Link> },
  ];

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Customers"
          description={`${data?.total ?? 0} total customers`}
          actions={
            <Can resource="customers" action="create">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="btn-add-customer" className="bg-primary text-secondary hover:bg-primary/90">
                    <Plus size={15} className="mr-1.5" />Add Customer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-2">
                    {[["name", "Full Name", "text"], ["phone", "Phone", "tel"], ["email", "Email", "email"], ["city", "City", "text"], ["address", "Address", "text"]].map(([k, l, t]) => (
                      <div key={k}>
                        <Label htmlFor={k}>{l}</Label>
                        <Input id={k} data-testid={`input-customer-${k}`} type={t} value={form[k as keyof CustomerForm]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="mt-1" />
                      </div>
                    ))}
                    <Button onClick={() => createMutation.mutate({ data: form })} disabled={createMutation.isPending} className="w-full bg-primary text-secondary hover:bg-primary/90" data-testid="btn-submit-customer">
                      {createMutation.isPending ? "Creating..." : "Create Customer"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </Can>
          }
        />

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, phone or email…"
        />

        <DataTable
          columns={columns}
          rows={data?.data as Row[] | undefined}
          isLoading={isLoading}
          rowKey={r => r.id}
          emptyTitle="No customers found"
          emptyDescription="Try adjusting your search or add a new customer."
          emptyAction={
            <Can resource="customers" action="create">
              <Button onClick={() => setOpen(true)} className="bg-primary text-secondary hover:bg-primary/90">
                <Plus size={14} className="mr-1.5" /> Add Customer
              </Button>
            </Can>
          }
        />
        <p className="text-white/30 text-xs"><Users size={11} className="inline mr-1" />Powered by shared DataTable / Can primitives.</p>
      </div>
    </AdminLayout>
  );
}
