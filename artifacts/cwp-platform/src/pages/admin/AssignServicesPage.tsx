import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, MapPin, UserCheck } from "lucide-react";
import {
  ASSIGNMENTS_QUERY_KEY,
  assignPendingService,
  fetchAssignedServices,
  fetchPendingAssignments,
  fetchStaffForAssignment,
  formatServiceType,
  SERVICE_TYPE_OPTIONS,
  type AssignmentFilters,
  type PendingAssignment,
} from "@/features/assign-services/api";
import { formatAssignmentLocation } from "@/features/assign-services/formatLocation";
import { listServiceLocations } from "@/features/service-locations/api";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function PriorityBadge({ priority }: { priority: PendingAssignment["priority"] }) {
  if (priority === "high") {
    return <Badge variant="destructive">High</Badge>;
  }
  return <Badge variant="secondary">Normal</Badge>;
}

export default function AssignServicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "assigned">("pending");
  const [selectedPendingId, setSelectedPendingId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState("");
  const [filters, setFilters] = useState<AssignmentFilters>({});

  const activeFilters = useMemo(() => {
    const f: AssignmentFilters = {};
    if (filters.serviceType) f.serviceType = filters.serviceType;
    if (filters.serviceLocationId) f.serviceLocationId = filters.serviceLocationId;
    if (filters.staffId) f.staffId = filters.staffId;
    if (filters.dateFrom) f.dateFrom = filters.dateFrom;
    if (filters.dateTo) f.dateTo = filters.dateTo;
    return f;
  }, [filters]);

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, "pending", activeFilters],
    queryFn: () => fetchPendingAssignments(activeFilters),
  });

  const { data: assigned = [], isLoading: assignedLoading } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, "assigned", activeFilters],
    queryFn: () => fetchAssignedServices(activeFilters),
    enabled: tab === "assigned",
  });

  const { data: staffList = [], isLoading: staffLoading } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, "staff"],
    queryFn: fetchStaffForAssignment,
  });

  const { data: locationsResponse } = useQuery({
    queryKey: ["service-locations", "assign-filter"],
    queryFn: () => listServiceLocations({ limit: 100 }),
  });
  const locations = locationsResponse?.data ?? [];

  const selectedPending = pending.find(p => p.id === selectedPendingId) ?? null;

  const assignMutation = useMutation({
    mutationFn: () => {
      if (!selectedPendingId || !staffId) throw new Error("Select a pending item and staff member");
      return assignPendingService(selectedPendingId, parseInt(staffId, 10));
    },
    onSuccess: () => {
      toast({ title: "Service assigned" });
      setSelectedPendingId(null);
      setStaffId("");
      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY });
    },
    onError: (e: Error) => {
      toast({ title: "Assignment failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <PageActionHeader
          title="Assign Service"
          description="Assign staff to booked jobs that still need a team member."
          primaryAction={{
            label: pending.length > 0 ? "Assign selected job" : "View jobs needing staff",
            onClick: () => {
              if (pending.length > 0 && !selectedPendingId) {
                setSelectedPendingId(pending[0]!.id);
                setTab("pending");
              }
            },
            testId: "assign-service-primary-cta",
          }}
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Filter by service type, service address, staff, or date.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label>Service type</Label>
              <Select
                value={filters.serviceType ?? "all"}
                onValueChange={v => setFilters(f => ({ ...f, serviceType: v === "all" ? undefined : v }))}
              >
                <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPE_OPTIONS.map(o => (
                    <SelectItem key={o.value || "all"} value={o.value || "all"}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Service address</Label>
              <Select
                value={filters.serviceLocationId ? String(filters.serviceLocationId) : "all"}
                onValueChange={v => setFilters(f => ({
                  ...f,
                  serviceLocationId: v === "all" ? undefined : parseInt(v, 10),
                }))}
              >
                <SelectTrigger><SelectValue placeholder="All addresses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All service addresses</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={String(loc.id)}>{loc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Staff</Label>
              <Select
                value={filters.staffId ? String(filters.staffId) : "all"}
                onValueChange={v => setFilters(f => ({
                  ...f,
                  staffId: v === "all" ? undefined : parseInt(v, 10),
                }))}
              >
                <SelectTrigger><SelectValue placeholder="All staff" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  {staffList.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date from</Label>
              <Input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Date to</Label>
              <Input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || undefined }))}
              />
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={v => setTab(v as "pending" | "assigned")}>
          <TabsList>
            <TabsTrigger value="pending">Needs staff ({pending.length})</TabsTrigger>
            <TabsTrigger value="assigned">Staff assigned</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Jobs needing staff</CardTitle>
                  <CardDescription>Booked work waiting for a staff member to be assigned.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {pendingLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : pending.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No jobs waiting for staff.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-2">ID</th>
                          <th className="py-2 pr-2">Service</th>
                          <th className="py-2 pr-2">Customer</th>
                          <th className="py-2 pr-2">Service address</th>
                          <th className="py-2 pr-2">Vehicle</th>
                          <th className="py-2 pr-2">Created</th>
                          <th className="py-2">Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pending.map(row => (
                          <tr
                            key={row.id}
                            className={`border-b cursor-pointer hover:bg-muted/50 ${selectedPendingId === row.id ? "bg-muted" : ""}`}
                            onClick={() => setSelectedPendingId(row.id)}
                          >
                            <td className="py-2 pr-2 font-mono text-xs">#{row.id}</td>
                            <td className="py-2 pr-2">
                              <div className="font-medium">{row.serviceName}</div>
                              <div className="text-xs text-muted-foreground">{formatServiceType(row.serviceType)}</div>
                            </td>
                            <td className="py-2 pr-2">{row.customerName}</td>
                            <td className="py-2 pr-2 text-sm">
                              {row.serviceLocationLabel
                                ? formatAssignmentLocation(row)
                                : <span className="text-destructive text-xs">Missing</span>}
                            </td>
                            <td className="py-2 pr-2">{row.assetLabel ?? "—"}</td>
                            <td className="py-2 pr-2 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                            <td className="py-2"><PriorityBadge priority={row.priority} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Assignment Panel
                  </CardTitle>
                  <CardDescription>Select staff and assign the highlighted job.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedPending ? (
                    <p className="text-sm text-muted-foreground">Select a job from the list.</p>
                  ) : (
                    <>
                      <div className="rounded-md border p-3 space-y-2 text-sm">
                        <div><span className="text-muted-foreground">Job #</span> {selectedPending.id}</div>
                        <div><span className="text-muted-foreground">Service:</span> {selectedPending.serviceName}</div>
                        <div><span className="text-muted-foreground">Customer:</span> {selectedPending.customerName}</div>
                        <div className="flex items-start gap-1">
                          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <span>{selectedPending.serviceLocationLabel
                            ? formatAssignmentLocation(selectedPending)
                            : "No service address — cannot assign"}</span>
                        </div>
                        {selectedPending.assetLabel && (
                          <div><span className="text-muted-foreground">Vehicle:</span> {selectedPending.assetLabel}</div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Staff</Label>
                        <Select value={staffId} onValueChange={setStaffId} disabled={staffLoading || !selectedPending.serviceLocationId}>
                          <SelectTrigger>
                            <SelectValue placeholder={staffLoading ? "Loading…" : "Select staff"} />
                          </SelectTrigger>
                          <SelectContent>
                            {staffList.map(s => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.name}{s.employeeCode ? ` · ${s.employeeCode}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        className="w-full"
                        disabled={!staffId || !selectedPending.serviceLocationId || assignMutation.isPending}
                        onClick={() => assignMutation.mutate()}
                      >
                        {assignMutation.isPending ? "Assigning…" : "Assign"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="assigned" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Assigned Services</CardTitle>
                <CardDescription>Read-only history of manual assignments.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {assignedLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : assigned.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No assigned services yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-2">ID</th>
                        <th className="py-2 pr-2">Staff</th>
                        <th className="py-2 pr-2">Assigned</th>
                        <th className="py-2 pr-2">Service</th>
                        <th className="py-2">Service address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assigned.map(row => (
                        <tr key={row.id} className="border-b">
                          <td className="py-2 pr-2 font-mono text-xs">#{row.id}</td>
                          <td className="py-2 pr-2">{row.staffName}</td>
                          <td className="py-2 pr-2 whitespace-nowrap">{formatDate(row.assignedAt)}</td>
                          <td className="py-2 pr-2">
                            <div className="font-medium">{row.serviceName}</div>
                            <div className="text-xs text-muted-foreground">{row.customerName}</div>
                          </td>
                          <td className="py-2 text-sm">{row.serviceLocationLabel ? formatAssignmentLocation(row) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
