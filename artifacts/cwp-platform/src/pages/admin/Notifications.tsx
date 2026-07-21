import { useState } from "react";
import { useListNotifications, getListNotificationsQueryKey, useCreateNotification, useMarkNotificationRead } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Bell, BellOff } from "lucide-react";
import { Link } from "wouter";

export default function AdminNotifications() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", type: "broadcast" });

  const { data: notifications, isLoading } = useListNotifications({}, { query: { queryKey: getListNotificationsQueryKey({}) } });

  const createMutation = useCreateNotification({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        setOpen(false);
        toast({ title: "Notification sent" });
      },
    },
  });

  const markReadMutation = useMarkNotificationRead({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    },
  });

  const unread = (notifications ?? []).filter(n => !n.isRead).length;

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Notifications</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{unread} unread · <Link href="/admin/push-logs" className="text-primary hover:underline">Push delivery log</Link></p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-send-notification">
                <Plus size={15} className="mr-1.5" />Broadcast
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Send Notification</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Title</Label>
                  <Input data-testid="input-notif-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Message</Label>
                  <Input data-testid="input-notif-message" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className="mt-1" />
                </div>
                <Button onClick={() => createMutation.mutate({ data: { ...form, type: "broadcast" as any } })}
                  disabled={createMutation.isPending} className="w-full " data-testid="btn-submit-notification">
                  {createMutation.isPending ? "Sending..." : "Send to All"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2">
          {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />) :
            (notifications ?? []).map(n => (
              <div key={n.id}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${n.isRead ? "bg-card border-border opacity-60" : "bg-primary/5 border-primary/20"}`}
                data-testid={`notification-${n.id}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${n.isRead ? "bg-muted" : "bg-primary/10"}`}>
                  {n.isRead ? <BellOff size={14} className="text-muted-foreground" /> : <Bell size={14} className="text-primary" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt!).toLocaleDateString("en-IN")}</p>
                </div>
                {!n.isRead && (
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-primary"
                    data-testid={`btn-mark-read-${n.id}`}
                    onClick={() => markReadMutation.mutate({ id: n.id })}>
                    Mark read
                  </Button>
                )}
              </div>
            ))}
          {!isLoading && (notifications ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No notifications yet</div>}
        </div>
      </div>
    </AdminLayout>
  );
}
