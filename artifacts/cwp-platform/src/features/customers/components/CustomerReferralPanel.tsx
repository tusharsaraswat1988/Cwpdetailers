import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Link2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { fetchCustomerNetwork, searchCustomers, updateCustomerTier3Fields } from "../api";

import { Can } from "@/components/Can";

type Props = {
  customerId: number;
  basePath: string;
};

export function CustomerReferralPanel({ customerId, basePath }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: network, isLoading } = useQuery({
    queryKey: ["customer-network", customerId],
    queryFn: () => fetchCustomerNetwork(customerId),
    enabled: customerId > 0,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["customer-referrer-search", search],
    queryFn: () => searchCustomers(search),
    enabled: search.trim().length >= 3,
  });

  const handleSetReferrer = async (referrerId: number) => {
    setSaving(true);
    try {
      await updateCustomerTier3Fields(customerId, { referredByCustomerId: referrerId });
      qc.invalidateQueries({ queryKey: ["customer-network", customerId] });
      setSearch("");
      toast({ title: "Referrer linked" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to link referrer", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClearReferrer = async () => {
    setSaving(true);
    try {
      await updateCustomerTier3Fields(customerId, { referredByCustomerId: null });
      qc.invalidateQueries({ queryKey: ["customer-network", customerId] });
      toast({ title: "Referrer removed" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to remove referrer", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const PersonLink = ({ id, name, phone }: { id: number; name: string; phone?: string }) => (
    <Link href={`${basePath}/${id}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors" data-testid={`network-customer-${id}`}>
      <Link2 size={12} className="text-muted-foreground shrink-0" />
      <span className="font-medium">{name}</span>
      {phone && <span className="text-xs text-muted-foreground">{phone}</span>}
    </Link>
  );

  return (
    <Card data-testid="customer-referral-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users size={16} className="text-primary" /> Family & referrals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Referred by</p>
          {network?.referrer ? (
            <div className="flex items-center justify-between gap-2">
              <PersonLink id={network.referrer.id} name={network.referrer.name} phone={network.referrer.phone} />
              <Can resource="customers" action="edit">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClearReferrer} disabled={saving}>
                  Remove
                </Button>
              </Can>
            </div>
          ) : (
            <p className="text-muted-foreground">No referrer linked</p>
          )}
        </div>

        <Can resource="customers" action="edit">
          {!network?.referrer && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs font-medium flex items-center gap-1"><UserPlus size={12} /> Link referrer</p>
            <Input
              placeholder="Search by name or phone (min 3 chars)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-referrer-search"
            />
            {(searchResults ?? []).filter(c => c.id !== customerId).slice(0, 5).map(c => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 rounded-lg border border-border hover:bg-muted/40 transition-colors"
                onClick={() => handleSetReferrer(c.id)}
                disabled={saving}
              >
                {c.name} · {c.phone}
              </button>
            ))}
          </div>
          )}
        </Can>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Customers referred ({network?.referralCount ?? 0})</p>
          {(network?.referrals ?? []).length === 0 ? (
            <p className="text-muted-foreground">No referrals yet</p>
          ) : (
            <div className="space-y-2">
              {(network?.referrals ?? []).map(r => (
                <PersonLink key={r.id} id={r.id} name={r.name} phone={r.phone} />
              ))}
            </div>
          )}
        </div>

        {(network?.siblings ?? []).length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Same referrer (siblings)</p>
            <div className="space-y-2">
              {network!.siblings.map(s => (
                <PersonLink key={s.id} id={s.id} name={s.name} phone={s.phone} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
