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

export const FUELS = ["Petrol", "Diesel", "Hybrid", "Electric"];

export const GEARBOXES = ["Manual", "Automatic"];

export const PRICE_BANDS: PriceBand[] = [
  { label: "No max", value: 999999 },
  { label: "Up to £8,000", value: 8000 },
  { label: "Up to £12,000", value: 12000 },
  { label: "Up to £15,000", value: 15000 },
  { label: "Up to £20,000", value: 20000 },
];

export const YEAR_BANDS: PriceBand[] = [
  { label: "Any", value: 0 },
  { label: "2018 or newer", value: 2018 },
  { label: "2019 or newer", value: 2019 },
  { label: "2020 or newer", value: 2020 },
  { label: "2021 or newer", value: 2021 },
];

export const MILEAGE_BANDS: PriceBand[] = [
  { label: "Any", value: 0 },
  { label: "Up to 20,000", value: 20000 },
  { label: "Up to 30,000", value: 30000 },
  { label: "Up to 40,000", value: 40000 },
  { label: "Up to 50,000", value: 50000 },
];

export const fmt = (n: number) => "£" + n.toLocaleString("en-GB");
export const fmtMiles = (n: number) => n.toLocaleString("en-GB") + " mi";

export type Filters = {
  make: string;
  model: string;
  priceMax: number;
  body: string;
  fuel: string;
  gearbox: string;
  yearMin: number;
  mileageMax: number;
};

export const EMPTY_FILTERS: Filters = {
  make: "",
  model: "",
  priceMax: 999999,
  body: "",
  fuel: "",
  gearbox: "",
  yearMin: 0,
  mileageMax: 0,
};

export function filterVehicles(vehicles: Vehicle[], f: Filters): Vehicle[] {
  return vehicles.filter((v) => {
    if (f.make && v.brand !== f.make) return false;
    if (f.body && v.body !== f.body) return false;
    if (f.fuel && v.fuel !== f.fuel) return false;
    if (f.gearbox && v.gearbox !== f.gearbox) return false;
    if (f.priceMax && v.price > f.priceMax) return false;
    if (f.yearMin && v.year < f.yearMin) return false;
    if (f.mileageMax && v.mileage > f.mileageMax) return false;
    if (f.model) {
      const q = f.model.toLowerCase();
      if (!v.name.toLowerCase().includes(q) && !v.brand.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export type SortKey = "newest" | "price-asc" | "price-desc" | "mileage-asc" | "monthly-asc";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "mileage-asc", label: "Mileage: Low to High" },
  { key: "monthly-asc", label: "Monthly: Low to High" },
];

export function sortVehicles(vehicles: Vehicle[], key: SortKey): Vehicle[] {
  const arr = [...vehicles];
  switch (key) {
    case "price-asc": return arr.sort((a, b) => a.price - b.price);
    case "price-desc": return arr.sort((a, b) => b.price - a.price);
    case "mileage-asc": return arr.sort((a, b) => a.mileage - b.mileage);
    case "monthly-asc": return arr.sort((a, b) => a.monthly - b.monthly);
    case "newest":
    default: return arr.sort((a, b) => b.year - a.year);
  }
}

export function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.make) n++;
  if (f.model) n++;
  if (f.body) n++;
  if (f.fuel) n++;
  if (f.gearbox) n++;
  if (f.priceMax < 999999) n++;
  if (f.yearMin) n++;
  if (f.mileageMax) n++;
  return n;
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
