const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];

export const money = (v) => (v === null || v === undefined || v === "" ? "" : gbp.format(Number(v)));

const parts = (iso) => (iso ? iso.slice(0, 10).split("-").map(Number) : null);

// 2026-07-01 -> 01/07/2026
export function ukDate(iso) {
  const p = parts(iso);
  return p ? `${String(p[2]).padStart(2, "0")}/${String(p[1]).padStart(2, "0")}/${p[0]}` : "";
}

// 2026-07-01 -> 1 Jul 2026
export function shortDate(iso) {
  const p = parts(iso);
  return p ? `${p[2]} ${MONTHS[p[1] - 1]} ${p[0]}` : "";
}

// 2026-07-01 -> 1 July 2026
export function longDate(iso) {
  const p = parts(iso);
  return p ? `${p[2]} ${LONG_MONTHS[p[1] - 1]} ${p[0]}` : "";
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Strip "(...)" detail off long category names for compact display.
export const shortCategory = (c) => (c ? c.split(" (")[0] : "");
