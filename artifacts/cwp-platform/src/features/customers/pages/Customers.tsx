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
import { PhoneInput } from "@/components/ui/phone-input";
import { EmailInput } from "@/components/ui/email-input";
import { submitEmail, submitMobile } from "@/lib/contactForm";

const statusColor: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  inactive: "bg-muted text-muted-foreground border-border",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
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
  const [errors, setErrors] = useState<{ phone?: string | null; email?: string | null }>({});

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
      onError: (err: any) => toast({ title: "Failed to create customer", description: err?.response?.data?.error, variant: "destructive" }),
    },
  });

  const handleCreate = () => {
    const phoneResult = submitMobile(form.phone);
    const emailResult = submitEmail(form.email);
    setErrors({
      phone: phoneResult.ok ? null : phoneResult.error,
      email: emailResult.ok ? null : emailResult.error,
    });
    if (!phoneResult.ok || !emailResult.ok) {
      toast({ title: "Please fix phone or email format", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      data: {
        ...form,
        phone: phoneResult.value,
        email: emailResult.value,
      },
    });
  };

  const columns: Column<Row>[] = [
    {
      key: "name", header: "Name",
      cell: c => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User size={13} className="text-primary" />
          </div>
          <span className="font-medium text-foreground">{c.name}</span>
        </div>
      ),
    },
    { key: "phone", header: "Phone", cell: c => <span className="text-muted-foreground">{c.phone}</span> },
    { key: "city", header: "City", cell: c => <span className="text-muted-foreground">{c.city ?? "—"}</span> },
    {
      key: "status", header: "Status",
      cell: c => <Badge variant="outline" className={`text-xs capitalize ${statusColor[c.status]}`}>{c.status}</Badge>,
    },
    { key: "wallet", header: "Wallet", align: "right", cell: c => <span className="text-primary font-medium">₹{Number(c.walletBalance).toLocaleString("en-IN")}</span> },
    { key: "dues", header: "Dues", align: "right", cell: c => Number(c.totalDues) > 0 ? <span className="text-red-600 dark:text-red-400 font-medium">₹{Number(c.totalDues).toLocaleString("en-IN")}</span> : <span className="text-muted-foreground">—</span> },
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
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" data-testid="input-customer-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
                    </div>
                    <PhoneInput
                      id="phone"
                      data-testid="input-customer-phone"
                      label="Phone"
                      value={form.phone}
                      onChange={v => setForm(f => ({ ...f, phone: v }))}
                      error={errors.phone}
                      onErrorChange={err => setErrors(e => ({ ...e, phone: err }))}
                    />
                    <EmailInput
                      id="email"
                      data-testid="input-customer-email"
                      label="Email"
                      optional
                      value={form.email}
                      onChange={v => setForm(f => ({ ...f, email: v }))}
                      error={errors.email}
                      onErrorChange={err => setErrors(e => ({ ...e, email: err }))}
                    />
                    {[["city", "City"], ["address", "Address"]].map(([k, l]) => (
                      <div key={k}>
                        <Label htmlFor={k}>{l}</Label>
                        <Input id={k} data-testid={`input-customer-${k}`} value={form[k as keyof CustomerForm]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="mt-1" />
                      </div>
                    ))}
                    <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full bg-primary text-secondary hover:bg-primary/90" data-testid="btn-submit-customer">
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
        <p className="text-muted-foreground text-xs"><Users size={11} className="inline mr-1" />Powered by shared DataTable / Can primitives.</p>
      </div>
    </AdminLayout>
  );
}
