"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StarMark from "@/components/StarMark";
import MobileMenu from "@/components/MobileMenu";

const LINKS: [string, string][] = [
  ["Find a Car", "/prestige/stock"],
  ["Finance", "/prestige#finance"],
  ["Part Exchange", "/prestige#partex"],
  ["Services", "/prestige#services"],
  ["Contact", "/prestige#contact"],
];

export default function PrestigeNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 12);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  return (
    <header className={"nav" + (scrolled ? " scrolled" : "")}>
      <div className="wrap nav-inner">
        <Link className="logo" href="/prestige" aria-label="SKH Prestige Motors">
          <StarMark variant="cream" size={38} />
          <span className="word">
            <span className="top" style={{ color: "var(--cream)" }}>SKH</span>
            <span className="sub" style={{ color: "var(--tx-dim)" }}>Prestige Motors</span>
          </span>
        </Link>
        <nav className="nav-links">
          {LINKS.map(([t, href]) => (
            <Link key={href} href={href}>{t}</Link>
          ))}
        </nav>
        <div className="nav-call">
          <span className="nav-phone" style={{ color: "var(--cream)" }}>07511 849893</span>
          <a className="btn btn-amber" href="tel:07511849893">Call Now</a>
          <MobileMenu links={LINKS.map(([label, href]) => ({ label, href }))} />
        </div>
      </div>
    </header>
  );
}
