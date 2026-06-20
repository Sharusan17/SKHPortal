import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <Link className="logo" href="/" style={{ marginBottom: 18 }}>
              <svg width="34" height="34" viewBox="0 0 100 100" aria-hidden="true">
                <defs>
                  <linearGradient id="footStar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#6c7382" />
                    <stop offset="1" stopColor="#2a2d35" />
                  </linearGradient>
                </defs>
                <path
                  d="M50 5 L61 39 L97 39 L68 61 L79 95 L50 74 L21 95 L32 61 L3 39 L39 39 Z"
                  fill="url(#footStar)"
                  stroke="#9AA0A8"
                  strokeWidth="1.4"
                  strokeOpacity="0.5"
                />
              </svg>
              <span className="word">
                <span className="top silver-text">SKH</span>
                <span className="sub">Inc</span>
              </span>
            </Link>
            <p style={{ color: "var(--tx-soft)", maxWidth: "34ch", margin: "6px 0 18px" }}>
              Your car, sorted — under one roof. Six specialist divisions, one trusted group.
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
            <Link href="/prestige#finance">SKH Finance</Link>
            <Link href="/#divisions">SKH Detailing</Link>
            <Link href="/#divisions">SKH Rental</Link>
            <Link href="/#divisions">SKH Mechanic</Link>
            <Link href="/#divisions">SKH Customs</Link>
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
