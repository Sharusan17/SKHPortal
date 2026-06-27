import type { Metadata } from "next";
import PrestigeNav from "@/components/PrestigeNav";
import SiteFooter from "@/components/SiteFooter";
import PrestigeHome from "./PrestigeHome";
import "./prestige.css";

export const metadata: Metadata = {
  title: "Prestige Motors — Quality used cars, finance-ready",
  description:
    "Hand-picked used cars, fully inspected and detailed before you collect. Browse the SKH Prestige showroom or reserve online for £99, fully refundable.",
};

export default function PrestigePage() {
  return (
    <>
      <PrestigeNav />
      <PrestigeHome />
      <SiteFooter />
    </>
  );
}
