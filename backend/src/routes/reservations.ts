import { Router } from "express";
import { prisma } from "../db";

const router = Router();

function makeRef(): string {
  return "SKH-" + Math.floor(10000 + Math.random() * 89999);
}

// POST /api/reservations — £99 hold on a vehicle.
router.post("/", async (req, res) => {
  const { name, email, phone, vehicleId } = req.body ?? {};
  if (!name || !email || !phone || !vehicleId) {
    return res.status(400).json({ error: "name, email, phone and vehicleId are required" });
  }
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const reservation = await prisma.reservation.create({
      data: { ref: makeRef(), name, email, phone, vehicleId },
    });
    res.status(201).json({ ref: reservation.ref, createdAt: reservation.createdAt });
  } catch (err) {
    console.error("POST /api/reservations failed:", err);
    res.status(500).json({ error: "Could not create reservation" });
  }
});

export default router;
