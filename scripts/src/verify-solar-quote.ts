import "./load-env.js";
import { resolveCatalogPricing } from "../../artifacts/api-server/src/lib/catalog/pricingEngine";
import { db, servicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const [svc] = await db.select().from(servicesTable).where(eq(servicesTable.pricingModel, "solar_slab")).limit(1);
  if (!svc) throw new Error("no solar service");

  for (const panels of [10, 30, 31, 100, 120]) {
    const q = await resolveCatalogPricing({ serviceId: svc.id, panelCount: panels, term: "one_time" });
    console.log(`one_time ${panels}p →`, q?.status, q?.solar?.amount ?? q?.message, "gst", q?.pricingType, q?.breakdown);
  }
  for (const panels of [10, 30, 120]) {
    const q = await resolveCatalogPricing({ serviceId: svc.id, panelCount: panels, term: "amc_6" });
    console.log(`amc_6 ${panels}p →`, q?.status, q?.solar?.amount ?? q?.message);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
