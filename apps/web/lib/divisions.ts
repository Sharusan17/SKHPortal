// SKH Inc divisions — content for the division landing pages.
import type { StarVariant } from "@/components/Star";

export type Division = {
  slug: string;
  name: string; // short, e.g. "Finance"
  full: string; // e.g. "SKH Finance"
  accent: string; // brand accent hex
  star: StarVariant;
  badge: string; // /public path to the crest badge
  tagline: string;
  blurb: string;
  offerings: string[];
  status: "live" | "soon";
};

export const DIVISIONS: Division[] = [
  {
    slug: "finance",
    name: "Finance",
    full: "SKH Finance",
    accent: "#0B8F5D",
    star: "finance",
    badge: "/logos/SKH Finance.png",
    tagline: "Flexible car finance, tailored to you.",
    blurb:
      "SKH Finance will make funding your next car simple — clear, tailored agreements with no jargon and no surprises, arranged alongside the showroom so it all happens under one roof.",
    offerings: [
      "PCP & HP options tailored to your budget",
      "Clear, illustrative examples before you commit",
      "Part-exchange settled and handled for you",
      "Decisions arranged alongside your purchase",
    ],
    status: "soon",
  },
  {
    slug: "detailing",
    name: "Detailing",
    full: "SKH Detailing",
    accent: "#5FA8E0",
    star: "detailing",
    badge: "/logos/SKH Detailing.png",
    tagline: "Showroom-grade valeting & detailing.",
    blurb:
      "From a full valet to paint correction and ceramic coating, SKH Detailing will bring every car back to its best — the same standard we apply to every car that leaves our showroom.",
    offerings: [
      "Full interior & exterior valeting",
      "Machine polishing & paint correction",
      "Ceramic coating & paint protection",
      "New-car protection packages",
    ],
    status: "soon",
  },
  {
    slug: "mechanic",
    name: "Mechanic",
    full: "SKH Mechanic",
    accent: "#22B3BD",
    star: "mechanic",
    badge: "/logos/SKH Mechanic.png",
    tagline: "Servicing, MOT & repairs you can trust.",
    blurb:
      "Main-dealer care at a fair price. SKH Mechanic will handle everything from routine servicing and MOTs to diagnostics and repairs, carried out by technicians who know cars inside out.",
    offerings: [
      "Full & interim servicing",
      "MOT testing & preparation",
      "Diagnostics & fault-finding",
      "Repairs, brakes, tyres & more",
    ],
    status: "soon",
  },
  {
    slug: "rental",
    name: "Rental",
    full: "SKH Rental",
    accent: "#E0A800",
    star: "rental",
    badge: "/logos/SKH Rental.png",
    tagline: "Self-drive hire, ready when you are.",
    blurb:
      "Need a set of keys today? SKH Rental will offer flexible self-drive hire — daily, weekly or longer — whether you're between cars, need something bigger for the weekend, or just want to try before you buy.",
    offerings: [
      "Daily, weekly & monthly hire",
      "A range of vehicles for every need",
      "Simple booking & fair pricing",
      "Courtesy options while we service your car",
    ],
    status: "soon",
  },
  {
    slug: "recovery",
    name: "Recovery",
    full: "SKH Recovery",
    accent: "#8B919E",
    star: "recovery",
    badge: "/logos/SKH Recovery.png",
    tagline: "24/7 breakdown recovery & transport.",
    blurb:
      "Stuck at the roadside or need a car moved? SKH Recovery will be there around the clock — quick, careful vehicle recovery and transport, whenever and wherever you need it.",
    offerings: [
      "24/7 breakdown recovery",
      "Accident & non-runner recovery",
      "Vehicle transport & delivery",
      "Careful handling of prestige cars",
    ],
    status: "soon",
  },
  {
    slug: "custom",
    name: "Custom",
    full: "SKH Custom",
    accent: "#8B6FD0",
    star: "custom",
    badge: "/logos/SKH Custom.png",
    tagline: "Modifications & styling, done properly.",
    blurb:
      "Make it yours. SKH Custom will handle styling and modifications the right way — wheels, wraps, tints and more, finished to the standard you'd expect from the SKH name.",
    offerings: [
      "Alloy wheels & refurbishment",
      "Vinyl wraps & styling",
      "Window tints & detailing add-ons",
      "Tasteful, quality-first modifications",
    ],
    status: "soon",
  },
];

export function getDivision(slug: string): Division | undefined {
  return DIVISIONS.find((d) => d.slug === slug);
}
