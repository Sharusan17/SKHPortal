import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import Star from "@/components/Star";
import MobileMenu from "@/components/MobileMenu";
import DivisionEnquiry from "./DivisionEnquiry";
import { DIVISIONS, getDivision } from "@/lib/divisions";
import "./division.css";

export function generateStaticParams() {
  return DIVISIONS.map((d) => ({ slug: d.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const d = getDivision(params.slug);
  if (!d) return { title: "Not found · SKH Inc" };
  return {
    title: `${d.full} — ${d.tagline}`,
    description: d.blurb,
  };
}

export default function DivisionPage({ params }: { params: { slug: string } }) {
  const d = getDivision(params.slug);
  if (!d) notFound();

  const others = DIVISIONS.filter((x) => x.slug !== d.slug).slice(0, 3);

  return (
    <div className="dv-page" style={{ ["--dv" as string]: d.accent } as React.CSSProperties}>
      {/* nav */}
      <header className="nav dv-nav" id="nav">
        <div className="wrap nav-inner">
          <Link className="logo" href="/" aria-label="SKH Inc home">
            <Star variant="silver" size={34} />
            <span className="word">
              <span className="top silver-text">SKH</span>
              <span className="sub">{d.name}</span>
            </span>
          </Link>
          <div className="nav-links">
            <Link href="/prestige">Prestige Motors</Link>
            <Link href="/#divisions">Divisions</Link>
            <Link href="/#about">Group</Link>
          </div>
          <div className="nav-call">
            <span className="nav-phone">07511 849893</span>
            <a className="btn btn-amber" href="tel:07511849893">Call now</a>
            <MobileMenu
              links={[
                { label: "Prestige Motors", href: "/prestige" },
                { label: "Divisions", href: "/#divisions" },
                { label: "Group", href: "/#about" },
              ]}
            />
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="dv-hero on-dark">
        <div className="dv-hero-grid" />
        <div className="wrap dv-hero-inner">
          <div className="dv-hero-copy">
            <span className="chip dv-chip">{d.status === "soon" ? "Coming soon" : "Open now"}</span>
            <h1 className="dv-hero-title">
              <span className="dv-skh">SKH</span>{d.name}
            </h1>
            <p className="dv-hero-tag">{d.tagline}</p>
            <p className="dv-hero-blurb">{d.blurb}</p>
            <div className="dv-hero-actions">
              <a className="btn btn-amber" href="#register">Register your interest</a>
              <a className="btn btn-ghost" href="tel:07511849893">Call 07511 849893</a>
            </div>
          </div>
          <div className="dv-hero-badge">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={encodeURI(d.badge)} alt={`${d.full} crest`} />
          </div>
        </div>
      </section>

      {/* offerings */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">What’s coming</p>
              <h2>What {d.full} will offer</h2>
            </div>
          </div>
          <div className="dv-grid2">
            {d.offerings.map((o, i) => (
              <div key={i} className="panel sheen dv-offer">
                <Star variant={d.star} size={30} />
                <p>{o}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* register interest */}
      <section className="section dv-register" id="register" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="panel sheen dv-register-panel">
            <div className="dv-register-head">
              <p className="eyebrow" style={{ color: "var(--dv)" }}>Be first to know</p>
              <h2>Register your interest</h2>
              <p className="dv-register-sub">
                {d.full} is launching soon. Leave your details and we’ll be in touch the moment it goes live —
                no spam, just a heads-up.
              </p>
            </div>
            <DivisionEnquiry division={d.slug} full={d.full} star={d.star} />
          </div>
        </div>
      </section>

      {/* cross links */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">The group</p>
              <h2>Explore the rest of SKH</h2>
            </div>
            <Link className="seeall" href="/#divisions">All divisions →</Link>
          </div>
          <div className="dv-grid3">
            <Link className="panel sheen dv-cross" href="/prestige">
              <Star variant="cream" size={30} />
              <h3>SKH Prestige Motors</h3>
              <p>Hand-picked quality used cars, prepped, inspected and finance-ready.</p>
              <span className="cross-go">Browse the showroom →</span>
            </Link>
            {others.map((o) => (
              <Link key={o.slug} className="panel sheen dv-cross" href={`/divisions/${o.slug}`}>
                <Star variant={o.star} size={30} />
                <h3>{o.full}</h3>
                <p>{o.tagline}</p>
                <span className="cross-go">Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
