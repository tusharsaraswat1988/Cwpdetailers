import { useAuth } from "@/lib/auth";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { History, FileText, Car, AlertCircle, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";
import { CustomerPhotoEditor } from "@/components/shared/CustomerPhotoEditor";
import { SupervisorContactCard } from "@/components/shared/SupervisorContactCard";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";

const accountLinks = [
  { href: "/customer/history", label: "Service History", description: "Past bookings & photos", icon: History },
  { href: "/customer/invoices", label: "Invoices", description: "Bills & payments due", icon: FileText },
  { href: "/customer/assets", label: "Vehicles & Solar", description: "Manage your assets", icon: Car },
  { href: "/customer/complaints", label: "Support", description: "File or track complaints", icon: AlertCircle },
];

type CustomerProfile = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  photoUrl?: string | null;
  totalDues?: string;
  lastPaymentDate?: string | null;
  customerSince?: string | null;
  historicalWashCount?: number | null;
  historicalSolarVisitCount?: number | null;
};

export default function CustomerAccount() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/customers/me");
    if (res.ok) setProfile(await res.json());
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const { data: supervisorData } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "customer-supervisor"],
    queryFn: staffEcosystemApi.getCustomerSupervisorContact,
  });

  const displayName = profile?.name ?? user?.name ?? "Customer";

  return (
    <CustomerLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-display font-bold text-2xl">Account</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Profile & settings</p>
        </div>

        <Card data-testid="account-profile-card">
          <CardContent className="p-4 space-y-4">
            {profile ? (
              <CustomerPhotoEditor
                customerId={profile.id}
                name={displayName}
                photoUrl={profile.photoUrl}
                size="lg"
                onUpdated={() => void loadProfile()}
                testIdPrefix="account-photo"
              />
            ) : null}
            <div className="min-w-0 border-t border-border pt-3">
              <p className="font-semibold">{displayName}</p>
              <p className="text-sm text-muted-foreground">{profile?.phone ?? user?.phone}</p>
              {(profile?.email ?? user?.email) && (
                <p className="text-xs text-muted-foreground">{profile?.email ?? user?.email}</p>
              )}
              {profile?.customerSince && (
                <p className="text-xs text-muted-foreground mt-1">Customer since {profile.customerSince}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <SupervisorContactCard
          supervisor={supervisorData?.supervisor}
          compact
          title="Field Supervisor"
          description="Contact your assigned supervisor for service issues."
          whatsAppMessage="Hi, I need help regarding my CWP service."
        />

        {(profile?.totalDues && parseFloat(profile.totalDues) > 0) && (
          <Card>
            <CardContent className="p-4 text-sm">
              <p className="text-muted-foreground">Outstanding amount</p>
              <p className="font-semibold text-lg">₹{parseFloat(profile.totalDues).toFixed(2)}</p>
              {profile.lastPaymentDate && (
                <p className="text-xs text-muted-foreground mt-1">Last payment: {profile.lastPaymentDate}</p>
              )}
            </CardContent>
          </Card>
        )}

        <PushNotificationSettings />

        <div className="space-y-2">
          {accountLinks.map(({ href, label, description, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="hover:bg-muted/40 transition-colors cursor-pointer" data-testid={`account-link-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </CustomerLayout>
  );
}
