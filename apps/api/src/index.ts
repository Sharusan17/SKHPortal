import "dotenv/config";
import express from "express";
import cors from "cors";
import vehicles from "./routes/vehicles";
import enquiries from "./routes/enquiries";
import reservations from "./routes/reservations";

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

app.use("/api/vehicles", vehicles);
app.use("/api/enquiries", enquiries);
app.use("/api/reservations", reservations);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SKHPortal backend listening on :${PORT}`);
});
