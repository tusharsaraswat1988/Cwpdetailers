import { useEffect, useState, type ReactNode, type ComponentType } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetCustomer,
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useUpdateCustomer,
  useListBranches,
  getListBranchesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, User, LayoutDashboard, MessageSquare, FileText } from "lucide-react";
import { Link } from "wouter";
import CommunicationTimeline from "@/features/communications/components/CommunicationTimeline";
import CommunicationPreferences from "@/features/communications/components/CommunicationPreferences";
import { CustomerPhotoEditor } from "@/components/shared/CustomerPhotoEditor";
import { Can } from "@/components/Can";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmailInput } from "@/components/ui/email-input";
import { submitEmail, submitMobile } from "@/lib/contactForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Customer360Overview } from "@/features/customers/components/Customer360Overview";
import { BillingSummaryPanel } from "@/features/customers/components/BillingSummaryPanel";
import { CustomerReferralPanel } from "@/features/customers/components/CustomerReferralPanel";
import { CustomerPersonaBadges } from "@/features/customers/components/CustomerPersonaBadges";
import { ArchiveCustomerButton } from "@/features/customers/components/ArchiveCustomerButton";
import { fetchCustomerServicesHub } from "@/features/customers/api";
import {
  apiToFounderStatus,
  founderToApiStatus,
  FOUNDER_STATUS_LABELS,
  type FounderCustomerStatus,
} from "@/lib/customerStatus";

type EditForm = {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  status: FounderCustomerStatus;
  branchId: string;
  gstin: string;
  billingName: string;
};

type CustomerTier3Fields = {
  gstin?: string | null;
  billingName?: string | null;
};

export type CustomerDetailPortalConfig = {
  Layout: ComponentType<{ children: ReactNode }>;
  basePath: string;
  routePattern: string;
};

export default function CustomerDetailPage({ Layout, basePath, routePattern }: CustomerDetailPortalConfig) {
  const [, params] = useRoute(routePattern);
  const id = parseInt(String((params as Record<string, string | undefined>)?.id ?? "0"), 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", phone: "", email: "", city: "", address: "", status: "active", branchId: "", gstin: "", billingName: "",
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [editErrors, setEditErrors] = useState<{ phone?: string | null; email?: string | null }>({});

  const { data: customer, isLoading } = useGetCustomer(id, {
    query: { queryKey: getGetCustomerQueryKey(id), enabled: id > 0 },
  });
  const { data: branches } = useListBranches({ query: { queryKey: getListBranchesQueryKey() } });

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    const legacyToOverview = new Set(["services", "wallet", "assets", "locations", "support", "active-services"]);
    if (tab === "active-services" || (tab && legacyToOverview.has(tab))) {
      setActiveTab("overview");
    } else if (tab === "profile" || tab === "communications" || tab === "bills" || tab === "billing") {
      setActiveTab(tab === "billing" ? "bills" : tab);
    } else if (tab) {
      setActiveTab("overview");
    }
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.pathname + url.search);
  };

  useEffect(() => {
    if (!customer) return;
    const tier3 = customer as typeof customer & CustomerTier3Fields;
    setEditForm({
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      city: customer.city ?? "",
      address: customer.address ?? "",
      status: apiToFounderStatus(customer.status ?? "active"),
      branchId: customer.branchId ? String(customer.branchId) : "",
      gstin: tier3.gstin ?? "",
      billingName: tier3.billingName ?? "",
    });
  }, [customer]);

  const { data: servicesHub } = useQuery({
    queryKey: ["customer", id, "services-hub"],
    queryFn: () => fetchCustomerServicesHub(id),
    enabled: id > 0,
    staleTime: 60_000,
  });

  const updateCustomerMutation = useUpdateCustomer({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setEditing(false);
        toast({ title: "Customer updated" });
      },
      onError: (err: any) => {
        const data = err?.response?.data;
        if (data?.error) {
          toast({
            title: "Contact already in use",
            description: data.error,
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Update failed", description: data?.error ?? err.message, variant: "destructive" });
      },
    },
  });

  const handleSaveProfile = () => {
    const phoneResult = submitMobile(editForm.phone);
    const emailResult = submitEmail(editForm.email);
    setEditErrors({
      phone: phoneResult.ok ? null : phoneResult.error,
      email: emailResult.ok ? null : emailResult.error,
    });
    if (!phoneResult.ok || !emailResult.ok) {
      toast({ title: "Please fix phone or email format", variant: "destructive" });
      return;
    }
    updateCustomerMutation.mutate({
      id,
      data: {
        name: editForm.name,
        phone: phoneResult.value,
        email: emailResult.value,
        city: editForm.city || undefined,
        address: editForm.address || undefined,
        status: founderToApiStatus(editForm.status),
        branchId: editForm.branchId ? parseInt(editForm.branchId, 10) : undefined,
        gstin: editForm.gstin.trim() || null,
        billingName: editForm.billingName.trim() || null,
      } as any,
    });
  };

  if (!id) return null;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl">
        <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft size={14} /> Back to customer profiles
        </Link>

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : customer ? (
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <Can
                resource="customers"
                action="edit"
                fallback={
                  <CustomerPhotoEditor
                    customerId={id}
                    name={customer.name}
                    photoUrl={customer.photoUrl}
                    editable={false}
                    size="lg"
                    testIdPrefix="admin-customer-photo"
                  />
                }
              >
                <CustomerPhotoEditor
                  customerId={id}
                  name={customer.name}
                  photoUrl={customer.photoUrl}
                  size="lg"
                  onUpdated={() => {
                    qc.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
                    qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
                  }}
                  testIdPrefix="admin-customer-photo"
                />
              </Can>
              <div>
                <h1 className="font-display font-bold text-2xl">{customer.name}</h1>
                <p className="text-muted-foreground text-sm">{customer.phone} · {customer.city ?? "—"}</p>
                <CustomerPersonaBadges profile={servicesHub?.profile} className="mt-2" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {basePath.startsWith("/admin") && (
                <Link href={`/admin/book-services?customerId=${id}`}>
                  <Button className="bg-primary text-secondary hover:bg-primary/90" data-testid="customer-profile-primary-cta">
                    Book Service
                  </Button>
                </Link>
              )}
              <Can resource="customers" action="edit">
                <Button variant="outline" size="sm" onClick={() => { setEditing(v => !v); if (!editing) setActiveTab("profile"); }} data-testid="btn-edit-customer">
                  <Pencil size={14} className="mr-1.5" />{editing ? "Cancel" : "Edit profile"}
                </Button>
              </Can>
              <Can resource="customers" action="edit">
                <ArchiveCustomerButton
                  customerId={id}
                  customerName={customer.name}
                  status={customer.status ?? "active"}
                />
              </Can>
            </div>
          </div>
        ) : null}

        {customer && (
          <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="customer-profile-tabs">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="overview" data-testid="tab-overview"><LayoutDashboard size={14} className="mr-1.5" />Overview</TabsTrigger>
              <TabsTrigger value="profile" data-testid="tab-profile"><User size={14} className="mr-1.5" />Profile</TabsTrigger>
              <TabsTrigger value="bills" data-testid="tab-bills"><FileText size={14} className="mr-1.5" />Bills</TabsTrigger>
              <TabsTrigger value="communications" data-testid="tab-communications"><MessageSquare size={14} className="mr-1.5" />Communications</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Customer360Overview
                customerId={id}
                basePath={basePath}
                customer={customer as typeof customer & CustomerTier3Fields}
              />
            </TabsContent>

            <TabsContent value="profile" className="mt-4 space-y-4">
              {editing ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User size={16} className="text-primary" /> Edit customer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="edit-name">Full name</Label>
                      <Input id="edit-name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="mt-1" data-testid="input-edit-customer-name" />
                    </div>
                    <PhoneInput
                      id="edit-phone"
                      label="Phone"
                      value={editForm.phone}
                      onChange={v => setEditForm(f => ({ ...f, phone: v }))}
                      error={editErrors.phone}
                      onErrorChange={err => setEditErrors(e => ({ ...e, phone: err }))}
                    />
                    <EmailInput
                      id="edit-email"
                      label="Email"
                      optional
                      value={editForm.email}
                      onChange={v => setEditForm(f => ({ ...f, email: v }))}
                      error={editErrors.email}
                      onErrorChange={err => setEditErrors(e => ({ ...e, email: err }))}
                    />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="edit-city">City</Label>
                        <Input id="edit-city" value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} className="mt-1" />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v as FounderCustomerStatus }))}>
                          <SelectTrigger className="mt-1" data-testid="select-edit-customer-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">{FOUNDER_STATUS_LABELS.active}</SelectItem>
                            <SelectItem value="inactive">{FOUNDER_STATUS_LABELS.inactive}</SelectItem>
                            <SelectItem value="archived">{FOUNDER_STATUS_LABELS.archived}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="edit-address">Address</Label>
                      <Input id="edit-address" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label>Branch</Label>
                      <Select value={editForm.branchId || "none"} onValueChange={v => setEditForm(f => ({ ...f, branchId: v === "none" ? "" : v }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Branch" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No branch</SelectItem>
                          {(branches ?? []).map(b => (
                            <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                      <div>
                        <Label htmlFor="edit-billing-name">Billing name (B2B)</Label>
                        <Input id="edit-billing-name" value={editForm.billingName} onChange={e => setEditForm(f => ({ ...f, billingName: e.target.value }))} className="mt-1" placeholder="Legal entity on invoice" data-testid="input-edit-billing-name" />
                      </div>
                      <div>
                        <Label htmlFor="edit-gstin">GSTIN</Label>
                        <Input id="edit-gstin" value={editForm.gstin} onChange={e => setEditForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))} className="mt-1 font-mono text-sm" placeholder="09ABCDE1234F1Z5" maxLength={15} data-testid="input-edit-gstin" />
                      </div>
                    </div>
                    <Button
                      onClick={handleSaveProfile}
                      disabled={updateCustomerMutation.isPending}
                      className="bg-primary text-secondary hover:bg-primary/90"
                      data-testid="btn-save-customer-profile"
                    >
                      {updateCustomerMutation.isPending ? "Saving..." : "Save changes"}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-sm space-y-2">
                    <p><span className="text-muted-foreground">Email:</span> {customer.email ?? "—"}</p>
                    <p><span className="text-muted-foreground">Address:</span> {customer.address ?? "—"}</p>
                    <p><span className="text-muted-foreground">City:</span> {customer.city ?? "—"}</p>
                    <p><span className="text-muted-foreground">Branch:</span> {(customer as { branchName?: string }).branchName ?? "—"}</p>
                    <p><span className="text-muted-foreground">Status:</span> {FOUNDER_STATUS_LABELS[apiToFounderStatus(customer.status ?? "active")]}</p>
                    {(customer as typeof customer & CustomerTier3Fields).billingName && (
                      <p><span className="text-muted-foreground">Billing name:</span> {(customer as typeof customer & CustomerTier3Fields).billingName}</p>
                    )}
                    {(customer as typeof customer & CustomerTier3Fields).gstin && (
                      <p><span className="text-muted-foreground">GSTIN:</span> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{(customer as typeof customer & CustomerTier3Fields).gstin}</code></p>
                    )}
                  </CardContent>
                </Card>
              )}
              <CustomerReferralPanel customerId={id} basePath={basePath} />
            </TabsContent>

            <TabsContent value="bills" className="mt-4">
              <BillingSummaryPanel customerId={id} />
            </TabsContent>

            <TabsContent value="communications" className="mt-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Communication preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <CommunicationPreferences customerId={id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Communication timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <CommunicationTimeline customerId={id} />
          </CardContent>
        </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
