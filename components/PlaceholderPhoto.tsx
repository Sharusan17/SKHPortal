export default function PlaceholderPhoto({
  label,
  tall = false,
}: {
  label: string;
  tall?: boolean;
}) {
  return (
    <div className={"ph " + (tall ? "ph-tall" : "")} role="img" aria-label={label + " — photo placeholder"}>
      <div className="ph-stripes" />
      <span className="ph-tag">{label}</span>
      <span className="ph-note">drop car photo</span>
    </div>
  );
}
