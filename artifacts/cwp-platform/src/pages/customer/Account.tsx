import { useAuth } from "@/lib/auth";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { History, FileText, Car, AlertCircle, User, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const accountLinks = [
  { href: "/customer/history", label: "Service History", description: "Past bookings & photos", icon: History },
  { href: "/customer/invoices", label: "Invoices", description: "Bills & payments due", icon: FileText },
  { href: "/customer/assets", label: "Vehicles & Solar", description: "Manage your assets", icon: Car },
  { href: "/customer/complaints", label: "Support", description: "File or track complaints", icon: AlertCircle },
];

/** Account hub stub — full restructure in Sprint 9 */
export default function CustomerAccount() {
  const { user } = useAuth();

  return (
    <CustomerLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-display font-bold text-2xl">Account</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Profile & settings</p>
        </div>

        <Card data-testid="account-profile-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User size={22} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold">{user?.name ?? "Customer"}</p>
              <p className="text-sm text-muted-foreground">{user?.phone}</p>
              {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {accountLinks.map(({ href, label, description, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="hover:bg-muted/40 transition-colors cursor-pointer" data-testid={`account-link-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </CustomerLayout>
  );
}
