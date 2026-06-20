import Star, { type StarVariant } from "./Star";

// Thin alias kept for the Prestige page — renders the SKH geometric star.
export default function StarMark({
  variant = "cream",
  size = 38,
}: {
  variant?: "cream" | "green" | "gun";
  size?: number;
}) {
  return <Star variant={variant as StarVariant} size={size} />;
}
