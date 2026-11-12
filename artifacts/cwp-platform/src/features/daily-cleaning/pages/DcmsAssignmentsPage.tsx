import { useState, useMemo } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import {
  useDcmsMonthlyAssignments,
  useAssignMonthlyCleaner,
  useDcmsPackageWashes,
  useAssignPackageWash,
  useDcmsStaffOptions,
  type MonthlyCleanerSubscription,
  type DcmsPackageWash,
} from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  UserCheck,
  UserX,
  Calendar,
  Sparkles,
  Droplet,
  Search,
  RefreshCw,
  AlertTriangle,
  Building2,
  Car,
  Phone,
  Clock,
  CheckCircle2,
  Info,
} from "lucide-react";
import { format } from "date-fns";

const REASSIGNMENT_REASONS = [
  { value: "staff_replacement", label: "Staff Replacement (Permanent Change)" },
  { value: "staff_leave", label: "Staff on Leave / Sickness" },
  { value: "route_rebalance", label: "Route Rebalancing / Workload Optimization" },
  { value: "customer_request", label: "Customer Request" },
  { value: "other", label: "Other Operational Reason" },
];

export default function DcmsAssignmentsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"monthly" | "washes">("monthly");
  const [searchTerm, setSearchTerm] = useState("");
  const [monthlyFilter, setMonthlyFilter] = useState<"all" | "unassigned" | "assigned">("all");
  const [washFilter, setWashFilter] = useState<"all" | "remaining" | "scheduled">("all");

  // Queries
  const {
    data: monthlySubs = [],
    isLoading: isMonthlyLoading,
    refetch: refetchMonthly,
  } = useDcmsMonthlyAssignments({
    unassignedOnly: monthlyFilter === "unassigned",
    search: searchTerm,
  });

  const {
    data: packageWashes = [],
    isLoading: isWashesLoading,
    refetch: refetchWashes,
  } = useDcmsPackageWashes({
    hasRemainingWashes: washFilter === "remaining",
    search: searchTerm,
  });

  const { data: staffList = [] } = useDcmsStaffOptions();

  // Mutations
  const assignCleanerMutation = useAssignMonthlyCleaner();
  const assignWashMutation = useAssignPackageWash();

  // Dialog States
  const [cleanerModalSub, setCleanerModalSub] = useState<MonthlyCleanerSubscription | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [reassignReason, setReassignReason] = useState<string>("staff_replacement");
  const [cleanerNotes, setCleanerNotes] = useState<string>("");

  const [washModalSub, setWashModalSub] = useState<DcmsPackageWash | null>(null);
  const [washStaffId, setWashStaffId] = useState<string>("");
  const [washDate, setWashDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [washTime, setWashTime] = useState<string>("");
  const [washNotes, setWashNotes] = useState<string>("");

  // Statistics
  const totalActiveMonthly = monthlySubs.length;
  const assignedMonthlyCount = useMemo(
    () => monthlySubs.filter(s => Boolean(s.assignedCleaner)).length,
    [monthlySubs],
  );
  const unassignedMonthlyCount = totalActiveMonthly - assignedMonthlyCount;

  const totalPackageWashesRemaining = useMemo(
    () => packageWashes.reduce((acc, p) => acc + (p.remainingWashes || 0), 0),
    [packageWashes],
  );
  const scheduledWashesCount = useMemo(
    () => packageWashes.filter(p => Boolean(p.scheduledWash)).length,
    [packageWashes],
  );

  // Handlers
  const handleOpenCleanerModal = (sub: MonthlyCleanerSubscription) => {
    setCleanerModalSub(sub);
    setSelectedStaffId(sub.assignedCleaner?.staffId ? String(sub.assignedCleaner.staffId) : "");
    setReassignReason(sub.assignedCleaner ? "staff_replacement" : "staff_replacement");
    setCleanerNotes("");
  };

  const handleConfirmCleanerAssign = async () => {
    if (!cleanerModalSub || !selectedStaffId) return;
    try {
      await assignCleanerMutation.mutateAsync({
        subscriptionId: cleanerModalSub.subscriptionId,
        staffId: parseInt(selectedStaffId, 10),
        reason: cleanerModalSub.assignedCleaner ? reassignReason : undefined,
        notes: cleanerNotes.trim() || undefined,
      });
      toast({
        title: cleanerModalSub.assignedCleaner ? "Cleaner Reassigned" : "Cleaner Assigned",
        description: `Assigned for the full service month. The cleaner will see this car on their daily route.`,
      });
      setCleanerModalSub(null);
      void refetchMonthly();
    } catch (err) {
      toast({
        title: "Assignment Failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleOpenWashModal = (sub: DcmsPackageWash) => {
    setWashModalSub(sub);
    setWashStaffId(sub.scheduledWash?.staffId ? String(sub.scheduledWash.staffId) : "");
    setWashDate(sub.scheduledWash?.scheduledDate || format(new Date(), "yyyy-MM-dd"));
    setWashTime(sub.scheduledWash?.scheduledTime || "");
    setWashNotes(sub.scheduledWash?.notes || "");
  };

  const handleConfirmWashAssign = async () => {
    if (!washModalSub || !washStaffId || !washDate) return;
    try {
      await assignWashMutation.mutateAsync({
        subscriptionId: washModalSub.subscriptionId,
        staffId: parseInt(washStaffId, 10),
        scheduledDate: washDate,
        scheduledTime: washTime.trim() || undefined,
        notes: washNotes.trim() || undefined,
      });
      toast({
        title: "Wash Scheduled & Assigned",
        description: `Scheduled for ${washDate}. The daily cleaning cleaner route remains untouched.`,
      });
      setWashModalSub(null);
      void refetchWashes();
    } catch (err) {
      toast({
        title: "Wash Scheduling Failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />

        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-primary" />
              Daily Cleaning Assignments
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Assign cleaners for the entire service month, and schedule bundled washes on a daily basis.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchMonthly();
                void refetchWashes();
              }}
              className="text-xs h-9"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Domain Rules Banner */}
        <Card className="bg-primary/5 border-primary/20 shadow-none">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed space-y-1 text-foreground">
              <p className="font-semibold text-primary">
                Operational Rule: Monthly Persistent Route vs. Date-Specific Washes
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Daily Cleaning (Dusting / Wipe):</strong> Assigned once for the <strong>entire service month</strong>. The cleaner automatically receives this vehicle in their daily route every morning. Reassignment is required <em>only</em> if the staff member is replaced, goes on leave, or if routes are reorganized.
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Included Package Washes (1–2x/month):</strong> Assigned on a <strong>daily / date-specific basis</strong> to specialized wash technicians (car washers). Scheduling a wash does not alter or disrupt the vehicle's assigned daily cleaner.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Active Subscriptions</p>
              <p className="text-2xl font-bold mt-1">{totalActiveMonthly}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Under Daily Car Cleaning</p>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Monthly Cleaners Assigned</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {assignedMonthlyCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {totalActiveMonthly > 0 ? Math.round((assignedMonthlyCount / totalActiveMonthly) * 100) : 0}% Route Coverage
              </p>
            </CardContent>
          </Card>

          <Card className={unassignedMonthlyCount > 0 ? "border-amber-400 bg-amber-50/20 shadow-none" : "shadow-none"}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                {unassignedMonthlyCount > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
                Pending Route Assignment
              </p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {unassignedMonthlyCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Needs Monthly Cleaner</p>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Package Washes Remaining</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {totalPackageWashesRemaining}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Eligible for scheduling</p>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-foreground">Washes Scheduled</p>
              <p className="text-2xl font-bold mt-1">{scheduledWashesCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Date-specific bookings</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Monthly Cleaner vs. Package Washes */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "monthly" | "washes")} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <TabsList>
              <TabsTrigger value="monthly" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Monthly Cleaner Routes
                <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0 h-4">
                  {totalActiveMonthly}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="washes" className="flex items-center gap-2">
                <Droplet className="h-4 w-4" />
                Package Washes (Daily)
                <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0 h-4">
                  {packageWashes.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vehicle, customer, society..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 w-60 text-xs"
                />
              </div>

              {activeTab === "monthly" ? (
                <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md text-xs">
                  <Button
                    variant={monthlyFilter === "all" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setMonthlyFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={monthlyFilter === "unassigned" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setMonthlyFilter("unassigned")}
                  >
                    Needs Cleaner ({unassignedMonthlyCount})
                  </Button>
                  <Button
                    variant={monthlyFilter === "assigned" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setMonthlyFilter("assigned")}
                  >
                    Assigned ({assignedMonthlyCount})
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md text-xs">
                  <Button
                    variant={washFilter === "all" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setWashFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={washFilter === "remaining" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setWashFilter("remaining")}
                  >
                    Washes Left
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* TAB 1: MONTHLY CLEANER ASSIGNMENTS */}
          <TabsContent value="monthly" className="space-y-4">
            {isMonthlyLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Loading monthly cleaner assignments...
              </div>
            ) : monthlySubs.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-card text-muted-foreground text-sm">
                No subscriptions found matching the filter.
              </div>
            ) : (
              <div className="rounded-md border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
                      <tr>
                        <th className="p-3">Customer & Contact</th>
                        <th className="p-3">Vehicle</th>
                        <th className="p-3">Society & Location</th>
                        <th className="p-3">Plan & Month Validity</th>
                        <th className="p-3">Monthly Assigned Cleaner</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {monthlySubs.map(row => {
                        const isAssigned = Boolean(row.assignedCleaner);
                        return (
                          <tr key={row.subscriptionId} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3">
                              <p className="font-semibold text-foreground">{row.customerName}</p>
                              {row.customerPhone && (
                                <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Phone className="h-3 w-3" /> {row.customerPhone}
                                </p>
                              )}
                              <span className="text-[10px] text-muted-foreground">ID: #{row.customerId}</span>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="font-mono text-xs font-semibold">
                                {row.vehicleNumber}
                              </Badge>
                              <p className="text-muted-foreground mt-1">
                                {row.vehicleMake} {row.vehicleModel}
                                {row.vehicleColor && ` · ${row.vehicleColor}`}
                              </p>
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-foreground flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                {row.societyName || "Standalone Location"}
                              </p>
                              <p className="text-muted-foreground mt-0.5">
                                {[row.towerName, row.parkingLevel, row.parkingBay].filter(Boolean).join(" · ") || "Parking details pending"}
                              </p>
                            </td>
                            <td className="p-3">
                              <p className="font-semibold">{row.planName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-emerald-600 font-medium">
                                  {row.remainingCleanings} of {row.allocatedCleanings} cleans left
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Started: {row.startDate}
                              </p>
                            </td>
                            <td className="p-3">
                              {isAssigned && row.assignedCleaner ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="font-semibold text-foreground">
                                      {row.assignedCleaner.staffName}
                                    </span>
                                  </div>
                                  {row.assignedCleaner.staffPhone && (
                                    <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
                                      <Phone className="h-2.5 w-2.5" /> {row.assignedCleaner.staffPhone}
                                    </p>
                                  )}
                                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 mt-1">
                                    Active for Full Month
                                  </Badge>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <Badge variant="destructive" className="flex items-center gap-1 w-fit text-[11px]">
                                    <UserX className="h-3 w-3" /> Unassigned
                                  </Badge>
                                  <p className="text-[10px] text-muted-foreground">Not in any cleaner's daily route</p>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {isAssigned ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => handleOpenCleanerModal(row)}
                                >
                                  Reassign Cleaner
                                </Button>
                              ) : (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-8 text-xs bg-primary text-primary-foreground"
                                  onClick={() => handleOpenCleanerModal(row)}
                                >
                                  Assign Cleaner
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: PACKAGE WASHES (DAILY ASSIGNMENT) */}
          <TabsContent value="washes" className="space-y-4">
            {isWashesLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Loading package washes...
              </div>
            ) : packageWashes.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-card text-muted-foreground text-sm">
                No package wash subscriptions found.
              </div>
            ) : (
              <div className="rounded-md border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
                      <tr>
                        <th className="p-3">Customer & Vehicle</th>
                        <th className="p-3">Society & Location</th>
                        <th className="p-3">Wash Entitlement</th>
                        <th className="p-3">Last Completed Wash</th>
                        <th className="p-3">Scheduled Wash (Date-Specific)</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {packageWashes.map(row => {
                        const hasRemaining = row.remainingWashes > 0;
                        const isScheduled = Boolean(row.scheduledWash);
                        return (
                          <tr key={row.subscriptionId} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3">
                              <p className="font-semibold text-foreground">{row.customerName}</p>
                              <Badge variant="outline" className="font-mono text-xs font-semibold mt-0.5">
                                {row.vehicleNumber}
                              </Badge>
                              <p className="text-muted-foreground text-[11px] mt-0.5">
                                {row.vehicleMake} {row.vehicleModel}
                              </p>
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-foreground">{row.societyName || "Standalone"}</p>
                              <p className="text-muted-foreground text-[11px] mt-0.5">
                                {[row.towerName, row.parkingLevel, row.parkingBay].filter(Boolean).join(" · ") || "Parking details pending"}
                              </p>
                            </td>
                            <td className="p-3">
                              <p className="font-semibold text-foreground">{row.planName}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Badge
                                  variant={hasRemaining ? "default" : "secondary"}
                                  className={hasRemaining ? "bg-blue-600 text-white text-[11px]" : "text-[11px]"}
                                >
                                  {row.remainingWashes} of {row.allocatedWashes} Washes Left
                                </Badge>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Used: {row.usedWashes} wash{row.usedWashes !== 1 ? "es" : ""}
                              </p>
                            </td>
                            <td className="p-3">
                              {row.lastWashDate ? (
                                <div className="space-y-0.5">
                                  <p className="font-medium text-foreground">{row.lastWashDate}</p>
                                  <span className="text-[10px] text-emerald-600 font-medium">Completed</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">No washes recorded yet</span>
                              )}
                            </td>
                            <td className="p-3">
                              {isScheduled && row.scheduledWash ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                                    <span>Date: {row.scheduledWash.scheduledDate}</span>
                                    {row.scheduledWash.scheduledTime && (
                                      <span className="text-muted-foreground text-[11px]">({row.scheduledWash.scheduledTime})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <UserCheck className="h-3 w-3 text-muted-foreground" />
                                    <span>Washer: <strong className="text-foreground">{row.scheduledWash.staffName}</strong></span>
                                  </div>
                                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                    Assigned for {row.scheduledWash.scheduledDate}
                                  </Badge>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">Not scheduled for any date</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {hasRemaining ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleOpenWashModal(row)}
                                >
                                  {isScheduled ? "Reschedule Wash" : "Schedule Wash"}
                                </Button>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  Quota Full
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* MODAL 1: ASSIGN / REASSIGN MONTHLY CLEANER */}
        <Dialog open={Boolean(cleanerModalSub)} onOpenChange={open => !open && setCleanerModalSub(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {cleanerModalSub?.assignedCleaner ? "Reassign Monthly Cleaner" : "Assign Monthly Cleaner"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Monthly persistent route assignment for daily car cleaning.
              </DialogDescription>
            </DialogHeader>

            {cleanerModalSub && (
              <div className="space-y-4 py-2 text-xs">
                {/* Vehicle & Customer Summary */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-foreground">
                      {cleanerModalSub.vehicleNumber}
                    </span>
                    <Badge variant="outline">{cleanerModalSub.planName}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Customer: <strong className="text-foreground">{cleanerModalSub.customerName}</strong>
                    {cleanerModalSub.customerPhone && ` (${cleanerModalSub.customerPhone})`}
                  </p>
                  <p className="text-muted-foreground">
                    Location: {[cleanerModalSub.societyName, cleanerModalSub.towerName, cleanerModalSub.parkingBay].filter(Boolean).join(" · ") || "Location pending"}
                  </p>
                  {cleanerModalSub.assignedCleaner && (
                    <p className="text-amber-700 dark:text-amber-400 font-medium pt-1">
                      Current Cleaner: {cleanerModalSub.assignedCleaner.staffName}
                    </p>
                  )}
                </div>

                {/* Cleaner Select */}
                <div className="space-y-1.5">
                  <Label htmlFor="cleanerStaffSelect" className="text-xs font-semibold">
                    Select Daily Cleaner
                  </Label>
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger id="cleanerStaffSelect" className="h-9 text-xs">
                      <SelectValue placeholder="Choose a cleaner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList
                        .filter(s => s.isCleaner)
                        .map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} {s.phone ? `(${s.phone})` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Only staff with the Daily Car Cleaner operational role are shown.
                  </p>
                </div>

                {/* Reassignment Reason */}
                {cleanerModalSub.assignedCleaner && (
                  <div className="space-y-1.5">
                    <Label htmlFor="reassignReasonSelect" className="text-xs font-semibold">
                      Reason for Reassignment
                    </Label>
                    <Select value={reassignReason} onValueChange={setReassignReason}>
                      <SelectTrigger id="reassignReasonSelect" className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REASSIGNMENT_REASONS.map(r => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="cleanerNotesInput" className="text-xs font-semibold">
                    Operational Notes (Optional)
                  </Label>
                  <Textarea
                    id="cleanerNotesInput"
                    placeholder="e.g. Cleaner replaced due to leave, vehicle route sequence changed..."
                    value={cleanerNotes}
                    onChange={e => setCleanerNotes(e.target.value)}
                    className="text-xs"
                    rows={2}
                  />
                </div>

                <div className="rounded border border-primary/20 bg-primary/5 p-2 text-[11px] text-muted-foreground">
                  Once assigned, this car stays in the cleaner's daily route for the <strong>entire service month</strong> without daily dispatching.
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCleanerModalSub(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!selectedStaffId || assignCleanerMutation.isPending}
                onClick={handleConfirmCleanerAssign}
              >
                {assignCleanerMutation.isPending ? "Assigning..." : "Confirm Monthly Assignment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 2: SCHEDULE & ASSIGN PACKAGE WASH */}
        <Dialog open={Boolean(washModalSub)} onOpenChange={open => !open && setWashModalSub(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-600">
                <Droplet className="h-5 w-5" />
                Schedule & Assign Package Wash
              </DialogTitle>
              <DialogDescription className="text-xs">
                Assign a wash technician on a daily / date-specific basis without altering the monthly cleaner.
              </DialogDescription>
            </DialogHeader>

            {washModalSub && (
              <div className="space-y-4 py-2 text-xs">
                {/* Vehicle & Customer Summary */}
                <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-1 border border-blue-200 dark:border-blue-900">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-foreground font-mono">
                      {washModalSub.vehicleNumber}
                    </span>
                    <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">
                      {washModalSub.remainingWashes} of {washModalSub.allocatedWashes} Washes Left
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Customer: <strong className="text-foreground">{washModalSub.customerName}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    Location: {[washModalSub.societyName, washModalSub.towerName, washModalSub.parkingBay].filter(Boolean).join(" · ") || "Location pending"}
                  </p>
                </div>

                {/* Scheduled Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="washDateInput" className="text-xs font-semibold">
                    Scheduled Wash Date
                  </Label>
                  <Input
                    id="washDateInput"
                    type="date"
                    value={washDate}
                    onChange={e => setWashDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Washes are periodic (1–2x/month) and executed on this scheduled date.
                  </p>
                </div>

                {/* Wash Staff Select */}
                <div className="space-y-1.5">
                  <Label htmlFor="washStaffSelect" className="text-xs font-semibold">
                    Select Wash Technician (Car Washer)
                  </Label>
                  <Select value={washStaffId} onValueChange={setWashStaffId}>
                    <SelectTrigger id="washStaffSelect" className="h-9 text-xs">
                      <SelectValue placeholder="Choose wash technician..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList
                        .filter(s => s.isWasher || s.isCleaner)
                        .map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} {s.isWasher ? "(Car Washer)" : "(Cleaner)"} {s.phone ? `· ${s.phone}` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Staff with the Car Washer operational role are prioritized.
                  </p>
                </div>

                {/* Optional Preferred Time */}
                <div className="space-y-1.5">
                  <Label htmlFor="washTimeInput" className="text-xs font-semibold">
                    Preferred Time Slot (Optional)
                  </Label>
                  <Input
                    id="washTimeInput"
                    placeholder="e.g. 10:00 AM - 12:00 PM"
                    value={washTime}
                    onChange={e => setWashTime(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="washNotesInput" className="text-xs font-semibold">
                    Notes for Washer (Optional)
                  </Label>
                  <Textarea
                    id="washNotesInput"
                    placeholder="e.g. Key with security guard, exterior pressure wash required..."
                    value={washNotes}
                    onChange={e => setWashNotes(e.target.value)}
                    className="text-xs"
                    rows={2}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setWashModalSub(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!washStaffId || !washDate || assignWashMutation.isPending}
                onClick={handleConfirmWashAssign}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {assignWashMutation.isPending ? "Scheduling..." : "Schedule & Assign Wash"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
