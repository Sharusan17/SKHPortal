// SKH Prestige Motors — stock data (placeholder figures, illustrative only)

export type Car = {
  id: number;
  name: string;
  brand: string;
  price: number;
  year: number;
  mileage: number;
  fuel: string;
  gearbox: string;
  body: string;
  monthly: number;
};

export type PriceBand = { label: string; value: number };

export const CARS: Car[] = [
  { id: 1, name: "Ford Fiesta 1.0 EcoBoost Zetec", brand: "Ford", price: 8495, year: 2019, mileage: 32140, fuel: "Petrol", gearbox: "Manual", body: "Hatchback", monthly: 159 },
  { id: 2, name: "VW Golf 1.5 TSI Match", brand: "Volkswagen", price: 13250, year: 2020, mileage: 28500, fuel: "Petrol", gearbox: "Manual", body: "Hatchback", monthly: 249 },
  { id: 3, name: "BMW 320d M Sport", brand: "BMW", price: 16990, year: 2019, mileage: 41200, fuel: "Diesel", gearbox: "Automatic", body: "Saloon", monthly: 319 },
  { id: 4, name: "Audi A3 35 TFSI S line", brand: "Audi", price: 18450, year: 2021, mileage: 19800, fuel: "Petrol", gearbox: "Automatic", body: "Hatchback", monthly: 345 },
  { id: 5, name: "Vauxhall Corsa SRi", brand: "Vauxhall", price: 7995, year: 2018, mileage: 38600, fuel: "Petrol", gearbox: "Manual", body: "Hatchback", monthly: 149 },
  { id: 6, name: "Mercedes A180 AMG Line", brand: "Mercedes-Benz", price: 19250, year: 2021, mileage: 15300, fuel: "Petrol", gearbox: "Automatic", body: "Hatchback", monthly: 359 },
  { id: 7, name: "Nissan Qashqai Acenta", brand: "Nissan", price: 12750, year: 2019, mileage: 34900, fuel: "Petrol", gearbox: "Manual", body: "SUV", monthly: 239 },
  { id: 8, name: "Toyota Yaris Hybrid", brand: "Toyota", price: 11495, year: 2020, mileage: 22400, fuel: "Hybrid", gearbox: "Automatic", body: "Hatchback", monthly: 215 },
];

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

// Readable URL slug for a car. Names are unique in the current stock, so the
// slug is unique; a later DB-backed phase can add an id suffix if needed.
export function carSlug(car: Car): string {
  return car.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getCarBySlug(slug: string): Car | undefined {
  return CARS.find((c) => carSlug(c) === slug);
}

export function filterCars(cars: Car[], f: Filters): Car[] {
  return cars.filter((c) => {
    if (f.make && c.brand !== f.make) return false;
    if (f.body && c.body !== f.body) return false;
    if (f.priceMax && c.price > f.priceMax) return false;
    if (f.model) {
      const q = f.model.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.brand.toLowerCase().includes(q)) return false;
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
