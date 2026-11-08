import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrestigeNav from "@/components/PrestigeNav";
import SiteFooter from "@/components/SiteFooter";
import CarView from "./CarView";
import { getVehicle, getVehicles } from "@/lib/api";
import { fmt, fmtMiles, type Vehicle } from "@/lib/cars";
import "../../prestige.css";
import "../stock.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const car = await getVehicle(params.slug);
  if (!car) return { title: "Car not found — SKH Prestige Motors" };
  return {
    title: `${car.name} — ${fmt(car.price)} — SKH Prestige Motors`,
    description: `${car.name}. ${car.year} · ${fmtMiles(car.mileage)} · ${car.fuel} · ${car.gearbox}. ${fmt(
      car.price
    )} at SKH Prestige Motors — 120-point inspected, reserve online for £99.`,
  };
}

export default async function CarPage({ params }: { params: { slug: string } }) {
  const car = await getVehicle(params.slug);
  if (!car) notFound();

  // Related: same body first, then same brand, then anything else — up to 3.
  const all = await getVehicles();
  const others = all.filter((v) => v.id !== car.id);
  const score = (v: Vehicle) => (v.body === car.body ? 2 : 0) + (v.brand === car.brand ? 1 : 0);
  const related = others.sort((a, b) => score(b) - score(a)).slice(0, 3);

  return (
    <>
      <PrestigeNav />
      <CarView car={car} related={related} />
      <SiteFooter />
    </>
  );
}
