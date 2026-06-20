import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrestigeNav from "@/components/PrestigeNav";
import SiteFooter from "@/components/SiteFooter";
import CarView from "./CarView";
import { CARS, carSlug, getCarBySlug, fmt, fmtMiles } from "@/lib/cars";
import "../../prestige.css";
import "../stock.css";

export function generateStaticParams() {
  return CARS.map((c) => ({ slug: carSlug(c) }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const car = getCarBySlug(params.slug);
  if (!car) return { title: "Car not found — SKH Prestige Motors" };
  return {
    title: `${car.name} — ${fmt(car.price)} — SKH Prestige Motors`,
    description: `${car.name}. ${car.year} · ${fmtMiles(car.mileage)} · ${car.fuel} · ${car.gearbox}. ${fmt(
      car.price
    )} at SKH Prestige Motors — 120-point inspected, reserve online for £99.`,
  };
}

export default function CarPage({ params }: { params: { slug: string } }) {
  const car = getCarBySlug(params.slug);
  if (!car) notFound();

  return (
    <>
      <PrestigeNav />
      <CarView car={car} />
      <SiteFooter />
    </>
  );
}
