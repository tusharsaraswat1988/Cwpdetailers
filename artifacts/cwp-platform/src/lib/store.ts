import { create } from "zustand";
import { persist } from "zustand/middleware";

type UiSlice = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebar: (v: boolean) => void;
};

type ScopeSlice = {
  activeBranchId: number | null;
  activeFranchiseeId: number | null;
  setActiveBranch: (id: number | null) => void;
  setActiveFranchisee: (id: number | null) => void;
};

type AppStore = UiSlice & ScopeSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebar: (v) => set({ sidebarCollapsed: v }),
      activeBranchId: null,
      activeFranchiseeId: null,
      setActiveBranch: (id) => set({ activeBranchId: id }),
      setActiveFranchisee: (id) => set({ activeFranchiseeId: id }),
    }),
    {
      name: "cwp_app_store",
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        activeBranchId: s.activeBranchId,
        activeFranchiseeId: s.activeFranchiseeId,
      }),
    },
  ),
);
