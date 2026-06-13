import { useState, useRef } from "react";
import StaffAppShell from "@/components/layout/StaffAppShell";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { useAuth } from "@/lib/auth";
import { useStaffDcmsAssignments, useVehicleSearch, useCompleteVisit } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Camera, MapPin } from "lucide-react";
import { Link } from "wouter";

type AssignmentRow = {
  assignment: { subscriptionId: number };
  planName: string;
  customerName: string;
  vehicleNumber: string;
  subscription: { status: string; remainingCleanings: number; remainingWashes: number };
  location?: { latitude: number; longitude: number; radiusMeters: number } | null;
};

export default function StaffDailyCleaningPage() {
  const { user } = useAuth();
  const { data: assignments, isLoading } = useStaffDcmsAssignments();
  const [searchReg, setSearchReg] = useState("");
  const [doSearch, setDoSearch] = useState(false);
  const search = useVehicleSearch(searchReg, doSearch);
  const completeVisit = useCompleteVisit();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeSubId, setActiveSubId] = useState<number | null>(null);
  const [visitType, setVisitType] = useState<"cleaning" | "wash">("cleaning");

  const rows = (assignments ?? []) as AssignmentRow[];

  const getGps = (): Promise<{ latitude: number; longitude: number; accuracy: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("GPS not available"));
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 15000 },
      );
    });

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSubId) return;
    try {
      const gps = await getGps();
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await completeVisit.mutateAsync({
            subscriptionId: activeSubId,
            visitType,
            imageBase64: reader.result as string,
            ...gps,
          });
          toast({ title: "Visit completed" });
          setActiveSubId(null);
        } catch (err) {
          toast({ title: "Visit rejected", description: (err as Error).message, variant: "destructive" });
        }
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "GPS required", description: "Enable location to complete visit", variant: "destructive" });
    }
    e.target.value = "";
  };

  if (!user?.staffId) {
    return (
      <StaffAccountGate scopeLoading={false} missingStaffLink={!user?.staffId} staffId={user?.staffId ?? null}>
        {null}
      </StaffAccountGate>
    );
  }

  return (
    <StaffAppShell>
      <div className="space-y-4">
        <h1 className="font-display font-bold text-xl">Daily Cleaning</h1>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-1"><Search className="h-4 w-4" /> Vehicle Search</p>
            <div className="flex gap-2">
              <Input
                placeholder="UP65AB1234"
                value={searchReg}
                onChange={e => { setSearchReg(e.target.value.toUpperCase()); setDoSearch(false); }}
              />
              <Button size="sm" onClick={() => setDoSearch(true)}>Search</Button>
            </div>
            {doSearch && search.isSuccess && search.data ? (
              <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                <p className="font-semibold">{(search.data as { customer?: { name?: string } }).customer?.name ?? "Found"}</p>
                <p>{(search.data as { vehicle?: { registrationNumber?: string } }).vehicle?.registrationNumber}</p>
                {(search.data as { assigned?: boolean }).assigned === false && (
                  <p className="text-destructive text-xs mt-1">Not assigned to you</p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div>
          <h2 className="font-semibold mb-2">My Assignments</h2>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assigned subscriptions</p>
          ) : (
            <div className="space-y-3">
              {rows.map(row => (
                <Card key={row.assignment.subscriptionId}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{row.customerName}</p>
                        <p className="text-sm">{row.vehicleNumber}</p>
                        {row.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {row.location.radiusMeters}m radius
                          </p>
                        )}
                      </div>
                      <Badge>{row.subscription.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.subscription.remainingCleanings} cleanings · {row.subscription.remainingWashes} washes left
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={visitType === "cleaning" ? "default" : "outline"}
                        onClick={() => { setVisitType("cleaning"); setActiveSubId(row.assignment.subscriptionId); fileRef.current?.click(); }}
                        disabled={row.subscription.remainingCleanings <= 0 || completeVisit.isPending}
                      >
                        <Camera className="h-3 w-3 mr-1" /> Cleaning
                      </Button>
                      <Button
                        size="sm"
                        variant={visitType === "wash" ? "default" : "outline"}
                        onClick={() => { setVisitType("wash"); setActiveSubId(row.assignment.subscriptionId); fileRef.current?.click(); }}
                        disabled={row.subscription.remainingWashes <= 0 || completeVisit.isPending}
                      >
                        <Camera className="h-3 w-3 mr-1" /> Wash
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />

        <Link href="/staff/jobs" className="text-sm text-primary">← Back to Jobs</Link>
      </div>
    </StaffAppShell>
  );
}
