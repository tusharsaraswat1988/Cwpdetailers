import { Router } from "express";
import { db } from "@workspace/db";
import { servicesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/services", async (req, res) => {
  try {
    const { category, isActive } = req.query as Record<string, string>;
    const conditions = [];
    if (category) conditions.push(eq(servicesTable.category, category as (typeof servicesTable.category)["_"]["data"]));
    if (isActive !== undefined) conditions.push(eq(servicesTable.isActive, isActive === "true"));
    const data = await db.select().from(servicesTable).where(conditions.length ? and(...conditions) : undefined);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List services error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/services", async (req, res) => {
  try {
    const { name, description, category, basePrice, durationMinutes, isActive, imageUrl, features } = req.body;
    if (!name || !category || basePrice === undefined) {
      return res.status(400).json({ error: "name, category, and basePrice are required" });
    }
    const [service] = await db.insert(servicesTable).values({
      name, description, category, basePrice: basePrice.toString(),
      durationMinutes, isActive: isActive !== false, imageUrl, features: features || [],
    }).returning();
    return res.status(201).json(service);
  } catch (err) {
    req.log.error({ err }, "Create service error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/services/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, category, basePrice, durationMinutes, isActive, imageUrl, features } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (basePrice !== undefined) updateData.basePrice = basePrice.toString();
    if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (features !== undefined) updateData.features = features;
    const [service] = await db.update(servicesTable).set(updateData).where(eq(servicesTable.id, id)).returning();
    if (!service) return res.status(404).json({ error: "Service not found" });
    return res.json(service);
  } catch (err) {
    req.log.error({ err }, "Update service error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/services/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(servicesTable).where(eq(servicesTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete service error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
