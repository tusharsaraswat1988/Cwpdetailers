import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, Upload, Users, Radio, ExternalLink, UserCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchLegacyContacts, reactivateLegacyCustomer } from "@/features/customers/api";

export default function AdminLegacyContacts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["legacy-contacts"],
    queryFn: () => fetchLegacyContacts({ limit: 100 }),
  });

  const contacts = data?.data ?? [];
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);

  const reactivateMut = useMutation({
    mutationFn: reactivateLegacyCustomer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legacy-contacts"] });
      qc.invalidateQueries({ queryKey: ["reactivated-customers"] });
      toast({ title: "Customer reactivated", description: "Welcome-back message queued in Communication timeline." });
      setReactivatingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Reactivation failed", description: err.message, variant: "destructive" });
      setReactivatingId(null);
    },
  });

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="mb-2">
          <Link href="/admin/customers/migration" className="text-sm text-primary hover:underline">
            ← Migration Tools
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl">Legacy Contacts</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Imported phone-only contacts from migration — not active customers. Use for win-back campaigns only.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/customers/migration">
                <Upload size={14} className="mr-1.5" />Import Existing Customers
              </Link>
            </Button>
            <Button asChild className="bg-primary text-primary-foreground">
              <Link href="/admin/communications">
                <Radio size={14} className="mr-1.5" />Send campaign
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="font-bold text-2xl text-amber-500">{data?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Dormant legacy contacts</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="font-bold text-2xl text-green-500">{data?.reactivatedTotal ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Returned (all time)</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 md:col-span-1 col-span-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Use Communication Center audience <Badge variant="outline" className="mx-1 text-[10px]">Legacy Contacts (Dormant)</Badge>
              for bulk WhatsApp/SMS. When they book or subscribe, they auto-reactivate with a welcome-back message.
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
            ) : contacts.length === 0 ? (
              <div className="py-12 text-center px-6">
                <Users size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-3">No legacy contacts yet.</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/customers/migration">Import from Excel</Link>
                </Button>
              </div>
            ) : (
              contacts.map(c => (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{c.name}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Phone size={9} />{c.phone}</span>
                      {c.city && <span>{c.city}</span>}
                      {c.customerSince && <span>Since {c.customerSince}</span>}
                    </div>
                    {c.operationalNotes && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{c.operationalNotes}</p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={reactivateMut.isPending && reactivatingId === c.id}
                      onClick={() => {
                        setReactivatingId(c.id);
                        reactivateMut.mutate(c.id);
                      }}
                    >
                      <UserCheck size={11} className="mr-1" />
                      {reactivateMut.isPending && reactivatingId === c.id ? "…" : "Reactivate"}
                    </Button>
                    <Link href={`/admin/customers/${c.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <ExternalLink size={11} className="mr-1" />View
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
