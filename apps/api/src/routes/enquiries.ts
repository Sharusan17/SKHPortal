import { Router } from "express";
import { prisma } from "../db";

const router = Router();

// POST /api/enquiries — general or per-vehicle enquiry.
router.post("/", async (req, res) => {
  const { name, email, phone, division, message, vehicleId } = req.body ?? {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: "name, email and message are required" });
  }
  try {
    const enquiry = await prisma.enquiry.create({
      data: {
        name,
        email,
        phone: phone || null,
        division: division || "general",
        message,
        vehicleId: vehicleId || null,
      },
    });
    res.status(201).json({ id: enquiry.id, createdAt: enquiry.createdAt });
  } catch (err) {
    console.error("POST /api/enquiries failed:", err);
    res.status(500).json({ error: "Could not save enquiry" });
  }
});

export default router;
