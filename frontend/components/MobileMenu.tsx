"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type NavLink = { label: string; href: string };

export default function MobileMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        className={"nav-toggle" + (open ? " open" : "")}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {open && (
        <div className="mobile-menu" onClick={close}>
          <nav className="mobile-menu-inner" onClick={(e) => e.stopPropagation()}>
            {links.map((l) =>
              l.href.startsWith("/") ? (
                <Link key={l.href} href={l.href} onClick={close}>{l.label}</Link>
              ) : (
                <a key={l.href} href={l.href} onClick={close}>{l.label}</a>
              )
            )}
            <a className="btn btn-amber" href="tel:07511849893" onClick={close}>Call 07511 849893</a>
          </nav>
        </div>
      )}
    </>
  );
}
