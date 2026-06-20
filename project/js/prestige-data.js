// SKH Prestige Motors — stock data (placeholder figures, illustrative only)
window.SKH = window.SKH || {};

window.SKH.CARS = [
  { id: 1, name: "Ford Fiesta 1.0 EcoBoost Zetec", brand: "Ford", price: 8495, year: 2019, mileage: 32140, fuel: "Petrol", gearbox: "Manual", body: "Hatchback", monthly: 159 },
  { id: 2, name: "VW Golf 1.5 TSI Match", brand: "Volkswagen", price: 13250, year: 2020, mileage: 28500, fuel: "Petrol", gearbox: "Manual", body: "Hatchback", monthly: 249 },
  { id: 3, name: "BMW 320d M Sport", brand: "BMW", price: 16990, year: 2019, mileage: 41200, fuel: "Diesel", gearbox: "Automatic", body: "Saloon", monthly: 319 },
  { id: 4, name: "Audi A3 35 TFSI S line", brand: "Audi", price: 18450, year: 2021, mileage: 19800, fuel: "Petrol", gearbox: "Automatic", body: "Hatchback", monthly: 345 },
  { id: 5, name: "Vauxhall Corsa SRi", brand: "Vauxhall", price: 7995, year: 2018, mileage: 38600, fuel: "Petrol", gearbox: "Manual", body: "Hatchback", monthly: 149 },
  { id: 6, name: "Mercedes A180 AMG Line", brand: "Mercedes-Benz", price: 19250, year: 2021, mileage: 15300, fuel: "Petrol", gearbox: "Automatic", body: "Hatchback", monthly: 359 },
  { id: 7, name: "Nissan Qashqai Acenta", brand: "Nissan", price: 12750, year: 2019, mileage: 34900, fuel: "Petrol", gearbox: "Manual", body: "SUV", monthly: 239 },
  { id: 8, name: "Toyota Yaris Hybrid", brand: "Toyota", price: 11495, year: 2020, mileage: 22400, fuel: "Hybrid", gearbox: "Automatic", body: "Hatchback", monthly: 215 }
];

window.SKH.BODY_TYPES = ["SUV", "Hatchback", "Saloon", "Estate", "Coupe", "Convertible", "MPV"];

window.SKH.BRANDS = ["Ford", "Volkswagen", "BMW", "Audi", "Mercedes-Benz", "Toyota", "Nissan", "Vauxhall"];

window.SKH.PRICE_BANDS = [
  { label: "No max", value: 999999 },
  { label: "Up to £8,000", value: 8000 },
  { label: "Up to £12,000", value: 12000 },
  { label: "Up to £15,000", value: 15000 },
  { label: "Up to £20,000", value: 20000 }
];

window.SKH.fmt = (n) => "£" + n.toLocaleString("en-GB");
window.SKH.fmtMiles = (n) => n.toLocaleString("en-GB") + " mi";
