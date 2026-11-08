import {
  ArrowLeftRight, Banknote, Car, CheckCircle2, Circle, FileText, FileWarning, Gavel,
  CalendarClock, Package, Receipt, TrendingUp, Upload, Wrench,
} from "lucide-react";
import {
  Alert, Badge, Button, Empty, InkCard, ListRow, PageHeader, Panel, Progress, StatCard, useLoad,
} from "../components/ui.jsx";
import { useApp } from "../context.js";
import { api } from "../api.js";
import { longDate, money, plural, shortDate, ukDate } from "../format.js";
import { navigate } from "../router.js";

const STAGES = [
  { key: "bought", label: "Bought" },
  { key: "in_prep", label: "In prep" },
  { key: "for_sale", label: "For sale" },
  { key: "sold", label: "Sold this quarter" },
];

const ACTION_ICON = { bill: Receipt, prep: Wrench, document: FileWarning, payment: Banknote, bank: ArrowLeftRight };

const QUICK = [
  { label: "Add a car", icon: Car, tone: "sage", href: "/admin/stock" },
  { label: "Create Invoice", icon: FileText, tone: "blush", href: "/admin/invoices" },
  { label: "Import bank CSV", icon: Upload, tone: "lilac", href: "/admin/bank" },
];

const go = (route) => { navigate(route); };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function actionRoute(a) {
  if (a.kind === "payment") return "/admin/invoices";
  if (a.kind === "bank") return "/admin/bank";
  return a.car_id ? `/admin/car/${a.car_id}` : "/admin/stock";
}

const block = (height) => (
  <div style={{ height, borderRadius: 16, background: "var(--panel-2)" }} aria-hidden="true" />
);

const stageChip = {
  display: "flex", flexDirection: "column", gap: 2, padding: "10px 12px", borderRadius: 12,
  background: "var(--panel)", border: "1px solid var(--border)", color: "var(--ink)", textDecoration: "none", minWidth: 0,
};

const quickLink = {
  display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "var(--ink)",
  fontWeight: 500, padding: 16,
};

const allClear = {
  display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10,
  background: "var(--green-bg)", color: "var(--green)", fontSize: 14, fontWeight: 500,
};

// The period's result after running costs. Car profit already takes off costs linked to a car.
function ProfitAndLoss({ pnl }) {
  const net = Number(pnl.net_profit) || 0;
  const rows = [
    ["Sales (before VAT)", pnl.sales_ex_vat, `${plural(pnl.cars_sold, "car")} · ${money(pnl.takings)} taken`],
    ["Profit on cars", pnl.car_profit, "After purchase, fees, prep and VAT"],
    ["Running costs", -Number(pnl.running_costs), "Not linked to a car, before VAT"],
    ["Other income", pnl.other_income, "Before VAT"],
  ];
  return (
    <Panel title={`Profit and loss · ${pnl.label}`}>
      <div className="pnl">
        {rows.map(([label, value, sub]) => (
          <div key={label} className="pnl-cell">
            <span className="small muted">{label}</span>
            <strong className="num">{money(value)}</strong>
            <span className="small muted">{sub}</span>
          </div>
        ))}
        <div className={`pnl-cell pnl-net ${net < 0 ? "is-loss" : ""}`}>
          <span className="small">{net < 0 ? "Net loss" : "Net profit"}</span>
          <strong className="num">{money(net)}</strong>
          <span className="small">Before tax and wages</span>
        </div>
      </div>
    </Panel>
  );
}

export default function HomePage() {
  const { business, version, period } = useApp();
  const home = useLoad(() => api.get("/admin/api/home", { p: period.id }), [version, period.id]);
  const d = home.data;
  const businessName = business?.trading_name || business?.company_name || business?.name || "";

  if (!d) {
    if (home.error) {
      return (
        <div className="stack">
          <PageHeader title="Home" />
          <Alert tone="error" title="Could not load the dashboard">{home.error.message}</Alert>
          <div><Button onClick={home.reload}>Try again</Button></div>
        </div>
      );
    }
    return (
      <div className="stack">
        <PageHeader title="Home" />
        {block(120)}
        <div className="grid-3">{block(120)}{block(120)}{block(120)}</div>
        {block(200)}
      </div>
    );
  }

  const quarter = d.quarter || {};
  const stock = d.stock || {};
  const stage = stock.by_stage || {};
  const sold = d.sold || {};
  const actions = d.actions || [];
  const progress = d.progress || {};
  const total = progress.total || 0;
  const categorised = progress.categorised || 0;
  const receiptsNeeded = progress.receipts_needed || 0;
  const receiptsAttached = progress.receipts_attached || 0;
  const warnings = progress.warnings || 0;
  const next = d.next_to_file;
  const name = d.salesperson || businessName;

  // The next return to send: the latest ended quarter if it isn't filed yet, else this quarter's.
  const submit = next
    ? { date: next.deadline, label: next.quarter, overdue: next.overdue }
    : { date: quarter.deadline, label: quarter.label, overdue: false };
  const daysLeft = submit.date ? Math.round((new Date(submit.date) - new Date(new Date().toDateString())) / 86400000) : null;
  const submitSub = submit.overdue ? `${submit.label} · overdue`
    : `${submit.label} · ${daysLeft === 0 ? "due today" : `${plural(daysLeft, "day")} left`}`;

  return (
    <>
      <div className="stack">
        <div className="page-head">
          <div>
            <h1>{`${greeting()}${name ? `, ${name}` : ""}`}</h1>
            {quarter.label && <p className="muted">{`${quarter.label} · quarter in progress`}</p>}
          </div>
          <div className="page-actions">
            {QUICK.map((q) => (
              <Button key={q.label} icon={q.icon} onClick={() => go(q.href)}>{q.label}</Button>
            ))}
          </div>
        </div>

        {home.error && <Alert tone="error" title="Showing the last loaded figures">{home.error.message}</Alert>}

        {/* Summary row: the only coloured boxes on the page, all the same height. */}
        <div className="hp-top">
          <StatCard tone="sage" icon={Package} label="In stock" sub={`${plural(stock.count || 0, "car")} at cost`}
            value={money(stock.at_cost)} onClick={() => go("/admin/stock")} />
          <StatCard tone="blush" icon={TrendingUp} label={`Sold · ${sold.label || "this quarter"}`}
            sub={`${plural(sold.count || 0, "car")} · profit before VAT`} value={money(sold.profit)}
            onClick={() => go("/admin/stock")} />
          <a href="/admin/return" className="hp-ink" aria-label="Open the VAT return">
            <InkCard title={quarter.label} chip="HMRC" amount={money(d.vat_so_far)}
              footLeft="VAT so far" footRight={quarter.deadline ? `Due ${ukDate(quarter.deadline)}` : ""} />
          </a>
          <StatCard tone="lilac" icon={CalendarClock} label="Next submission date" sub={submitSub}
            value={submit.date ? longDate(submit.date) : "Nothing due"} onClick={() => go("/admin/return")} />
        </div>

        {d.pnl && <ProfitAndLoss pnl={d.pnl} />}

        <div className="hp-cols">
          <div className="stack">
            <Panel title="Needs action">
              {actions.length ? (
                actions.map((a, i) => (
                  <ListRow key={`${a.kind}-${a.car_id || a.invoice_id || i}`}
                    icon={ACTION_ICON[a.kind] || Circle} title={a.text}
                    onClick={() => go(actionRoute(a))} />
                ))
              ) : (
                <div style={allClear}><CheckCircle2 size={18} /> All caught up</div>
              )}
            </Panel>

            <Panel title="Stock by stage" action="Stock Book" onAction={() => go("/admin/stock")}>
              <div className="hp-stages">
                {STAGES.map((s) => (
                  <a key={s.key} href="/admin/stock" style={stageChip}>
                    <span className="small muted">{s.label}</span>
                    <span style={{ fontSize: 22, fontWeight: 600 }}>{s.key === "sold" ? sold.count || 0 : stage[s.key] || 0}</span>
                  </a>
                ))}
              </div>
            </Panel>
          </div>

          <div className="stack">
            <Panel title="Recent invoices" action="All invoices" onAction={() => go("/admin/invoices")}>
              {(d.recent_invoices || []).length ? (
                d.recent_invoices.map((inv) => (
                  <ListRow key={inv.id} icon={FileText}
                    title={`${inv.invoice_no} · ${inv.reg}`}
                    sub={`${inv.buyer_name} · ${shortDate(inv.invoice_date)}`}
                    value={
                      <span style={{ display: "inline-flex", gap: 8, alignItems: "center", color: inv.void ? "var(--muted)" : undefined, textDecoration: inv.void ? "line-through" : "none" }}>
                        {inv.void && <Badge tone="red">Void</Badge>}
                        {money(inv.total)}
                      </span>
                    }
                    onClick={() => go("/admin/invoices")} />
                ))
              ) : (
                <Empty title="No invoices yet" />
              )}
            </Panel>

            <Panel title="To categorise" action="View all" onAction={() => go("/admin/bank")}>
              {(d.to_categorise || []).length ? (
                d.to_categorise.map((t) => (
                  <ListRow key={t.id} title={t.description} sub={ukDate(t.date)}
                    onClick={() => go("/admin/bank")}
                    value={<span style={{ color: t.amount > 0 ? "var(--green)" : undefined }}>{money(t.amount)}</span>} />
                ))
              ) : (
                <Empty title="Nothing to categorise" />
              )}
            </Panel>

            <Panel title="Quarter checklist">
              <Progress label={`Bank lines categorised ${categorised} of ${total}`}
                value={total ? categorised / total : 0} />
              <div className="stack-sm" style={{ marginTop: 8 }}>
                <ListRow icon={receiptsAttached >= receiptsNeeded ? CheckCircle2 : Circle}
                  title="Receipts attached" value={`${receiptsAttached}/${receiptsNeeded}`} />
                <ListRow icon={warnings === 0 ? CheckCircle2 : Circle}
                  title="Checks open" value={String(warnings)} />
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <style>{`
        .hp-top { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; align-items: stretch; }
        .hp-top > * { height: 100%; }
        .hp-ink { display: block; text-decoration: none; color: inherit; }
        .hp-ink > * { height: 100%; box-sizing: border-box; }
        .hp-cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: start; }
        .hp-stages { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
        @media (max-width: 1100px) { .hp-top { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 800px) {
          .hp-top, .hp-cols { grid-template-columns: minmax(0, 1fr); }
          .hp-stages { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </>
  );
}
