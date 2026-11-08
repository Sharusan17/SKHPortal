import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, CalendarClock, CalendarCheck, CalendarX, CheckCircle2, Circle, Car, ArrowLeftRight,
  LayoutDashboard, Loader2, LogOut, Wallet, ReceiptPoundSterling, ReceiptText, Search, ShieldCheck,
} from "lucide-react";
import { api } from "./api.js";
import { Badge, Select, useLoad } from "./components/ui.jsx";
import { AppCtx } from "./context.js";
import { currentPage, interceptLinks } from "./router.js";
import { plural, shortDate } from "./format.js";
import HomePage from "./pages/HomePage.jsx";
import ReturnPage from "./pages/ReturnPage.jsx";
import StockPage from "./pages/StockPage.jsx";
import InvoicesPage from "./pages/InvoicesPage.jsx";
import BankPage from "./pages/BankPage.jsx";
import ExpensesPage from "./pages/ExpensesPage.jsx";
import ExpensePage from "./pages/ExpensePage.jsx";
import CarPage from "./pages/CarPage.jsx";
import Reminders from "./components/Reminders.jsx";
import BusinessPage, { BusinessForm } from "./pages/BusinessPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";

const PAGES = [
  { id: "home", label: "Home", icon: LayoutDashboard, Component: HomePage },
  { id: "stock", label: "Stock Book", icon: Car, Component: StockPage },
  { id: "invoices", label: "Create Invoice", icon: ReceiptPoundSterling, Component: InvoicesPage },
  { id: "expenses", label: "Add Expenses", icon: Wallet, Component: ExpensesPage },
  { id: "bank", label: "Bank", icon: ArrowLeftRight, Component: BankPage },
  { id: "return", label: "VAT Return", icon: ReceiptText, Component: ReturnPage },
];

// Reached from the Building icon beside the bell, not the sidebar.
const TOP_PAGES = [{ id: "business", label: "Business", icon: Building2, Component: BusinessPage }];

const DEFAULT_PAGE = "home";

// The page from the address (/admin/stock -> "stock"); links inside the app don't reload it.
function usePathPage() {
  const read = () => {
    const id = currentPage();
    if (/^car\/\d+$/.test(id)) return id; // one car's own page, under the Stock book
    if (/^expense\/\d+$/.test(id)) return id; // one expense's own page, under Expenses
    return [...PAGES, ...TOP_PAGES].some((p) => p.id === id) ? id : DEFAULT_PAGE;
  };
  const [page, setPage] = useState(read);
  useEffect(() => {
    const on = () => { setPage(read()); window.scrollTo(0, 0); };
    window.addEventListener("popstate", on);
    const stop = interceptLinks();
    return () => { window.removeEventListener("popstate", on); stop(); };
  }, []);
  return page;
}

const STATUS = {
  filed: { tone: "green", icon: CalendarCheck, text: (q) => `Filed ${shortDate(q.filed_on)}` },
  in_progress: { tone: "blue", icon: CalendarClock, text: () => "In progress" },
  due: { tone: "orange", icon: CalendarClock, text: (q) => `Filing due ${shortDate(q.deadline)}` },
  overdue: { tone: "gray", icon: CalendarX, text: (q) => `Deadline was ${shortDate(q.deadline)}` },
};

export function QuarterStatus({ quarter }) {
  const s = STATUS[quarter.status];
  return <Badge tone={s.tone} icon={s.icon}>{s.text(quarter)}</Badge>;
}

function Checklist({ quarter, version }) {
  const { data } = useLoad(() => api.get("/admin/api/return", { q: quarter.id }), [quarter.id, version]);
  if (!data) return null;
  const p = data.progress;
  const items = [
    [p.total > 0, `${plural(p.total, "bank transaction")} imported`],
    [p.total > 0 && p.categorised === p.total, `${p.categorised} of ${p.total} categorised`],
    [p.receipts_attached === p.receipts_needed, `${p.receipts_attached} of ${p.receipts_needed} VAT receipts attached`],
    [!data.warnings.length, data.warnings.length ? `${plural(data.warnings.length, "issue")} to check` : "No issues"],
  ];
  return (
    <ul className="checklist">
      {items.map(([ok, text]) => (
        <li key={text}>
          {ok ? <CheckCircle2 size={16} className="ok" /> : <Circle size={16} className="todo" />}
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

// The company logo from the Business page; the business name when no logo is uploaded.
function SidebarLogo({ name, hasLogo }) {
  const [failed, setFailed] = useState(false);
  if (!hasLogo || failed) return <div className="wordmark">{name}</div>;
  return (
    <a href="/admin/home" className="side-logo" aria-label={`${name}, home`}>
      <img src="/admin/api/logo" alt={name} onError={() => setFailed(true)} />
    </a>
  );
}

const KIND_SHORT = { quarter: "Quarter", year: "Year", tax_year: "Tax year", financial_year: "Fin. year", all: "All time" };

function Sidebar({ page, business, quarter, period, periods, setPeriodId, version }) {
  const name = business.trading_name || business.company_name;
  const kinds = Object.keys(KIND_SHORT).filter((k) => (periods.options[k] || []).length);
  const options = periods.options[period.kind] || [];
  return (
    <aside className="sidebar">
      <SidebarLogo name={name} hasLogo={business.has_logo} />

      <div className="biz-card">
        <div className="biz-text">
          <div className="biz-name">{business.company_name || name}</div>
          <div className="biz-vrn">VAT {business.vrn_formatted}</div>
        </div>
      </div>

      <nav className="nav" aria-label="Main">
        {PAGES.map((p) => (
          <a key={p.id} href={`/admin/${p.id}`} className={page === p.id ? "active" : ""}
            aria-current={page === p.id ? "page" : undefined}>
            <p.icon size={18} />
            <span>{p.label}</span>
          </a>
        ))}
      </nav>

      <div className="side-block">
        <div className="side-section">
          <span className="side-label">Period</span>
          <div className="period-kinds" role="tablist" aria-label="Period type">
            {kinds.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={period.kind === k}
                className={period.kind === k ? "active" : ""}
                onClick={() => setPeriodId(periods.options[k][0].id)}>{KIND_SHORT[k]}</button>
            ))}
          </div>
          {period.kind !== "all" && (
            <Select id="period-pick" value={period.id} onChange={setPeriodId} className="input side-select"
              aria-label={KIND_SHORT[period.kind]} options={options.map((o) => ({ value: o.id, label: o.label }))} />
          )}
          <div className="side-dates">{shortDate(period.start)} to {shortDate(period.end)}</div>
          {period.kind === "quarter" && <div><QuarterStatus quarter={quarter} /></div>}
        </div>

        <div className="side-section">
          <div className="side-label">Checklist · {quarter.label}</div>
          <Checklist quarter={quarter} version={version} />
        </div>
      </div>

      <div className="side-foot">
        <button type="button" className="signout" onClick={signOut}><LogOut size={14} /> Sign out</button>
      </div>
    </aside>
  );
}

// The server doesn't reload itself: after an update it keeps running the old code until run.bat
// is restarted. An older server has no /api/version at all, which counts as out of date too.
function StaleBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () => fetch("/admin/api/version")
      .then((r) => (r.ok ? r.json() : { stale: true }))
      .then((d) => { if (alive) setStale(!!d.stale); })
      .catch(() => {});
    check();
    const t = setInterval(check, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!stale) return null;
  return (
    <div className="stale-banner" role="alert">
      The app has been updated. Close the run.bat window and open run.bat again to use the new version.
    </div>
  );
}

function Dashboard() {
  const page = usePathPage();
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const meta = useLoad(() => api.get("/admin/api/meta"), []);
  const biz = useLoad(() => api.get("/admin/api/business"), []);
  const [business, setBusiness] = useState(undefined);
  useEffect(() => { if (biz.data !== undefined) setBusiness(biz.data); }, [biz.data]);

  const quartersLoad = useLoad(
    () => (business ? api.get("/admin/api/quarters") : Promise.resolve(null)),
    [business?.stagger, business?.vat_reg_date, !!business, version],
  );
  const quarters = quartersLoad.data;
  // The picked quarter survives a page reload (per browser tab).
  const [quarterId, setQuarterIdState] = useState(() => {
    try { return sessionStorage.getItem("quarter"); } catch { return null; }
  });
  const setQuarterId = (id) => {
    setQuarterIdState(id);
    try { sessionStorage.setItem("quarter", id); } catch { /* storage unavailable */ }
  };
  const periodsLoad = useLoad(
    () => (business ? api.get("/admin/api/periods") : Promise.resolve(null)),
    [business?.stagger, business?.vat_reg_date, business?.year_end, !!business, version],
  );
  const periods = periodsLoad.data;
  // The picked period survives a page reload (per browser tab). A quarter period also picks the
  // VAT quarter; any longer period uses its latest VAT quarter for filing and the checklist.
  const [periodId, setPeriodIdState] = useState(() => {
    try { return sessionStorage.getItem("period"); } catch { return null; }
  });
  const setPeriodId = (id) => {
    setPeriodIdState(id);
    try { sessionStorage.setItem("period", id); } catch { /* storage unavailable */ }
    if (id.startsWith("q:")) setQuarterId(id.slice(2));
  };
  const period = useMemo(() => {
    if (!periods) return null;
    const all = Object.values(periods.options).flat();
    return all.find((o) => o.id === periodId) || all.find((o) => o.id === `q:${quarterId}`)
      || periods.options.quarter[0] || all[0];
  }, [periods, periodId, quarterId]);
  const quarter = useMemo(() => {
    if (!quarters) return null;
    if (period && period.kind === "quarter") return quarters.find((q) => `q:${q.id}` === period.id) || quarters[0];
    if (period) return quarters.find((q) => q.end <= period.end && q.end >= period.start) || quarters[0];
    return quarters.find((q) => q.id === quarterId) || quarters[0];
  }, [quarters, quarterId, period]);

  const error = meta.error || biz.error;
  if (error) {
    return <div className="loading-screen">Can't reach the VAT server: {error.message}. Is run.bat still open?</div>;
  }
  if (!meta.data || business === undefined) {
    return <div className="loading-screen"><Loader2 className="spin" /></div>;
  }

  const ctx = { meta: meta.data, business, setBusiness, quarter, quarters, period, periods, setPeriodId,
    version, refresh, search, setSearch };

  if (!business) {
    return (
      <AppCtx.Provider value={ctx}>
        <div className="onboard">
          <div className="onboard-hero">
            <div className="onboard-mark"><Car size={26} /></div>
            <div>
              <h1>Set up your business</h1>
              <p className="muted">Enter your company and VAT details once. You can change them later on the Business page.</p>
            </div>
          </div>
          <BusinessForm onSaved={(b) => { setBusiness(b); refresh(); }} />
        </div>
      </AppCtx.Provider>
    );
  }

  if (!quarter || !period) return <div className="loading-screen"><Loader2 className="spin" /></div>;
  const carId = page.startsWith("car/") ? Number(page.slice(4)) : null;
  const expenseId = page.startsWith("expense/") ? Number(page.slice(8)) : null;
  const Current = carId || expenseId ? null : [...PAGES, ...TOP_PAGES].find((p) => p.id === page).Component;
  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell">
        <Sidebar page={carId ? "stock" : expenseId ? "expenses" : page} business={business} quarter={quarter} period={period}
          periods={periods} setPeriodId={setPeriodId} version={version} />
        <div className="content">
          <div className="topbar">
            <label className="search">
              <Search size={16} aria-hidden="true" />
              <input type="search" placeholder="Search" value={search}
                onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
            </label>
            <Reminders />
            <a href="/admin/business" className={`icon-square top-link ${page === "business" ? "active" : ""}`}
              aria-label="Business" title="Business" aria-current={page === "business" ? "page" : undefined}>
              <Building2 size={18} />
            </a>
          </div>
          <StaleBanner />
          <main className="main">
            {carId ? <CarPage key={page} carId={carId} />
              : expenseId ? <ExpensePage key={page} expenseId={expenseId} /> : <Current key={page} />}
          </main>
        </div>
      </div>
    </AppCtx.Provider>
  );
}

async function signOut() {
  await fetch("/admin/api/auth/logout", { method: "POST" }).catch(() => {});
  window.dispatchEvent(new Event("auth-required"));
}

// The sign-in gate: nothing loads until the server says this browser is signed in. Any request
// that comes back "Please sign in" (an expired session) brings the sign-in page back.
export default function App() {
  const [state, setState] = useState({ loading: true });
  const [round, setRound] = useState(0);
  const check = useCallback(() => {
    fetch("/admin/api/auth/me").then((r) => r.json())
      .then((d) => setState({ signedIn: d.signed_in, notSetUp: d.required && !d.configured }))
      .catch(() => setState({ signedIn: false, error: true }));
  }, []);
  useEffect(() => {
    check();
    const out = () => setState({ signedIn: false });
    window.addEventListener("auth-required", out);
    return () => window.removeEventListener("auth-required", out);
  }, [check]);

  if (state.loading) return <div className="loading-screen"><Loader2 className="spin" /></div>;
  if (!state.signedIn) {
    return <LoginPage notSetUp={state.notSetUp} onSignedIn={() => { setRound((n) => n + 1); setState({ signedIn: true }); }} />;
  }
  return <Dashboard key={round} />;
}
