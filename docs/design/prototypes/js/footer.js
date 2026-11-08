// Shared SKH Inc footer — injected into #footer-mount on both pages
(function () {
  const mount = document.getElementById('footer-mount');
  if (!mount) return;
  mount.innerHTML = `
  <footer class="footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <a class="logo" href="index.html" style="margin-bottom:18px;">
            <svg width="34" height="34" viewBox="0 0 100 100" aria-hidden="true">
              <defs><linearGradient id="footStar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6c7382"/><stop offset="1" stop-color="#2a2d35"/></linearGradient></defs>
              <path d="M50 5 L61 39 L97 39 L68 61 L79 95 L50 74 L21 95 L32 61 L3 39 L39 39 Z" fill="url(#footStar)" stroke="#9AA0A8" stroke-width="1.4" stroke-opacity="0.5"/>
            </svg>
            <span class="word"><span class="top silver-text">SKH</span><span class="sub">Inc</span></span>
          </a>
          <p style="color:var(--tx-soft); max-width: 34ch; margin: 6px 0 18px;">Your car, sorted — under one roof. Six specialist divisions, one trusted group.</p>
          <div class="bars" aria-hidden="true"><i></i><i></i><i></i></div>
        </div>

        <div>
          <h4>Divisions</h4>
          <a href="prestige.html">Prestige Motors</a>
          <a href="prestige.html#finance">SKH Finance</a>
          <a href="index.html#divisions">SKH Detailing</a>
          <a href="index.html#divisions">SKH Rental</a>
          <a href="index.html#divisions">SKH Mechanic</a>
          <a href="index.html#divisions">SKH Customs</a>
        </div>

        <div>
          <h4>Company</h4>
          <a href="index.html#about">About SKH</a>
          <a href="#contact">Contact</a>
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
        </div>

        <div>
          <h4>Get in touch</h4>
          <a href="tel:07511849893">07511 849893</a>
          <a href="mailto:info@skhinc.co.uk">info@skhinc.co.uk</a>
          <p style="color:var(--tx-soft); font-size:0.92rem; margin:14px 0 0;">
            Mon–Sat &nbsp;8:00–18:00<br/>
            Sun &nbsp;10:00–16:00
          </p>
        </div>
      </div>

      <div class="legal">
        <span>© ${new Date().getFullYear()} SKH Inc. All rights reserved.</span>
        <span>SKH Inc — regulatory details coming soon. Finance figures shown are illustrative only.</span>
      </div>
    </div>
  </footer>`;
})();
