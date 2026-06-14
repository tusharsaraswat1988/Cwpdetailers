import { Phone, MessageCircle, Mail, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SupervisorContactInfo = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  employeeCode?: string | null;
};

type Props = {
  supervisor: SupervisorContactInfo | null | undefined;
  title?: string;
  description?: string;
  compact?: boolean;
  whatsAppMessage?: string;
  testId?: string;
};

function phoneDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("91") ? digits : `91${digits}`;
}

export function SupervisorContactCard({
  supervisor,
  title = "Your Supervisor",
  description = "For service issues, reach your assigned field supervisor directly.",
  compact = false,
  whatsAppMessage,
  testId = "supervisor-contact-card",
}: Props) {
  if (!supervisor) {
    return (
      <Card data-testid={testId}>
        <CardContent className={`${compact ? "p-4" : "p-5"} text-sm text-muted-foreground`}>
          <p className="font-medium text-foreground mb-1">{title}</p>
          <p>No supervisor assigned yet. Use Support to file a complaint and our team will route it.</p>
        </CardContent>
      </Card>
    );
  }

  const waUrl = `https://wa.me/${phoneDigits(supervisor.phone)}${whatsAppMessage ? `?text=${encodeURIComponent(whatsAppMessage)}` : ""}`;
  const telUrl = `tel:${supervisor.phone}`;

  if (compact) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid={testId}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UserCog size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="font-semibold text-sm truncate">{supervisor.name}</p>
            {supervisor.employeeCode && (
              <p className="text-[10px] text-muted-foreground">{supervisor.employeeCode}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" asChild>
            <a href={telUrl} data-testid="btn-call-supervisor"><Phone size={14} className="mr-1.5" />Call</a>
          </Button>
          <Button size="sm" variant="outline" className="flex-1" asChild>
            <a href={waUrl} target="_blank" rel="noreferrer" data-testid="btn-whatsapp-supervisor">
              <MessageCircle size={14} className="mr-1.5" />WhatsApp
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UserCog size={18} className="text-primary" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-semibold">{supervisor.name}</p>
          {supervisor.employeeCode && (
            <p className="text-xs text-muted-foreground">{supervisor.employeeCode}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">{supervisor.phone}</p>
          {supervisor.email && (
            <p className="text-sm text-muted-foreground">{supervisor.email}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={telUrl} data-testid="btn-call-supervisor"><Phone size={15} className="mr-1.5" />Call</a>
          </Button>
          <Button variant="outline" asChild>
            <a href={waUrl} target="_blank" rel="noreferrer" data-testid="btn-whatsapp-supervisor">
              <MessageCircle size={15} className="mr-1.5" />WhatsApp
            </a>
          </Button>
          {supervisor.email && (
            <Button variant="outline" asChild>
              <a href={`mailto:${supervisor.email}`} data-testid="btn-email-supervisor">
                <Mail size={15} className="mr-1.5" />Email
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
