import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Link } from "wouter";
import { RefreshCw, BellRing } from "lucide-react";

type PushLogRow = {
  id: number;
  userId: number;
  recipientName: string | null;
  recipientRole: string | null;
  userRole: string | null;
  userPhone: string | null;
  eventType: string | null;
  reason: string | null;
  title: string;
  body: string;
  status: string;
  error: string | null;
  channel: string;
  notificationEventId: number | null;
  sentAt: string | null;
  createdAt: string;
};

type PushLogsResponse = {
  stats: { total: number; sent: number; failed: number; skipped: number };
  logs: PushLogRow[];
};

async function fetchPushLogs(params: Record<string, string>): Promise<PushLogsResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/push/admin/logs?${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load push logs");
  return res.json();
}

const statusStyle: Record<string, string> = {
  sent: "bg-green-500/10 text-green-700 border-green-500/30",
  failed: "bg-red-500/10 text-red-700 border-red-500/30",
  skipped: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  pending: "bg-blue-500/10 text-blue-700 border-blue-500/30",
};

export default function AdminPushLogsPage() {
  const [status, setStatus] = useState<string>("all");
  const [eventType, setEventType] = useState("");
  const [role, setRole] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params: Record<string, string> = {};
  if (status !== "all") params.status = status;
  if (eventType.trim()) params.eventType = eventType.trim();
  if (role !== "all") params.role = role;
  if (from) params.from = from;
  if (to) params.to = to;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["push-logs", params],
    queryFn: () => fetchPushLogs(params),
  });

  const stats = data?.stats;
  const logs = data?.logs ?? [];

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <BellRing className="h-6 w-6" /> Push Delivery Log
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Who received each browser push, when it was sent, and why it was triggered.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Link href="/admin/notifications">
              <Button variant="ghost" size="sm">In-app notifications</Button>
            </Link>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total", value: stats.total },
              { label: "Sent", value: stats.sent },
              { label: "Failed", value: stats.failed },
              { label: "Skipped", value: stats.skipped },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Recipient role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Event type</Label>
              <Input
                className="mt-1"
                placeholder="visit_completed"
                value={eventType}
                onChange={e => setEventType(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">From date</Label>
              <Input type="date" className="mt-1" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To date</Label>
              <Input type="date" className="mt-1" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading push logs…</p>
        ) : logs.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No push delivery records yet</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {logs.map(row => {
              const when = row.sentAt ?? row.createdAt;
              return (
                <Card key={row.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{row.title}</p>
                        <p className="text-sm text-muted-foreground">{row.body}</p>
                      </div>
                      <Badge className={statusStyle[row.status] ?? ""}>{row.status}</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm pt-2 border-t">
                      <p>
                        <span className="text-muted-foreground">To: </span>
                        <span className="font-medium">{row.recipientName ?? "Unknown"}</span>
                        {" · "}
                        <span className="capitalize">{row.recipientRole ?? row.userRole ?? "—"}</span>
                        {row.userPhone && (
                          <span className="text-muted-foreground"> ({row.userPhone})</span>
                        )}
                      </p>
                      <p>
                        <span className="text-muted-foreground">When: </span>
                        {format(new Date(when), "dd MMM yyyy, hh:mm a")}
                      </p>
                      <p className="md:col-span-2">
                        <span className="text-muted-foreground">Why: </span>
                        {row.reason ?? "—"}
                      </p>
                      {row.eventType && (
                        <p>
                          <span className="text-muted-foreground">Event: </span>
                          <code className="text-xs bg-muted px-1 rounded">{row.eventType}</code>
                          {row.notificationEventId != null && (
                            <span className="text-muted-foreground text-xs"> · event #{row.notificationEventId}</span>
                          )}
                        </p>
                      )}
                      {row.error && (
                        <p className="text-destructive text-xs md:col-span-2">{row.error}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
