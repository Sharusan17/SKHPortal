import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrestigeNav from "@/components/PrestigeNav";
import SiteFooter from "@/components/SiteFooter";
import CarView from "./CarView";
import { getVehicle } from "@/lib/api";
import { fmt, fmtMiles } from "@/lib/cars";
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

  return (
    <>
      <PrestigeNav />
      <CarView car={car} />
      <SiteFooter />
    </>
  );
}
