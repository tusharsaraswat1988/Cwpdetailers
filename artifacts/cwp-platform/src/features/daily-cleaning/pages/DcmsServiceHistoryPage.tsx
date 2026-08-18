import { useMemo, useState, type ReactNode } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { DcmsAdminNav } from "../components/DcmsAdminNav";
import { DcmsEntitySearch, type SearchOption } from "../components/DcmsEntitySearch";
import {
  useDcmsServiceHistory,
  type ServiceHistoryVisitCell,
} from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { resolveMediaUrl } from "@/lib/media-url";
import { format, parseISO } from "date-fns";
import { Search } from "lucide-react";
import { adminVisitLabel } from "../lib/visitLabels";

function istDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function defaultHistoryRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: istDateString(from), to: istDateString(to) };
}

function formatVisitTime(iso: string) {
  try {
    return format(parseISO(iso), "hh:mm a");
  } catch {
    return "—";
  }
}

function VisitCell({ cell, label }: { cell?: ServiceHistoryVisitCell; label: string }) {
  if (!cell) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-1 min-w-[140px]">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">{formatVisitTime(cell.time)}</span>
        <StatusBadge
          status={cell.status}
          label={adminVisitLabel(cell.status)}
          tone={cell.status === "car_not_available" ? "warning" : undefined}
        />
      </div>
      <p className="text-xs text-muted-foreground">{cell.staffName}</p>
      {cell.status === "car_not_available" ? (
        <p className="text-[11px] text-muted-foreground">No vehicle photo — car was not available</p>
      ) : cell.photoUrl ? (
        <a href={resolveMediaUrl(cell.photoUrl)} target="_blank" rel="noreferrer" className="inline-block">
          <img
            src={resolveMediaUrl(cell.photoUrl)}
            alt={`${label} proof`}
            className="h-12 w-12 rounded-md object-cover border border-border"
          />
        </a>
      ) : (
        <p className="text-[11px] text-muted-foreground">No photo</p>
      )}
      {cell.rejectionReason ? (
        <p className="text-[11px] text-destructive">{cell.rejectionReason}</p>
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function formatHistoryError(error: Error) {
  if (error.message.includes("<!DOCTYPE") || error.message.includes("<html")) {
    return "Could not load service history. Restart the dev server if you just added this feature.";
  }
  return error.message;
}

export default function DcmsServiceHistoryPage() {
  const defaults = useMemo(() => defaultHistoryRange(), []);
  const [customer, setCustomer] = useState<SearchOption | null>(null);
  const [vehicle, setVehicle] = useState<SearchOption | null>(null);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [applied, setApplied] = useState<Record<string, string | number>>(() => ({
    from: defaults.from,
    to: defaults.to,
  }));

  const { data: days, isLoading, isFetching, error } = useDcmsServiceHistory(applied);

  const applyFilters = () => {
    const next: Record<string, string | number> = { from, to };
    if (customer) next.customerId = customer.id;
    if (vehicle) next.vehicleId = vehicle.id;
    setApplied(next);
  };

  const totalRows = days?.reduce((sum, day) => sum + day.rows.length, 0) ?? 0;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        <DcmsAdminNav />

        <div>
          <h2 className="font-display font-bold text-xl">Service History</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daily cleaning and wash consumption by date — search by customer or vehicle number.
          </p>
        </div>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-end gap-2 overflow-x-auto pb-0.5">
              <FilterField label="Customer" className="min-w-[180px] flex-[1.3]">
                <DcmsEntitySearch
                  type="customers"
                  value={customer}
                  onChange={setCustomer}
                  placeholder="Name or phone…"
                />
              </FilterField>

              <FilterField label="Vehicle" className="min-w-[160px] flex-[1.2]">
                <DcmsEntitySearch
                  type="vehicles"
                  value={vehicle}
                  onChange={setVehicle}
                  placeholder="Car number…"
                  vehicleFilters={customer ? { customerId: customer.id } : undefined}
                />
              </FilterField>

              <FilterField label="From" className="w-[132px] shrink-0">
                <Input
                  id="history-from"
                  type="date"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="h-9 text-sm"
                />
              </FilterField>

              <span className="hidden shrink-0 self-end pb-2 text-sm text-muted-foreground sm:inline" aria-hidden>
                –
              </span>

              <FilterField label="To" className="w-[132px] shrink-0">
                <Input
                  id="history-to"
                  type="date"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="h-9 text-sm"
                  onKeyDown={e => {
                    if (e.key === "Enter") applyFilters();
                  }}
                />
              </FilterField>

              <Button
                type="button"
                size="sm"
                className="h-9 shrink-0 px-4"
                onClick={applyFilters}
                disabled={isFetching}
              >
                <Search className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{isFetching ? "Loading…" : "Search"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <p className="text-destructive text-sm">{formatHistoryError(error as Error)}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : !days?.length ? (
          <p className="text-sm text-muted-foreground">No service records in this range.</p>
        ) : (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">{totalRows} vehicle-day record(s) across {days.length} day(s)</p>
            {days.map(day => (
              <section key={day.date} className="space-y-2">
                <h3 className="font-display font-semibold text-base sticky top-0 bg-background/95 py-1 border-b border-border">
                  {format(parseISO(`${day.date}T12:00:00`), "EEEE, d MMM yyyy")}
                </h3>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Daily Cleaning</TableHead>
                        <TableHead>Wash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {day.rows.map(row => (
                        <TableRow key={`${day.date}-${row.vehicleId}-${row.subscriptionId}`}>
                          <TableCell className="font-medium">{row.vehicleNumber}</TableCell>
                          <TableCell>{row.customerName}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{row.planName}</TableCell>
                          <TableCell>
                            <VisitCell cell={row.cleaning} label="Cleaning" />
                          </TableCell>
                          <TableCell>
                            <VisitCell cell={row.wash} label="Wash" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
