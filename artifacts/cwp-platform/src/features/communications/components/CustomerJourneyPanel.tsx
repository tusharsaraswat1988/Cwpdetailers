import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { commApi } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Route } from "lucide-react";

export default function CustomerJourneyPanel() {
  const [customerId, setCustomerId] = useState("");
  const [searchId, setSearchId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["comm-journey", searchId],
    queryFn: () => commApi.getCustomerJourney(searchId!, { sync: true }),
    enabled: searchId != null,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Route size={14} />Customer Journey</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Customer ID" value={customerId} onChange={e => setCustomerId(e.target.value)} type="number" />
          <Button onClick={() => { const id = parseInt(customerId); if (id) setSearchId(id); }} disabled={!customerId}>Load</Button>
          {searchId && <Button variant="outline" onClick={() => refetch()}>Sync</Button>}
        </CardContent>
      </Card>
      {searchId && (
        <Card>
          <CardContent className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
            {isLoading && <p className="text-sm text-muted-foreground">Loading journey…</p>}
            {(data?.items ?? []).map(item => (
              <div key={item.id} className="flex gap-3 p-3 border rounded-lg text-sm">
                <Badge variant="outline" className="shrink-0">{item.source}</Badge>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.occurredAt).toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
            {!isLoading && !data?.items?.length && (
              <p className="text-sm text-muted-foreground text-center py-8">No journey events for customer #{searchId}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
