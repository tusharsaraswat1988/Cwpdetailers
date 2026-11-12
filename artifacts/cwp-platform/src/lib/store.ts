import { create } from "zustand";
import { persist } from "zustand/middleware";

type UiSlice = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebar: (v: boolean) => void;
};

type ScopeSlice = {
  activeCityId: number | null;
  activeBranchId: number | null;
  activeFranchiseeId: number | null;
  setActiveCity: (id: number | null) => void;
  setActiveBranch: (id: number | null, cityId?: number | null) => void;
  setActiveFranchisee: (id: number | null) => void;
  clearScope: () => void;
};

type AppStore = UiSlice & ScopeSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebar: (v) => set({ sidebarCollapsed: v }),
      activeCityId: null,
      activeBranchId: null,
      activeFranchiseeId: null,
      setActiveCity: (id) => set({ activeCityId: id }),
      setActiveBranch: (id, cityId) => set((s) => ({
        activeBranchId: id,
        activeCityId: cityId !== undefined ? cityId : s.activeCityId,
      })),
      setActiveFranchisee: (id) => set({ activeFranchiseeId: id }),
      clearScope: () => set({ activeCityId: null, activeBranchId: null, activeFranchiseeId: null }),
    }),
    {
      name: "cwp_app_store",
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        activeCityId: s.activeCityId,
        activeBranchId: s.activeBranchId,
        activeFranchiseeId: s.activeFranchiseeId,
      }),
    },
  ),
);
