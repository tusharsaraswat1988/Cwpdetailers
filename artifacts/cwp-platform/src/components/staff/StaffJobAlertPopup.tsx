import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Briefcase, X } from "lucide-react";
import type { StaffJobAlert } from "@/hooks/useStaffJobAlerts";
import { motion, AnimatePresence } from "framer-motion";

export function StaffJobAlertPopup({
  alert,
  onDismiss,
}: {
  alert: StaffJobAlert | null;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="fixed top-14 left-0 right-0 z-50 px-3 pointer-events-none"
          data-testid="staff-job-alert-popup"
        >
          <div className="max-w-md mx-auto pointer-events-auto rounded-2xl border-2 border-primary/40 bg-primary text-primary-foreground shadow-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Briefcase size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm">New job assigned</p>
                <p className="text-sm mt-0.5 opacity-95 truncate">
                  {alert.customerName ?? "Customer"}
                  {alert.serviceName ? ` · ${alert.serviceName}` : ""}
                  {alert.scheduledTime ? ` · ${alert.scheduledTime}` : ""}
                </p>
                <p className="text-xs mt-1 opacity-80">Tap below to open job actions on Today</p>
                <div className="flex gap-2 mt-3">
                  <Link href="/staff/dashboard">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-9 font-semibold bg-white text-primary hover:bg-white/90"
                      onClick={onDismiss}
                    >
                      Open Today
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 text-primary-foreground hover:bg-white/10"
                    onClick={onDismiss}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-white/10 shrink-0"
                aria-label="Dismiss"
                onClick={onDismiss}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
