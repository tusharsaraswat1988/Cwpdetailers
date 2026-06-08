import { useState } from "react";
import FranchiseeLayout from "@/components/layout/FranchiseeLayout";
import { useAuth } from "@/lib/auth";
import { useListStaff } from "@workspace/api-client-react";
import { UserCog, CheckCircle, Clock, XCircle, Plus, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const verificationBadge: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending: { label: "Pending Verification", cls: "bg-amber-500/10 text-amber-500", icon: Clock },
  verified: { label: "Verified", cls: "bg-green-500/10 text-green-500", icon: CheckCircle },
  rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-400", icon: XCircle },
};

export default function FranchiseeStaff() {
  const { user } = useAuth();
  const branchId = user?.branchId?.toString();
  const { data: staff = [], isLoading, refetch } = useListStaff({ branchId } as any);
  const { toast } = useToast();

  return (
    <FranchiseeLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl">My Staff</h1>
            <p className="text-muted-foreground text-sm mt-1">Staff added by you — verification done by CWP Admin before they can take bookings</p>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-5 text-sm text-blue-400">
          <strong>Workflow:</strong> Add staff below → Admin reviews documents & verifies → Verified staff get login credentials and can be assigned bookings.
        </div>

        {/* Verification summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {(["pending", "verified", "rejected"] as const).map(status => {
            const count = staff.filter((s: any) => s.verificationStatus === status).length;
            const { label, cls, icon: Icon } = verificationBadge[status];
            return (
              <div key={status} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <Icon size={16} className={cls.split(" ")[1]} />
                <div>
                  <p className="font-bold text-lg">{count}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Staff list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <UserCog size={15} className="text-muted-foreground" />
            <h2 className="font-semibold text-sm">All Staff</h2>
            <span className="ml-auto text-xs text-muted-foreground">{staff.length} total</span>
          </div>
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
            ) : staff.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">No staff added yet. Contact admin to add staff.</div>
            ) : (
              staff.map((s: any) => {
                const badge = verificationBadge[s.verificationStatus] ?? verificationBadge.pending;
                const BadgeIcon = badge.icon;
                return (
                  <div key={s.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-sm">{s.name?.[0] ?? "?"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{s.name}</p>
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>
                          <BadgeIcon size={10} />{badge.label}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="capitalize">{s.role?.replace("_", " ")}</span>
                        {s.phone && <span className="flex items-center gap-1"><Phone size={9} />{s.phone}</span>}
                        {s.email && <span className="flex items-center gap-1"><Mail size={9} />{s.email}</span>}
                      </div>
                      {s.verificationNotes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">Note: {s.verificationNotes}</p>
                      )}
                    </div>
                    {s.userId ? (
                      <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">Has Login</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No login yet</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </FranchiseeLayout>
  );
}
