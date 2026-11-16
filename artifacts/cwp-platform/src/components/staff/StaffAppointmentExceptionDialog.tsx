import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  PhoneOff,
  UserX,
  XCircle,
  HelpCircle,
  Droplets,
  Lock,
  Wrench,
  Loader2,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import type { StaffJob } from "@/lib/staff-jobs";
import { useStaffLanguage } from "@/lib/staffLanguage";

export type AppointmentExceptionOption = {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof AlertTriangle;
  badgeText: string;
};

const EXCEPTION_OPTIONS: AppointmentExceptionOption[] = [
  {
    id: "customer_unreachable",
    title: "Customer Unreachable (संपर्क नहीं हो सका)",
    subtitle: "ग्राहक फोन नहीं उठा रहे या मोबाइल स्विच ऑफ / नॉट रीचेबल है।",
    icon: PhoneOff,
    badgeText: "Unreachable",
  },
  {
    id: "customer_unavailable",
    title: "Customer Unavailable at Location (पते पर कोई नहीं मिला)",
    subtitle: "दिए गए पते पर पहुंचे लेकिन ग्राहक या गाड़ी मौजूद नहीं है।",
    icon: UserX,
    badgeText: "Not on Site",
  },
  {
    id: "customer_refused",
    title: "Customer Refused / Postponed (ग्राहक ने मना किया)",
    subtitle: "ग्राहक ने अभी सर्विस कराने से मना किया या रीशेड्यूल करने को कहा।",
    icon: XCircle,
    badgeText: "Refused",
  },
  {
    id: "scope_mismatch",
    title: "Scope / Condition Mismatch (पैकेज से बाहर काम)",
    subtitle: "गाड़ी बहुत ज्यादा खराब / क्षतिग्रस्त है या बुक की गई सर्विस से अलग है।",
    icon: HelpCircle,
    badgeText: "Scope Mismatch",
  },
  {
    id: "utility_unavailable",
    title: "Water / Power Unavailable (पानी / बिजली नहीं है)",
    subtitle: "धुलाई या सर्विस के लिए आवश्यक पानी या बिजली कनेक्शन उपलब्ध नहीं है।",
    icon: Droplets,
    badgeText: "No Utility",
  },
  {
    id: "access_blocked",
    title: "Site Access Blocked (सोसायटी / गेट में प्रवेश नहीं)",
    subtitle: "गार्ड या गेट द्वारा परिसर में अंदर जाने की अनुमति नहीं मिली।",
    icon: Lock,
    badgeText: "Access Denied",
  },
  {
    id: "other_issue",
    title: "Other Field Issue (अन्य परिचालन समस्या)",
    subtitle: "उपकरण खराबी या कोई अन्य फील्ड आपात समस्या जिसके कारण काम नहीं हो सका।",
    icon: Wrench,
    badgeText: "Other Issue",
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: StaffJob;
  onConfirmException: (reason: string) => Promise<void>;
  isSubmitting?: boolean;
};

export function StaffAppointmentExceptionDialog({
  open,
  onOpenChange,
  job,
  onConfirmException,
  isSubmitting = false,
}: Props) {
  const { isHindi } = useStaffLanguage();
  const [selectedOption, setSelectedOption] = useState<AppointmentExceptionOption | null>(null);
  const [remarks, setRemarks] = useState("");

  const handleClose = () => {
    setSelectedOption(null);
    setRemarks("");
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!selectedOption) return;
    const finalReason = `${selectedOption.id.toUpperCase()}: ${remarks.trim() || selectedOption.title}`;
    await onConfirmException(finalReason);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={openState => { if (!openState) handleClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4" data-testid="appointment-exception-dialog">
        {selectedOption ? (
          /* STEP 2: REMARKS & CONFIRMATION */
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setSelectedOption(null)}
              >
                <ArrowLeft size={16} />
              </Button>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-bold truncate">
                  {selectedOption.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate">
                  {job.customerName} • {job.serviceName ?? job.serviceType}
                </DialogDescription>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 text-xs">
              <p className="font-semibold text-foreground flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                <selectedOption.icon size={15} className="text-amber-700 shrink-0" />
                <span>{selectedOption.title}</span>
              </p>
              <p className="text-muted-foreground">{selectedOption.subtitle}</p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 italic pt-1 border-t border-amber-500/20">
                {isHindi
                  ? "सूचना: यह काम 'Missed / Exception' के रूप में दर्ज होगा। आपकी आज की लिस्ट अपडेट हो जाएगी और एडमिन को सूचित किया जाएगा।"
                  : "Notice: This job will be recorded as Missed / Exception. Your list will be updated and operations notified."}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor={`exception-notes-${job.id}`} className="text-xs font-semibold text-foreground">
                {isHindi ? "विस्तृत कारण / रिमार्क (वैकल्पिक)" : "Detailed Remarks (Optional)"}
              </label>
              <Textarea
                id={`exception-notes-${job.id}`}
                placeholder={
                  isHindi
                    ? "उदा: 3 बार कॉल किया, कोई उत्तर नहीं मिला। दरवाजे पर बेल बजाई पर कोई नहीं आया..."
                    : "Ex: Called 3 times with no answer, rang bell at gate with no response..."
                }
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="text-xs min-h-[75px] resize-none rounded-xl"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-12 text-xs"
                onClick={() => setSelectedOption(null)}
                disabled={isSubmitting}
              >
                {isHindi ? "पीछे जाएं" : "Back"}
              </Button>
              <Button
                className="flex-1 h-12 text-xs font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => void handleConfirm()}
                disabled={isSubmitting}
                data-testid="btn-confirm-appointment-exception"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                    <span>{isHindi ? "दर्ज हो रहा है..." : "Submitting..."}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} className="mr-1.5" />
                    <span>{isHindi ? "एक्सेप्शन दर्ज करें" : "Confirm Exception"}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* STEP 1: SELECT EXCEPTION REASON */
          <div className="space-y-3">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-lg font-bold font-display tracking-tight text-foreground">
                  {isHindi ? "समस्या रिपोर्ट करें / काम नहीं हो सका" : "Report Issue / Unable to Complete"}
                </DialogTitle>
                <Badge variant="outline" className="text-[11px] font-semibold text-primary">
                  {job.scheduledTime || "Today"}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                {job.customerName} • {job.serviceName ?? job.serviceType}
              </DialogDescription>
            </DialogHeader>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {isHindi
                ? "अगर किसी कारणवश यह काम पूरा नहीं हो सका, तो सही कारण चुनें ताकि एडमिन स्थिति समझ सके:"
                : "Select the appropriate reason why this job cannot be executed:"}
            </p>

            <div className="space-y-2 pt-1" data-testid="appointment-exception-options-list">
              {EXCEPTION_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOption(opt)}
                    className="w-full text-left p-3 rounded-xl border border-border/80 bg-card hover:bg-muted/50 text-foreground transition-all flex items-center justify-between gap-3 staff-tap"
                    data-testid={`appointment-exception-${opt.id}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 shrink-0 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                        <Icon size={17} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate leading-tight">
                            {opt.title}
                          </p>
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground shrink-0">
                            {opt.badgeText}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {opt.subtitle}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
