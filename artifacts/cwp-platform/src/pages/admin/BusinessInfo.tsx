import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Mail, Phone, MapPin, Globe, Users, Save, Info,
} from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useBranding } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface BusinessInfo {
  id: number;
  businessName: string;
  ownerName: string;
  businessType: string;
  gstNumber?: string | null;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber?: string | null;
  alternatePhone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pinCode: string;
  country: string;
  services?: string[] | null;
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  website?: string | null;
  updatedAt: string;
}

const DEFAULT_SERVICES = [
  "Car Wash",
  "Solar Panel Cleaning & Maintenance",
  "Vehicle Detailing",
  "Ceramic Coating",
  "Graphene Coating",
  "PPF",
  "Bike Detailing",
  "Dent & Paint Services",
];

async function apiGet(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPut(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon size={14} className="text-primary" />
        </div>
        <h2 className="font-display font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function BusinessInfoPage() {
  const branding = useBranding();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: info, isLoading } = useQuery<BusinessInfo>({
    queryKey: ["business-info"],
    queryFn: () => apiGet("/api/business-info"),
    staleTime: 60_000,
  });

  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    businessType: "",
    gstNumber: "",
    supportEmail: "",
    supportPhone: "",
    whatsappNumber: "",
    alternatePhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pinCode: "",
    country: "India",
    website: "",
    facebook: "",
    instagram: "",
    youtube: "",
    linkedin: "",
    twitter: "",
    servicesRaw: "",
  });

  useEffect(() => {
    if (info) {
      setForm({
        businessName: info.businessName ?? "",
        ownerName: info.ownerName ?? "",
        businessType: info.businessType ?? "",
        gstNumber: info.gstNumber ?? "",
        supportEmail: info.supportEmail ?? "",
        supportPhone: info.supportPhone ?? "",
        whatsappNumber: info.whatsappNumber ?? "",
        alternatePhone: info.alternatePhone ?? "",
        addressLine1: info.addressLine1 ?? "",
        addressLine2: info.addressLine2 ?? "",
        city: info.city ?? "",
        state: info.state ?? "",
        pinCode: info.pinCode ?? "",
        country: info.country ?? "India",
        website: info.website ?? "",
        facebook: info.facebook ?? "",
        instagram: info.instagram ?? "",
        youtube: info.youtube ?? "",
        linkedin: info.linkedin ?? "",
        twitter: info.twitter ?? "",
        servicesRaw: (info.services ?? DEFAULT_SERVICES).join("\n"),
      });
    }
  }, [info]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const services = form.servicesRaw
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean);

      return apiPut("/api/admin/business-info", {
        businessName: form.businessName,
        ownerName: form.ownerName,
        businessType: form.businessType,
        gstNumber: form.gstNumber || null,
        supportEmail: form.supportEmail,
        supportPhone: form.supportPhone,
        whatsappNumber: form.whatsappNumber || null,
        alternatePhone: form.alternatePhone || null,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2 || null,
        city: form.city,
        state: form.state,
        pinCode: form.pinCode,
        country: form.country,
        website: form.website || null,
        facebook: form.facebook || null,
        instagram: form.instagram || null,
        youtube: form.youtube || null,
        linkedin: form.linkedin || null,
        twitter: form.twitter || null,
        services,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-info"] });
      toast({ title: "Saved", description: "Business information updated successfully." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const f = (k: keyof typeof form) => ({
    id: k,
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value })),
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Business Information</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Single source of truth for all business details. Updates propagate to Contact Us, Footer, SEO schemas, and invoices.
            </p>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2"
          >
            <Save size={15} />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Info notice */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
          <Info size={15} className="text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            This information automatically populates the <strong className="text-foreground">Contact Us</strong> page,{" "}
            <strong className="text-foreground">website footer</strong>,{" "}
            <strong className="text-foreground">Google Business schema</strong>, and{" "}
            <strong className="text-foreground">email templates</strong>. No duplicate storage.
          </p>
        </div>

        {/* Business Identity */}
        <Section icon={Building2} title="Business Identity">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="businessName" className="text-xs text-muted-foreground mb-1">Business Name *</Label>
              <Input {...f("businessName")} placeholder={branding.companyName || branding.brandName || "Business name"} />
            </div>
            <div>
              <Label htmlFor="ownerName" className="text-xs text-muted-foreground mb-1">Owner Name *</Label>
              <Input {...f("ownerName")} placeholder="Tushar Saraswat" />
            </div>
            <div>
              <Label htmlFor="businessType" className="text-xs text-muted-foreground mb-1">Business Type *</Label>
              <Input {...f("businessType")} placeholder="Proprietorship" />
            </div>
            <div>
              <Label htmlFor="gstNumber" className="text-xs text-muted-foreground mb-1">GST Number (optional)</Label>
              <Input {...f("gstNumber")} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div>
              <Label htmlFor="website" className="text-xs text-muted-foreground mb-1">Website URL</Label>
              <Input {...f("website")} placeholder="https://cwpdetailers.in" type="url" />
            </div>
          </div>
        </Section>

        {/* Contact Details */}
        <Section icon={Mail} title="Contact Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supportEmail" className="text-xs text-muted-foreground mb-1">Support Email *</Label>
              <Input {...f("supportEmail")} type="email" placeholder="cwpdetailers@gmail.com" />
            </div>
            <div>
              <Label htmlFor="supportPhone" className="text-xs text-muted-foreground mb-1">Support Phone *</Label>
              <Input {...f("supportPhone")} placeholder="+91-7054007733" />
            </div>
            <div>
              <Label htmlFor="whatsappNumber" className="text-xs text-muted-foreground mb-1">WhatsApp Number</Label>
              <Input {...f("whatsappNumber")} placeholder="+91-7054007733" />
            </div>
            <div>
              <Label htmlFor="alternatePhone" className="text-xs text-muted-foreground mb-1">Alternate Phone</Label>
              <Input {...f("alternatePhone")} placeholder="+91-XXXXXXXXXX" />
            </div>
          </div>
        </Section>

        {/* Address */}
        <Section icon={MapPin} title="Address">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="addressLine1" className="text-xs text-muted-foreground mb-1">Address Line 1 *</Label>
              <Input {...f("addressLine1")} placeholder="Seer Goverdhanpur, Behind BHU" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="addressLine2" className="text-xs text-muted-foreground mb-1">Address Line 2</Label>
              <Input {...f("addressLine2")} placeholder="Apartment, floor, landmark..." />
            </div>
            <div>
              <Label htmlFor="city" className="text-xs text-muted-foreground mb-1">City *</Label>
              <Input {...f("city")} placeholder="Varanasi" />
            </div>
            <div>
              <Label htmlFor="state" className="text-xs text-muted-foreground mb-1">State *</Label>
              <Input {...f("state")} placeholder="Uttar Pradesh" />
            </div>
            <div>
              <Label htmlFor="pinCode" className="text-xs text-muted-foreground mb-1">PIN Code *</Label>
              <Input {...f("pinCode")} placeholder="221005" />
            </div>
            <div>
              <Label htmlFor="country" className="text-xs text-muted-foreground mb-1">Country</Label>
              <Input {...f("country")} placeholder="India" />
            </div>
          </div>
        </Section>

        {/* Services */}
        <Section icon={Users} title="Services Offered">
          <Label htmlFor="servicesRaw" className="text-xs text-muted-foreground mb-1">
            Services (one per line)
          </Label>
          <Textarea
            {...f("servicesRaw")}
            rows={10}
            className="font-mono text-sm"
            placeholder={DEFAULT_SERVICES.join("\n")}
          />
          <p className="text-xs text-muted-foreground mt-2">
            These populate the About Us page, schema markup, and service listings.
          </p>
        </Section>

        {/* Social Links */}
        <Section icon={Globe} title="Social Links">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="instagram" className="text-xs text-muted-foreground mb-1">Instagram</Label>
              <Input {...f("instagram")} placeholder="https://instagram.com/cwpdetailers" type="url" />
            </div>
            <div>
              <Label htmlFor="facebook" className="text-xs text-muted-foreground mb-1">Facebook</Label>
              <Input {...f("facebook")} placeholder="https://facebook.com/cwpdetailers" type="url" />
            </div>
            <div>
              <Label htmlFor="youtube" className="text-xs text-muted-foreground mb-1">YouTube</Label>
              <Input {...f("youtube")} placeholder="https://youtube.com/@cwpdetailers" type="url" />
            </div>
            <div>
              <Label htmlFor="linkedin" className="text-xs text-muted-foreground mb-1">LinkedIn</Label>
              <Input {...f("linkedin")} placeholder="https://linkedin.com/company/cwpdetailers" type="url" />
            </div>
            <div>
              <Label htmlFor="twitter" className="text-xs text-muted-foreground mb-1">X / Twitter</Label>
              <Input {...f("twitter")} placeholder="https://x.com/cwpdetailers" type="url" />
            </div>
          </div>
        </Section>

        {/* Save button (bottom) */}
        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            size="lg"
            className="gap-2"
          >
            <Save size={16} />
            {saveMutation.isPending ? "Saving..." : "Save All Changes"}
          </Button>
        </div>

        {info?.updatedAt && (
          <p className="text-xs text-muted-foreground text-right">
            Last updated: {new Date(info.updatedAt).toLocaleString("en-IN")}
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
