import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { UserCheck, Phone, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchReactivatedCustomers } from "@/features/customers/api";
import { CustomerHubAdminNav } from "@/features/customers/components/CustomerHubAdminNav";

export default function AdminReactivatedCustomers() {
  const [days, setDays] = useState<string>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["reactivated-customers", days],
    queryFn: () => fetchReactivatedCustomers({
      limit: 100,
      days: days === "all" ? undefined : parseInt(days, 10),
    }),
  });

  const rows = data?.data ?? [];

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <CustomerHubAdminNav />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl">Reactivated Customers</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Former legacy contacts who came back — tracked when they book, subscribe, or are manually reactivated
            </p>
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 inline-block">
          <p className="font-bold text-2xl text-green-500">{data?.total ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Customers returned from legacy segment</p>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center">
                <UserCheck size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No reactivations in this period yet.</p>
              </div>
            ) : (
              rows.map(c => (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{c.name}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Phone size={9} />{c.phone}</span>
                      {c.city && <span>{c.city}</span>}
                      {c.reactivatedAt && (
                        <span className="text-green-600 dark:text-green-400">
                          Reactivated {new Date(c.reactivatedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link href={`/admin/customers/${c.id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <ExternalLink size={11} className="mr-1" />View profile
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
