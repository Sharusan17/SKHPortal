import type { Metadata } from "next";
import PrestigeNav from "@/components/PrestigeNav";
import SiteFooter from "@/components/SiteFooter";
import Inventory from "./Inventory";
import { EMPTY_FILTERS, type Filters } from "@/lib/cars";
import "../prestige.css";
import "./stock.css";

export const metadata: Metadata = {
  title: "Browse our stock — SKH Prestige Motors",
  description:
    "Browse the full SKH Prestige Motors showroom. Hand-picked, 120-point inspected used cars — filter by make, model, body type and price.",
};

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

export default function StockPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const priceMax = Number(first(searchParams.priceMax));
  const initial: Filters = {
    ...EMPTY_FILTERS,
    make: first(searchParams.make),
    model: first(searchParams.model),
    body: first(searchParams.body),
    priceMax: priceMax > 0 ? priceMax : EMPTY_FILTERS.priceMax,
  };

  return (
    <>
      <PrestigeNav />
      <Inventory initial={initial} />
      <SiteFooter />
    </>
  );
}
