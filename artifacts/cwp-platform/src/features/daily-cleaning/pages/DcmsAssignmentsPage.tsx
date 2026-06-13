import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { DcmsEntitySearch, type SearchOption } from "../components/DcmsEntitySearch";
import { useDcmsAssignments, useDcmsSubscriptionMutations } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

type AssignmentRow = {
  assignment: { id: number; subscriptionId: number; staffId: number; routeOrder: number; assignedAt: string };
  planName: string;
  customerName: string;
  vehicleNumber: string;
  staffName?: string;
};

export default function DcmsAssignmentsPage() {
  const { data: assignments, isLoading } = useDcmsAssignments();
  const { assign } = useDcmsSubscriptionMutations();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [subscription, setSubscription] = useState<SearchOption | null>(null);
  const [staff, setStaff] = useState<SearchOption | null>(null);
  const [routeOrder, setRouteOrder] = useState("1");

  const handleAssign = async () => {
    if (!subscription || !staff) {
      toast({ title: "Select subscription and staff", variant: "destructive" });
      return;
    }
    try {
      await assign.mutateAsync({
        subscriptionId: subscription.id,
        staffId: staff.id,
        routeOrder: Number(routeOrder) || 0,
      });
      setOpen(false);
      setSubscription(null);
      setStaff(null);
      toast({ title: "Staff assigned" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const rows = (assignments ?? []) as AssignmentRow[];

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />
        <div className="flex justify-between items-center">
          <h2 className="font-display font-bold text-xl">Staff Assignments</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Assign Staff</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Staff to Subscription</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Subscription</Label>
                  <DcmsEntitySearch type="subscriptions" value={subscription} onChange={setSubscription} placeholder="Customer or vehicle registration…" />
                </div>
                <div>
                  <Label>Staff</Label>
                  <DcmsEntitySearch type="staff" value={staff} onChange={setStaff} placeholder="Search name or mobile…" />
                </div>
                <div>
                  <Label>Route Order</Label>
                  <Input type="number" min={0} value={routeOrder} onChange={e => setRouteOrder(e.target.value)} placeholder="Sequence in daily route" />
                </div>
                <Button onClick={handleAssign} disabled={assign.isPending} className="w-full">Assign</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? <p>Loading...</p> : (
          <div className="space-y-3">
            {rows.map(row => (
              <Card key={row.assignment.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{row.customerName} · {row.vehicleNumber}</p>
                    <p className="text-sm text-muted-foreground">{row.planName}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Route #{row.assignment.routeOrder + 1}</p>
                </CardContent>
              </Card>
            ))}
            {rows.length === 0 && <p className="text-muted-foreground">No active assignments</p>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
