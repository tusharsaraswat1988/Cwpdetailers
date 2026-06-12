import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Calendar, History, FileText, AlertCircle, User, LogOut, Sun } from "lucide-react";

const navItems = [
  { href: "/customer/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/customer/bookings", label: "Book", icon: Calendar },
  { href: "/customer/history", label: "History", icon: History },
  { href: "/customer/invoices", label: "Invoices", icon: FileText },
  { href: "/customer/complaints", label: "Support", icon: AlertCircle },
];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col" data-testid="customer-layout">
      <header className="sticky top-0 z-30 bg-card/90 backdrop-blur border-b border-border shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Sun size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-primary text-base truncate">CWP</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 flex-wrap justify-end">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all",
                  location === href || location.startsWith(href + "/")
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon size={14} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            {user && <span className="text-sm text-muted-foreground hidden sm:block max-w-[8rem] truncate">{user.name}</span>}
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4 sm:py-6 pb-24 md:pb-6 min-w-0">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur safe-area-bottom"
        aria-label="Customer navigation"
      >
        <div className="grid grid-cols-5 gap-0.5 px-1 py-1.5 max-w-lg mx-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-lg text-[10px] sm:text-xs transition-all min-h-[3rem]",
                  active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground",
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate w-full text-center">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
