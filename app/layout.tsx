import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://skhinc.co.uk"),
  title: {
    default: "SKH Inc — Your car, sorted. Under one roof.",
    template: "%s · SKH Inc",
  },
  description:
    "SKH Inc is a Lancashire automotive group with six specialist divisions — from the showroom floor to finance, servicing and beyond.",
  openGraph: {
    title: "SKH Inc — Your car, sorted. Under one roof.",
    description:
      "One group, six specialist divisions — prestige used cars, finance, detailing, rental, mechanic and customs.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
