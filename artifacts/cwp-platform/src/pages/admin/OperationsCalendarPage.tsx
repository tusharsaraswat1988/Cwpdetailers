import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAppStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  CalendarDays,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  Umbrella,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Info,
  RefreshCw,
  Building2,
  Users,
} from "lucide-react";
import { useMasterList, type City } from "@/features/master-data/api";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type OperatingHourRow = {
  id?: number;
  scopeType: "global" | "city" | "branch";
  cityId?: number | null;
  branchId?: number | null;
  dayOfWeek: number;
  isWorkingDay: boolean;
  openTime: string;
  closeTime: string;
  slotStepMinutes: number;
  maxConcurrentSlots: number;
};

type ClosureRow = {
  id: number;
  title: string;
  category: string;
  customerReason: string;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  scopeType: string;
  cityId?: number | null;
  branchId?: number | null;
  exemptSegments: string[];
  isActive: boolean;
  createdAt: string;
};

const CATEGORY_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  govt_holiday: { label: "Govt / Declared Holiday", variant: "default", icon: Calendar },
  casual_holiday: { label: "Company / Casual Off", variant: "secondary", icon: CalendarDays },
  natural_calamity: { label: "Weather / Calamity", variant: "destructive", icon: Umbrella },
  staff_absenteeism: { label: "Staff Shortage / Bandh", variant: "destructive", icon: Users },
  operational_issue: { label: "Maintenance / Issue", variant: "outline", icon: AlertTriangle },
  overbooking_freeze: { label: "Overbooking Freeze", variant: "destructive", icon: ShieldAlert },
  other: { label: "Other Closure", variant: "outline", icon: Info },
};

export default function OperationsCalendarPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("hours");

  const activeBranchId = useAppStore((s) => s.activeBranchId);
  const activeCityId = useAppStore((s) => s.activeCityId);

  const [selectedCityId, setSelectedCityId] = useState<string>(activeCityId ? String(activeCityId) : "all");
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranchId ? String(activeBranchId) : "all");

  useEffect(() => {
    if (activeBranchId) setSelectedBranchId(String(activeBranchId));
    if (activeCityId) setSelectedCityId(String(activeCityId));
  }, [activeBranchId, activeCityId]);

  const { data: cities } = useMasterList<City>("cities");

  // ─── Operating Hours Query ─────────────────────────────────────────────────
  const { data: hoursData, isLoading: hoursLoading, refetch: refetchHours } = useQuery({
    queryKey: ["admin", "calendar", "hours", selectedCityId, selectedBranchId],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (selectedCityId !== "all") {
        qs.set("scopeType", "city");
        qs.set("cityId", selectedCityId);
      } else {
        qs.set("scopeType", "global");
      }
      const res = await fetch(`/api/admin/calendar/hours?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch hours");
      const data = await res.json() as { hours: OperatingHourRow[] };
      return data.hours;
    },
  });

  // ─── Closures Query ────────────────────────────────────────────────────────
  const { data: closuresData, isLoading: closuresLoading, refetch: refetchClosures } = useQuery({
    queryKey: ["admin", "calendar", "closures", selectedCityId],
    queryFn: async () => {
      const qs = new URLSearchParams({ includePast: "true" });
      if (selectedCityId !== "all") qs.set("cityId", selectedCityId);
      const res = await fetch(`/api/admin/calendar/closures?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch closures");
      const data = await res.json() as { closures: ClosureRow[] };
      return data.closures;
    },
  });

  // ─── Modal State: Declare Closure ──────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("govt_holiday");
  const [customerReason, setCustomerReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("13:00");
  const [exemptDailyCleaning, setExemptDailyCleaning] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ─── Simulator State ───────────────────────────────────────────────────────
  const [simDate, setSimDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [simDuration, setSimDuration] = useState("45");
  const { data: simData, isLoading: simLoading, refetch: refetchSim } = useQuery({
    queryKey: ["admin", "calendar", "preview", simDate, selectedCityId, simDuration],
    queryFn: async () => {
      const qs = new URLSearchParams({ date: simDate });
      if (selectedCityId !== "all") qs.set("cityId", selectedCityId);
      const res = await fetch(`/api/admin/calendar/preview?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Preview failed");
      return res.json() as Promise<{
        date: string;
        evaluation: {
          isClosed: boolean;
          reason?: string;
          category?: string;
          operatingHours?: OperatingHourRow;
        };
      }>;
    },
    enabled: Boolean(simDate),
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const updateHourMutation = useMutation({
    mutationFn: async (payload: OperatingHourRow) => {
      const res = await fetch("/api/admin/calendar/hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "calendar", "hours"] });
      toast({ title: "Working hours updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not update hours", description: err.message, variant: "destructive" });
    },
  });

  const deleteClosureMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/calendar/closures/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete closure");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "calendar", "closures"] });
      toast({ title: "Operational closure removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not remove closure", description: err.message, variant: "destructive" });
    },
  });

  const handleCreateClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !customerReason || !startDate || !endDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title,
        category,
        customerReason,
        startDate,
        endDate,
        isFullDay,
        startTime: isFullDay ? null : startTime,
        endTime: isFullDay ? null : endTime,
        scopeType: selectedCityId !== "all" ? "city" : "global",
        cityId: selectedCityId !== "all" ? parseInt(selectedCityId, 10) : null,
        exemptSegments: exemptDailyCleaning ? ["daily_cleaning"] : [],
        isActive: true,
      };

      const res = await fetch("/api/admin/calendar/closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error || "Failed to create closure");
      }

      toast({ title: "Holiday / Closure declared successfully" });
      setModalOpen(false);
      setTitle("");
      setCustomerReason("");
      setStartDate("");
      setEndDate("");
      qc.invalidateQueries({ queryKey: ["admin", "calendar", "closures"] });
    } catch (err: unknown) {
      toast({
        title: "Failed to declare closure",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Build full 7 days list from hoursData or default Mon-Sun
  const fullWeekHours: OperatingHourRow[] = DAYS_OF_WEEK.map((_, dayIndex) => {
    const existing = hoursData?.find((h) => h.dayOfWeek === dayIndex);
    if (existing) return existing;
    return {
      scopeType: selectedCityId !== "all" ? "city" : "global",
      cityId: selectedCityId !== "all" ? parseInt(selectedCityId, 10) : null,
      dayOfWeek: dayIndex,
      isWorkingDay: dayIndex !== 0,
      openTime: "08:00",
      closeTime: "18:00",
      slotStepMinutes: 15,
      maxConcurrentSlots: 8,
    };
  });

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground flex items-center gap-2.5">
              <CalendarDays className="h-7 w-7 text-primary" />
              Operations Calendar & Working Hours
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure dynamic operating schedules, weekly offs, gazetted holidays, weather calamity shutdowns, and 15-minute slot capacity.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => setModalOpen(true)}
              className="gap-2 shadow-sm"
            >
              <Plus size={16} />
              Declare Holiday / Closure
            </Button>
          </div>
        </div>

        {/* City Filter Pill Bar */}
        <div className="flex items-center gap-3 bg-card border border-border p-3 rounded-xl shadow-xs">
          <Building2 size={16} className="text-muted-foreground ml-1" />
          <span className="text-xs font-semibold text-slate-700">Territory Scope:</span>
          <Select value={selectedCityId} onValueChange={setSelectedCityId}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="All Cities (Global)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Global (All Cities)</SelectItem>
              {cities?.map((city) => (
                <SelectItem key={city.id} value={String(city.id)}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCityId !== "all" && (
            <Badge variant="secondary" className="text-xs">
              City Override Active
            </Badge>
          )}
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="grid w-full sm:w-auto grid-cols-3 max-w-md h-10">
            <TabsTrigger value="hours" className="gap-2 text-xs">
              <Clock size={14} />
              Working Hours
            </TabsTrigger>
            <TabsTrigger value="closures" className="gap-2 text-xs">
              <Calendar size={14} />
              Holidays & Closures
            </TabsTrigger>
            <TabsTrigger value="simulator" className="gap-2 text-xs">
              <Sparkles size={14} />
              Live Simulator
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: WORKING HOURS */}
          <TabsContent value="hours">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Weekly Operating Schedule</CardTitle>
                <CardDescription className="text-xs">
                  Set opening time, closing time, slot granularity (15m multiples), and maximum concurrent technician slots for each day.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                  {fullWeekHours.map((row) => (
                    <div
                      key={row.dayOfWeek}
                      className="p-4 bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 w-40">
                        <Switch
                          checked={row.isWorkingDay}
                          onCheckedChange={(checked) => {
                            updateHourMutation.mutate({
                              ...row,
                              isWorkingDay: checked,
                            });
                          }}
                        />
                        <div>
                          <p className="font-semibold text-sm text-foreground">{DAYS_OF_WEEK[row.dayOfWeek]}</p>
                          <span className="text-[11px] text-muted-foreground">
                            {row.isWorkingDay ? "Operational" : "Weekly Off"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[11px] text-muted-foreground">Open:</Label>
                          <Input
                            type="time"
                            disabled={!row.isWorkingDay}
                            value={row.openTime}
                            onChange={(e) => (row.openTime = e.target.value)}
                            onBlur={() => updateHourMutation.mutate(row)}
                            className="w-24 h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[11px] text-muted-foreground">Close:</Label>
                          <Input
                            type="time"
                            disabled={!row.isWorkingDay}
                            value={row.closeTime}
                            onChange={(e) => (row.closeTime = e.target.value)}
                            onBlur={() => updateHourMutation.mutate(row)}
                            className="w-24 h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[11px] text-muted-foreground">Slot Cadence:</Label>
                          <Select
                            disabled={!row.isWorkingDay}
                            value={String(row.slotStepMinutes)}
                            onValueChange={(val) => {
                              updateHourMutation.mutate({
                                ...row,
                                slotStepMinutes: parseInt(val, 10),
                              });
                            }}
                          >
                            <SelectTrigger className="w-24 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 mins</SelectItem>
                              <SelectItem value="30">30 mins</SelectItem>
                              <SelectItem value="60">60 mins</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[11px] text-muted-foreground">Max Slots:</Label>
                          <Input
                            type="number"
                            min="1"
                            max="50"
                            disabled={!row.isWorkingDay}
                            value={row.maxConcurrentSlots}
                            onChange={(e) => (row.maxConcurrentSlots = parseInt(e.target.value, 10) || 8)}
                            onBlur={() => updateHourMutation.mutate(row)}
                            className="w-20 h-8 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center justify-end">
                        {row.isWorkingDay ? (
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs">
                            Active ({row.openTime} - {row.closeTime})
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-slate-600 bg-slate-100 text-xs">
                            Closed (Weekly Off)
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: HOLIDAYS & CLOSURES */}
          <TabsContent value="closures">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Active & Upcoming Operational Closures</CardTitle>
                  <CardDescription className="text-xs">
                    Declared holidays, government alerts, natural calamities, or unforeseen staff shortages with customer messaging.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchClosures()} className="gap-1.5 text-xs">
                  <RefreshCw size={13} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {closuresLoading ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">Loading closures...</p>
                ) : !closuresData || closuresData.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl p-8 text-center bg-slate-50/50">
                    <CalendarDays className="h-9 w-9 text-muted-foreground/60 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No Operational Closures Declared</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      All standard days are operating normally. Click "Declare Holiday / Closure" above to add a public holiday or emergency closure.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {closuresData.map((c) => {
                      const meta = CATEGORY_META[c.category] || CATEGORY_META.other;
                      const Icon = meta.icon;
                      const isExempt = Array.isArray(c.exemptSegments) && c.exemptSegments.includes("daily_cleaning");
                      return (
                        <div
                          key={c.id}
                          className="p-4 rounded-xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
                        >
                          <div className="space-y-1.5 max-w-xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={meta.variant} className="gap-1 text-xs">
                                <Icon size={12} />
                                {meta.label}
                              </Badge>
                              <span className="text-xs font-bold text-foreground">{c.title}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {c.scopeType.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-700 font-medium">
                              Customer message: <span className="italic text-slate-900">"{c.customerReason}"</span>
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                              <span>
                                Dates: <strong>{c.startDate}</strong> {c.startDate !== c.endDate && `to ${c.endDate}`}
                              </span>
                              <span>•</span>
                              <span>Timing: {c.isFullDay ? "Full Day" : `${c.startTime} - ${c.endTime}`}</span>
                              {isExempt && (
                                <>
                                  <span>•</span>
                                  <span className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                                    Daily Car Cleaning (DCMS) Exempted
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteClosureMutation.mutate(c.id)}
                              className="text-destructive hover:bg-destructive/10 text-xs h-8 px-2.5"
                            >
                              <Trash2 size={14} className="mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: LIVE SIMULATOR */}
          <TabsContent value="simulator">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Customer Schedule Simulator</CardTitle>
                <CardDescription className="text-xs">
                  Pick any date to test how the Booking Engine evaluates working hours, holidays, and 15-minute slot capacity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Test Date:</Label>
                    <Input
                      type="date"
                      value={simDate}
                      onChange={(e) => setSimDate(e.target.value)}
                      className="w-40 h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Service Duration:</Label>
                    <Select value={simDuration} onValueChange={setSimDuration}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 mins (Quick)</SelectItem>
                        <SelectItem value="45">45 mins (Express Wash)</SelectItem>
                        <SelectItem value="60">60 mins (Standard)</SelectItem>
                        <SelectItem value="90">90 mins (Deep Clean)</SelectItem>
                        <SelectItem value="120">120 mins (Detailing)</SelectItem>
                        <SelectItem value="240">240 mins (Ceramic)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchSim()} className="h-8 text-xs gap-1">
                    <RefreshCw size={13} />
                    Evaluate
                  </Button>
                </div>

                {simLoading ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Evaluating date in engine...</p>
                ) : simData ? (
                  <div className="border border-border rounded-xl p-4 bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">Date Evaluation Result for {simData.date}</span>
                      {simData.evaluation.isClosed ? (
                        <Badge variant="destructive" className="text-xs">
                          CLOSED / BLOCKED
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-600">
                          OPEN / AVAILABLE
                        </Badge>
                      )}
                    </div>

                    {simData.evaluation.isClosed ? (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 font-medium">
                        <p>Customer Message: <strong>"{simData.evaluation.reason}"</strong></p>
                        <p className="text-[11px] text-red-700 mt-1">Category: {simData.evaluation.category}</p>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium space-y-1">
                        <p>Operating Hours: <strong>{simData.evaluation.operatingHours?.openTime} to {simData.evaluation.operatingHours?.closeTime}</strong></p>
                        <p className="text-[11px] text-emerald-700">
                          Slot Cadence: {simData.evaluation.operatingHours?.slotStepMinutes} mins • Max Capacity: {simData.evaluation.operatingHours?.maxConcurrentSlots} concurrent jobs
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DECLARE CLOSURE DIALOG */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Declare Holiday / Closure
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Declare a gazetted holiday, weather emergency, casual off, or staff shortage. Customers will see the clear reason in the booking calendar.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateClosure} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Event Title *</Label>
                <Input
                  required
                  placeholder="e.g. Diwali / Heavy Rain Alert / Annual Company Off"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="govt_holiday">Government / Declared Holiday</SelectItem>
                    <SelectItem value="casual_holiday">Casual / Company Holiday</SelectItem>
                    <SelectItem value="natural_calamity">Weather Alert / Natural Calamity</SelectItem>
                    <SelectItem value="staff_absenteeism">Staff Absenteeism / Bandh</SelectItem>
                    <SelectItem value="operational_issue">Operational / Equipment Maintenance</SelectItem>
                    <SelectItem value="overbooking_freeze">Overbooking Freeze</SelectItem>
                    <SelectItem value="other">Other Reason</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Customer-Facing Message ("Kyun Band Hai") *</Label>
                <Input
                  required
                  placeholder="e.g. Closed: Govt declared holiday (Diwali)"
                  value={customerReason}
                  onChange={(e) => setCustomerReason(e.target.value)}
                  className="text-xs"
                />
                <p className="text-[10px] text-muted-foreground">This message appears directly on disabled date tiles in the customer app.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Date *</Label>
                  <Input
                    required
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End Date *</Label>
                  <Input
                    required
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-slate-50">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">Full Day Closure</Label>
                  <p className="text-[10px] text-muted-foreground">Turn off for partial day time windows</p>
                </div>
                <Switch checked={isFullDay} onCheckedChange={setIsFullDay} />
              </div>

              {!isFullDay && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">From Time</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To Time</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-blue-200 bg-blue-50/70">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold text-blue-900">Exempt Daily Car Cleaning (DCMS)</Label>
                  <p className="text-[10px] text-blue-700">Keep morning apartment parking cleaning running normally</p>
                </div>
                <Switch checked={exemptDailyCleaning} onCheckedChange={setExemptDailyCleaning} />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="text-xs">
                  {submitting ? "Declaring..." : "Declare Closure"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
