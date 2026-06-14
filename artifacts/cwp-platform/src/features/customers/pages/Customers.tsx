import { useState, type ReactNode, type ComponentType } from "react";
import { useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Users, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { Can } from "@/components/Can";
import { PageHeader, FilterBar, DataTable, type Column } from "@/components/shared";
import { CustomerAvatar } from "@/components/shared/CustomerAvatar";
import { QuickCreateCustomerForm } from "../components/QuickCreateCustomerForm";
import { CustomerOnboardingWizard } from "../components/CustomerOnboardingWizard";

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
  photoUrl?: string | null;
  gstin?: string | null;
  referredByCustomerId?: number | null;
  status: "active" | "inactive" | "suspended";
  walletBalance: string | number;
  totalDues: string | number;
};

export type CustomersPortalConfig = {
  Layout: ComponentType<{ children: ReactNode }>;
  basePath: string;
};

export default function CustomersPage({ Layout, basePath }: CustomersPortalConfig) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data, isLoading } = useListCustomers(
    { search: search || undefined },
    { query: { queryKey: getListCustomersQueryKey({ search: search || undefined }) } },
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });

  const columns: Column<Row>[] = [
    {
      key: "name", header: "Name",
      cell: c => (
        <div className="flex items-center gap-2.5">
          <CustomerAvatar name={c.name} photoUrl={c.photoUrl} size="xs" />
          <div className="min-w-0">
            <span className="font-medium text-foreground">{c.name}</span>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {c.gstin && <Badge variant="outline" className="text-[10px] h-4 px-1 border-primary/30 text-primary">B2B</Badge>}
              {c.referredByCustomerId && <Badge variant="outline" className="text-[10px] h-4 px-1">Referred</Badge>}
            </div>
          </div>
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
    { key: "action", header: "", align: "right", cell: c => <Link href={`${basePath}/${c.id}`} className="text-primary hover:underline text-xs font-medium" data-testid={`btn-view-customer-${c.id}`}>View</Link> },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-5">
        <PageHeader
          title="Customers"
          description={`${data?.total ?? 0} total customers`}
          actions={
            <Can resource="customers" action="create">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setWizardOpen(true)} data-testid="btn-onboard-customer">
                  <UserPlus size={15} className="mr-1.5" />Onboard
                </Button>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="btn-add-customer" className="bg-primary text-secondary hover:bg-primary/90">
                      <Plus size={15} className="mr-1.5" />Add Customer
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
                    <QuickCreateCustomerForm
                      customerBasePath={basePath}
                      onCreated={() => {
                        invalidate();
                        setOpen(false);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </Can>
          }
        />

        <CustomerOnboardingWizard
          open={wizardOpen}
          onOpenChange={v => {
            setWizardOpen(v);
            if (!v) invalidate();
          }}
          basePath={basePath}
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
    </Layout>
  );
}
