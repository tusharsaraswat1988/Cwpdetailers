import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck, ClipboardList, MapPin, Boxes } from "lucide-react";
import { fetchCustomerServicesHub } from "../api";

type Props = {
  customerId: number;
  basePath: string;
};

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "active" || s === "completed") return "text-green-600 border-green-600/30";
  if (s === "paused" || s === "pending" || s === "expiring") return "text-amber-600 border-amber-600/30";
  if (s === "expired" || s === "cancelled") return "text-red-500 border-red-500/30";
  return "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN");
}

export function ActiveServicesSummary({ customerId, basePath }: Props) {
  const isAdmin = basePath.startsWith("/admin");
  const bookServicesPath = isAdmin ? `/admin/book-services?customerId=${customerId}` : null;

  const { data: hub, isLoading } = useQuery({
    queryKey: ["customer", customerId, "services-hub"],
    queryFn: () => fetchCustomerServicesHub(customerId),
    enabled: customerId > 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const contracts = hub?.contracts ?? [];
  const activeCount = hub?.counts.activeContracts ?? 0;

  return (
    <div className="space-y-4" data-testid="active-services-summary">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList size={16} className="text-primary" />
            Active plans
          </CardTitle>
          {bookServicesPath && (
            <Link href={bookServicesPath}>
              <Button size="sm" className="bg-primary text-primary-foreground shrink-0" data-testid="btn-book-service">
                <CalendarCheck size={14} className="mr-1.5" />Create Service Request
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {activeCount} active plan{activeCount === 1 ? "" : "s"} for this customer. Use Create Service Request to sell more.
          </p>

          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active services yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[640px]" data-testid="active-services-table">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="py-2 pr-3 font-medium">Service</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Start</th>
                    <th className="py-2 pr-3 font-medium">End</th>
                    <th className="py-2 pr-3 font-medium">Service address</th>
                    <th className="py-2 font-medium">Vehicle</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map(c => (
                    <tr key={c.id} className="border-b border-border/60" data-testid={`active-service-row-${c.id}`}>
                      <td className="py-3 pr-3 align-top">
                        <p className="font-medium">{c.serviceName}</p>
                        <p className="text-xs text-muted-foreground">Service #{c.id}</p>
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <Badge variant="outline" className={`text-xs capitalize ${statusBadgeClass(c.status)}`}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 align-top whitespace-nowrap">{formatDate(c.startDate ?? c.validFrom)}</td>
                      <td className="py-3 pr-3 align-top whitespace-nowrap">{formatDate(c.endDate ?? c.validUntil)}</td>
                      <td className="py-3 pr-3 align-top">
                        {c.serviceLocationLabel ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} className="text-muted-foreground" />
                            {c.serviceLocationLabel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 align-top">
                        {c.linkedAssetLabel ? (
                          <span className="inline-flex items-center gap-1">
                            <Boxes size={12} className="text-muted-foreground" />
                            {c.linkedAssetLabel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
