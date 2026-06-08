import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Calendar, History, FileText, AlertCircle, User, LogOut, Sun } from "lucide-react";

const navItems = [
  { href: "/customer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customer/bookings", label: "Book Service", icon: Calendar },
  { href: "/customer/history", label: "History", icon: History },
  { href: "/customer/invoices", label: "Invoices", icon: FileText },
  { href: "/customer/complaints", label: "Complaints", icon: AlertCircle },
  { href: "/customer/profile", label: "Profile", icon: User },
];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background" data-testid="customer-layout">
      <header className="sticky top-0 z-30 bg-card/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Sun size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-primary text-base">CWP</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all",
                  location === href || location.startsWith(href + "/")
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                <Icon size={14} />{label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {user && <span className="text-sm text-muted-foreground hidden md:block">{user.name}</span>}
            <button onClick={logout} className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10">
              <LogOut size={15} />
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden border-t border-border overflow-x-auto">
          <div className="flex px-2 py-1.5 gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs transition-all",
                  location === href || location.startsWith(href + "/")
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground"
                )}>
                <Icon size={14} />{label}
              </Link>
            ))}
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
