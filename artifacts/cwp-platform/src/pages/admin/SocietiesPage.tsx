import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Layers,
  Shield,
  Car,
  Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useSocieties,
  useSociety,
  useCreateSociety,
  useCreateSocietyTower,
  type ResidentialSociety,
} from "@/features/societies/api";
import { useMasterList, type City } from "@/features/master-data/api";

export default function SocietiesPage() {
  const { toast } = useToast();
  const [selectedCityId, setSelectedCityId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeSocietyId, setActiveSocietyId] = useState<number | null>(null);

  // Queries
  const citiesQuery = useMasterList<City>("cities");
  const societiesQuery = useSocieties({
    cityId: selectedCityId !== "all" ? parseInt(selectedCityId, 10) : undefined,
    search: search.trim() || undefined,
  });

  const activeSocietyQuery = useSociety(activeSocietyId);
  const createSocietyMutation = useCreateSociety();
  const createTowerMutation = useCreateSocietyTower();

  // Create Society Form State
  const [newCityId, setNewCityId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPincode, setNewPincode] = useState("");
  const [newGateNotes, setNewGateNotes] = useState("");
  const [initialTowers, setInitialTowers] = useState("");

  // Add Tower Form State
  const [towerName, setTowerName] = useState("");
  const [towerFloors, setTowerFloors] = useState("");
  const [towerFlats, setTowerFlats] = useState("");
  const [parkingLevels, setParkingLevels] = useState("B1, B2");

  const handleCreateSociety = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityId || !newName.trim() || !newAddress.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please fill in City, Society Name, and Address.",
        variant: "destructive",
      });
      return;
    }

    try {
      const towersArray = initialTowers
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);

      await createSocietyMutation.mutateAsync({
        cityId: parseInt(newCityId, 10),
        name: newName.trim(),
        code: newCode.trim() || undefined,
        address: newAddress.trim(),
        pincode: newPincode.trim() || undefined,
        gateSecurityNotes: newGateNotes.trim() || undefined,
        initialTowers: towersArray.length > 0 ? towersArray : undefined,
      });

      toast({
        title: "Society created successfully",
        description: `${newName.trim()} has been registered with ${towersArray.length} towers.`,
      });

      setCreateDialogOpen(false);
      setNewCityId("");
      setNewName("");
      setNewCode("");
      setNewAddress("");
      setNewPincode("");
      setNewGateNotes("");
      setInitialTowers("");
    } catch (err) {
      toast({
        title: "Failed to create society",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleAddTower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSocietyId || !towerName.trim()) {
      toast({
        title: "Tower name required",
        variant: "destructive",
      });
      return;
    }

    try {
      await createTowerMutation.mutateAsync({
        societyId: activeSocietyId,
        body: {
          name: towerName.trim(),
          totalFloors: towerFloors ? parseInt(towerFloors, 10) : undefined,
          totalFlats: towerFlats ? parseInt(towerFlats, 10) : undefined,
          parkingLevels: parkingLevels.trim() || undefined,
        },
      });

      toast({
        title: "Tower added",
        description: `${towerName.trim()} has been added to the society.`,
      });

      setTowerName("");
      setTowerFloors("");
      setTowerFlats("");
      setParkingLevels("B1, B2");
    } catch (err) {
      toast({
        title: "Failed to add tower",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">
                Residential Societies & Towers
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Configure high-rise residential apartment communities, towers, and basement parking layouts for daily cleaning operations.
            </p>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="shrink-0 flex items-center gap-2"
            data-testid="btn-add-society"
          >
            <Plus className="h-4 w-4" />
            <span>Add Society</span>
          </Button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card p-3 rounded-xl border shadow-xs">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by society name, sector, address..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={selectedCityId} onValueChange={setSelectedCityId}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {citiesQuery.data?.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Societies Grid */}
        {societiesQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-44 rounded-xl border bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : societiesQuery.data?.data?.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-card space-y-3">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="text-base font-semibold text-foreground">No societies found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {search || selectedCityId !== "all"
                ? "No residential societies match your active filters."
                : "No residential societies have been registered yet. Add your first society to enable high-rise cleaning operations."}
            </p>
            <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add First Society
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {societiesQuery.data?.data?.map(soc => (
              <div
                key={soc.id}
                className="rounded-xl border bg-card p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-foreground leading-snug">
                        {soc.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-xs font-mono">
                          {soc.code}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {soc.cityName || "Noida"}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant={soc.isActive ? "default" : "destructive"}>
                      {soc.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="line-clamp-2">{soc.address}</p>
                  </div>

                  {soc.gateSecurityNotes ? (
                    <div className="flex items-start gap-1.5 text-xs bg-amber-500/10 text-amber-900 dark:text-amber-300 p-2 rounded-lg border border-amber-500/20">
                      <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <p className="line-clamp-2">{soc.gateSecurityNotes}</p>
                    </div>
                  ) : null}
                </div>

                <div className="pt-4 mt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      {soc.totalTowers ?? 0} Towers
                    </span>
                    <span className="flex items-center gap-1">
                      <Car className="h-3.5 w-3.5" />
                      {soc.totalFlats ?? 0} Flats
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveSocietyId(soc.id)}
                  >
                    View Towers
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Society Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Register Residential Society</DialogTitle>
              <DialogDescription>
                Add a new residential complex or society to support tower-level and basement parking operations.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateSociety} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Select value={newCityId} onValueChange={setNewCityId}>
                    <SelectTrigger id="city" className="mt-1">
                      <SelectValue placeholder="Select city..." />
                    </SelectTrigger>
                    <SelectContent>
                      {citiesQuery.data?.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="code">Society Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g. GC2-14"
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="name">Society / Complex Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Gaur City 2 - 14th Avenue"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="address">Full Address *</Label>
                <Textarea
                  id="address"
                  placeholder="e.g. Sector 16C, Greater Noida West, Gautam Buddha Nagar"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    placeholder="e.g. 201009"
                    value={newPincode}
                    onChange={e => setNewPincode(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="initial-towers">Initial Towers (Comma-separated)</Label>
                  <Input
                    id="initial-towers"
                    placeholder="e.g. Tower 1, Tower 2, Tower 3"
                    value={initialTowers}
                    onChange={e => setInitialTowers(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="gate-notes">Gate Security & Entry Notes</Label>
                <Input
                  id="gate-notes"
                  placeholder="e.g. Cleaner entry via Gate 2 only. Security verification required."
                  value={newGateNotes}
                  onChange={e => setNewGateNotes(e.target.value)}
                  className="mt-1"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createSocietyMutation.isPending}>
                  {createSocietyMutation.isPending ? "Creating..." : "Create Society"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* View / Manage Towers Sheet */}
        <Sheet
          open={Boolean(activeSocietyId)}
          onOpenChange={open => !open && setActiveSocietyId(null)}
        >
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {activeSocietyQuery.data?.name ?? "Society Towers"}
              </SheetTitle>
              <SheetDescription>
                {activeSocietyQuery.data?.cityName ? `${activeSocietyQuery.data.cityName} — ` : ""}
                {activeSocietyQuery.data?.address}
              </SheetDescription>
            </SheetHeader>

            <div className="py-6 space-y-6">
              {/* Add New Tower Box */}
              <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-primary" />
                  <span>Add Tower to Society</span>
                </h4>

                <form onSubmit={handleAddTower} className="space-y-3">
                  <div>
                    <Label htmlFor="t-name">Tower / Block Name *</Label>
                    <Input
                      id="t-name"
                      placeholder="e.g. Tower 4 or Block B"
                      value={towerName}
                      onChange={e => setTowerName(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="t-floors">Total Floors</Label>
                      <Input
                        id="t-floors"
                        placeholder="e.g. 24"
                        type="number"
                        value={towerFloors}
                        onChange={e => setTowerFloors(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="t-flats">Total Flats</Label>
                      <Input
                        id="t-flats"
                        placeholder="e.g. 192"
                        type="number"
                        value={towerFlats}
                        onChange={e => setTowerFlats(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="t-parking">Parking Levels</Label>
                    <Input
                      id="t-parking"
                      placeholder="e.g. B1, B2, Podium"
                      value={parkingLevels}
                      onChange={e => setParkingLevels(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    className="w-full"
                    disabled={createTowerMutation.isPending}
                  >
                    {createTowerMutation.isPending ? "Adding Tower..." : "Add Tower"}
                  </Button>
                </form>
              </div>

              {/* Existing Towers List */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground flex items-center justify-between">
                  <span>Registered Towers</span>
                  <Badge variant="outline">
                    {activeSocietyQuery.data?.towers?.length ?? 0} Towers
                  </Badge>
                </h4>

                {activeSocietyQuery.data?.towers?.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No towers added yet. Use the form above to add towers.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeSocietyQuery.data?.towers?.map(tower => (
                      <div
                        key={tower.id}
                        className="p-3 rounded-lg border bg-card flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold text-sm text-foreground">
                            {tower.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tower.totalFloors ? `${tower.totalFloors} floors • ` : ""}
                            {tower.totalFlats ? `${tower.totalFlats} flats • ` : ""}
                            Parking: {tower.parkingLevels || "Standard"}
                          </p>
                        </div>
                        <Badge variant={tower.isActive ? "secondary" : "outline"} className="text-xs">
                          {tower.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
}
