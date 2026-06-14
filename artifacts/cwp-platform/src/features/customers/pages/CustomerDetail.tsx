import { useEffect, useState, type ReactNode, type ComponentType } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useGetCustomer,
  getGetCustomerQueryKey,
  getListCustomersQueryKey,
  useListVehicles,
  getListVehiclesQueryKey,
  useUpdateVehicle,
  useUpdateCustomer,
  useCreateVehicle,
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
import { ArrowLeft, IndianRupee, Wallet, Car, Plus, Pencil, User, LayoutDashboard, MessageSquare, LifeBuoy } from "lucide-react";
import { Link } from "wouter";
import CommunicationTimeline from "@/features/communications/components/CommunicationTimeline";
import CommunicationPreferences from "@/features/communications/components/CommunicationPreferences";
import { VehicleReferencePhotoEditor } from "@/components/shared/VehicleReferencePhotoEditor";
import { vehiclePhotosFromRecord } from "@/components/shared/VehicleReferencePhotos";
import { StaffAssignSelect } from "@/components/shared/StaffAssignSelect";
import { VehicleModelSelect } from "@/components/shared/VehicleModelSelect";
import { LocationPicker } from "@/components/shared/LocationPicker";
import type { LocationValue, VehicleModel } from "@/features/master-data/api";
import { CustomerPhotoEditor } from "@/components/shared/CustomerPhotoEditor";
import { roleSlugForVehicleAssignment } from "@/lib/staff-ecosystem/roles";
import { Can } from "@/components/Can";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmailInput } from "@/components/ui/email-input";
import { submitEmail, submitMobile } from "@/lib/contactForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Customer360Overview } from "@/features/customers/components/Customer360Overview";
import { CustomerReferralPanel } from "@/features/customers/components/CustomerReferralPanel";
import { CustomerComplaintsPanel } from "@/features/customers/components/CustomerComplaintsPanel";

type WalletTx = {
  id: number;
  type: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  reference?: string | null;
  paymentMode?: string | null;
  notes?: string | null;
  createdAt: string;
};

type EditForm = {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  status: "active" | "inactive" | "suspended";
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

async function fetchWallet(id: number) {
  const res = await fetch(`/api/customers/${id}/wallet`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load wallet");
  return res.json();
}

async function fetchWalletTransactions(id: number) {
  const res = await fetch(`/api/customers/${id}/wallet/transactions?limit=20`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load transactions");
  return res.json() as Promise<{ data: WalletTx[]; total: number }>;
}

async function creditWallet(id: number, body: { amount: number; paymentMode: string; notes?: string }) {
  const res = await fetch(`/api/customers/${id}/wallet/credit`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Credit failed");
  }
  return res.json();
}

export default function CustomerDetailPage({ Layout, basePath, routePattern }: CustomerDetailPortalConfig) {
  const [, params] = useRoute(routePattern);
  const id = parseInt(String((params as Record<string, string | undefined>)?.id ?? "0"), 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("upi");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", phone: "", email: "", city: "", address: "", status: "active", branchId: "", gstin: "", billingName: "",
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [editErrors, setEditErrors] = useState<{ phone?: string | null; email?: string | null }>({});
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [vehicleForm, setVehicleForm] = useState({ year: "", color: "", registrationNumber: "" });
  const [vehicleLocation, setVehicleLocation] = useState<LocationValue | null>(null);

  const { data: customer, isLoading } = useGetCustomer(id, {
    query: { queryKey: getGetCustomerQueryKey(id), enabled: id > 0 },
  });
  const { data: branches } = useListBranches({ query: { queryKey: getListBranchesQueryKey() } });

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab) setActiveTab(tab);
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
      status: customer.status ?? "active",
      branchId: customer.branchId ? String(customer.branchId) : "",
      gstin: tier3.gstin ?? "",
      billingName: tier3.billingName ?? "",
    });
  }, [customer]);

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet", id],
    queryFn: () => fetchWallet(id),
    enabled: id > 0,
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["wallet-transactions", id],
    queryFn: () => fetchWalletTransactions(id),
    enabled: id > 0,
  });

  const { data: vehicles, isLoading: vehiclesLoading } = useListVehicles(
    { customerId: String(id) } as any,
    { query: { queryKey: getListVehiclesQueryKey({ customerId: String(id) } as any), enabled: id > 0 } },
  );

  const assignStaffMutation = useUpdateVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVehiclesQueryKey({ customerId: String(id) } as any) });
        qc.invalidateQueries({ queryKey: ["daily-ops"] });
        toast({ title: "Staff assignment updated" });
      },
      onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
    },
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
        if (data?.existingCustomerId) {
          toast({
            title: "Phone already in use",
            description: `${data.existingCustomerName ?? "Another customer"} has this number.`,
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Update failed", description: data?.error ?? err.message, variant: "destructive" });
      },
    },
  });

  const createVehicleMutation = useCreateVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVehiclesQueryKey({ customerId: String(id) } as any) });
        setShowAddVehicle(false);
        setSelectedModel(null);
        setVehicleForm({ year: "", color: "", registrationNumber: "" });
        setVehicleLocation(null);
        toast({ title: "Vehicle added" });
      },
      onError: (err: any) => toast({ title: "Failed to add vehicle", description: err?.response?.data?.error, variant: "destructive" }),
    },
  });

  const creditMutation = useMutation({
    mutationFn: () => creditWallet(id, {
      amount: parseFloat(amount),
      paymentMode,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet", id] });
      qc.invalidateQueries({ queryKey: ["wallet-transactions", id] });
      qc.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
      qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      setAmount("");
      setNotes("");
      toast({ title: "Wallet credited successfully" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
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
        status: editForm.status,
        branchId: editForm.branchId ? parseInt(editForm.branchId, 10) : undefined,
        gstin: editForm.gstin.trim() || null,
        billingName: editForm.billingName.trim() || null,
      } as any,
    });
  };

  const handleAddVehicle = () => {
    if (!selectedModel || !vehicleForm.registrationNumber.trim()) {
      toast({ title: "Select model and enter registration number", variant: "destructive" });
      return;
    }
    createVehicleMutation.mutate({
      data: {
        customerId: id,
        vehicleModelId: selectedModel.id,
        make: selectedModel.brandName,
        model: selectedModel.name,
        year: vehicleForm.year ? parseInt(vehicleForm.year, 10) : undefined,
        color: vehicleForm.color || undefined,
        registrationNumber: vehicleForm.registrationNumber.trim().toUpperCase(),
        ...(vehicleLocation ? {
          serviceAddress: vehicleLocation.address,
          serviceLat: vehicleLocation.latitude,
          serviceLng: vehicleLocation.longitude,
          placeId: vehicleLocation.placeId,
          locationLabel: "Default Service Location",
        } : {}),
      } as any,
    });
  };

  if (!id) return null;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl">
        <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft size={14} /> Back to customers
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
                <p className="text-xs text-muted-foreground mt-0.5">Customer 360 hub</p>
              </div>
            </div>
            <Can resource="customers" action="edit">
              <Button variant="outline" size="sm" onClick={() => { setEditing(v => !v); if (!editing) setActiveTab("profile"); }} data-testid="btn-edit-customer">
                <Pencil size={14} className="mr-1.5" />{editing ? "Cancel" : "Edit profile"}
              </Button>
            </Can>
          </div>
        ) : null}

        {customer && (
          <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="customer-360-tabs">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="overview" data-testid="tab-overview"><LayoutDashboard size={14} className="mr-1.5" />Overview</TabsTrigger>
              <TabsTrigger value="profile" data-testid="tab-profile"><User size={14} className="mr-1.5" />Profile</TabsTrigger>
              <TabsTrigger value="wallet" data-testid="tab-wallet"><Wallet size={14} className="mr-1.5" />Wallet</TabsTrigger>
              <TabsTrigger value="vehicles" data-testid="tab-vehicles"><Car size={14} className="mr-1.5" />Vehicles</TabsTrigger>
              <TabsTrigger value="communications" data-testid="tab-communications"><MessageSquare size={14} className="mr-1.5" />Communications</TabsTrigger>
              <TabsTrigger value="support" data-testid="tab-support"><LifeBuoy size={14} className="mr-1.5" />Support</TabsTrigger>
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
                        <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v as EditForm["status"] }))}>
                          <SelectTrigger className="mt-1" data-testid="select-edit-customer-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
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
                    <p><span className="text-muted-foreground">Status:</span> <span className="capitalize">{customer.status}</span></p>
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

            <TabsContent value="wallet" className="mt-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet size={16} className="text-primary" /> Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {walletLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-primary flex items-center gap-1">
                <IndianRupee size={20} />
                {(wallet?.balance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            )}
            {wallet?.isLowBalance && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                Low balance (below {wallet.lowBalanceThresholdDays} days)
              </Badge>
            )}

            <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-border">
              <div>
                <Label htmlFor="credit-amount">Amount (₹)</Label>
                <Input
                  id="credit-amount"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1"
                  data-testid="input-wallet-credit-amount"
                />
              </div>
              <div>
                <Label>Payment mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger className="mt-1" data-testid="select-wallet-payment-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="credit-notes">Remarks</Label>
                <Input
                  id="credit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                  placeholder="Optional"
                  data-testid="input-wallet-credit-notes"
                />
              </div>
            </div>
            <Button
              onClick={() => creditMutation.mutate()}
              disabled={creditMutation.isPending || !amount || parseFloat(amount) <= 0}
              className="bg-primary text-secondary hover:bg-primary/90"
              data-testid="btn-wallet-credit"
            >
              {creditMutation.isPending ? "Adding..." : "Add wallet credit"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Transaction ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (txData?.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {(txData?.data ?? []).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                    data-testid={`wallet-tx-${tx.id}`}
                  >
                    <div>
                      <Badge variant="outline" className={`text-xs capitalize ${tx.type === "credit" ? "text-green-500 border-green-500/30" : "text-red-400 border-red-500/30"}`}>
                        {tx.type}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tx.reference?.replace(/_/g, " ") ?? "—"}
                        {tx.paymentMode ? ` · ${tx.paymentMode}` : ""}
                      </p>
                      {tx.notes && <p className="text-xs text-muted-foreground">{tx.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.type === "credit" ? "text-green-500" : "text-red-400"}`}>
                        {tx.type === "credit" ? "+" : "-"}₹{tx.amount.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bal ₹{tx.balanceAfter.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
            </TabsContent>

            <TabsContent value="vehicles" className="mt-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Car size={16} className="text-primary" /> Vehicles & staff assignment
            </CardTitle>
            <Can resource="customers" action="edit">
              <Button variant="outline" size="sm" onClick={() => setShowAddVehicle(v => !v)} data-testid="btn-toggle-add-vehicle">
                <Plus size={14} className="mr-1" />{showAddVehicle ? "Cancel" : "Add vehicle"}
              </Button>
            </Can>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAddVehicle && (
              <div className="p-4 rounded-lg border border-dashed border-primary/30 space-y-4 bg-primary/5">
                <p className="text-sm font-medium">New vehicle</p>
                <VehicleModelSelect modelId={selectedModel?.id} onSelect={setSelectedModel} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Year</Label>
                    <Input type="number" className="mt-1" value={vehicleForm.year} onChange={e => setVehicleForm(f => ({ ...f, year: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <Input className="mt-1" value={vehicleForm.color} onChange={e => setVehicleForm(f => ({ ...f, color: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Registration number</Label>
                  <Input
                    className="mt-1"
                    value={vehicleForm.registrationNumber}
                    onChange={e => setVehicleForm(f => ({ ...f, registrationNumber: e.target.value.toUpperCase() }))}
                    data-testid="input-admin-vehicle-reg"
                  />
                </div>
                <LocationPicker value={vehicleLocation} onChange={loc => setVehicleLocation(loc)} />
                <Button
                  onClick={handleAddVehicle}
                  disabled={createVehicleMutation.isPending || !selectedModel || !vehicleForm.registrationNumber.trim()}
                  className="bg-primary text-secondary hover:bg-primary/90"
                  data-testid="btn-save-admin-vehicle"
                >
                  {createVehicleMutation.isPending ? "Saving..." : "Save vehicle"}
                </Button>
              </div>
            )}

            {vehiclesLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (vehicles ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No vehicles registered</p>
            ) : (
              <div className="space-y-3">
                {(vehicles ?? []).map((v: any) => (
                  <div key={v.id} className="flex flex-col gap-3 p-3 rounded-lg border border-border" data-testid={`vehicle-staff-${v.id}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{v.registrationNumber}</p>
                        <p className="text-xs text-muted-foreground">{v.make} {v.model} · {v.vehicleType}</p>
                      </div>
                      <StaffAssignSelect
                        roleSlug={roleSlugForVehicleAssignment()}
                        allowUnassigned
                        value={v.assignedStaffId ? String(v.assignedStaffId) : "none"}
                        onValueChange={(val) => {
                          assignStaffMutation.mutate({
                            id: v.id,
                            data: { assignedStaffId: val === "none" ? null : parseInt(val, 10) } as any,
                          });
                        }}
                        className="w-full sm:w-48"
                        data-testid={`select-staff-${v.id}`}
                      />
                    </div>
                    <VehicleReferencePhotoEditor
                      vehicleId={v.id}
                      initialPhotos={vehiclePhotosFromRecord(v)}
                      compact
                      onUpdated={() => qc.invalidateQueries({ queryKey: getListVehiclesQueryKey({ customerId: String(id) } as any) })}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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

            <TabsContent value="support" className="mt-4">
              <CustomerComplaintsPanel customerId={id} complaintsAdminPath="/admin/complaints" />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
