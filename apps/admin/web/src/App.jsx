import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, CalendarClock, CalendarCheck, CalendarX, CheckCircle2, Circle, Car, ArrowLeftRight,
  BarChart3, ClipboardCheck, Flag, LayoutDashboard, Loader2, Wallet, ReceiptPoundSterling, ReceiptText, Search,
  ShieldCheck, Users,
} from "lucide-react";
import { api } from "./api.js";
import { Badge, Select, useLoad } from "./components/ui.jsx";
import { AppCtx } from "./context.js";
import { currentPage, interceptLinks } from "./router.js";
import { plural, shortDate } from "./format.js";
import HomePage from "./pages/HomePage.jsx";
import ReturnPage from "./pages/ReturnPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import StockPage from "./pages/StockPage.jsx";
import InvoicesPage from "./pages/InvoicesPage.jsx";
import BankPage from "./pages/BankPage.jsx";
import ExpensesPage from "./pages/ExpensesPage.jsx";
import ExpensePage from "./pages/ExpensePage.jsx";
import FlagsPage from "./pages/FlagsPage.jsx";
import CarPage from "./pages/CarPage.jsx";
import Reminders from "./components/Reminders.jsx";
import BusinessPage, { BusinessForm } from "./pages/BusinessPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import ApprovalsPage from "./pages/ApprovalsPage.jsx";

const PAGES = [
  { id: "home", label: "Home", icon: LayoutDashboard, Component: HomePage },
  { id: "stock", label: "Stock Book", icon: Car, Component: StockPage },
  { id: "invoices", label: "Create Invoice", icon: ReceiptPoundSterling, Component: InvoicesPage },
  { id: "expenses", label: "Add Expenses", icon: Wallet, Component: ExpensesPage },
  { id: "bank", label: "Bank", icon: ArrowLeftRight, Component: BankPage },
  { id: "return", label: "VAT Return", icon: ReceiptText, Component: ReturnPage },
  { id: "reports", label: "Reports", icon: BarChart3, Component: ReportsPage },
  { id: "approvals", label: "Approvals", icon: ClipboardCheck, Component: ApprovalsPage },
];

// Reached from the icons beside the bell (Building: the business; People: your account, and users
// for admins), not the sidebar.
const TOP_PAGES = [
  { id: "business", label: "Business", icon: Building2, Component: BusinessPage },
  { id: "users", label: "Users", icon: Users, Component: UsersPage },
  { id: "flags", label: "Flags", icon: Flag, Component: FlagsPage },
];

// The pages this person may open: everything for an admin, the server's list for a user.
const allowed = (me, id) => !me.pages || me.pages.includes(id) || id === "approvals" || id === "users";

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

function Sidebar({ page, business, quarter, period, periods, setPeriodId, version, me }) {
  const isAdmin = me.role === "admin";
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
        {PAGES.filter((p) => allowed(me, p.id)).map((p) => (
          <a key={p.id} href={`/admin/${p.id}`} className={page === p.id ? "active" : ""}
            aria-current={page === p.id ? "page" : undefined}>
            <p.icon size={18} />
            <span>{p.id === "approvals" && !isAdmin ? "My requests" : p.label}</span>
            {p.id === "approvals" && me.pending_requests > 0 && (
              <span className="nav-count" aria-label={`${me.pending_requests} waiting`}>{me.pending_requests}</span>
            )}
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

        {isAdmin && (
          <div className="side-section">
            <div className="side-label">Checklist · {quarter.label}</div>
            <Checklist quarter={quarter} version={version} />
          </div>
        )}
      </div>

    </aside>
  );
}

// After an update goes live the page in an open tab is the old one: offer a reload.
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
      A new version is live. <button type="button" className="link-btn" onClick={() => window.location.reload()}>Reload the page</button> to use it.
    </div>
  );
}

function Dashboard() {
  const page = usePathPage();
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const meta = useLoad(() => api.get("/admin/api/meta"), []);
  // Who's signed in, their role and how many requests wait; reloaded when something changes.
  const [meTick, setMeTick] = useState(0);
  const meLoad = useLoad(() => api.get("/admin/api/auth/me"), [version, meTick]);
  useEffect(() => {
    const on = () => setMeTick((t) => t + 1);
    window.addEventListener("approvals-changed", on);
    return () => window.removeEventListener("approvals-changed", on);
  }, []);
  const [me, setMe] = useState(null);
  useEffect(() => {
    const d = meLoad.data;
    if (d && d.user) {
      setMe({ ...d.user, pages: d.pages, pending_requests: d.pending_requests, permissions: d.permissions, flags: d.flags });
    }
  }, [meLoad.data]);
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
    return (
      <div className="loading-screen">
        <div style={{ textAlign: "center" }}>
          <p>Can't reach the server: {error.message}</p>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }
  if (!meta.data || business === undefined || !me) {
    return <div className="loading-screen"><Loader2 className="spin" /></div>;
  }

  const ctx = { meta: meta.data, business, setBusiness, quarter, quarters, period, periods, setPeriodId,
    version, refresh, search, setSearch, me, isAdmin: me.role === "admin" };

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
  const isAdmin = me.role === "admin";
  const carId = page.startsWith("car/") ? Number(page.slice(4)) : null;
  const expenseId = page.startsWith("expense/") ? Number(page.slice(8)) : null;
  // Old /admin/flag/<id> links: a flag lives on its expense's page now.
  const flagId = page.startsWith("flag/") ? Number(page.slice(5)) : null;
  // A user who opens an admin page (an old link, a typed address) lands on Home instead.
  const shown = carId || expenseId || flagId || allowed(me, page) ? page : DEFAULT_PAGE;
  const Current = carId || expenseId || flagId ? null : [...PAGES, ...TOP_PAGES].find((p) => p.id === shown).Component;
  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell">
        <Sidebar page={carId ? "stock" : expenseId || flagId ? "expenses" : shown} business={business} quarter={quarter} period={period}
          periods={periods} setPeriodId={setPeriodId} version={version} me={me} />
        <div className="content">
          <div className="topbar">
            <label className="search">
              <Search size={16} aria-hidden="true" />
              <input type="search" placeholder="Search" value={search}
                onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
            </label>
            <a href="/admin/flags" className={`icon-square top-link ${page === "flags" ? "active" : ""}`}
              aria-label={me.flags?.waiting ? `Flags, ${me.flags.waiting} waiting on you` : "Flags"}
              title={me.flags?.waiting ? `${me.flags.waiting} waiting on you` : `${me.flags?.open || 0} open flags`}
              aria-current={page === "flags" ? "page" : undefined} style={{ position: "relative" }}>
              <Flag size={18} />
              {(me.flags?.waiting > 0 || me.flags?.open > 0) && (
                <span className={`top-count ${me.flags.waiting > 0 ? "" : "top-count-quiet"}`}>
                  {me.flags.waiting > 0 ? me.flags.waiting : me.flags.open}
                </span>
              )}
            </a>
            <Reminders />
            <a href="/admin/users" className={`icon-square top-link ${page === "users" ? "active" : ""}`}
              aria-label={isAdmin ? "Users and your account" : "Your account"} title={isAdmin ? "Users and your account" : "Your account"}
              aria-current={page === "users" ? "page" : undefined}>
              <Users size={18} />
            </a>
            {isAdmin && (
              <>
                <a href="/admin/business" className={`icon-square top-link ${page === "business" ? "active" : ""}`}
                  aria-label="Business" title="Business" aria-current={page === "business" ? "page" : undefined}>
                  <Building2 size={18} />
                </a>
              </>
            )}
          </div>
          <StaleBanner />
          <main className="main">
            {carId ? <CarPage key={page} carId={carId} />
              : expenseId ? <ExpensePage key={page} expenseId={expenseId} />
                : flagId ? <ExpensePage key={page} expenseId={flagId} /> : <Current key={shown} />}
          </main>
        </div>
      </div>
    </AppCtx.Provider>
  );
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
