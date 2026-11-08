import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const VEHICLES = [
  { name: "Ford Fiesta 1.0 EcoBoost Zetec", brand: "Ford", price: 8495, year: 2019, mileage: 32140, fuel: "Petrol", gearbox: "Manual", body: "Hatchback", monthly: 159, featured: true },
  { name: "VW Golf 1.5 TSI Match", brand: "Volkswagen", price: 13250, year: 2020, mileage: 28500, fuel: "Petrol", gearbox: "Manual", body: "Hatchback", monthly: 249, featured: true },
  { name: "BMW 320d M Sport", brand: "BMW", price: 16990, year: 2019, mileage: 41200, fuel: "Diesel", gearbox: "Automatic", body: "Saloon", monthly: 319, featured: true },
  { name: "Audi A3 35 TFSI S line", brand: "Audi", price: 18450, year: 2021, mileage: 19800, fuel: "Petrol", gearbox: "Automatic", body: "Hatchback", monthly: 345, featured: true },
  { name: "Vauxhall Corsa SRi", brand: "Vauxhall", price: 7995, year: 2018, mileage: 38600, fuel: "Petrol", gearbox: "Manual", body: "Hatchback", monthly: 149, featured: false },
  { name: "Mercedes A180 AMG Line", brand: "Mercedes-Benz", price: 19250, year: 2021, mileage: 15300, fuel: "Petrol", gearbox: "Automatic", body: "Hatchback", monthly: 359, featured: false },
  { name: "Nissan Qashqai Acenta", brand: "Nissan", price: 12750, year: 2019, mileage: 34900, fuel: "Petrol", gearbox: "Manual", body: "SUV", monthly: 239, featured: false },
  { name: "Toyota Yaris Hybrid", brand: "Toyota", price: 11495, year: 2020, mileage: 22400, fuel: "Hybrid", gearbox: "Automatic", body: "Hatchback", monthly: 215, featured: false },
];

async function main() {
  for (const v of VEHICLES) {
    const slug = slugify(v.name);
    const description = `${v.year} ${v.name} — ${v.mileage.toLocaleString("en-GB")} miles, ${v.fuel}, ${v.gearbox}. Hand-picked and 120-point inspected by SKH Prestige Motors.`;
    await prisma.vehicle.upsert({
      where: { slug },
      update: { ...v, slug, description },
      create: { ...v, slug, description },
    });
  }
  console.log(`Seeded ${VEHICLES.length} vehicles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
