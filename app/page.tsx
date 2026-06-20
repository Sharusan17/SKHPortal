import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import HubEffects from "@/components/HubEffects";
import "./hub.css";

const STAR_PATH = "M50 5 L61 39 L97 39 L68 61 L79 95 L50 74 L21 95 L32 61 L3 39 L39 39 Z";

type Division = {
  num: string;
  name: string;
  desc: string;
  accent: string;
  href: string;
  live?: boolean;
  star: { id: string; from: string; to: string; stroke: string; strokeWidth: number; strokeOpacity?: number };
};

const DIVISIONS: Division[] = [
  {
    num: "01",
    name: "Prestige Motors",
    desc: "Hand-picked quality used cars, prepped, inspected and finance-ready.",
    accent: "#C0272D",
    href: "/prestige",
    live: true,
    star: { id: "s1", from: "#fff", to: "#e3cfc8", stroke: "#caa99e", strokeWidth: 2 },
  },
  {
    num: "02",
    name: "Finance",
    desc: "Flexible car finance tailored to you, with clear illustrative examples.",
    accent: "#0B8F5D",
    href: "/prestige#finance",
    star: { id: "s2", from: "#19c685", to: "#0a7d52", stroke: "#3ee0a0", strokeWidth: 1.4, strokeOpacity: 0.6 },
  },
  {
    num: "03",
    name: "Detailing",
    desc: "Showroom-grade valeting and detailing — every car leaves immaculate.",
    accent: "#5A6172",
    href: "#about",
    star: { id: "s3", from: "#eef0f2", to: "#aab0bb", stroke: "#cfd3d9", strokeWidth: 1.4 },
  },
  {
    num: "04",
    name: "Rental",
    desc: "Self-drive car hire, ready when you need a set of keys today.",
    accent: "#5A6172",
    href: "#about",
    star: { id: "s4", from: "#8b919e", to: "#3a3f49", stroke: "#aab0bb", strokeWidth: 1.4 },
  },
  {
    num: "05",
    name: "Mechanic",
    desc: "Servicing, MOT and repairs you can trust — main-dealer care, fair pricing.",
    accent: "#5A6172",
    href: "#about",
    star: { id: "s5", from: "#8b919e", to: "#3a3f49", stroke: "#aab0bb", strokeWidth: 1.4 },
  },
  {
    num: "06",
    name: "Customs",
    desc: "Modifications and styling, done properly — wheels, wraps, the lot.",
    accent: "#5A6172",
    href: "#about",
    star: { id: "s6", from: "#8b919e", to: "#3a3f49", stroke: "#aab0bb", strokeWidth: 1.4 },
  },
];

const HERO_INDEX = [
  { n: "01", nm: "Prestige Motors", href: "/prestige" },
  { n: "02", nm: "Finance", href: "/prestige#finance" },
  { n: "03", nm: "Detailing", href: "#divisions" },
  { n: "04", nm: "Rental", href: "#divisions" },
  { n: "05", nm: "Mechanic", href: "#divisions" },
  { n: "06", nm: "Customs", href: "#divisions" },
];

export default function Home() {
  return (
    <div className="hub-root">
      {/* ============ NAV ============ */}
      <header className="nav hero-nav" id="nav">
        <div className="wrap nav-inner">
          <Link className="logo" href="/" aria-label="SKH Inc home">
            <svg className="star-svg" width="36" height="36" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <linearGradient id="gunStar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#8b919e" />
                  <stop offset="0.5" stopColor="#5a6172" />
                  <stop offset="1" stopColor="#34384200" />
                  <stop offset="1" stopColor="#343842" />
                </linearGradient>
              </defs>
              <path d={STAR_PATH} fill="url(#gunStar)" stroke="#9AA0A8" strokeWidth="1.2" strokeOpacity="0.5" />
            </svg>
            <span className="word">
              <span className="top silver-text">SKH</span>
              <span className="sub">Inc</span>
            </span>
          </Link>
          <div className="nav-links">
            <Link href="/prestige">Prestige Motors</Link>
            <a href="#divisions">Divisions</a>
            <a href="#about">Group</a>
          </div>
          <div className="nav-call">
            <span className="nav-phone">07511 849893</span>
            <a className="btn btn-amber" href="tel:07511849893">Call now</a>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="hero on-dark">
        <div className="hero-grid-bg"></div>
        <svg className="hero-mark" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="heroMark" x1="0.1" y1="0" x2="0.9" y2="1">
              <stop offset="0" stopColor="#3a3f4a" />
              <stop offset="0.5" stopColor="#262a32" />
              <stop offset="1" stopColor="#181b20" />
            </linearGradient>
          </defs>
          <path d={STAR_PATH} fill="url(#heroMark)" stroke="#5a6172" strokeWidth="0.8" strokeOpacity="0.5" />
        </svg>

        <div className="wrap">
          <div className="hero-inner">
            <div className="hero-meta reveal">
              <span className="tri" aria-hidden="true">
                <i></i>
                <i></i>
                <i></i>
              </span>
              <span>SKH Inc — Automotive Group · Lancashire</span>
            </div>
            <h1 className="hero-title reveal">
              Your car, sorted.<em>Under one roof.</em>
            </h1>
            <p className="hero-lead reveal">
              One group, six specialist divisions — from the showroom floor to finance, servicing and
              beyond. Whatever your car needs, the same name stands behind it.
            </p>
            <div className="hero-actions reveal">
              <Link className="btn btn-amber" href="/prestige">Browse the showroom</Link>
              <a className="btn btn-ghost" href="#divisions">Explore the group</a>
            </div>
          </div>

          <nav className="hero-index reveal" aria-label="Divisions">
            <div className="hero-index-row">
              {HERO_INDEX.map((d) =>
                d.href.startsWith("/") ? (
                  <Link key={d.n} className="hidx" href={d.href}>
                    <span className="n">{d.n}</span>
                    <span className="nm">{d.nm}</span>
                  </Link>
                ) : (
                  <a key={d.n} className="hidx" href={d.href}>
                    <span className="n">{d.n}</span>
                    <span className="nm">{d.nm}</span>
                  </a>
                )
              )}
            </div>
          </nav>
        </div>
      </section>

      {/* ============ DIVISIONS ============ */}
      <section className="divisions" id="divisions">
        <div className="wrap">
          <header className="dv-head">
            <div className="l reveal">
              <span className="dv-eyebrow">
                <span className="tri" aria-hidden="true">
                  <i></i>
                  <i></i>
                  <i></i>
                </span>{" "}
                The Group
              </span>
              <h2>Six divisions, one standard.</h2>
            </div>
            <p className="r reveal">
              Everything your car needs, handled by specialists who answer to the same name — and the
              same standard.
            </p>
          </header>

          <div className="dv-grid">
            {DIVISIONS.map((d) => {
              const className = "dv-card reveal" + (d.live ? " live" : "");
              const style = { "--accent": d.accent } as React.CSSProperties;
              const inner = (
                <>
                  <span className="wash"></span>
                  <div className="dv-top">
                    <span className="dv-num">{d.num}</span>
                    <svg className="dv-star" viewBox="0 0 100 100" aria-hidden="true">
                      <defs>
                        <linearGradient id={d.star.id} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor={d.star.from} />
                          <stop offset="1" stopColor={d.star.to} />
                        </linearGradient>
                      </defs>
                      <path
                        d={STAR_PATH}
                        fill={`url(#${d.star.id})`}
                        stroke={d.star.stroke}
                        strokeWidth={d.star.strokeWidth}
                        strokeOpacity={d.star.strokeOpacity}
                      />
                    </svg>
                  </div>
                  <h3 className="dv-name">
                    <span className="skh">SKH</span>
                    {d.name}
                  </h3>
                  <p className="dv-desc">{d.desc}</p>
                  <div className="dv-foot">
                    <span className="dv-status">
                      <span className="pip"></span> {d.live ? "Open now" : "Coming soon"}
                    </span>
                    <span className="dv-arrow">→</span>
                  </div>
                  <span className="dv-rule"></span>
                </>
              );
              return d.href.startsWith("/") ? (
                <Link key={d.num} className={className} href={d.href} style={style}>
                  {inner}
                </Link>
              ) : (
                <a key={d.num} className={className} href={d.href} style={style}>
                  {inner}
                </a>
              );
            })}
          </div>

          {/* closing CTA */}
          <div className="closer" id="about">
            <div className="closer-panel reveal on-dark">
              <div className="closer-grid"></div>
              <div className="closer-inner">
                <div className="closer-tri" aria-hidden="true">
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
                <h2>
                  One account. <span className="accentword">Six services.</span> No runaround.
                </h2>
                <p>
                  Buy, finance, service, valet, hire or modify — handled by one group that already
                  knows your car. Start where most people do.
                </p>
                <div className="closer-actions">
                  <Link className="btn btn-amber" href="/prestige">Start with Prestige Motors</Link>
                  <a className="btn btn-ghost" href="tel:07511849893">Call 07511 849893</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
      <HubEffects />
    </div>
  );
}
