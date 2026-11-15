import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AppShell, type BottomNavItem } from "@/components/app-shell";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { CustomerThemeRoot, CustomerButton } from "@/features/customer-ds";
import { CustomerExtraServiceApprovalHost } from "@/features/extra-service/components/CustomerExtraServiceApprovalHost";
import {
  LogOut,
  LayoutDashboard,
  Calendar,
  ClipboardList,
  User,
  Car,
  MapPin,
  ChevronDown,
} from "lucide-react";
import {
  CustomerAddressProvider,
  useCustomerAddress,
} from "@/context/CustomerAddressContext";
import { AddressPickerSheet } from "@/components/shared/AddressPickerSheet";

/** Frozen IA v1.0 — Home · My Plans · Schedule (FAB) · Assets · Account */
const navItems: BottomNavItem[] = [
  { href: CUSTOMER_ROUTES.home, label: "Home", icon: LayoutDashboard },
  { href: CUSTOMER_ROUTES.plans, label: "My Plans", icon: ClipboardList },
  { href: CUSTOMER_ROUTES.scheduleEntry({ from: "fab" }), label: "Schedule", icon: Calendar, fab: true },
  { href: CUSTOMER_ROUTES.assets, label: "Assets", icon: Car },
  { href: CUSTOMER_ROUTES.account, label: "Account", icon: User },
];

type CustomerLayoutProps = {
  children: ReactNode;
  /** Override shell width — Account hub uses `hub` for two-column desktop. */
  maxWidth?: "sm" | "md" | "hub" | "full" | "responsive";
  headerCenter?: ReactNode;
};

function CustomerLayoutInner({
  children,
  maxWidth = "responsive",
  headerCenter,
}: CustomerLayoutProps) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const {
    selectedAddress,
    selectAddress,
    shortAddressLabel,
    isAddressPickerOpen,
    setAddressPickerOpen,
    openAddressPicker,
    savedLocations,
    saveNewAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    customerId,
  } = useCustomerAddress();

  const addressCapsule = (
    <button
      type="button"
      onClick={openAddressPicker}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-foreground text-xs font-semibold max-w-[190px] sm:max-w-xs transition-colors cursor-pointer border border-slate-200/80 truncate shadow-2xs"
      aria-label={`Current service location: ${shortAddressLabel}. Tap to change`}
      data-testid="header-address-capsule"
    >
      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
      <span className="truncate">{shortAddressLabel}</span>
      <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
    </button>
  );

  const resolvedHeaderContent = headerCenter !== undefined ? headerCenter : addressCapsule;

  return (
    <CustomerThemeRoot>
      <AppShell
        testId="customer-layout"
        maxWidth={maxWidth}
        appBar={{
          leading: (
            <div className="flex items-center gap-3 shrink-0">
              <Link href={CUSTOMER_ROUTES.home} className="flex items-center gap-2 shrink-0" aria-label="Go to Home">
                <BrandLogo variant="mobile" lazy={false} />
              </Link>
              <nav className="hidden md:flex items-center gap-1 ml-2" aria-label="Desktop navigation">
                {navItems.map(item => {
                  const active = location === item.href || (item.href !== "/customer/dashboard" && location.startsWith(item.href + "/"));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5",
                        active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium",
                      )}
                    >
                      <item.icon size={15} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ),
          title: resolvedHeaderContent,
          subtitle: undefined,
          trailing: (
            <div className="flex items-center gap-1.5">
              <SyncStatusIndicator compact className="hidden sm:inline-flex" />
              <CustomerButton
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-destructive hidden sm:flex"
                onClick={() => logout()}
                aria-label="Sign out"
              >
                <LogOut size={18} />
              </CustomerButton>
            </div>
          ),
        }}
        bottomNav={navItems}
      >
        {children}
        <CustomerExtraServiceApprovalHost />

        {/* Global Address Picker Sheet */}
        <AddressPickerSheet
          open={isAddressPickerOpen}
          onOpenChange={setAddressPickerOpen}
          value={selectedAddress}
          savedLocations={savedLocations}
          customerId={customerId ?? undefined}
          onSelect={(loc, meta) => selectAddress(loc, meta)}
          onSaveNew={saveNewAddress}
          onUpdate={updateAddress}
          onDelete={deleteAddress}
          onSetDefault={setDefaultAddress}
        />
      </AppShell>
    </CustomerThemeRoot>
  );
}

export default function CustomerLayout(props: CustomerLayoutProps) {
  return (
    <CustomerAddressProvider>
      <CustomerLayoutInner {...props} />
    </CustomerAddressProvider>
  );
}
