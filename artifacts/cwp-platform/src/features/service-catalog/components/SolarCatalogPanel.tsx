import { ServicesTab } from "./ServicesTab";
import { PackagesTab } from "@/features/products/components/PackagesTab";
import { SolarSlabsTab } from "./SolarSlabsTab";

/** Solar revenue line — products + configurable rate card. */
export function SolarCatalogPanel() {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold mb-1">Rate card</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Panel bands, ₹/panel, minimum billing, and site-visit rules. Quotes on admin, client, and staff all use this table.
        </p>
        <SolarSlabsTab />
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-1">One Time Cleaning</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Single solar panel cleaning — price quoted at booking from the rate card (GST exclusive when configured).
        </p>
        <ServicesTab revenueLine="solar" />
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-1">6 Month Plan</h3>
        <p className="text-xs text-muted-foreground mb-3">
          AMC package shell (visits + validity). Sell price is quoted from panel count × rate card.
        </p>
        <PackagesTab packageFilter="solar_6" />
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-1">12 Month Plan</h3>
        <p className="text-xs text-muted-foreground mb-3">
          AMC package shell (visits + validity). Sell price is quoted from panel count × rate card.
        </p>
        <PackagesTab packageFilter="solar_12" />
      </section>
    </div>
  );
}
