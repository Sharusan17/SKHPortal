// SKH 8-point geometric star — the brand mark, recoloured per context.

const STAR_D =
  "M50 3 L55.36 37.07 L76.87 23.13 L62.93 44.64 L97 50 L62.93 55.36 L76.87 76.87 L55.36 62.93 L50 97 L44.64 62.93 L23.13 76.87 L37.07 55.36 L3 50 L37.07 44.64 L23.13 23.13 L44.64 37.07 Z";

const SPOKES_D =
  "M50 50 L50 3 M50 50 L76.87 23.13 M50 50 L97 50 M50 50 L76.87 76.87 M50 50 L50 97 M50 50 L23.13 76.87 M50 50 L3 50 M50 50 L23.13 23.13";

const OCT_D =
  "M55.36 37.07 L62.93 44.64 L62.93 55.36 L55.36 62.93 L44.64 62.93 L37.07 55.36 L37.07 44.64 L44.64 37.07 Z";

export type StarTone = { from: string; to: string; line: string };

export const STAR_TONES = {
  // light/silver — for dark backgrounds (nav over hero, footer)
  silver: { from: "#dfe3e8", to: "#5a6172", line: "rgba(255,255,255,0.38)" },
  // faint dark star — the giant graphic mark bleeding off the hero
  heroDark: { from: "#3a3f4a", to: "#181b20", line: "rgba(255,255,255,0.10)" },
  // division tones — tuned to read on the light editorial cards
  prestige: { from: "#fbe9e2", to: "#c9a89e", line: "rgba(20,24,40,0.18)" },
  finance: { from: "#2fe39a", to: "#0a7d52", line: "rgba(20,24,40,0.20)" },
  detailing: { from: "#bfe0fb", to: "#5fa8e0", line: "rgba(20,24,40,0.18)" },
  mechanic: { from: "#8fe8ec", to: "#22b3bd", line: "rgba(20,24,40,0.18)" },
  rental: { from: "#ffd34d", to: "#e0a800", line: "rgba(20,24,40,0.20)" },
  recovery: { from: "#d8dce0", to: "#8b919e", line: "rgba(20,24,40,0.20)" },
  custom: { from: "#cdbbf2", to: "#8b6fd0", line: "rgba(20,24,40,0.18)" },
  // on-light cream for the Prestige nav/decorative marks
  cream: { from: "#f1e7e1", to: "#caa99e", line: "rgba(20,24,40,0.16)" },
  green: { from: "#2fe39a", to: "#0a7d52", line: "rgba(20,24,40,0.18)" },
  gun: { from: "#d8dce0", to: "#6c7382", line: "rgba(20,24,40,0.22)" },
} satisfies Record<string, StarTone>;

export type StarVariant = keyof typeof STAR_TONES;

export default function Star({
  variant = "silver",
  size = 38,
  className,
  style,
}: {
  variant?: StarVariant;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const tone = STAR_TONES[variant];
  const gid = `star_${variant}_${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
      style={{ display: "block", ...style }}
    >
      <defs>
        <linearGradient id={gid} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={tone.from} />
          <stop offset="1" stopColor={tone.to} />
        </linearGradient>
      </defs>
      <path d={STAR_D} fill={`url(#${gid})`} stroke={tone.to} strokeOpacity="0.45" strokeWidth="0.8" strokeLinejoin="round" />
      <path d={SPOKES_D} fill="none" stroke={tone.line} strokeWidth="0.8" />
      <path d={OCT_D} fill="none" stroke={tone.line} strokeWidth="0.8" />
    </svg>
  );
}
