import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Server,
  Zap,
  Sliders,
  Calendar,
  Eye,
  Trash2,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";

export default function AutomationOpsCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // State
  const [kpis, setKpis] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [totalJobsCount, setTotalJobsCount] = useState(0);
  const [jobTypes, setJobTypes] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Action Modals
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [actionJob, setActionJob] = useState<any>(null);
  const [actionType, setActionType] = useState<"run_now" | "dry_run" | "pause" | "resume" | "retry" | "delete">("run_now");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<any>(null);

  // Create Job Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [newJobType, setNewJobType] = useState("");
  const [newScheduleType, setNewScheduleType] = useState<"recurring_interval" | "recurring_cron" | "one_time">("recurring_cron");
  const [newCronExpr, setNewCronExpr] = useState("0 10 * * *");
  const [newIntervalSeconds, setNewIntervalSeconds] = useState("3600");
  const [newTimezone, setNewTimezone] = useState("Asia/Kolkata");
  const [newPayloadJson, setNewPayloadJson] = useState("{}");
  const [newMaxRetries, setNewMaxRetries] = useState("3");
  const [creating, setCreating] = useState(false);

  // Inspect Execution Modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<any>(null);

  const fetchKPIs = async () => {
    try {
      const res = await fetch("/api/automation/dashboard");
      if (res.ok) {
        const data = await res.json();
        setKpis(data);
      }
    } catch (err) {
      console.error("Failed to fetch KPIs:", err);
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("jobType", typeFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/automation/jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        setTotalJobsCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobTypes = async () => {
    try {
      const res = await fetch("/api/automation/job-types");
      if (res.ok) {
        const data = await res.json();
        setJobTypes(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch job types:", err);
    }
  };

  const fetchWorkers = async () => {
    try {
      const res = await fetch("/api/automation/workers");
      if (res.ok) {
        const data = await res.json();
        setWorkers(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch workers:", err);
    }
  };

  const fetchExecutions = async () => {
    try {
      const res = await fetch("/api/automation/executions?limit=30");
      if (res.ok) {
        const data = await res.json();
        setExecutions(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch executions:", err);
    }
  };

  useEffect(() => {
    fetchKPIs();
    fetchJobTypes();
    fetchJobs();
    fetchWorkers();
    fetchExecutions();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [statusFilter, typeFilter]);

  const handleActionClick = (job: any, type: "run_now" | "dry_run" | "pause" | "resume" | "retry" | "delete") => {
    setActionJob(job);
    setActionType(type);
    setActionResult(null);
    setConfirmModalOpen(true);
  };

  const executeConfirmedAction = async () => {
    if (!actionJob) return;
    setActionLoading(true);
    setActionResult(null);

    try {
      let endpoint = "";
      let method = "POST";

      if (actionType === "run_now") endpoint = `/api/automation/jobs/${actionJob.id}/run-now`;
      else if (actionType === "dry_run") endpoint = `/api/automation/jobs/${actionJob.id}/dry-run`;
      else if (actionType === "pause") endpoint = `/api/automation/jobs/${actionJob.id}/pause`;
      else if (actionType === "resume") endpoint = `/api/automation/jobs/${actionJob.id}/resume`;
      else if (actionType === "retry") endpoint = `/api/automation/jobs/${actionJob.id}/retry`;
      else if (actionType === "delete") {
        endpoint = `/api/automation/jobs/${actionJob.id}`;
        method = "DELETE";
      }

      const res = await fetch(endpoint, { method });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Action failed");
      }

      setActionResult(data);
      toast({
        title: "Action Completed",
        description: actionType === "dry_run" ? "Dry-run simulation completed successfully." : `Successfully triggered ${actionType} on ${actionJob.name}`,
      });

      // Refresh data
      fetchKPIs();
      fetchJobs();
      fetchExecutions();

      if (actionType !== "dry_run") {
        setTimeout(() => setConfirmModalOpen(false), 800);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to execute action",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!newJobName.trim() || !newJobType) {
      toast({ title: "Validation Error", description: "Name and Job Type are required.", variant: "destructive" });
      return;
    }

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(newPayloadJson);
    } catch {
      toast({ title: "Invalid JSON", description: "Payload must be valid JSON.", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/automation/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newJobName.trim(),
          jobType: newJobType,
          scheduleType: newScheduleType,
          cronExpression: newScheduleType === "recurring_cron" ? newCronExpr : undefined,
          intervalSeconds: newScheduleType === "recurring_interval" ? Number(newIntervalSeconds) : undefined,
          timezone: newTimezone,
          payload: parsedPayload,
          maxRetries: Number(newMaxRetries) || 3,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create job");

      toast({ title: "Success", description: "Scheduled job created successfully." });
      setCreateModalOpen(false);
      setNewJobName("");
      fetchJobs();
      fetchKPIs();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive || status === "paused") {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">Paused</Badge>;
    }
    if (status === "active") {
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-medium">Active</Badge>;
    }
    if (status === "failed") {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (status === "completed") {
      return <Badge variant="secondary">Completed</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getLastRunBadge = (lastStatus: string | null) => {
    if (!lastStatus) return <span className="text-muted-foreground text-xs">Never run</span>;
    if (lastStatus === "success") {
      return <span className="inline-flex items-center text-xs text-emerald-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Success</span>;
    }
    if (lastStatus === "running") {
      return <span className="inline-flex items-center text-xs text-blue-600 font-medium animate-pulse"><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Running</span>;
    }
    return <span className="inline-flex items-center text-xs text-red-600 font-medium"><AlertCircle className="w-3.5 h-3.5 mr-1" /> Failed</span>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Activity className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Automation Operations Center
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Configuration-driven background job scheduler, worker heartbeats, retry backoff & reliability telemetry.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchKPIs();
                fetchJobs();
                fetchWorkers();
                fetchExecutions();
                toast({ title: "Refreshed", description: "Telemetry state re-synchronized." });
              }}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setNewJobName("");
                setNewJobType(jobTypes[0]?.type || "retention_automation");
                setCreateModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Scheduled Job
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="bg-card shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-muted-foreground">Total Schedulers</span>
              <p className="text-2xl font-bold mt-1 text-foreground">{kpis?.totalJobs ?? 0}</p>
              <span className="text-xs text-emerald-600 font-medium mt-1 inline-block">
                {kpis?.activeJobs ?? 0} active
              </span>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-muted-foreground">Active Workers</span>
              <p className="text-2xl font-bold mt-1 text-foreground">{kpis?.activeWorkersCount ?? 0}</p>
              <span className="text-xs text-blue-600 font-medium mt-1 inline-flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-ping" />
                Cluster Healthy
              </span>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-muted-foreground">24h Successes</span>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{kpis?.successJobs24h ?? 0}</p>
              <span className="text-xs text-muted-foreground mt-1 inline-block">
                Avg {kpis?.avgExecutionDurationMs ?? 0}ms
              </span>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-muted-foreground">24h Failures</span>
              <p className="text-2xl font-bold mt-1 text-rose-600">{kpis?.failedJobs24h ?? 0}</p>
              <span className="text-xs text-muted-foreground mt-1 inline-block">
                {kpis?.retryQueueCount ?? 0} in retry backoff
              </span>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-muted-foreground">Pending / Overdue</span>
              <p className="text-2xl font-bold mt-1 text-amber-600">{kpis?.overdueJobs ?? 0}</p>
              <span className="text-xs text-muted-foreground mt-1 inline-block">
                Tolerance: 5 min
              </span>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-muted-foreground">Running Now</span>
              <p className="text-2xl font-bold mt-1 text-blue-600">{kpis?.runningJobs ?? 0}</p>
              <span className="text-xs text-muted-foreground mt-1 inline-block">
                Skip-Locked Leased
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full md:w-[600px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="jobs">Job Directory ({totalJobsCount})</TabsTrigger>
            <TabsTrigger value="history">Run Logs</TabsTrigger>
            <TabsTrigger value="workers">Worker Health</TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Critical System Automations</span>
                    <Badge variant="outline" className="text-xs">Autonomously Scheduled</Badge>
                  </CardTitle>
                  <CardDescription>
                    Background jobs driving multi-city retention, points expiry, DCMS missed visits, and push routes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {jobs.slice(0, 5).map((job) => (
                    <div
                      key={job.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border bg-card hover:bg-accent/40 transition-colors gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{job.name}</span>
                          {getStatusBadge(job.status, job.isActive)}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            {job.scheduleType === "recurring_cron" ? `Cron: ${job.cronExpression}` : `Every ${job.intervalSeconds}s`} ({job.timezone})
                          </span>
                          <span>•</span>
                          <span>Next: {job.nextRunAt ? new Date(job.nextRunAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "N/A"}</span>
                          <span>•</span>
                          <span>Last: {getLastRunBadge(job.lastRunStatus)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleActionClick(job, "dry_run")}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Dry Run
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleActionClick(job, "run_now")}
                        >
                          <Play className="w-3.5 h-3.5 mr-1" />
                          Run Now
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setActiveTab("jobs")}
                  >
                    View all {totalJobsCount} scheduled jobs <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>

              {/* Reliability & Cluster Card */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Server className="w-4 h-4 text-primary" />
                      Worker Cluster Reliability
                    </CardTitle>
                    <CardDescription>PostgreSQL FOR UPDATE SKIP LOCKED & Leases</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Concurrency Pool:</span>
                      <span className="font-medium text-foreground">5 concurrent tasks / node</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Lease Duration:</span>
                      <span className="font-medium text-foreground">5 minutes with renew</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Heartbeat Interval:</span>
                      <span className="font-medium text-foreground">15 seconds</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Stale Sweeper:</span>
                      <span className="font-medium text-emerald-600">Active (Auto-recovering)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">Retry Policy:</span>
                      <span className="font-medium text-foreground">Exp backoff with jitter</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Alert Channel:</span>
                      <span className="font-medium text-foreground">In-App Admin Notification</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                      <Zap className="w-4 h-4" />
                      Tenant Boundary Protection
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      All job queries, dispatch routines, and manual executions enforce strict tenant scoping. City and branch administrators can only observe and manage automations authorized for their operational territory.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: JOB DIRECTORY */}
          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader className="p-4 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search jobs by name or key..."
                      className="pl-8 text-xs h-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchJobs()}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[130px] h-9 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[160px] h-9 text-xs">
                        <SelectValue placeholder="Job Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {jobTypes.map((t) => (
                          <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Job Details</th>
                        <th className="py-3 px-3">Schedule & Timezone</th>
                        <th className="py-3 px-3">Scope</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Next Run</th>
                        <th className="py-3 px-3">Last Run Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                            Loading scheduled jobs...
                          </td>
                        </tr>
                      ) : jobs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            No scheduled jobs found matching criteria.
                          </td>
                        </tr>
                      ) : (
                        jobs.map((job) => (
                          <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-foreground text-sm">{job.name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{job.jobKey}</div>
                              {job.description && (
                                <p className="text-[11px] text-muted-foreground/80 line-clamp-1 mt-0.5">{job.description}</p>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-medium text-foreground">
                                {job.scheduleType === "recurring_cron" ? job.cronExpression : `Every ${job.intervalSeconds}s`}
                              </span>
                              <div className="text-[10px] text-muted-foreground">{job.timezone}</div>
                            </td>
                            <td className="py-3 px-3">
                              {job.cityId ? (
                                <Badge variant="outline" className="text-[10px]">City #{job.cityId}</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">Global</Badge>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {getStatusBadge(job.status, job.isActive)}
                            </td>
                            <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                              {job.nextRunAt
                                ? new Date(job.nextRunAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" })
                                : "N/A"}
                            </td>
                            <td className="py-3 px-3">
                              <div>{getLastRunBadge(job.lastRunStatus)}</div>
                              {job.lastRunDurationMs ? (
                                <span className="text-[10px] text-muted-foreground">{job.lastRunDurationMs}ms</span>
                              ) : null}
                              {job.lastError && (
                                <p className="text-[10px] text-red-500 line-clamp-1 max-w-[140px] mt-0.5" title={job.lastError}>
                                  {job.lastError}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => handleActionClick(job, "dry_run")}
                                  title="Run dry-run simulation without persistent changes"
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Dry Run
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => handleActionClick(job, "run_now")}
                                  title="Execute immediately"
                                >
                                  <Play className="w-3 h-3 mr-1" />
                                  Run
                                </Button>
                                {job.isActive ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700"
                                    onClick={() => handleActionClick(job, "pause")}
                                    title="Pause recurring execution"
                                  >
                                    <Pause className="w-3.5 h-3.5" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                                    onClick={() => handleActionClick(job, "resume")}
                                    title="Resume recurring execution"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: RUN LOGS & EXECUTION HISTORY */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recent Execution History</CardTitle>
                  <CardDescription>Immutable execution telemetry with sanitized payload audits</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchExecutions}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Refresh Logs
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Job Key & Type</th>
                        <th className="py-3 px-3">Trigger Mode</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Execution Time</th>
                        <th className="py-3 px-3">Duration</th>
                        <th className="py-3 px-3">Result / Metrics</th>
                        <th className="py-3 px-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {executions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            No execution history logs recorded yet.
                          </td>
                        </tr>
                      ) : (
                        executions.map((log) => (
                          <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-semibold text-foreground">{log.jobKey}</span>
                              <div className="text-[10px] text-muted-foreground font-mono">{log.jobType}</div>
                            </td>
                            <td className="py-3 px-3">
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {log.triggerType}
                              </Badge>
                            </td>
                            <td className="py-3 px-3">
                              {log.status === "success" ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                                  Success
                                </Badge>
                              ) : log.status === "failed" ? (
                                <Badge variant="destructive">Failed</Badge>
                              ) : (
                                <Badge variant="secondary">{log.status}</Badge>
                              )}
                            </td>
                            <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                              {new Date(log.startedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "medium" })}
                            </td>
                            <td className="py-3 px-3 text-foreground font-mono">
                              {log.durationMs != null ? `${log.durationMs}ms` : "-"}
                            </td>
                            <td className="py-3 px-3 text-muted-foreground max-w-[200px]">
                              {log.errorMessage ? (
                                <span className="text-red-500 line-clamp-1">{log.errorMessage}</span>
                              ) : log.resultSummary ? (
                                <span className="line-clamp-1 font-mono text-[10px]">{JSON.stringify(log.resultSummary)}</span>
                              ) : (
                                "OK"
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setSelectedExecution(log);
                                  setInspectModalOpen(true);
                                }}
                              >
                                Inspect
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: WORKER HEALTH */}
          <TabsContent value="workers" className="space-y-4">
            <Card>
              <CardHeader className="p-4 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  Background Worker Node Fleet
                </CardTitle>
                <CardDescription>Live heartbeat monitors & distributed lease holders</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workers.length === 0 ? (
                    <p className="text-sm text-muted-foreground col-span-3 py-6 text-center">
                      No active workers currently reporting.
                    </p>
                  ) : (
                    workers.map((w) => (
                      <div key={w.workerId} className="p-4 rounded-lg border bg-card space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-sm">{w.workerId}</span>
                          {w.healthStatus === "healthy" ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                              Healthy
                            </Badge>
                          ) : (
                            <Badge variant="destructive">{w.healthStatus}</Badge>
                          )}
                        </div>
                        <div className="space-y-1.5 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Host / PID:</span>
                            <span className="font-mono text-foreground">{w.hostname} (PID {w.pid})</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Concurrency:</span>
                            <span className="font-mono text-foreground">{w.concurrency} concurrent slots</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Active In-Flight:</span>
                            <span className="font-mono text-foreground">{w.activeJobsCount} tasks</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Last Heartbeat:</span>
                            <span className="text-foreground">
                              {Math.floor(w.msSinceHeartbeat / 1000)}s ago
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Confirmation / Dry Run Dialog */}
        <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {actionType === "dry_run" ? <Eye className="w-5 h-5 text-primary" /> : <ShieldAlert className="w-5 h-5 text-amber-500" />}
                {actionType === "dry_run" ? "Dry-Run Simulation Preview" : `Confirm ${actionType.replace("_", " ").toUpperCase()}`}
              </DialogTitle>
              <DialogDescription>
                {actionType === "dry_run"
                  ? "Simulate the execution of this job safely. Candidate records will be evaluated and counted without sending external notifications, modifying ledgers, or applying database mutations."
                  : `Are you sure you want to execute ${actionType.replace("_", " ")} on scheduled job '${actionJob?.name}'?`}
              </DialogDescription>
            </DialogHeader>

            {actionResult && (
              <div className="bg-muted p-3.5 rounded-lg space-y-2 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Simulation / Execution Output:
                </span>
                <pre className="font-mono text-[11px] max-h-48 overflow-y-auto bg-card p-2 rounded border">
                  {JSON.stringify(actionResult.result || actionResult, null, 2)}
                </pre>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
                {actionResult ? "Close" : "Cancel"}
              </Button>
              {!actionResult && (
                <Button
                  variant={actionType === "delete" ? "destructive" : "default"}
                  onClick={executeConfirmedAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                  Confirm & Execute
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Scheduled Job Modal */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="sm:max-w-[540px]">
            <DialogHeader>
              <DialogTitle>Create Scheduled Background Job</DialogTitle>
              <DialogDescription>
                Define a persistent database-backed scheduled automation or recurring background worker task.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="job-name">Job Name</Label>
                <Input
                  id="job-name"
                  placeholder="e.g. Daily Noida Customer Reactivation"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="job-type">Job Type</Label>
                  <Select value={newJobType} onValueChange={setNewJobType}>
                    <SelectTrigger id="job-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobTypes.map((t) => (
                        <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="schedule-type">Schedule Type</Label>
                  <Select
                    value={newScheduleType}
                    onValueChange={(val: any) => setNewScheduleType(val)}
                  >
                    <SelectTrigger id="schedule-type">
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recurring_cron">Recurring Cron Expression</SelectItem>
                      <SelectItem value="recurring_interval">Interval (Seconds)</SelectItem>
                      <SelectItem value="one_time">One-Time Execution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newScheduleType === "recurring_cron" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="cron-expr">Cron Expression (5-part syntax)</Label>
                  <Input
                    id="cron-expr"
                    placeholder="0 10 * * *"
                    value={newCronExpr}
                    onChange={(e) => setNewCronExpr(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">E.g. "0 10 * * *" (10:00 AM daily), "59 23 * * *" (23:59 EOD), "0 */6 * * *"</p>
                </div>
              ) : newScheduleType === "recurring_interval" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="interval-sec">Interval (Seconds)</Label>
                  <Input
                    id="interval-sec"
                    type="number"
                    placeholder="3600"
                    value={newIntervalSeconds}
                    onChange={(e) => setNewIntervalSeconds(e.target.value)}
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={newTimezone}
                    onChange={(e) => setNewTimezone(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="max-retries">Max Retries</Label>
                  <Input
                    id="max-retries"
                    type="number"
                    value={newMaxRetries}
                    onChange={(e) => setNewMaxRetries(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payload-json">Payload Configuration (JSON)</Label>
                <textarea
                  id="payload-json"
                  className="w-full h-24 p-2 text-xs font-mono rounded border bg-card"
                  value={newPayloadJson}
                  onChange={(e) => setNewPayloadJson(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateJob} disabled={creating}>
                {creating ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                Create Job
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Inspect Execution Modal */}
        <Dialog open={inspectModalOpen} onOpenChange={setInspectModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Execution Log #{selectedExecution?.id}
              </DialogTitle>
              <DialogDescription>
                {selectedExecution?.jobKey} ({selectedExecution?.jobType})
              </DialogDescription>
            </DialogHeader>

            {selectedExecution && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg">
                  <div>
                    <span className="text-muted-foreground">Trigger Mode:</span>
                    <p className="font-semibold capitalize">{selectedExecution.triggerType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <p className="font-semibold font-mono">{selectedExecution.durationMs}ms</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Started At:</span>
                    <p className="font-semibold">{new Date(selectedExecution.startedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Worker Node:</span>
                    <p className="font-semibold font-mono">{selectedExecution.workerId || "N/A"}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Execution Summary Metrics</Label>
                  <pre className="p-2.5 bg-card rounded border font-mono text-[11px] max-h-36 overflow-y-auto">
                    {JSON.stringify(selectedExecution.resultSummary, null, 2)}
                  </pre>
                </div>

                {selectedExecution.errorMessage && (
                  <div className="space-y-1">
                    <Label className="text-red-500">Error Details</Label>
                    <div className="p-2.5 bg-red-50 text-red-800 rounded border border-red-200 font-mono text-[11px] overflow-x-auto">
                      <p className="font-bold">{selectedExecution.errorMessage}</p>
                      {selectedExecution.errorStack && (
                        <pre className="text-[10px] mt-1 text-red-600 max-h-24 overflow-y-auto">
                          {selectedExecution.errorStack}
                        </pre>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Sanitized Job Payload (Audit Safe)</Label>
                  <pre className="p-2.5 bg-card rounded border font-mono text-[11px] max-h-32 overflow-y-auto">
                    {JSON.stringify(selectedExecution.sanitizedPayload, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setInspectModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
