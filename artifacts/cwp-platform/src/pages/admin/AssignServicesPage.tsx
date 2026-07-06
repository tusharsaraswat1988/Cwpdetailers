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

import {

  Dialog,

  DialogContent,

  DialogDescription,

  DialogFooter,

  DialogHeader,

  DialogTitle,

} from "@/components/ui/dialog";

import { Textarea } from "@/components/ui/textarea";

import { useToast } from "@/hooks/use-toast";

import { MapPin, UserCheck, UserPlus } from "lucide-react";

import {

  ASSIGNMENTS_QUERY_KEY,

  assignPendingServiceTasks,

  fetchAssignedServices,

  fetchPendingAssignments,

  fetchStaffForAssignment,

  formatServiceType,

  recordSubstituteExecution,

  SERVICE_TYPE_OPTIONS,

  type AssignmentFilters,

  type PendingAssignment,

  type AssignedService,

  type ServiceTaskType,

} from "@/features/assign-services/api";

import { formatAssignmentLocation } from "@/features/assign-services/formatLocation";

import { listServiceLocations } from "@/features/service-locations/api";

import { roleSlugForTaskType, taskTypeLabel } from "@/lib/staff-ecosystem/taskTypes";

import { roleLabelForSlug } from "@/lib/staff-ecosystem/roles";



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



function TaskStaffPicker({

  taskType,

  value,

  onChange,

  disabled,

  assignedName,

}: {

  taskType: ServiceTaskType;

  value: string;

  onChange: (v: string) => void;

  disabled?: boolean;

  assignedName?: string;

}) {

  const roleSlug = roleSlugForTaskType(taskType);

  const { data: staffList = [], isLoading } = useQuery({

    queryKey: [...ASSIGNMENTS_QUERY_KEY, "staff", taskType, roleSlug],

    queryFn: () => fetchStaffForAssignment(roleSlug),

    enabled: !assignedName,

  });



  if (assignedName) {

    return (

      <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">

        <span className="text-muted-foreground">{taskTypeLabel(taskType)}:</span>{" "}

        <span className="font-medium">{assignedName}</span>

        <Badge variant="outline" className="ml-2 text-xs">Assigned</Badge>

      </div>

    );

  }



  return (

    <div className="space-y-1">

      <Label>{taskTypeLabel(taskType)}</Label>

      <p className="text-xs text-muted-foreground">

        Role: {roleLabelForSlug(roleSlug)}

      </p>

      <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>

        <SelectTrigger>

          <SelectValue placeholder={isLoading ? "Loading…" : staffList.length === 0 ? "No matching staff" : "Select staff"} />

        </SelectTrigger>

        <SelectContent>

          {staffList.map(s => (

            <SelectItem key={s.id} value={String(s.id)}>

              {s.name}

              {s.employeeCode ? ` · ${s.employeeCode}` : ""}

              {s.operationalRoles?.length

                ? ` (${s.operationalRoles.map(r => r.roleName).join(", ")})`

                : ""}

            </SelectItem>

          ))}

        </SelectContent>

      </Select>

      {!isLoading && staffList.length === 0 && (

        <p className="text-xs text-amber-600">

          No staff with {roleLabelForSlug(roleSlug)} role. Add it on the staff profile.

        </p>

      )}

    </div>

  );

}



export default function AssignServicesPage() {

  const { toast } = useToast();

  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"pending" | "assigned">("pending");

  const [selectedPendingId, setSelectedPendingId] = useState<number | null>(null);

  const [taskStaff, setTaskStaff] = useState<Partial<Record<ServiceTaskType, string>>>({});

  const [filters, setFilters] = useState<AssignmentFilters>({});

  const [substituteOpen, setSubstituteOpen] = useState(false);

  const [substituteRow, setSubstituteRow] = useState<AssignedService | null>(null);

  const [substituteStaffId, setSubstituteStaffId] = useState("");

  const [substituteReason, setSubstituteReason] = useState("");



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



  const selectedPending = pending.find(p => p.id === selectedPendingId) ?? null;



  const unassignedTasks = useMemo(() => {

    if (!selectedPending) return [];

    return selectedPending.requiredTasks.filter(t => !t.staffId);

  }, [selectedPending]);



  const canAssign = useMemo(() => {

    if (!selectedPending?.serviceLocationId || unassignedTasks.length === 0) return false;

    return unassignedTasks.every(t => Boolean(taskStaff[t.taskType]?.trim()));

  }, [selectedPending, unassignedTasks, taskStaff]);



  const { data: filterStaffList = [] } = useQuery({
    queryKey: [...ASSIGNMENTS_QUERY_KEY, "staff", "filter"],
    queryFn: () => fetchStaffForAssignment(),
  });

  const { data: locationsResponse } = useQuery({

    queryKey: ["service-locations", "assign-filter"],

    queryFn: () => listServiceLocations({ limit: 100 }),

  });

  const locations = locationsResponse?.data ?? [];



  const assignMutation = useMutation({

    mutationFn: () => {

      if (!selectedPendingId || !selectedPending) throw new Error("Select a pending item");

      const tasks = unassignedTasks.map(t => ({

        taskType: t.taskType,

        staffId: parseInt(taskStaff[t.taskType]!, 10),

      }));

      return assignPendingServiceTasks(selectedPendingId, tasks);

    },

    onSuccess: () => {

      toast({ title: "Service assigned" });

      setSelectedPendingId(null);

      setTaskStaff({});

      setTab("assigned");

      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY });

    },

    onError: (e: Error) => {

      toast({ title: "Assignment failed", description: e.message, variant: "destructive" });

    },

  });



  const substituteRoleSlug = substituteRow ? roleSlugForTaskType(substituteRow.taskType) : null;

  const { data: substituteStaffList = [] } = useQuery({

    queryKey: [...ASSIGNMENTS_QUERY_KEY, "substitute-staff", substituteRoleSlug],

    queryFn: () => fetchStaffForAssignment(substituteRoleSlug!),

    enabled: substituteOpen && Boolean(substituteRoleSlug),

  });



  const substituteMutation = useMutation({

    mutationFn: () => {

      if (!substituteRow) throw new Error("No assignment selected");

      return recordSubstituteExecution({

        contractId: substituteRow.contractId,

        taskType: substituteRow.taskType,

        substituteStaffId: parseInt(substituteStaffId, 10),

        reason: substituteReason.trim() || undefined,

      });

    },

    onSuccess: () => {

      toast({ title: "Substitute job created for today" });

      setSubstituteOpen(false);

      setSubstituteRow(null);

      setSubstituteStaffId("");

      setSubstituteReason("");

      queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY });

    },

    onError: (e: Error) => {

      toast({ title: "Substitute failed", description: e.message, variant: "destructive" });

    },

  });



  return (

    <AdminLayout>

      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">

        <PageActionHeader

          title="Assign Service"

          description="Assign staff by task — daily clean and wash can go to different people. Use substitute when regular staff is absent."

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
                  {filterStaffList.map(s => (
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

                  <CardDescription>

                    Split packages show both Daily Clean and Full Wash when washes are included.

                  </CardDescription>

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

                          <th className="py-2 pr-2">Tasks needed</th>

                          <th className="py-2 pr-2">Customer</th>

                          <th className="py-2 pr-2">Service address</th>

                          <th className="py-2 pr-2">Vehicle</th>

                          <th className="py-2">Priority</th>

                        </tr>

                      </thead>

                      <tbody>

                        {pending.map(row => {

                          const missing = row.requiredTasks.filter(t => !t.staffId);

                          return (

                            <tr

                              key={row.id}

                              className={`border-b cursor-pointer hover:bg-muted/50 ${selectedPendingId === row.id ? "bg-muted" : ""}`}

                              onClick={() => { setSelectedPendingId(row.id); setTaskStaff({}); }}

                            >

                              <td className="py-2 pr-2 font-mono text-xs">#{row.id}</td>

                              <td className="py-2 pr-2">

                                <div className="font-medium">{row.serviceName}</div>

                                <div className="text-xs text-muted-foreground">{formatServiceType(row.serviceType)}</div>

                              </td>

                              <td className="py-2 pr-2">

                                <div className="flex flex-wrap gap-1">

                                  {missing.map(t => (

                                    <Badge key={t.taskType} variant="outline" className="text-xs">

                                      {t.taskTypeLabel}

                                    </Badge>

                                  ))}

                                </div>

                              </td>

                              <td className="py-2 pr-2">{row.customerName}</td>

                              <td className="py-2 pr-2 text-sm">

                                {row.serviceLocationLabel

                                  ? formatAssignmentLocation(row)

                                  : <span className="text-destructive text-xs">Missing</span>}

                              </td>

                              <td className="py-2 pr-2">{row.assetLabel ?? "—"}</td>

                              <td className="py-2"><PriorityBadge priority={row.priority} /></td>

                            </tr>

                          );

                        })}

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

                  <CardDescription>Assign each task to the right staff member.</CardDescription>

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



                      <div className="space-y-3">

                        {selectedPending.requiredTasks.map(slot => (

                          <TaskStaffPicker

                            key={slot.taskType}

                            taskType={slot.taskType}

                            value={taskStaff[slot.taskType] ?? ""}

                            onChange={v => setTaskStaff(prev => ({ ...prev, [slot.taskType]: v }))}

                            disabled={!selectedPending.serviceLocationId}

                            assignedName={slot.staffName}

                          />

                        ))}

                      </div>



                      <Button

                        className="w-full"

                        disabled={!canAssign || assignMutation.isPending}

                        onClick={() => assignMutation.mutate()}

                      >

                        {assignMutation.isPending

                          ? "Assigning…"

                          : unassignedTasks.length > 1

                            ? `Assign ${unassignedTasks.length} tasks`

                            : "Assign"}

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

                <CardDescription>

                  Use Substitute when the regular staff member is absent today.

                </CardDescription>

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

                        <th className="py-2 pr-2">Task</th>

                        <th className="py-2 pr-2">Staff</th>

                        <th className="py-2 pr-2">Assigned</th>

                        <th className="py-2 pr-2">Service</th>

                        <th className="py-2 pr-2">Actions</th>

                      </tr>

                    </thead>

                    <tbody>

                      {assigned.map(row => (

                        <tr key={row.id} className="border-b">

                          <td className="py-2 pr-2 font-mono text-xs">#{row.id}</td>

                          <td className="py-2 pr-2">

                            <Badge variant="secondary">{row.taskTypeLabel}</Badge>

                          </td>

                          <td className="py-2 pr-2">{row.staffName}</td>

                          <td className="py-2 pr-2 whitespace-nowrap">{formatDate(row.assignedAt)}</td>

                          <td className="py-2 pr-2">

                            <div className="font-medium">{row.serviceName}</div>

                            <div className="text-xs text-muted-foreground">{row.customerName}</div>

                          </td>

                          <td className="py-2 pr-2">

                            <Button

                              size="sm"

                              variant="outline"

                              className="gap-1"

                              onClick={() => {

                                setSubstituteRow(row);

                                setSubstituteStaffId("");

                                setSubstituteReason("");

                                setSubstituteOpen(true);

                              }}

                            >

                              <UserPlus className="h-3.5 w-3.5" />

                              Substitute today

                            </Button>

                          </td>

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



      <Dialog open={substituteOpen} onOpenChange={setSubstituteOpen}>

        <DialogContent>

          <DialogHeader>

            <DialogTitle>Substitute for today</DialogTitle>

            <DialogDescription>

              {substituteRow

                ? `Assign another staff member to cover ${substituteRow.taskTypeLabel} for ${substituteRow.customerName} while ${substituteRow.staffName} is absent.`

                : ""}

            </DialogDescription>

          </DialogHeader>

          <div className="space-y-3 py-2">

            <div className="space-y-1">

              <Label>Substitute staff</Label>

              <Select value={substituteStaffId} onValueChange={setSubstituteStaffId}>

                <SelectTrigger>

                  <SelectValue placeholder="Select substitute" />

                </SelectTrigger>

                <SelectContent>

                  {substituteStaffList

                    .filter(s => s.id !== substituteRow?.assignedStaffId)

                    .map(s => (

                      <SelectItem key={s.id} value={String(s.id)}>

                        {s.name}

                        {s.operationalRoles?.length

                          ? ` (${s.operationalRoles.map(r => r.roleName).join(", ")})`

                          : ""}

                      </SelectItem>

                    ))}

                </SelectContent>

              </Select>

            </div>

            <div className="space-y-1">

              <Label>Reason (optional)</Label>

              <Textarea

                placeholder="e.g. Saif on leave"

                value={substituteReason}

                onChange={e => setSubstituteReason(e.target.value)}

                rows={2}

              />

            </div>

          </div>

          <DialogFooter>

            <Button variant="outline" onClick={() => setSubstituteOpen(false)}>Cancel</Button>

            <Button

              disabled={!substituteStaffId || substituteMutation.isPending}

              onClick={() => substituteMutation.mutate()}

            >

              {substituteMutation.isPending ? "Creating…" : "Create substitute job"}

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>

    </AdminLayout>

  );

}

