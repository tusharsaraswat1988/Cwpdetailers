import React from "react";
import { Link } from "wouter";
import { MaterialSymbol } from "@/lib/design-system/MaterialSymbol";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  MapPin,
  Building2,
  Compass,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Info,
} from "lucide-react";

interface BranchSetupGuidelinesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateAction?: (route: string) => void;
}

export function BranchSetupGuidelinesModal({
  open,
  onOpenChange,
  onNavigateAction,
}: BranchSetupGuidelinesModalProps) {
  const handleNav = (path: string) => {
    onOpenChange(false);
    if (onNavigateAction) {
      onNavigateAction(path);
    } else {
      window.location.href = path;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Branch Setup Guidelines & Operations SOP
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                5 सरल स्टेप्स में नई ब्रांच शुरू करें और कस्टमर सर्विसिबिलिटी एक्टिवेट करें
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Core Architecture Callout Banner */}
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-blue-950 dark:text-blue-300">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>"Expanding to this area soon" क्यों आ रहा था? (The Location Chain)</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            CWP प्लेटफॉर्म में सिर्फ ब्रांच बना देने से कस्टमर बुकिंग चालू नहीं होती। सिस्टम एक 4-स्तरीय सुरक्षा चेन पर काम करता है:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
            <div className="p-2 bg-background/80 rounded-md border text-center font-medium">
              1. Active City<br /><span className="text-[10px] text-muted-foreground font-sans">सक्रिय शहर</span>
            </div>
            <div className="p-2 bg-background/80 rounded-md border text-center font-medium">
              2. Branch (COCO)<br /><span className="text-[10px] text-muted-foreground font-sans">ब्रांच / सर्विस हब</span>
            </div>
            <div className="p-2 bg-background/80 rounded-md border text-center font-medium border-amber-500/50 bg-amber-500/5 text-amber-900 dark:text-amber-300">
              3. Operational Zone<br /><span className="text-[10px] text-muted-foreground font-sans font-semibold">सर्विस दायरा (क्रिटिकल)</span>
            </div>
            <div className="p-2 bg-background/80 rounded-md border text-center font-medium">
              4. Coverage Rules<br /><span className="text-[10px] text-muted-foreground font-sans">पिनकोड / सोसायटियां</span>
            </div>
          </div>
          <p className="text-muted-foreground text-[11px] pt-0.5">
            जब तक आपकी ब्रांच के लिए <strong>Operational Zone</strong> और <strong>Coverage Rules (पिनकोड)</strong> सेट नहीं होंगे, कस्टमर का पता अनसर्विसिबल ही रहेगा।
          </p>
        </div>

        {/* 5-Step Operational Roadmap */}
        <div className="space-y-3 pt-1">
          <h3 className="text-sm font-bold text-foreground flex items-center justify-between">
            <span>Standard Operating Procedure (स्टेप-बाय-स्टेप प्रक्रिया)</span>
            <Badge variant="outline" className="text-[10px] uppercase font-semibold">SOP v4.2</Badge>
          </h3>

          {/* Step 1 */}
          <div className="rounded-xl border p-3.5 bg-card hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  1
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-foreground">City Activation (शहर को एक्टिवेट करें)</h4>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1">Mandatory</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-normal">
                    <strong>Cities & Expansion</strong> पेज पर जाएं। जिस शहर (उदा. Noida) में ब्रांच खोल रहे हैं, उसका स्टेटस <strong>Active Operational</strong> होना अनिवार्य है। यदि वह "Setup In Progress" में है, तो कार्ड पर <strong>"Activate City"</strong> दबाएं।
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-xs h-8"
                onClick={() => handleNav("/admin/cities")}
              >
                Go to Cities <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border p-3.5 bg-card hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  2
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-foreground">Branch Creation & City Linkage (ब्रांच बनाएं व शहर से जोड़ें)</h4>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1">COCO Only</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-normal">
                    <strong>Branches</strong> पेज पर <strong>"+ Add Branch"</strong> दबाएं। नाम, कोड (उदा. NOI-01) डालें और <strong>City ड्रॉपडाउन में सही शहर सिलेक्ट करें</strong>। बिलिंग के लिए <strong>Legal Entity</strong> चुनें।
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-xs h-8"
                onClick={() => onOpenChange(false)}
              >
                Current Page
              </Button>
            </div>
          </div>

          {/* Step 3 - Critical */}
          <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-3.5 hover:border-amber-500/70 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">
                  3
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-amber-950 dark:text-amber-200">
                      Operational Zone & Coverage Rules (ऑपरेशनल दायरा व पिनकोड कवरेज)
                    </h4>
                    <Badge className="bg-amber-600 text-white text-[10px] py-0 px-1.5 inline-flex items-center gap-1">
                      <MaterialSymbol name="bolt" size={12} weight={500} />
                      <span>Most Critical</span>
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-normal">
                    <strong>Operational Zones & Coverage</strong> पेज पर जाएं:
                  </p>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5 pt-0.5">
                    <li><strong>"+ New Operational Zone"</strong> बनाएं और अपनी नई ब्रांच से लिंक करें (उदा. 8 km रेडियस)।</li>
                    <li>ज़ोन कार्ड पर <strong>"Coverage Rules"</strong> पर क्लिक करें और अपने <strong>Pincode (उदा. 201301)</strong> या सोसायटियां जोड़कर स्टेटस <strong>Serviceable</strong> रखें।</li>
                  </ul>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 text-xs h-8"
                onClick={() => handleNav("/admin/operations/zones")}
              >
                Go to Zones <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>

          {/* Step 4 */}
          <div className="rounded-xl border p-3.5 bg-card hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  4
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-foreground">Staff & Manager Allocation (सफाईकर्मी व मैनेजर नियुक्ति)</h4>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1">Prerequisite</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-normal">
                    <strong>Staff & Team</strong> पेज पर जाएं। ब्रांच के लिए कम से कम 1 एक्टिव क्लीनर/स्टाफ असाइन करें। इसके अलावा ब्रांच कार्ड पर <strong>"Assignments"</strong> दबाकर ब्रांच मैनेजर का खाता लिंक करें।
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-xs h-8"
                onClick={() => handleNav("/admin/staff")}
              >
                Go to Staff <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>

          {/* Step 5 */}
          <div className="rounded-xl border p-3.5 bg-card hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">
                  5
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-foreground">Readiness Checklist Verification & Go-Live (सत्यापन व लॉन्च)</h4>
                    <Badge variant="outline" className="text-[10px] py-0 px-1 text-emerald-600 border-emerald-500/40">Final Step</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-normal">
                    ब्रांच कार्ड पर <strong>Checklist</strong> बटन दबाएं। यदि कोई आइटम लाल है, तो उसके सामने दिए गए <strong>Action बटन</strong> पर क्लिक करके उसे ठीक करें। 100% स्कोर होने पर <strong>"Confirm Activation"</strong> दबाएं।
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-xs h-8 text-emerald-600 hover:text-emerald-700"
                onClick={() => onOpenChange(false)}
              >
                Check Readiness
              </Button>
            </div>
          </div>
        </div>

        {/* Pro-Tips & Common Gotchas */}
        <div className="rounded-xl border border-muted bg-muted/30 p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>महत्वपूर्ण सावधानियां (Common Pitfalls):</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>
              <strong>टॉप बार ब्रांच संदर्भ:</strong> जब आप एडमिन में कस्टमर जोड़ते हैं, तो सबसे ऊपर टॉप बार में वही ब्रांच सिलेक्ट होनी चाहिए जिसके लिए आप कस्टमर बना रहे हैं। यदि ऊपर 'Varanasi' चुना है और पिनकोड '201301' (नोएडा) डालेंगे, तो सिस्टम उसे बेमेल मानकर रिजेक्ट कर देगा।
            </li>
            <li>
              <strong>Google Maps Watermark:</strong> यदि आपके मैप पर "For development purposes only" आ रहा है, तो चिंता न करें। आप नीचे मैन्युअल ड्रॉपडाउन से शहर और पिनकोड डालकर भी कस्टमर सेव कर सकते हैं।
            </li>
          </ul>
        </div>

        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close Guidelines
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
