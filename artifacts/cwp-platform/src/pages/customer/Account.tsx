import { useAuth } from "@/lib/auth";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, FileText, Car, AlertCircle, User, ChevronRight, Camera, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRequestUploadUrl } from "@workspace/api-client-react";
import { resolveMediaUrl, uploadFileToCloudinary } from "@/lib/media-url";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";

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
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const requestUpload = useRequestUploadUrl();

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/customers/me");
    if (res.ok) setProfile(await res.json());
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const onPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    try {
      const presign = await requestUpload.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      const secureUrl = await uploadFileToCloudinary(file, presign);
      const patch = await fetch(`/api/customers/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: secureUrl }),
      });
      if (!patch.ok) throw new Error("Failed to save photo");
      await loadProfile();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const displayName = profile?.name ?? user?.name ?? "Customer";
  const photoSrc = resolveMediaUrl(profile?.photoUrl);

  return (
    <CustomerLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-display font-bold text-2xl">Account</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Profile & settings</p>
        </div>

        <Card data-testid="account-profile-card">
          <CardContent className="p-4 flex items-center gap-4">
            <button
              type="button"
              className="relative w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden group"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Change profile photo"
            >
              {photoSrc ? (
                <img src={photoSrc} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={24} className="text-primary" />
              )}
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                {uploading ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoSelect} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{displayName}</p>
              <p className="text-sm text-muted-foreground">{profile?.phone ?? user?.phone}</p>
              {(profile?.email ?? user?.email) && (
                <p className="text-xs text-muted-foreground">{profile?.email ?? user?.email}</p>
              )}
              {profile?.customerSince && (
                <p className="text-xs text-muted-foreground mt-1">Customer since {profile.customerSince}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : "Photo"}
            </Button>
          </CardContent>
        </Card>

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
