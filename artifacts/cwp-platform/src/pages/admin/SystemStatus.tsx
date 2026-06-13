import { useEffect, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConnectivity } from "@/services/ConnectivityContext";
import { offlineQueue } from "@/services/offlineQueue";
import { usePwaInstall } from "@/lib/pwa/usePwaInstall";
import type { QueueItem } from "@/services/offlineQueue";

function statusBadge(ok: boolean, okLabel: string, badLabel: string) {
  return (
    <Badge variant={ok ? "default" : "destructive"} className={ok ? "bg-emerald-600" : undefined}>
      {ok ? okLabel : badLabel}
    </Badge>
  );
}

export default function SystemStatus() {
  const {
    state,
    browserOnline,
    backendAvailable,
    lastSuccessfulSync,
    lastCheckedAt,
    pendingQueueCount,
    isSyncing,
    refresh,
    processQueue,
  } = useConnectivity();
  const { canInstall, isStandalone } = usePwaInstall("admin");
  const [swStatus, setSwStatus] = useState<"active" | "none" | "unsupported">("unsupported");
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setSwStatus("unsupported");
      return;
    }
    void navigator.serviceWorker.getRegistration().then((reg) => {
      setSwStatus(reg?.active ? "active" : "none");
    });
  }, []);

  useEffect(() => {
    void offlineQueue.getAllItems().then(setQueueItems);
  }, [pendingQueueCount, isSyncing]);

  return (
    <AdminLayout>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl">System Status</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Connectivity and sync diagnostics for support and troubleshooting.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => void processQueue()} disabled={isSyncing}>
              Sync Queue
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Internet Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {statusBadge(browserOnline, "Connected", "Offline")}
              <p className="text-xs text-muted-foreground">
                Browser reports {browserOnline ? "online" : "offline"}.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Backend Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {statusBadge(backendAvailable, "Available", "Unavailable")}
              <p className="text-xs text-muted-foreground capitalize">App state: {state.replace("_", " ")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Last Successful Sync</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{lastSuccessfulSync ? new Date(lastSuccessfulSync).toLocaleString() : "Never"}</p>
              {lastCheckedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last checked: {new Date(lastCheckedAt).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pending Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-2xl font-display font-bold">{pendingQueueCount}</p>
              <p className="text-xs text-muted-foreground">
                {isSyncing ? "Sync in progress…" : "Queued write operations waiting to sync."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Service Worker</CardTitle>
            </CardHeader>
            <CardContent>
              {statusBadge(swStatus === "active", "Active", swStatus === "none" ? "Not registered" : "Unsupported")}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">PWA Installed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {statusBadge(isStandalone, "Installed", canInstall ? "Installable" : "Browser mode")}
            </CardContent>
          </Card>
        </div>

        {queueItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Queued Operations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {queueItems.map((item) => (
                <div key={item.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.label}</span>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.method} {item.url} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {item.lastError && <p className="text-xs text-destructive mt-1">{item.lastError}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
