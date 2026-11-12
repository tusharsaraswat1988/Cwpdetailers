import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  Building2,
  Globe,
  Search,
  X,
  User,
  Shield,
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

type Branch = {
  id: number;
  name: string;
  code?: string;
  city?: string;
  cityId?: number | null;
  status?: string;
};

export function AdminScopeHeader() {
  const { user } = useAuth();
  const activeBranchId = useAppStore((s) => s.activeBranchId);
  const setActiveBranch = useAppStore((s) => s.setActiveBranch);
  const setActiveCity = useAppStore((s) => s.setActiveCity);
  const clearScope = useAppStore((s) => s.clearScope);

  // Fetch Branches
  const { data: branchesData = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/branches", { credentials: "include" });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : json?.data ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  // Dynamic operational branches
  const branches: Branch[] = useMemo(() => {
    return branchesData;
  }, [branchesData]);

  const selectedBranchObj = useMemo(
    () => branches.find((b) => b.id === activeBranchId),
    [branches, activeBranchId],
  );

  const hasActiveFilter = activeBranchId !== null;

  const handleBranchChange = (val: string) => {
    if (val === "all") {
      clearScope();
    } else {
      const branchId = Number(val);
      const branch = branches.find((b) => b.id === branchId);
      setActiveBranch(branchId, branch?.cityId ?? null);
    }
  };

  const handleOpenSearch = () => {
    window.dispatchEvent(new CustomEvent("cwp:open-command-palette"));
  };

  return (
    <header
      data-testid="admin-scope-header"
      className="sticky top-0 z-20 w-full mb-4 pb-3 pt-1 border-b border-border/60 bg-background/95 backdrop-blur flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      {/* Left: Single Unified Branch Selector */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1.5 bg-card border border-border/80 rounded-lg px-2.5 py-1 shadow-sm">
          <Building2 size={14} className="text-primary shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Branch:</span>
          <Select
            value={activeBranchId ? String(activeBranchId) : "all"}
            onValueChange={handleBranchChange}
          >
            <SelectTrigger
              className="h-7 w-[160px] sm:w-[190px] text-xs font-medium border-0 shadow-none px-1.5 focus:ring-0 focus:ring-offset-0 bg-transparent"
              data-testid="scope-branch-select"
            >
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="font-semibold text-foreground">🏢 All Branches (Global)</span>
              </SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={String(branch.id)}>
                  {branch.name} {branch.city && branch.city !== branch.name ? `(${branch.city})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filter Button */}
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearScope}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
            title="Reset to All Branches"
            data-testid="scope-clear-btn"
          >
            <X size={12} />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        )}

        {/* Active Scope Badge */}
        <div className="hidden md:flex items-center">
          {!hasActiveFilter ? (
            <Badge
              variant="outline"
              className="h-6 text-[11px] font-normal gap-1 bg-muted/30 border-dashed text-muted-foreground"
            >
              <Globe size={11} className="text-primary" />
              All Branches (Company View)
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="h-6 text-[11px] font-semibold gap-1.5 bg-primary/10 text-primary border border-primary/20"
            >
              <Building2 size={11} />
              <span>{selectedBranchObj?.name ?? "Selected Branch"}</span>
              {selectedBranchObj?.city && (
                <span className="text-foreground/70 font-normal">· {selectedBranchObj.city}</span>
              )}
            </Badge>
          )}
        </div>
      </div>

      {/* Right: Search & User Identity */}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenSearch}
          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 border-border/80 bg-card shadow-sm"
          title="Search pages and modules (Ctrl+K or Cmd+K)"
          data-testid="header-command-palette-btn"
        >
          <Search size={13} className="text-primary" />
          <span className="hidden lg:inline font-normal">Search...</span>
          <kbd className="hidden sm:inline-flex text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border/50">
            ⌘K
          </kbd>
        </Button>

        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-border/80">
            <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs">
              {user.name ? user.name.charAt(0).toUpperCase() : <User size={13} />}
            </div>
            <div className="hidden xl:block text-left leading-tight">
              <p className="text-xs font-semibold truncate max-w-[120px] text-foreground">
                {user.name}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
                <Shield size={9} className="text-primary" />
                {user.role}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default AdminScopeHeader;
