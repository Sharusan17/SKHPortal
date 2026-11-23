import { useState } from "react";
import { Download, Landmark, PiggyBank, TrendingUp } from "lucide-react";
import { Alert, Button, Card, PageHeader, Segmented, useLoad } from "../components/ui.jsx";
import { useApp } from "../context.js";
import { api } from "../api.js";
import { money, plural } from "../format.js";

const SPLITS = [{ value: "month", label: "By month" }, { value: "quarter", label: "By VAT quarter" }];

// [key, label, how it's shown]: "sub" a line that feeds the total below it, "total" a result line
// (bold, green or red), "minus" shown as money going out.
const SECTIONS = [
  {
    title: "Profit and loss", icon: TrendingUp,
    note: "Before tax, with VAT left out: VAT charged belongs to HMRC and VAT reclaimed comes back.",
    rows: [
      ["car_sales", "Car sales, without VAT"],
      ["cars_cost", "Cost of the cars sold", "minus"],
      ["car_expenses", "Expenses on those cars", "minus"],
      ["car_profit", "Profit on cars", "total"],
      ["running_costs", "Running costs (not tied to a car)", "minus"],
      ["other_income", "Other income"],
      ["net_profit", "Net profit before tax", "total"],
    ],
  },
  {
    title: "VAT", icon: Landmark,
    note: "For the dates in each column, worked out the same way as the VAT return. Paid to HMRC is bank lines that mention HMRC.",
    rows: [
      ["vat_charged", "VAT charged on sales (Box 1)"],
      ["vat_reclaimed", "VAT reclaimed (Box 4)", "minus"],
      ["vat_owed", "VAT owed to HMRC (Box 5)", "total-plain"],
      ["paid_to_hmrc", "Paid to HMRC"],
    ],
  },
  {
    title: "Cash flow", icon: PiggyBank,
    note: "The bank as it happened, VAT included. Cash after VAT is the net cash once the VAT owed for these dates is settled with HMRC.",
    rows: [
      ["money_in", "Money in"],
      ["money_out", "Money out", "minus"],
      ["net_cash", "Net cash flow", "total"],
      ["cash_after_vat", "Cash after paying HMRC", "total"],
    ],
  },
];

const tone = (v) => (Number(v) > 0 ? "var(--green)" : Number(v) < 0 ? "var(--red)" : undefined);
const show = (v, kind) => (kind === "minus" && Number(v) ? `-${money(Math.abs(Number(v)))}` : money(v));

// Profit and loss, VAT and cash flow for the period picked at the top, by month or VAT quarter.
export default function ReportsPage() {
  const { period, version } = useApp();
  const [by, setBy] = useState("month");
  const load = useLoad(() => api.get("/admin/api/report", { p: period.id, by }), [period.id, by, version]);
  const d = load.data;
  const cols = d ? [...d.columns, { ...d.total, label: "Total", isTotal: true }] : [];

  const csv = () => {
    const lines = [["", ...cols.map((c) => c.label)]];
    SECTIONS.forEach((s) => {
      lines.push([s.title]);
      s.rows.forEach(([k, label, kind]) => lines.push([label, ...cols.map((c) => (kind === "minus" ? -Number(c[k]) : Number(c[k])).toFixed(2))]));
    });
    const text = lines.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = `report-${period.label.replace(/[^\w-]+/g, "-")}-${by}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="stack">
      <PageHeader title="Reports" subtitle={`${period.label} · profit and loss, VAT and cash flow`}
        actions={
          <>
            <Segmented ariaLabel="Split by" options={SPLITS} value={by} onChange={setBy} />
            <Button icon={Download} disabled={!d} onClick={csv}>Download CSV</Button>
          </>
        } />
      {load.error && <Alert tone="error">{load.error.message}</Alert>}
      {!d && !load.error && <p className="muted">Loading…</p>}
      {d && d.columns.length === 0 && <Alert tone="info">Nothing to show for {period.label}.</Alert>}
      {d && d.columns.length > 0 && SECTIONS.map((s) => (
        <Card key={s.title} title={s.title} icon={s.icon}>
          <p className="small muted" style={{ marginTop: -6 }}>{s.note}</p>
          <div className="table-wrap report-wrap">
            <table className="table report-table">
              <thead>
                <tr>
                  <th />
                  {cols.map((c) => <th key={c.label} className={`r ${c.isTotal ? "report-total" : ""}`}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {s.rows.map(([k, label, kind]) => (
                  <tr key={k} className={kind?.startsWith("total") ? "report-sum" : ""}>
                    <td>{label}</td>
                    {cols.map((c) => (
                      <td key={c.label} className={`r ${c.isTotal ? "report-total" : ""}`}
                        style={{ color: kind === "total" ? tone(c[k]) : undefined }}>
                        {show(c[k], kind)}
                      </td>
                    ))}
                  </tr>
                ))}
                {s.title === "Profit and loss" && (
                  <tr className="report-note-row">
                    <td>Cars sold</td>
                    {cols.map((c) => <td key={c.label} className={`r ${c.isTotal ? "report-total" : ""}`}>{c.cars_sold}</td>)}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      {d && d.columns.length > 0 && (
        <p className="small muted">
          {plural(d.columns.length, by === "month" ? "month" : "quarter")} from the period picked at the top, up to today.
          Cash flow counts bank lines only (cash and personal-card expenses aren't in the bank).
        </p>
      )}
    </div>
  );
}
