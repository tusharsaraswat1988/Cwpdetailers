import { useQuery } from "@tanstack/react-query";
import { commApi } from "@/features/communications/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Mail, Smartphone, Bell } from "lucide-react";

const CHANNEL_ICONS: Record<string, typeof MessageSquare> = {
  sms: Smartphone,
  email: Mail,
  whatsapp: MessageSquare,
  in_app: Bell,
  push: Bell,
};

export default function CommunicationTimeline({ customerId }: { customerId: number }) {
  const { data: events, isLoading } = useQuery({
    queryKey: ["comm-timeline", customerId],
    queryFn: () => commApi.getTimeline(customerId),
  });

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;

  if (!events?.length) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No communication history yet</p>;
  }

  return (
    <div className="space-y-2">
      {events.map(e => {
        const Icon = CHANNEL_ICONS[e.channel] ?? MessageSquare;
        return (
          <div key={e.id} className="flex gap-3 p-3 rounded-lg border">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon size={14} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge variant="outline" className="text-[10px]">{e.channel}</Badge>
                <Badge variant={e.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">{e.status}</Badge>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {new Date(e.sentAt ?? e.createdAt).toLocaleString("en-IN")}
                </span>
              </div>
              <p className="text-sm line-clamp-2">{e.renderedBody}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
