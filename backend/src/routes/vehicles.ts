import { Router } from "express";
import { prisma } from "../db";

const router = Router();

// GET /api/vehicles — all available vehicles (newest/featured first).
router.get("/", async (_req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { status: "AVAILABLE" },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      include: { images: { orderBy: { position: "asc" } } },
    });
    res.json(vehicles);
  } catch (err) {
    console.error("GET /api/vehicles failed:", err);
    res.status(500).json({ error: "Could not load vehicles" });
  }
});

// GET /api/vehicles/:slug — a single vehicle (any status, so its page still loads).
router.get("/:slug", async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { slug: req.params.slug },
      include: { images: { orderBy: { position: "asc" } } },
    });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    res.json(vehicle);
  } catch (err) {
    console.error("GET /api/vehicles/:slug failed:", err);
    res.status(500).json({ error: "Could not load vehicle" });
  }
});

export default router;
