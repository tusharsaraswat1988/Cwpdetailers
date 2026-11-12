import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Layers,
  Shield,
  Car,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Calendar,
  Trash2,
  Camera,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useSocieties,
  useSociety,
  useCreateSociety,
  useCreateSocietyTower,
  useSocietyDailyOperations,
  useOperationalExceptions,
  useResolveOperationalException,
  useMediaRetentionPolicy,
  useRunMediaPurge,
  type OperationalExceptionRow,
} from "@/features/societies/api";
import { useMasterList, type City } from "@/features/master-data/api";

export default function SocietiesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("operations");
  const [selectedCityId, setSelectedCityId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeSocietyId, setActiveSocietyId] = useState<number | null>(null);

  // Resolution Dialog State
  const [resolvingException, setResolvingException] = useState<OperationalExceptionRow | null>(null);
  const [resolutionAction, setResolutionAction] = useState<"grant_makeup_credit" | "reassign_staff" | "schedule_reclean" | "dismiss">("grant_makeup_credit");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [newStaffId, setNewStaffId] = useState("");

  // Media Purge State
  const [purgeDays, setPurgeDays] = useState("30");
  const [lastPurgeResult, setLastPurgeResult] = useState<any>(null);

  // Queries
  const cityIdNum = selectedCityId !== "all" ? parseInt(selectedCityId, 10) : undefined;
  const citiesQuery = useMasterList<City>("cities");
  const societiesQuery = useSocieties({
    cityId: cityIdNum,
    search: search.trim() || undefined,
  });

  const activeSocietyQuery = useSociety(activeSocietyId);
  const createSocietyMutation = useCreateSociety();
  const createTowerMutation = useCreateSocietyTower();

  const operationsQuery = useSocietyDailyOperations({ cityId: cityIdNum });
  const exceptionsQuery = useOperationalExceptions({ cityId: cityIdNum });
  const resolveMutation = useResolveOperationalException();
  const retentionPolicyQuery = useMediaRetentionPolicy();
  const purgeMutation = useRunMediaPurge();

  // Create Society Form State
  const [newCityId, setNewCityId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPincode, setNewPincode] = useState("");
  const [newGateNotes, setNewGateNotes] = useState("");
  const [initialTowers, setInitialTowers] = useState("");

  // Add Tower Form State
  const [towerName, setTowerName] = useState("");
  const [towerFloors, setTowerFloors] = useState("");
  const [towerFlats, setTowerFlats] = useState("");
  const [parkingLevels, setParkingLevels] = useState("B1, B2");

  const handleCreateSociety = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityId || !newName.trim() || !newAddress.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please fill in City, Society Name, and Address.",
        variant: "destructive",
      });
      return;
    }

    try {
      const towersArray = initialTowers
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);

      await createSocietyMutation.mutateAsync({
        cityId: parseInt(newCityId, 10),
        name: newName.trim(),
        code: newCode.trim() || undefined,
        address: newAddress.trim(),
        pincode: newPincode.trim() || undefined,
        gateSecurityNotes: newGateNotes.trim() || undefined,
        initialTowers: towersArray.length > 0 ? towersArray : undefined,
      });

      toast({
        title: "Society created successfully",
        description: `${newName.trim()} has been registered with ${towersArray.length} towers.`,
      });

      setCreateDialogOpen(false);
      setNewCityId("");
      setNewName("");
      setNewCode("");
      setNewAddress("");
      setNewPincode("");
      setNewGateNotes("");
      setInitialTowers("");
    } catch (err) {
      toast({
        title: "Failed to create society",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleAddTower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSocietyId || !towerName.trim()) {
      toast({
        title: "Tower name required",
        variant: "destructive",
      });
      return;
    }

    try {
      await createTowerMutation.mutateAsync({
        societyId: activeSocietyId,
        body: {
          name: towerName.trim(),
          totalFloors: towerFloors ? parseInt(towerFloors, 10) : undefined,
          totalFlats: towerFlats ? parseInt(towerFlats, 10) : undefined,
          parkingLevels: parkingLevels.trim() || undefined,
        },
      });

      toast({
        title: "Tower added",
        description: `${towerName.trim()} has been added to the society.`,
      });

      setTowerName("");
      setTowerFloors("");
      setTowerFlats("");
      setParkingLevels("B1, B2");
    } catch (err) {
      toast({
        title: "Failed to add tower",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleResolveException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingException) return;
    if (!resolutionNotes.trim()) {
      toast({
        title: "Resolution notes required",
        description: "Please provide rationale for this resolution action.",
        variant: "destructive",
      });
      return;
    }

    try {
      await resolveMutation.mutateAsync({
        exceptionId: resolvingException.id,
        action: resolutionAction,
        resolutionNotes: resolutionNotes.trim(),
        newStaffId: newStaffId ? parseInt(newStaffId, 10) : undefined,
      });

      toast({
        title: "Exception resolved",
        description: `Action ${resolutionAction} completed successfully.`,
      });

      setResolvingException(null);
      setResolutionNotes("");
      setNewStaffId("");
    } catch (err) {
      toast({
        title: "Failed to resolve exception",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleRunPurge = async (dryRun: boolean) => {
    try {
      const res = await purgeMutation.mutateAsync({
        days: parseInt(purgeDays, 10) || 30,
        dryRun,
      });
      setLastPurgeResult(res);
      toast({
        title: dryRun ? "Dry Run Complete" : "Purge Complete",
        description: dryRun
          ? `Found ${res.eligibleCount} visit photos eligible for routine purging.`
          : `Successfully purged ${res.purgedCount} expired photo records.`,
      });
    } catch (err) {
      toast({
        title: "Purge execution failed",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const opsSummary = operationsQuery.data?.summary;

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">
                Society Operations & Hierarchy
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Multi-city residential society towers, daily cleaning operational progress, exceptions triage, and media privacy lifecycle.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedCityId} onValueChange={setSelectedCityId}>
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {citiesQuery.data?.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="shrink-0 flex items-center gap-2"
              data-testid="btn-add-society"
            >
              <Plus className="h-4 w-4" />
              <span>Add Society</span>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="operations" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>Daily Hub</span>
            </TabsTrigger>
            <TabsTrigger value="exceptions" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>Exceptions</span>
              {(opsSummary?.totalOpenExceptions ?? 0) > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                  {opsSummary?.totalOpenExceptions}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="directory" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span>Societies & Towers</span>
            </TabsTrigger>
            <TabsTrigger value="retention" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              <span>Media Privacy</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: DAILY OPERATIONS HUB */}
          <TabsContent value="operations" className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-xl border bg-card shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">Active Societies</span>
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {opsSummary?.totalSocieties ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground">communities</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-card shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">Active Vehicles</span>
                  <Car className="h-4 w-4 text-blue-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {opsSummary?.totalActiveSubscriptions ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground">subscribed</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-card shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">Today Completed</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-600">
                    {opsSummary?.totalCompletedToday ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {opsSummary?.overallCompletionPercentage ?? 0}%
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-card shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">Pending Today</span>
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-amber-600">
                    {opsSummary?.totalPendingToday ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground">remaining</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-card shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">CNA / Exceptions</span>
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-rose-600">
                    {opsSummary?.totalCarNotAvailableToday ?? 0} CNA
                  </span>
                  {(opsSummary?.totalOpenExceptions ?? 0) > 0 && (
                    <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                      {opsSummary?.totalOpenExceptions} open
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Society Operational Progress Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <span>Society Cleaning Runs Today</span>
                  <Badge variant="outline" className="text-xs">
                    {operationsQuery.data?.date}
                  </Badge>
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => operationsQuery.refetch()}
                  className="h-8 gap-1"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${operationsQuery.isFetching ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </Button>
              </div>

              {operationsQuery.isLoading ? (
                <div className="p-12 text-center text-muted-foreground">Loading operations progress...</div>
              ) : operationsQuery.data?.societies.length === 0 ? (
                <div className="p-12 text-center border rounded-xl bg-card text-muted-foreground">
                  No active residential societies configured for this selection.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {operationsQuery.data?.societies.map(soc => (
                    <div
                      key={soc.societyId}
                      className="p-5 rounded-xl border bg-card shadow-xs hover:border-primary/40 transition-colors space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground text-base">{soc.societyName}</h4>
                            <Badge variant="secondary" className="text-xs">{soc.cityName}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {soc.totalTowers} Towers • {soc.activeSubscriptionsCount} Active Subscriptions
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-foreground">
                            {soc.completionPercentage}%
                          </span>
                          <p className="text-xs text-muted-foreground">completion</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${soc.completionPercentage}%` }}
                        />
                      </div>

                      {/* Counters */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs py-1 border-y">
                        <div>
                          <p className="text-muted-foreground">Completed</p>
                          <p className="font-bold text-emerald-600 mt-0.5">{soc.completedTodayCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pending</p>
                          <p className="font-bold text-amber-600 mt-0.5">{soc.pendingTodayCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">CNA / Bay Empty</p>
                          <p className="font-bold text-rose-600 mt-0.5">{soc.carNotAvailableTodayCount}</p>
                        </div>
                      </div>

                      {/* Cleaner Breakdown */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                          <span>Assigned Staff</span>
                          {soc.openExceptionsCount > 0 && (
                            <span className="text-rose-600 font-semibold">
                              {soc.openExceptionsCount} open exception(s)
                            </span>
                          )}
                        </p>
                        {soc.assignedStaff.length === 0 ? (
                          <p className="text-xs text-amber-600 italic">No cleaners currently assigned to this society.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {soc.assignedStaff.map(st => (
                              <div
                                key={st.staffId}
                                className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted text-xs text-foreground"
                              >
                                <UserCheck className="h-3 w-3 text-primary" />
                                <span>{st.staffName}:</span>
                                <span className="font-semibold text-emerald-600">{st.completedCount}</span>
                                <span className="text-muted-foreground">/ {st.assignedCount}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: OPERATIONAL EXCEPTIONS */}
          <TabsContent value="exceptions" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Operational Exceptions & Triage</h3>
                <p className="text-xs text-muted-foreground">
                  Review Car Not Available (CNA) reports, basement GPS fallbacks, missed cleanings, and customer complaints with one-click resolution.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exceptionsQuery.refetch()}
                className="gap-1 h-8"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${exceptionsQuery.isFetching ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
            </div>

            {exceptionsQuery.isLoading ? (
              <div className="p-12 text-center text-muted-foreground">Loading operational exceptions...</div>
            ) : exceptionsQuery.data?.data.length === 0 ? (
              <div className="p-12 text-center border rounded-xl bg-card text-muted-foreground space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="font-semibold text-foreground">Zero Open Exceptions</p>
                <p className="text-xs">All society cleanings and parking verifications are running smoothly.</p>
              </div>
            ) : (
              <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase font-medium text-muted-foreground border-b">
                      <tr>
                        <th className="p-3">Type</th>
                        <th className="p-3">Society & City</th>
                        <th className="p-3">Customer & Vehicle</th>
                        <th className="p-3">Reported Details</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {exceptionsQuery.data?.data.map(exc => (
                        <tr key={exc.id} className="hover:bg-muted/30">
                          <td className="p-3">
                            <Badge
                              variant={
                                exc.exceptionType === "basement_gps_audit"
                                  ? "outline"
                                  : exc.exceptionType === "car_not_available"
                                  ? "secondary"
                                  : "destructive"
                              }
                              className="font-mono text-xs"
                            >
                              {exc.exceptionType.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <p className="font-semibold text-foreground text-xs">{exc.societyName || "Open Street"}</p>
                            <p className="text-xs text-muted-foreground">{exc.cityName}</p>
                          </td>
                          <td className="p-3">
                            <p className="font-semibold text-foreground text-xs">{exc.vehicleNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {exc.customerName} {exc.parkingBay ? `• Bay: ${exc.parkingBay}` : ""}
                            </p>
                          </td>
                          <td className="p-3 max-w-xs">
                            <p className="text-xs text-foreground font-medium truncate">{exc.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              By {exc.staffName || "Staff"} • {new Date(exc.reportedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {exc.evidencePhotoUrl && (
                              <a
                                href={exc.evidencePhotoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                              >
                                <Camera className="h-3 w-3" />
                                <span>View Photo Evidence</span>
                              </a>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                exc.status === "open"
                                  ? "destructive"
                                  : exc.status === "resolved"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {exc.status}
                            </Badge>
                            {exc.resolutionAction && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {exc.resolutionAction.replace(/_/g, " ")}
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {exc.status === "open" && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  setResolvingException(exc);
                                  setResolutionAction("grant_makeup_credit");
                                  setResolutionNotes("");
                                }}
                              >
                                Resolve
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: SOCIETIES & TOWERS DIRECTORY */}
          <TabsContent value="directory" className="space-y-6">
            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card p-3 rounded-xl border shadow-xs">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by society name, sector, address..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </div>

            {/* Societies Grid */}
            {societiesQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-44 rounded-xl border bg-muted/20 animate-pulse" />
                ))}
              </div>
            ) : societiesQuery.data?.data.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-card">
                <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold text-lg text-foreground">No societies found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  No residential societies match the selected city or search criteria.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {societiesQuery.data?.data.map(society => (
                  <div
                    key={society.id}
                    className="p-5 rounded-xl border bg-card hover:border-primary/50 transition-colors shadow-xs flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-base text-foreground tracking-tight">
                            {society.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{society.cityName || "City"} • {society.address}</span>
                          </div>
                        </div>
                        <Badge variant={society.isActive ? "secondary" : "outline"} className="shrink-0 text-xs">
                          {society.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 py-2 border-y text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-primary" />
                          <span>{society.totalTowers} Towers</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Car className="h-3.5 w-3.5 text-primary" />
                          <span>Basement Bays</span>
                        </div>
                      </div>

                      {society.gateSecurityNotes && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 p-2 rounded-md">
                          <Shield className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{society.gateSecurityNotes}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setActiveSocietyId(society.id)}
                      >
                        Manage Towers & Parking
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 4: MEDIA RETENTION & PRIVACY */}
          <TabsContent value="retention" className="space-y-6">
            <div className="p-6 rounded-xl border bg-card shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-rose-500" />
                    <span>Cleaning Media Retention & Privacy Policy</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                    Automated privacy enforcement to prevent unbounded image payload storage and maintain compliance with privacy best practices.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {retentionPolicyQuery.data?.routineRetentionDays ?? 30} Days Retention
                </Badge>
              </div>

              <div className="p-4 rounded-lg bg-muted/40 text-xs text-muted-foreground border leading-relaxed">
                <span className="font-semibold text-foreground block mb-1">Customer & Operational Disclosure:</span>
                {retentionPolicyQuery.data?.notice}
              </div>

              {/* Run Purge Tool */}
              <div className="pt-4 border-t space-y-4">
                <h4 className="font-semibold text-sm text-foreground">Execute Routine Photo Purge</h4>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label htmlFor="purgeDays" className="text-xs shrink-0">Retention Threshold (Days):</Label>
                    <Input
                      id="purgeDays"
                      type="number"
                      value={purgeDays}
                      onChange={e => setPurgeDays(e.target.value)}
                      className="w-24 h-9"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunPurge(true)}
                      disabled={purgeMutation.isPending}
                      className="h-9"
                    >
                      Preview Eligible Records (Dry Run)
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRunPurge(false)}
                      disabled={purgeMutation.isPending}
                      className="h-9"
                    >
                      {purgeMutation.isPending ? "Purging..." : "Execute Purge Now"}
                    </Button>
                  </div>
                </div>

                {lastPurgeResult && (
                  <div className="p-4 rounded-lg border bg-muted/20 text-xs space-y-1">
                    <p className="font-semibold text-foreground">
                      {lastPurgeResult.dryRun ? "Dry Run Results:" : "Purge Execution Results:"}
                    </p>
                    <p className="text-muted-foreground">
                      Cutoff Date: {new Date(lastPurgeResult.cutoffDate).toLocaleDateString()}
                    </p>
                    <p className="text-muted-foreground">
                      Eligible Records: {lastPurgeResult.eligibleCount} visit photos
                    </p>
                    {!lastPurgeResult.dryRun && (
                      <p className="font-semibold text-emerald-600">
                        Successfully Purged: {lastPurgeResult.purgedCount} visit photos (records and OCR preserved)
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Resolve Exception Modal */}
        <Dialog open={Boolean(resolvingException)} onOpenChange={open => !open && setResolvingException(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span>Resolve Operational Exception</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                {resolvingException?.exceptionType.replace(/_/g, " ")} • {resolvingException?.vehicleNumber} ({resolvingException?.societyName})
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleResolveException} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Resolution Action</Label>
                <Select value={resolutionAction} onValueChange={(val: any) => setResolutionAction(val)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grant_makeup_credit">
                      Grant +1 Make-Up Cleaning Credit to Subscription
                    </SelectItem>
                    <SelectItem value="schedule_reclean">
                      Schedule Priority Re-Cleaning
                    </SelectItem>
                    <SelectItem value="reassign_staff">
                      Reassign Route to Another Cleaner
                    </SelectItem>
                    <SelectItem value="dismiss">
                      Dismiss Exception (Invalid / False Alarm)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {resolutionAction === "reassign_staff" && (
                <div className="space-y-1.5">
                  <Label htmlFor="newStaffId" className="text-xs">New Cleaner Staff ID</Label>
                  <Input
                    id="newStaffId"
                    value={newStaffId}
                    onChange={e => setNewStaffId(e.target.value)}
                    placeholder="Enter staff ID to reassign"
                    className="h-9"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="resNotes" className="text-xs">Resolution Rationale / Notes</Label>
                <Textarea
                  id="resNotes"
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  placeholder="Explain why this action was chosen..."
                  className="h-20 text-xs"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResolvingException(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={resolveMutation.isPending}
                >
                  {resolveMutation.isPending ? "Resolving..." : "Submit Resolution"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create Society Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Register Residential Society</DialogTitle>
              <DialogDescription>
                Add a new residential apartment complex or society in Noida or another target city.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateSociety} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="citySelect" className="text-xs">City *</Label>
                  <Select value={newCityId} onValueChange={setNewCityId}>
                    <SelectTrigger id="citySelect" className="h-9">
                      <SelectValue placeholder="Select City" />
                    </SelectTrigger>
                    <SelectContent>
                      {citiesQuery.data?.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="societyCode" className="text-xs">Society Code</Label>
                  <Input
                    id="societyCode"
                    placeholder="e.g. GC-16 or ATS-ADV"
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="societyName" className="text-xs">Society Name *</Label>
                <Input
                  id="societyName"
                  placeholder="e.g. Gaur City 2 - 16th Avenue"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="societyAddress" className="text-xs">Address / Sector *</Label>
                  <Input
                    id="societyAddress"
                    placeholder="e.g. Sector 16C, Greater Noida West"
                    value={newAddress}
                    onChange={e => setNewAddress(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="societyPincode" className="text-xs">Pincode</Label>
                  <Input
                    id="societyPincode"
                    placeholder="201301"
                    value={newPincode}
                    onChange={e => setNewPincode(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="initialTowers" className="text-xs">
                  Initial Towers (Comma separated)
                </Label>
                <Input
                  id="initialTowers"
                  placeholder="Tower A, Tower B, Tower C, Tower D"
                  value={initialTowers}
                  onChange={e => setInitialTowers(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gateNotes" className="text-xs">Gate & Security Access Instructions</Label>
                <Textarea
                  id="gateNotes"
                  placeholder="Entry via Gate 2 only. Staff RFID tags issued at clubhouse..."
                  value={newGateNotes}
                  onChange={e => setNewGateNotes(e.target.value)}
                  className="h-20 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={createSocietyMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createSocietyMutation.isPending}>
                  {createSocietyMutation.isPending ? "Registering..." : "Register Society"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Towers Management Sheet */}
        <Sheet open={Boolean(activeSocietyId)} onOpenChange={open => !open && setActiveSocietyId(null)}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{activeSocietyQuery.data?.name || "Society Towers"}</SheetTitle>
              <SheetDescription>
                {activeSocietyQuery.data?.address} • {activeSocietyQuery.data?.cityName}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Add Tower Form */}
              <div className="p-4 rounded-xl border bg-card space-y-3">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  <span>Add Tower to Society</span>
                </h4>
                <form onSubmit={handleAddTower} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="towerNameInput" className="text-xs">Tower Name *</Label>
                    <Input
                      id="towerNameInput"
                      placeholder="e.g. Tower 14 or Tower B"
                      value={towerName}
                      onChange={e => setTowerName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="towerFloorsInput" className="text-xs">Total Floors</Label>
                      <Input
                        id="towerFloorsInput"
                        type="number"
                        placeholder="e.g. 24"
                        value={towerFloors}
                        onChange={e => setTowerFloors(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="towerFlatsInput" className="text-xs">Total Flats</Label>
                      <Input
                        id="towerFlatsInput"
                        type="number"
                        placeholder="e.g. 96"
                        value={towerFlats}
                        onChange={e => setTowerFlats(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="parkingLevelsInput" className="text-xs">Parking Levels</Label>
                    <Input
                      id="parkingLevelsInput"
                      placeholder="e.g. B1, B2, Stilt"
                      value={parkingLevels}
                      onChange={e => setParkingLevels(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    className="w-full"
                    disabled={createTowerMutation.isPending}
                  >
                    {createTowerMutation.isPending ? "Adding Tower..." : "Add Tower"}
                  </Button>
                </form>
              </div>

              {/* Existing Towers List */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground flex items-center justify-between">
                  <span>Registered Towers</span>
                  <Badge variant="outline">
                    {activeSocietyQuery.data?.towers?.length ?? 0} Towers
                  </Badge>
                </h4>

                {activeSocietyQuery.data?.towers?.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No towers added yet. Use the form above to add towers.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeSocietyQuery.data?.towers?.map(tower => (
                      <div
                        key={tower.id}
                        className="p-3 rounded-lg border bg-card flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-sm text-foreground">
                            {tower.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tower.totalFloors ? `${tower.totalFloors} floors • ` : ""}
                            {tower.totalFlats ? `${tower.totalFlats} flats • ` : ""}
                            Parking: {tower.parkingLevels || "Standard"}
                          </p>
                        </div>
                        <Badge variant={tower.isActive ? "secondary" : "outline"} className="text-xs">
                          {tower.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
}
