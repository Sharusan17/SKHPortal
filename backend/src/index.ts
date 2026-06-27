import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./db";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Allow the frontend origin(s). Comma-separate multiple in CORS_ORIGIN.
const origins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors(origins.length ? { origin: origins } : undefined));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "skhportal-backend", time: new Date().toISOString() });
});

// Create an enquiry (used by the frontend enquiry forms).
app.post("/api/enquiries", async (req, res) => {
  const { name, email, phone, division, message } = req.body ?? {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: "name, email and message are required" });
  }
  try {
    const enquiry = await prisma.enquiry.create({
      data: { name, email, phone: phone || null, division: division || "general", message },
    });
    res.status(201).json({ id: enquiry.id, createdAt: enquiry.createdAt });
  } catch (err) {
    console.error("Failed to create enquiry:", err);
    res.status(500).json({ error: "Could not save enquiry" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SKHPortal backend listening on :${PORT}`);
});
