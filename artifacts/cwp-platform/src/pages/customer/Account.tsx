import { useAuth } from "@/lib/auth";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { History, FileText, Car, AlertCircle, ChevronRight, Loader2, Save, KeyRound } from "lucide-react";
import { Link } from "wouter";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";
import { CustomerPhotoEditor } from "@/components/shared/CustomerPhotoEditor";
import { SupervisorContactCard } from "@/components/shared/SupervisorContactCard";
import { SetPasswordDialog } from "@/components/auth/SetPasswordDialog";
import { useBranding } from "@/lib/branding";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { submitMobile } from "@/lib/contactForm";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/apiError";
import { clearRememberedPhone, hasRememberedPhone } from "@/lib/rememberPhone";

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
  const branding = useBranding();
  const { user, token, login } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [rememberedOnDevice, setRememberedOnDevice] = useState(hasRememberedPhone);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/customers/me", { credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as CustomerProfile;
      setProfile(data);
      setName(data.name);
      setPhone(data.phone);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const { data: supervisorData } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "customer-supervisor"],
    queryFn: staffEcosystemApi.getCustomerSupervisorContact,
  });

  const displayName = profile?.name ?? user?.name ?? "Customer";
  const profileDirty =
    profile != null && (name.trim() !== profile.name || phone.trim() !== profile.phone);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    const phoneResult = submitMobile(phone);
    setPhoneError(phoneResult.ok ? null : phoneResult.error);
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/customers/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, phone: phoneResult.value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Could not update profile");
      }

      setProfile(body);
      setName(body.name);
      setPhone(body.phone);

      if (user) {
        login(
          {
            ...user,
            name: body.name,
            phone: body.phone,
          },
          token ?? "",
        );
      }

      toast({ title: "Profile updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: getApiErrorMessage(err, "Could not save your profile"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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
                selfService
                onUpdated={() => void loadProfile()}
                testIdPrefix="account-photo"
              />
            ) : null}

            <form onSubmit={handleSaveProfile} className="space-y-4 border-t border-border pt-4">
              <div>
                <Label htmlFor="account-name">Full name</Label>
                <Input
                  id="account-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1.5"
                  autoComplete="name"
                  data-testid="input-account-name"
                />
              </div>

              <PhoneInput
                id="account-phone"
                label="Mobile number"
                value={phone}
                onChange={setPhone}
                error={phoneError}
                onErrorChange={setPhoneError}
                data-testid="input-account-phone"
              />

              {(profile?.email ?? user?.email) && (
                <div>
                  <Label htmlFor="account-email">Email</Label>
                  <Input
                    id="account-email"
                    value={profile?.email ?? user?.email ?? ""}
                    readOnly
                    disabled
                    className="mt-1.5 bg-muted/50"
                    data-testid="input-account-email"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Contact support to change your email.</p>
                </div>
              )}

              {profile?.customerSince && (
                <p className="text-xs text-muted-foreground">Customer since {profile.customerSince}</p>
              )}

              <Button
                type="submit"
                disabled={saving || !profileDirty}
                className="w-full sm:w-auto"
                data-testid="btn-save-account-profile"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={14} className="mr-2" />
                    Save profile
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card data-testid="account-security-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <KeyRound size={16} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Security</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {user?.hasUserPassword
                    ? "Sign in with your mobile number and password, or continue with Google."
                    : "Create a password for quicker sign-in, or keep using OTP."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setShowPasswordDialog(true)}
              data-testid="btn-manage-account-password"
            >
              {user?.hasUserPassword ? "Change password" : "Set password"}
            </Button>
            {rememberedOnDevice && (
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto text-muted-foreground"
                onClick={() => {
                  clearRememberedPhone();
                  setRememberedOnDevice(false);
                  toast({ title: "Device forgotten", description: "Saved mobile number removed from this device." });
                }}
                data-testid="btn-forget-device"
              >
                Forget this device
              </Button>
            )}
          </CardContent>
        </Card>

        <SupervisorContactCard
          supervisor={supervisorData?.supervisor}
          compact
          title="Field Supervisor"
          description="Contact your assigned supervisor for service issues."
          whatsAppMessage={`Hi, I need help regarding my ${branding.brandName} service.`}
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

      <SetPasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        hasExistingPassword={Boolean(user?.hasUserPassword)}
        onSuccess={updatedUser => {
          if (user) {
            login({ ...user, hasUserPassword: updatedUser.hasUserPassword ?? true }, token ?? "");
          }
          setShowPasswordDialog(false);
        }}
      />
    </CustomerLayout>
  );
}
