// SKH Prestige Motors — vehicle types, UI constants and helpers.
// Vehicle data now comes from the backend API (see lib/api.ts).

export type VehicleImage = {
  id: string;
  url: string;
  alt: string | null;
  position: number;
};

export type Vehicle = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  body: string;
  fuel: string;
  gearbox: string;
  year: number;
  mileage: number;
  price: number;
  monthly: number;
  description: string | null;
  status: "AVAILABLE" | "RESERVED" | "SOLD";
  featured: boolean;
  images: VehicleImage[];
  createdAt: string;
  updatedAt: string;
};

export type PriceBand = { label: string; value: number };

export const BODY_TYPES = ["SUV", "Hatchback", "Saloon", "Estate", "Coupe", "Convertible", "MPV"];

export const BRANDS = ["Ford", "Volkswagen", "BMW", "Audi", "Mercedes-Benz", "Toyota", "Nissan", "Vauxhall"];

export const PRICE_BANDS: PriceBand[] = [
  { label: "No max", value: 999999 },
  { label: "Up to £8,000", value: 8000 },
  { label: "Up to £12,000", value: 12000 },
  { label: "Up to £15,000", value: 15000 },
  { label: "Up to £20,000", value: 20000 },
];

export const fmt = (n: number) => "£" + n.toLocaleString("en-GB");
export const fmtMiles = (n: number) => n.toLocaleString("en-GB") + " mi";

export type Filters = { make: string; model: string; priceMax: number; body: string };

export const EMPTY_FILTERS: Filters = { make: "", model: "", priceMax: 999999, body: "" };

export function filterVehicles(vehicles: Vehicle[], f: Filters): Vehicle[] {
  return vehicles.filter((v) => {
    if (f.make && v.brand !== f.make) return false;
    if (f.body && v.body !== f.body) return false;
    if (f.priceMax && v.price > f.priceMax) return false;
    if (f.model) {
      const q = f.model.toLowerCase();
      if (!v.name.toLowerCase().includes(q) && !v.brand.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// Build a /prestige/stock query string from a partial set of filters.
export function stockQuery(f: Partial<Filters>): string {
  const p = new URLSearchParams();
  if (f.make) p.set("make", f.make);
  if (f.model) p.set("model", f.model);
  if (f.body) p.set("body", f.body);
  if (f.priceMax && f.priceMax < 999999) p.set("priceMax", String(f.priceMax));
  const s = p.toString();
  return s ? `?${s}` : "";
}
