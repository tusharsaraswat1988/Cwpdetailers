import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AdminIntelligencePlaybook } from "./AdminIntelligencePlaybook";

export function AdminIntelligenceDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [initialWorkflow, setInitialWorkflow] = useState<string>("branch_creation");

  useEffect(() => {
    const handleOpen = (e: CustomEvent<{ workflowKey?: string }>) => {
      if (e.detail?.workflowKey) {
        setInitialWorkflow(e.detail.workflowKey);
      }
      setIsOpen(true);
    };

    window.addEventListener("cwp:open-intelligence-playbook" as any, handleOpen);
    return () => {
      window.removeEventListener("cwp:open-intelligence-playbook" as any, handleOpen);
    };
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl p-0 gap-0 border-l border-border/80 shadow-2xl flex flex-col z-[100]"
        data-testid="admin-intelligence-drawer"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Admin & Manager Operations Playbook</SheetTitle>
          <SheetDescription>
            Interactive operations guides and walkthrough assistance for core workflows
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          <AdminIntelligencePlaybook
            initialWorkflow={initialWorkflow}
            onClose={() => setIsOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Utility to open the intelligence drawer from any screen or button */
export function openAdminIntelligencePlaybook(workflowKey?: string) {
  window.dispatchEvent(
    new CustomEvent("cwp:open-intelligence-playbook", {
      detail: { workflowKey },
    })
  );
}
