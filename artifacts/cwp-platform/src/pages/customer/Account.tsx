import { useQuery } from "@tanstack/react-query";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { useAuth } from "@/lib/auth";
import { staffEcosystemApi, STAFF_ECOSYSTEM_QUERY_KEY } from "@/lib/staff-ecosystem/api";
import { CustomerPage, CustomerHeader } from "@/features/customer-ds";
import { ProfileCard } from "./account/ProfileCard";
import { AccountSummary } from "./account/AccountSummary";
import { BillingSection } from "./account/BillingSection";
import { NotificationSection } from "./account/NotificationSection";
import { SupportSection } from "./account/SupportSection";
import { LogoutSection } from "./account/LogoutSection";
import { useCustomerProfile } from "./account/useCustomerProfile";
import { useAccountSummary } from "./account/useAccountSummary";

export default function CustomerAccount() {
  const { logout } = useAuth();

  const {
    profile,
    name,
    setName,
    phone,
    saving,
    profileDirty,
    displayName,
    displayPhone,
    displayEmail,
    loadProfile,
    resetForm,
    saveProfile,
  } = useCustomerProfile();

  const summaryMetrics = useAccountSummary(profile?.totalDues);

  const { data: supervisorData } = useQuery({
    queryKey: [STAFF_ECOSYSTEM_QUERY_KEY, "customer-supervisor"],
    queryFn: staffEcosystemApi.getCustomerSupervisorContact,
  });

  return (
    <CustomerLayout maxWidth="hub">
      <CustomerPage className="!space-y-0">
        <CustomerHeader title="Account" className="mb-4" />

        {/*
          Mobile: single column
          Desktop (md+): identity + membership | billing / alerts / support
        */}
        <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-8">
          <div className="flex flex-col gap-4">
            <ProfileCard
              profile={profile}
              displayName={displayName}
              displayPhone={displayPhone}
              displayEmail={displayEmail}
              name={name}
              phone={phone}
              saving={saving}
              dirty={profileDirty}
              onNameChange={setName}
              onSave={saveProfile}
              onReset={resetForm}
              onPhotoUpdated={() => void loadProfile()}
            />
            <AccountSummary metrics={summaryMetrics} />
          </div>

          <div className="flex flex-col gap-6">
            <BillingSection totalDues={profile?.totalDues} />
            <NotificationSection />
            <SupportSection supervisor={supervisorData?.supervisor ?? null} />
            <LogoutSection onLogout={logout} />
          </div>
        </div>
      </CustomerPage>
    </CustomerLayout>
  );
}
