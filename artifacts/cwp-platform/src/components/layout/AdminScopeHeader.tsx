import { useMemo, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { switchActiveBranch } from "@/lib/branchScopeBridge";
import {
  Building2,
  Search,
  User,
  Shield,
  Loader2,
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
import { MaterialSymbol } from "@/lib/design-system/MaterialSymbol";
import {
  AdminIntelligenceDrawer,
  openAdminIntelligencePlaybook,
} from "@/components/admin/intelligence";

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
  const queryClient = useQueryClient();
  const activeBranchId = useAppStore((s) => s.activeBranchId);
  const [isSwitching, setIsSwitching] = useState(false);

  // Fetch Authorized Branches for logged-in user
  const { data: branchesData = [], isLoading: isLoadingBranches } = useQuery<Branch[]>({
    queryKey: ["/api/branch-assignments/my-branches"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/branch-assignments/my-branches", { credentials: "include" });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : json?.data ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const branches: Branch[] = useMemo(() => {
    return branchesData;
  }, [branchesData]);

  // Auto-select valid branch if current activeBranchId is missing or unauthorized
  useEffect(() => {
    if (branches.length > 0) {
      const isCurrentValid = activeBranchId !== null && branches.some((b) => b.id === activeBranchId);
      if (!isCurrentValid) {
        const first = branches[0];
        switchActiveBranch(queryClient, first.id, first.cityId ?? null, {
          silent: true,
          branchName: first.name,
          cityName: first.city,
        });
      }
    }
  }, [branches, activeBranchId, queryClient]);

  const selectedBranchObj = useMemo(
    () => branches.find((b) => b.id === activeBranchId),
    [branches, activeBranchId],
  );

  const handleBranchChange = (val: string) => {
    const branchId = Number(val);
    const branch = branches.find((b) => b.id === branchId);
    if (branch && branch.id !== activeBranchId) {
      setIsSwitching(true);
      switchActiveBranch(queryClient, branch.id, branch.cityId ?? null, {
        branchName: branch.name,
        cityName: branch.city,
      });
      setTimeout(() => setIsSwitching(false), 400);
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
      {/* Left: Primary Operational Branch Selector */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1.5 bg-card border border-border/80 rounded-lg px-2.5 py-1 shadow-sm">
          <Building2 size={14} className="text-primary shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Branch:</span>
          {isLoadingBranches ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin text-primary" />
              <span>Loading branches...</span>
            </div>
          ) : branches.length === 0 ? (
            <span className="text-xs text-muted-foreground px-1 italic">No authorized branch</span>
          ) : (
            <Select
              value={activeBranchId ? String(activeBranchId) : String(branches[0]?.id)}
              onValueChange={handleBranchChange}
            >
              <SelectTrigger
                className="h-7 w-[210px] sm:w-[250px] md:w-[280px] text-xs font-medium border-0 shadow-none px-1.5 focus:ring-0 focus:ring-offset-0 bg-transparent"
                data-testid="scope-branch-select"
              >
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={String(branch.id)}>
                    <span className="font-medium text-foreground">{branch.name}</span>
                    {branch.city && branch.city !== branch.name && (
                      <span className="text-muted-foreground ml-1.5 text-[11px]">({branch.city})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isSwitching && (
            <Loader2 size={12} className="animate-spin text-primary shrink-0 ml-1" />
          )}
        </div>

        {/* Active Scope Badge (Explicit Branch & City context) */}
        {selectedBranchObj && (
          <div className="hidden md:flex items-center">
            <Badge
              variant="secondary"
              className="h-6 text-[11px] font-semibold gap-1.5 bg-primary/10 text-primary border border-primary/20"
              data-testid="scope-active-branch-badge"
            >
              <Building2 size={11} />
              <span>{selectedBranchObj.name}</span>
              {selectedBranchObj.city && (
                <span className="text-foreground/70 font-normal">· {selectedBranchObj.city}</span>
              )}
            </Badge>
          </div>
        )}
      </div>

      {/* Right: Search & User Identity */}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openAdminIntelligencePlaybook()}
          className="h-7 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1.5 border-primary/30 bg-primary/5 shadow-sm"
          title="Operations Intelligence & SOP Playbook"
          data-testid="header-intelligence-playbook-btn"
        >
          <MaterialSymbol name="psychology" size={15} className="text-primary" />
          <span className="hidden md:inline font-semibold">Playbook & SOPs</span>
        </Button>

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

      <AdminIntelligenceDrawer />
    </header>
  );
}

export default AdminScopeHeader;
