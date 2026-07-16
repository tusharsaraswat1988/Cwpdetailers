import { Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

interface ScheduleSuccessScreenProps {
  requestId: number;
  onScheduleAnother: () => void;
}

export function ScheduleSuccessScreen({ requestId, onScheduleAnother }: ScheduleSuccessScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4" data-testid="schedule-success">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm text-center">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6 mx-auto">
          <CheckCircle size={40} className="text-green-500" aria-hidden />
        </div>
        <h2 className="font-display font-bold text-2xl mb-2">Request Received</h2>
        <p className="text-muted-foreground text-sm mb-1">
          CWP will verify availability and confirm your scheduled service.
        </p>
        <p className="text-sm font-medium mb-8">Request #{requestId}</p>
        <div className="flex flex-col gap-3">
          <Link href={CUSTOMER_ROUTES.scheduledServiceDetail(requestId)}>
            <Button className="w-full h-11">View Scheduled Service</Button>
          </Link>
          <Link href={CUSTOMER_ROUTES.home}>
            <Button variant="outline" className="w-full h-11">Back Home</Button>
          </Link>
          <Button variant="ghost" className="w-full" onClick={onScheduleAnother}>
            Schedule Another Service
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default ScheduleSuccessScreen;
