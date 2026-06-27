// SKHPortal frontend — backend API client.

import type { Vehicle } from "./cars";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Reads (used in server components) ──

export async function getVehicles(): Promise<Vehicle[]> {
  const res = await fetch(`${API_URL}/api/vehicles`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load vehicles");
  return res.json();
}

export async function getVehicle(slug: string): Promise<Vehicle | null> {
  const res = await fetch(`${API_URL}/api/vehicles/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load vehicle");
  return res.json();
}

// ── Writes (used in the browser from client components) ──

export type EnquiryInput = {
  name: string;
  email: string;
  phone?: string;
  division?: string;
  message: string;
  vehicleId?: string;
};

export async function createEnquiry(input: EnquiryInput): Promise<void> {
  const res = await fetch(`${API_URL}/api/enquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Could not send enquiry");
}

export type ReservationInput = {
  name: string;
  email: string;
  phone: string;
  vehicleId: string;
};

export async function createReservation(input: ReservationInput): Promise<{ ref: string }> {
  const res = await fetch(`${API_URL}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Could not create reservation");
  return res.json();
}
