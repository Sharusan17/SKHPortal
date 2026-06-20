"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Star from "@/components/Star";
import CarCard from "@/components/CarCard";
import {
  CARS,
  BODY_TYPES,
  BRANDS,
  PRICE_BANDS,
  stockQuery,
  type Filters,
} from "@/lib/cars";

const FEATURED = CARS.slice(0, 4);

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 78;
  window.scrollTo({ top: y, behavior: "smooth" });
}

/* ---------- hero + search ---------- */
function Hero({ onSearch }: { onSearch: (f: Partial<Filters>) => void }) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [priceMax, setPriceMax] = useState(999999);
  return (
    <section className="hero-p">
      <div className="hero-p-bg" />
      <div className="hero-p-grid" />
      <div className="wrap" style={{ position: "relative" }}>
        <div className="reveal" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span className="chip" style={{ borderColor: "var(--hair-2)", color: "var(--cream)" }}>★ 4.8 / 5 · 600+ reviews</span>
          <span className="chip">120-point inspected</span>
        </div>
        <h1 className="reveal hero-p-title">
          <span style={{ color: "var(--cream)" }}>Find your next car,</span>
          <br />
          <span className="italic" style={{ color: "var(--cream)", opacity: 0.85 }}>prepped &amp; finance-ready.</span>
        </h1>
        <p className="reveal hero-p-sub">
          Hand-picked used cars, fully inspected and detailed before you collect. Search the showroom or
          reserve online for just £99 — fully refundable.
        </p>

        <div className="reveal search-card panel sheen">
          <div className="search-row">
            <label className="search-field">
              <span>Make</span>
              <select value={make} onChange={(e) => setMake(e.target.value)}>
                <option value="">Any make</option>
                {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="search-field">
              <span>Model / keyword</span>
              <input type="text" placeholder="e.g. Golf, M Sport" value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
            <label className="search-field">
              <span>Max price</span>
              <select value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))}>
                {PRICE_BANDS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <button className="btn btn-cream search-go" onClick={() => onSearch({ make, model, priceMax })}>
              Search stock
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- body type tiles ---------- */
const BODY_ICONS: Record<string, string> = {
  SUV: "M3 13h18l-1.5-4.2A2 2 0 0017.6 7.5H6.4a2 2 0 00-1.9 1.3L3 13zm0 0v4m18-4v4M6.5 17a1.5 1.5 0 11-3 0m17 0a1.5 1.5 0 11-3 0",
  Hatchback: "M3 13l2-5.2A2 2 0 016.9 6.5H15l4 4 .8 2.5M3 13h17m-17 0v3.5m17-3.5v3.5M7 16.5a1.5 1.5 0 11-3 0m14 0a1.5 1.5 0 11-3 0",
  Saloon: "M2.5 13l2-4.7A2 2 0 016.4 7h9.2a2 2 0 011.7 1l2.7 4.4M2.5 13h19M2.5 13v3.4m19-3.4v3.4M6.5 16.4a1.5 1.5 0 11-3 0m15 0a1.5 1.5 0 11-3 0",
  Estate: "M2.5 13l1.8-5A2 2 0 016.2 6.6H17l3.5 3.4.5 3M2.5 13h18.5M2.5 13v3.4m18.5-3.4v3.4M6.5 16.4a1.5 1.5 0 11-3 0m14.5 0a1.5 1.5 0 11-3 0",
  Coupe: "M3 13l3-4.5A3 3 0 018.5 7H14c2 0 5 2.5 6 6M3 13h17M3 13v3.4m17-3.4v3.4M7 16.4a1.5 1.5 0 11-3 0m14 0a1.5 1.5 0 11-3 0",
  Convertible: "M3 13l2-4.7A2 2 0 016.9 7H14M3 13h17l-1-3.5M3 13v3.4m17-3.4v3.4M7 16.4a1.5 1.5 0 11-3 0m14 0a1.5 1.5 0 11-3 0",
  MPV: "M3.5 13l1-5A2 2 0 016.4 6.4h9.5a2 2 0 011.8 1.1L20.5 13M3.5 13h17M3.5 13v3.4m17-3.4v3.4M7 16.4a1.5 1.5 0 11-3 0m14 0a1.5 1.5 0 11-3 0",
};
function BodyTiles({ counts, onPick }: { counts: Record<string, number>; onPick: (b: string) => void }) {
  return (
    <section className="section" style={{ paddingBottom: 0 }}>
      <div className="wrap">
        <div className="section-head reveal">
          <div>
            <p className="eyebrow">Browse</p>
            <h2>Shop by body type</h2>
          </div>
          <Link className="seeall" href="/prestige/stock">View all stock →</Link>
        </div>
        <div className="tiles reveal">
          {BODY_TYPES.map((t) => (
            <button key={t} className="tile" onClick={() => onPick(t)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d={BODY_ICONS[t]} />
              </svg>
              <span className="tile-name">{t}</span>
              <span className="tile-count">{counts[t] || 0} in stock</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- why buy ---------- */
function WhyBuy() {
  const items = [
    { t: "Hand-picked quality", d: "Every car is sourced, driven and chosen by us — no auction clear-outs, no surprises.", bar: "var(--red)" },
    { t: "120-point inspection", d: "Mechanically checked, road-tested and showroom-detailed by SKH Mechanic & Detailing before sale.", bar: "var(--amber)" },
    { t: "Flexible finance & peace of mind", d: "In-house finance options, a 14-day money-back guarantee and total transparency on every deal.", bar: "var(--green)" },
  ];
  return (
    <section className="section" id="services">
      <div className="wrap">
        <div className="section-head reveal">
          <div>
            <p className="eyebrow">Why SKH</p>
            <h2>Why buy from SKH Prestige</h2>
          </div>
        </div>
        <div className="why-grid">
          {items.map((it, i) => (
            <div key={i} className="panel sheen why-card reveal">
              <span className="why-bar" style={{ background: it.bar }} />
              <span className="why-num">0{i + 1}</span>
              <h3>{it.t}</h3>
              <p>{it.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- stats band ---------- */
function Stats() {
  const stats: [string, string][] = [
    ["250+", "cars in stock"],
    ["120", "point inspection"],
    ["£99", "refundable reservation"],
    ["14-day", "money-back guarantee"],
    ["9.9%", "APR representative*"],
  ];
  return (
    <section className="stats-band">
      <div className="stats-gridbg" aria-hidden="true" />
      <div className="wrap stats-inner">
        {stats.map(([n, l], i) => (
          <div key={i} className="stat reveal">
            <span className="stat-bar" />
            <span className="stat-n">{n}</span>
            <span className="stat-l">{l}</span>
          </div>
        ))}
      </div>
      <div className="wrap">
        <p className="stats-foot">*Illustrative only — SKH is not yet FCA-authorised. No live finance available until authorised.</p>
      </div>
    </section>
  );
}

/* ---------- featured preview ---------- */
function Featured() {
  return (
    <section className="section" id="stock">
      <div className="wrap">
        <div className="section-head reveal">
          <div>
            <p className="eyebrow">The showroom</p>
            <h2>Featured cars</h2>
          </div>
          <Link className="seeall" href="/prestige/stock">View all stock →</Link>
        </div>
        <div className="car-grid">
          {FEATURED.map((c) => <CarCard key={c.id} car={c} />)}
        </div>
        <p className="car-disclaimer">*Monthly figures are illustrative examples only and not a financial promotion. See the finance example below.</p>
      </div>
    </section>
  );
}

/* ---------- finance illustrative example ---------- */
function FinanceExample() {
  const rows: [string, string][] = [
    ["Cash price", "£13,250"],
    ["Deposit", "£1,500"],
    ["Amount of credit", "£11,750"],
    ["Agreement term", "60 months"],
    ["Representative APR", "9.9% APR"],
    ["Monthly payment", "£249"],
    ["Total amount payable", "£16,440"],
  ];
  return (
    <section className="section" id="finance">
      <div className="wrap">
        <div className="fin-wrap panel sheen reveal">
          <span className="fin-stripe" />
          <div className="fin-head">
            <div className="fin-brand">
              <Star variant="green" size={40} />
              <div>
                <p className="eyebrow" style={{ color: "var(--green-deep)" }}>SKH Finance</p>
                <h2 style={{ color: "var(--ink)" }}>Finance, made flexible</h2>
              </div>
            </div>
            <p className="fin-intro">
              Spread the cost with terms tailored to you. Here’s how a typical agreement might look on our VW Golf
              1.5 TSI Match — figures shown as an example of the structure only.
            </p>
          </div>

          <div className="fin-notice">
            Illustrative example only — not a financial promotion. SKH is not yet FCA-authorised; no live finance is
            offered until authorisation is in place.
          </div>

          <div className="fin-table">
            {rows.map(([k, v], i) => (
              <div key={i} className={"fin-row" + (k === "Monthly payment" || k === "Total amount payable" ? " hi" : "")}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>

          <div className="fin-cta">
            <Link className="btn btn-green" href="/#divisions">Explore SKH Finance →</Link>
            <span className="fin-note">Representative figures · for illustration of structure only</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- part exchange band ---------- */
function PartExchange() {
  return (
    <section className="section" id="partex" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="px-band reveal">
          <div className="px-glow" />
          <div className="px-text">
            <p className="eyebrow" style={{ color: "var(--red)" }}>Part exchange</p>
            <h2>Trade in your current car</h2>
            <p>
              Get a fair, no-obligation valuation against any car in our showroom. We’ll handle the paperwork and
              settle outstanding finance — you just drive away in the new one.
            </p>
          </div>
          <div className="px-actions">
            <a className="btn btn-amber" href="tel:07511849893">Get a valuation</a>
            <Link className="btn btn-ghost" href="/prestige/stock">Browse stock</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- reviews strip ---------- */
function Reviews() {
  const quotes: [string, string][] = [
    ["“Car was spotless on collection — clearly valeted properly. Finance side was painless.”", "Danielle R."],
    ["“Found me exactly the Golf I wanted and sorted the part-ex on my old one same day.”", "Marcus T."],
    ["“Genuinely the easiest car purchase I’ve made. No pressure, straight answers.”", "Priya S."],
  ];
  return (
    <section className="section reviews" id="contact">
      <div className="wrap">
        <div className="reviews-head reveal">
          <div className="reviews-score">
            <span className="rs-num">4.8</span>
            <div>
              <span className="rs-stars">★★★★★</span>
              <span className="rs-sub">from 600+ verified reviews</span>
            </div>
          </div>
          <div className="bar-underline" />
        </div>
        <div className="reviews-grid">
          {quotes.map(([q, a], i) => (
            <figure key={i} className="panel sheen review-card reveal">
              <span className="review-stars">★★★★★</span>
              <blockquote>{q}</blockquote>
              <figcaption>{a} · <span>SKH Prestige customer</span></figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- popular brands ---------- */
function Brands({ onPick }: { onPick: (b: string) => void }) {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="section-head reveal">
          <div>
            <p className="eyebrow">Manufacturers</p>
            <h2>Popular brands</h2>
          </div>
        </div>
        <div className="brands-grid reveal">
          {BRANDS.map((b) => (
            <button key={b} className="brand-cell" onClick={() => onPick(b)}>
              <span>{b}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- cross links to siblings ---------- */
function CrossLinks() {
  const items = [
    { t: "Need a car today?", d: "Self-drive hire from SKH Rental while you decide.", cta: "SKH Rental", variant: "amber", href: "/#divisions" },
    { t: "Every car, fully prepped", d: "Detailed by SKH Detailing, mechanically checked by SKH Mechanic.", cta: "Our workshops", variant: "silver", href: "/#divisions" },
    { t: "Spread the cost", d: "Flexible, tailored finance through SKH Finance.", cta: "SKH Finance", variant: "green", href: "#finance" },
  ];
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="cross-grid">
          {items.map((it, i) =>
            it.href.startsWith("#") ? (
              <a
                key={i}
                className="panel sheen cross-card reveal"
                href={it.href}
                onClick={(e) => { e.preventDefault(); scrollToId(it.href.slice(1)); }}
              >
                <span className={"cross-bar cb-" + it.variant} />
                <h3>{it.t}</h3>
                <p>{it.d}</p>
                <span className="cross-go">{it.cta} →</span>
              </a>
            ) : (
              <Link key={i} className="panel sheen cross-card reveal" href={it.href}>
                <span className={"cross-bar cb-" + it.variant} />
                <h3>{it.t}</h3>
                <p>{it.d}</p>
                <span className="cross-go">{it.cta} →</span>
              </Link>
            )
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- home ---------- */
export default function PrestigeHome() {
  const router = useRouter();

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    CARS.forEach((car) => { c[car.body] = (c[car.body] || 0) + 1; });
    return c;
  }, []);

  const goToStock = (f: Partial<Filters>) => router.push("/prestige/stock" + stockQuery(f));

  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>(".reveal")];
    els.forEach((el, i) => { el.classList.add("js-anim"); el.style.transitionDelay = Math.min(i % 4, 3) * 60 + "ms"; });
    const io = new IntersectionObserver(
      (ents) => {
        ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
    );
    els.forEach((el) => io.observe(el));
    const t = setTimeout(() => els.forEach((el) => el.classList.add("in")), 1500);
    return () => { io.disconnect(); clearTimeout(t); };
  });

  return (
    <>
      <Hero onSearch={goToStock} />
      <BodyTiles counts={counts} onPick={(b) => goToStock({ body: b })} />
      <WhyBuy />
      <Stats />
      <Featured />
      <FinanceExample />
      <PartExchange />
      <Reviews />
      <Brands onPick={(b) => goToStock({ make: b })} />
      <CrossLinks />
    </>
  );
}
