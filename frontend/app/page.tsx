import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import HubEffects from "@/components/HubEffects";
import Star, { type StarVariant } from "@/components/Star";
import MobileMenu from "@/components/MobileMenu";
import "./hub.css";

type Division = {
  num: string;
  name: string;
  desc: string;
  accent: string;
  href: string;
  live?: boolean;
  star: StarVariant;
};

const DIVISIONS: Division[] = [
  {
    num: "01",
    name: "Prestige Motors",
    desc: "Hand-picked quality used cars, prepped, inspected and finance-ready.",
    accent: "#C0272D",
    href: "/prestige",
    live: true,
    star: "prestige",
  },
  {
    num: "02",
    name: "Finance",
    desc: "Flexible car finance tailored to you, with clear illustrative examples.",
    accent: "#0B8F5D",
    href: "/prestige#finance",
    star: "finance",
  },
  {
    num: "03",
    name: "Detailing",
    desc: "Showroom-grade valeting and detailing — every car leaves immaculate.",
    accent: "#5FA8E0",
    href: "#about",
    star: "detailing",
  },
  {
    num: "04",
    name: "Mechanic",
    desc: "Servicing, MOT and repairs you can trust — main-dealer care, fair pricing.",
    accent: "#22B3BD",
    href: "#about",
    star: "mechanic",
  },
  {
    num: "05",
    name: "Rental",
    desc: "Self-drive car hire, ready when you need a set of keys today.",
    accent: "#E0A800",
    href: "#about",
    star: "rental",
  },
  {
    num: "06",
    name: "Recovery",
    desc: "24/7 breakdown recovery and vehicle transport, whenever you’re stuck.",
    accent: "#8B919E",
    href: "#about",
    star: "recovery",
  },
  {
    num: "07",
    name: "Custom",
    desc: "Modifications and styling, done properly — wheels, wraps, the lot.",
    accent: "#8B6FD0",
    href: "#about",
    star: "custom",
  },
];

const HERO_INDEX = [
  { n: "01", nm: "Prestige Motors", href: "/prestige" },
  { n: "02", nm: "Finance", href: "/prestige#finance" },
  { n: "03", nm: "Detailing", href: "#divisions" },
  { n: "04", nm: "Mechanic", href: "#divisions" },
  { n: "05", nm: "Rental", href: "#divisions" },
  { n: "06", nm: "Recovery", href: "#divisions" },
  { n: "07", nm: "Custom", href: "#divisions" },
];

export default function Home() {
  return (
    <div className="hub-root">
      {/* ============ NAV ============ */}
      <header className="nav hero-nav" id="nav">
        <div className="wrap nav-inner">
          <Link className="logo" href="/" aria-label="SKH Inc home">
            <Star variant="silver" size={36} className="star-svg" />
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
            <MobileMenu
              links={[
                { label: "Prestige Motors", href: "/prestige" },
                { label: "Divisions", href: "#divisions" },
                { label: "Group", href: "#about" },
              ]}
            />
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="hero on-dark">
        <div className="hero-grid-bg"></div>
        <Star variant="heroDark" size={720} className="hero-mark" />

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
              One group, seven specialist divisions — from the showroom floor to finance, servicing and
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
              <h2>Seven divisions, one standard.</h2>
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
                    <Star variant={d.star} size={38} className="dv-star" />
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
                  One account. <span className="accentword">Seven services.</span> No runaround.
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
