import Link from "next/link";
import Star from "./Star";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <Link className="logo" href="/" style={{ marginBottom: 18 }}>
              <Star variant="silver" size={34} />
              <span className="word">
                <span className="top silver-text">SKH</span>
                <span className="sub">Inc</span>
              </span>
            </Link>
            <p style={{ color: "var(--tx-soft)", maxWidth: "34ch", margin: "6px 0 18px" }}>
              Your car, sorted — under one roof. Seven specialist divisions, one trusted group.
            </p>
            <div className="bars" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </div>
          </div>

          <div>
            <h4>Divisions</h4>
            <Link href="/prestige">Prestige Motors</Link>
            <Link href="/divisions/finance">SKH Finance</Link>
            <Link href="/divisions/detailing">SKH Detailing</Link>
            <Link href="/divisions/mechanic">SKH Mechanic</Link>
            <Link href="/divisions/rental">SKH Rental</Link>
            <Link href="/divisions/recovery">SKH Recovery</Link>
            <Link href="/divisions/custom">SKH Custom</Link>
          </div>

          <div>
            <h4>Company</h4>
            <Link href="/#about">About SKH</Link>
            <a href="#contact">Contact</a>
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
          </div>

          <div>
            <h4>Get in touch</h4>
            <a href="tel:07511849893">07511 849893</a>
            <a href="mailto:info@skhinc.co.uk">info@skhinc.co.uk</a>
            <p style={{ color: "var(--tx-soft)", fontSize: "0.92rem", margin: "14px 0 0" }}>
              Mon–Sat &nbsp;8:00–18:00
              <br />
              Sun &nbsp;10:00–16:00
            </p>
          </div>
        </div>

        <div className="legal">
          <span>© {year} SKH Inc. All rights reserved.</span>
          <span>
            SKH Inc — regulatory details coming soon. Finance figures shown are illustrative only.
          </span>
        </div>
      </div>
    </footer>
  );
}
