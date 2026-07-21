import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { submitMobile } from "@/lib/contactForm";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/apiError";
import type { CustomerProfile } from "./types";

export function useCustomerProfile() {
  const { user, token, login } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/me", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as CustomerProfile;
        setProfile(data);
        setName(data.name);
        setPhone(data.phone);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const profileDirty = profile != null && name.trim() !== profile.name;

  const resetForm = useCallback(() => {
    if (!profile) return;
    setName(profile.name);
    setPhone(profile.phone);
    setPhoneError(null);
  }, [profile]);

  const saveProfile = useCallback(async (): Promise<boolean> => {
    if (!profile) return false;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: "Name is required", variant: "destructive" });
      return false;
    }

    // Mobile is read-only in the editor — always send the stored phone.
    const phoneResult = submitMobile(profile.phone);
    if (!phoneResult.ok) {
      toast({ title: phoneResult.error, variant: "destructive" });
      return false;
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
      return true;
    } catch (err) {
      toast({
        title: "Update failed",
        description: getApiErrorMessage(err, "Could not save your profile"),
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, [profile, name, user, token, login, toast]);

  const displayName = profile?.name ?? user?.name ?? "Customer";
  const displayPhone = profile?.phone ?? user?.phone ?? "";
  const displayEmail = profile?.email ?? user?.email ?? null;

  return {
    profile,
    loading,
    name,
    setName,
    phone,
    setPhone,
    phoneError,
    setPhoneError,
    saving,
    profileDirty,
    displayName,
    displayPhone,
    displayEmail,
    loadProfile,
    resetForm,
    saveProfile,
  };
}
