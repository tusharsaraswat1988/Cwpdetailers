import { ServicesTab } from "./ServicesTab";
import { PackagesTab } from "@/features/products/components/PackagesTab";

/** Solar revenue line — three sellable products only (no pricing engine UI). */
export function SolarCatalogPanel() {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold mb-1">One Time Cleaning</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Single solar panel cleaning — price is quoted at booking based on panel count.
        </p>
        <ServicesTab revenueLine="solar" />
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-1">6 Month Plan</h3>
        <p className="text-xs text-muted-foreground mb-3">Fixed-price solar service plan over six months.</p>
        <PackagesTab packageFilter="solar_6" />
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-1">12 Month Plan</h3>
        <p className="text-xs text-muted-foreground mb-3">Fixed-price solar service plan over twelve months.</p>
        <PackagesTab packageFilter="solar_12" />
      </section>
    </div>
  );
}
