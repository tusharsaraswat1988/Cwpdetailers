import { Router } from "express";
import { assertContactIdentityAvailable } from "../lib/contactIdentity";

const router = Router();

router.get("/contact/verify", async (req, res) => {
  try {
    const { phone, email, excludeEntity, excludeId } = req.query as Record<string, string>;

    const exclude = excludeEntity && excludeId
      ? {
        entity: excludeEntity as "customer" | "staff" | "user",
        id: parseInt(excludeId, 10),
      }
      : undefined;

    const result = await assertContactIdentityAvailable(phone, email, exclude);
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    return res.json({
      available: true,
      identity: result.identity,
    });
  } catch (err) {
    req.log.error({ err }, "Contact verify error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
