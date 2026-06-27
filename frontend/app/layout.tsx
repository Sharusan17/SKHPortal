import type { Metadata } from "next";
import { Schibsted_Grotesk, Hanken_Grotesk, Saira_Condensed } from "next/font/google";
import "./globals.css";

const display = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-next",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body-next",
  display: "swap",
});

const logo = Saira_Condensed({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-logo-next",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://skhinc.co.uk"),
  title: {
    default: "SKH Inc — Your car, sorted. Under one roof.",
    template: "%s · SKH Inc",
  },
  description:
    "SKH Inc is a Lancashire automotive group with seven specialist divisions — from the showroom floor to finance, servicing and beyond.",
  openGraph: {
    title: "SKH Inc — Your car, sorted. Under one roof.",
    description:
      "One group, seven specialist divisions — prestige used cars, finance, detailing, mechanic, rental, recovery and custom.",
    type: "website",
    locale: "en_GB",
    siteName: "SKH Inc",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${logo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
