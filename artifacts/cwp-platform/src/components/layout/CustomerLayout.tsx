import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { AppShell, type BottomNavItem } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Sun, LogOut, Bell, LayoutDashboard, Calendar, Car, History, AlertCircle } from "lucide-react";

const navItems: BottomNavItem[] = [
  { href: "/customer/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/customer/assets", label: "Services", icon: Car },
  { href: "/customer/bookings", label: "Book", icon: Calendar, fab: true },
  { href: "/customer/history", label: "History", icon: History },
  { href: "/customer/complaints", label: "Support", icon: AlertCircle },
];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const pageTitle = navItems.find(
    (item) => location === item.href || location.startsWith(item.href + "/"),
  )?.label;

  return (
    <AppShell
      testId="customer-layout"
      maxWidth="sm"
      appBar={{
        leading: (
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sun size={16} className="text-white" />
            </div>
          </Link>
        ),
        title: pageTitle ?? "CWP",
        subtitle: user?.name,
        trailing: (
          <>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Notifications">
              <Bell size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              onClick={logout}
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </Button>
          </>
        ),
      }}
      bottomNav={navItems}
    >
      {children}
    </AppShell>
  );
}
