import { useQuery } from "@tanstack/react-query";
import { commApi } from "../api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "default",
  delivered: "default",
  failed: "destructive",
  consent_blocked: "destructive",
  pending: "secondary",
  queued: "outline",
};

export default function HistoryPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["comm-history"],
    queryFn: commApi.getHistory,
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[80px_1fr_100px_120px] gap-2 p-3 bg-muted/50 text-xs font-medium uppercase text-muted-foreground">
        <span>Channel</span>
        <span>Message</span>
        <span>Status</span>
        <span>Date</span>
      </div>
      <div className="max-h-[520px] overflow-y-auto divide-y">
        {(data ?? []).map(row => (
          <div key={row.id} className="grid grid-cols-[80px_1fr_100px_120px] gap-2 p-3 text-sm items-start">
            <Badge variant="outline" className="text-[10px] w-fit">{row.channel}</Badge>
            <p className="truncate text-muted-foreground">{row.renderedBody}</p>
            <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"} className="text-[10px] w-fit">
              {row.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(row.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </div>
        ))}
        {!data?.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">No message history yet</p>
        )}
      </div>
    </div>
  );
}
