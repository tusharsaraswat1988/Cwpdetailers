import AdminLayout from "@/components/layout/AdminLayout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminReactivatedCustomers() {
  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h1 className="font-display font-bold text-xl">Reactivated customers</h1>
            <p className="text-sm text-muted-foreground">
              There is no separate reactivation module. When an inactive customer books again, they become active automatically.
              Look for the <strong>Reactivated</strong> badge on the customer list and profile timeline.
            </p>
            <Button asChild>
              <Link href="/admin/customers">Go to Customer Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
