type Variant = "cream" | "green" | "gun";

const STOPS: Record<Variant, [string, string]> = {
  cream: ["#FBEFEB", "#d8b8ad"],
  green: ["#14d579", "#00833f"],
  gun: ["#6c7382", "#2a2d35"],
};

const STROKE: Record<Variant, string> = {
  cream: "#ffffff",
  green: "#3ae892",
  gun: "#9AA0A8",
};

export default function StarMark({
  variant = "cream",
  size = 38,
}: {
  variant?: Variant;
  size?: number;
}) {
  const id = `s_${variant}_${size}`;
  const stops = STOPS[variant];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="1" stopColor={stops[1]} />
        </linearGradient>
      </defs>
      <path
        d="M50 5 L61 39 L97 39 L68 61 L79 95 L50 74 L21 95 L32 61 L3 39 L39 39 Z"
        fill={`url(#${id})`}
        stroke={STROKE[variant]}
        strokeOpacity="0.45"
        strokeWidth="1.3"
      />
    </svg>
  );
}
