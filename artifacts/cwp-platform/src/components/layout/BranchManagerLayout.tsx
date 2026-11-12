import { ReactNode, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import { useBranding } from "@/lib/branding";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { SyncStatusIndicator } from "@/components/connectivity/SyncStatusIndicator";
import { MANAGER_NAV_SECTIONS } from "./managerNavConfig";
import {
  Building2,
  LogOut,
  ChevronDown,
  Shield,
  User,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AssignedBranch = {
  id: number;
  name: string;
  code?: string | null;
  city: string;
  cityId?: number | null;
  status: string;
  isActive: boolean;
};

export default function BranchManagerLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const branding = useBranding();
  const activeBranchId = useAppStore((s) => s.activeBranchId);
  const setActiveBranch = useAppStore((s) => s.setActiveBranch);

  // Fetch branches authorized specifically for this branch manager
  const { data: myBranches = [] } = useQuery<AssignedBranch[]>({
    queryKey: ["/api/branch-assignments/my-branches"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/branch-assignments/my-branches", { credentials: "include" });
        if (!res.ok) return [];
        return await res.json();
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  // Ensure activeBranchId is set to one of the manager's assigned branches
  useEffect(() => {
    if (myBranches.length > 0) {
      const isCurrentValid = myBranches.some((b) => b.id === activeBranchId);
      if (!isCurrentValid) {
        const primary = myBranches[0]!;
        setActiveBranch(primary.id, primary.cityId ?? null);
      }
    }
  }, [myBranches, activeBranchId, setActiveBranch]);

  const selectedBranch = useMemo(
    () => myBranches.find((b) => b.id === activeBranchId) ?? myBranches[0],
    [myBranches, activeBranchId],
  );

  const handleBranchChange = (val: string) => {
    const branchId = Number(val);
    const branch = myBranches.find((b) => b.id === branchId);
    if (branch) {
      setActiveBranch(branch.id, branch.cityId ?? null);
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside
        data-testid="branch-manager-sidebar"
        className="hidden md:flex flex-col w-64 shrink-0 bg-card border-r border-border h-full overflow-y-auto"
      >
        {/* Brand header */}
        <div className="p-4 border-b border-border/80 flex items-center gap-3">
          <BrandLogo variant="navbar" lazy={false} />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{branding.brandName}</h2>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/40 text-primary">
              Branch Operating Unit
            </Badge>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {MANAGER_NAV_SECTIONS.map((section) => (
            <div key={section.label} className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-muted-foreground px-2 tracking-wider">
                {section.label}
              </p>
              {section.entries.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href || (item.href !== "/manager/dashboard" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-border/80 bg-muted/20">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0 flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <User size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate text-foreground">{user?.name || "Branch Manager"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.phone}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
              title="Sign Out"
            >
              <LogOut size={14} />
            </Button>
          </div>
          <SyncStatusIndicator className="text-[10px] text-muted-foreground/60 justify-center" />
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Scope Header (Branch Manager Scoped) */}
        <header
          data-testid="branch-manager-header"
          className="h-14 border-b border-border bg-card/80 backdrop-blur px-4 flex items-center justify-between gap-3 shrink-0"
        >
          {/* Branch Selector: restricted to assigned branches */}
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-primary shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Operating Branch:</span>
            {myBranches.length > 1 ? (
              <Select
                value={selectedBranch ? String(selectedBranch.id) : ""}
                onValueChange={handleBranchChange}
              >
                <SelectTrigger className="h-8 w-[180px] sm:w-[220px] text-xs font-medium">
                  <SelectValue placeholder="Select assigned branch" />
                </SelectTrigger>
                <SelectContent>
                  {myBranches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)} className="text-xs">
                      🏢 {b.name} ({b.city})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : selectedBranch ? (
              <Badge variant="secondary" className="text-xs font-medium py-1 px-2.5">
                🏢 {selectedBranch.name} ({selectedBranch.city})
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                No active branch assigned
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-primary/30 text-primary hidden sm:inline-flex">
              <Shield size={12} className="mr-1" /> Branch Manager Portal
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 md:hidden"
              onClick={handleLogout}
            >
              <LogOut size={13} className="mr-1" /> Logout
            </Button>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
