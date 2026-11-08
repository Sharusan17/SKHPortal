import { useEffect, useRef, useState } from "react";
import { Car, Check, ExternalLink, FileText, Paperclip, Plus, Receipt, Trash2, Wallet, Building2, PiggyBank, X } from "lucide-react";
import {
  Alert, Button, Card, Field, Input, MoneyInput, PageHeader, Segmented, Select, StatCard,
  useAction, useLoad, useToast,
} from "../components/ui.jsx";
import { useApp } from "../context.js";
import { api } from "../api.js";
import { money, plural, ukDate } from "../format.js";
import { navigate } from "../router.js";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "car", label: "Car costs" },
  { value: "general", label: "General" },
  { value: "receipt", label: "Missing receipt" },
  { value: "untyped", label: "To sort" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function ExpensesPage() {
  const { meta, period, version, refresh, search } = useApp();
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const load = useLoad(() => api.get("/admin/api/expenses", { p: period.id }), [period.id, version]);
  const stock = useLoad(() => api.get("/admin/api/stock"), [version]);

  if (!load.data) {
    return load.error ? <Alert tone="error">{load.error.message}</Alert> : <p className="muted">Loading…</p>;
  }
  const { lines, by_type: byType, totals } = load.data;
  const cars = stock.data ?? [];
  const term = String(search ?? "").trim().toLowerCase();
  const view = lines.filter((x) => (
    (filter === "all"
      || (filter === "car" && x.car_id)
      || (filter === "general" && !x.car_id && !x.uncategorised)
      || (filter === "receipt" && x.needs_receipt)
      || (filter === "untyped" && (x.uncategorised || !x.type_set)))
    && (!term || `${x.description} ${x.car_reg ?? ""} ${x.notes}`.toLowerCase().includes(term))
  ));

  return (
    <div className="stack">
      <PageHeader title="Add Expenses" subtitle={`${period.label} · costs for the cars and the business`}
        actions={<Button variant="primary" icon={Plus} onClick={() => setAdding((a) => !a)}>Add Expense</Button>} />

      <div className="grid-4">
        <StatCard tone="sage" icon={Wallet} label="Spent"
          sub={`${plural(lines.length - totals.uncategorised, "line")}${Number(totals.refunds) ? ` · ${money(totals.refunds)} refunded` : ""}`}
          value={money(totals.gross)} />
        <StatCard tone="blush" icon={PiggyBank} label="VAT to reclaim" sub="Box 4" value={money(totals.vat)} />
        <StatCard tone="sky" icon={Car} label="Car costs" sub="Linked to a car" value={money(totals.cars)} />
        <StatCard tone="sand" icon={Building2} label="General" sub="Running the business" value={money(totals.general)} />
      </div>

      {adding && <AddExpense meta={meta} cars={cars} onDone={() => { setAdding(false); refresh(); }}
        onCancel={() => setAdding(false)} />}

      {totals.uncategorised > 0 && (
        <Alert tone="warning">
          {`${plural(totals.uncategorised, "bank payment")} not sorted yet. Pick a type below, or mark it on the Bank page if it isn't a cost.`}
        </Alert>
      )}

      <div className="grid-expenses">
        <Card title="Expenses" icon={Receipt}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <Segmented options={FILTERS.map((f) => ({
              ...f,
              label: f.value === "receipt" && totals.missing_receipts ? `${f.label} (${totals.missing_receipts})` : f.label,
            }))} value={filter} onChange={setFilter} ariaLabel="Filter expenses" />
          </div>
          <ExpenseTable lines={view} meta={meta} cars={cars} empty={lines.length === 0
            ? `No costs in ${period.label}. Import a Tide CSV on the Bank page, or add a cash expense.`
            : "Nothing matches."} />
        </Card>

        <Card title="By type" icon={Wallet}>
          {byType.length === 0 ? <p className="muted small">Nothing yet.</p> : (
            <ul className="plain by-type">
              {byType.map((b) => (
                <li key={b.type}>
                  <span>{b.type}<span className="muted small"> · {b.count}</span></span>
                  <span className="r">
                    <strong>{money(b.gross)}</strong>
                    {Number(b.vat) > 0 && <span className="muted small">{money(b.vat)} VAT</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ExpenseTable({ lines, meta, cars, empty }) {
  const { refresh } = useApp();
  const toast = useToast();
  const [run, busy] = useAction();
  const types = [{ value: "", label: "Pick a type…" }, ...meta.expense_types.map((t) => ({
    value: t.name, label: t.vat || t.name.includes("no VAT") ? t.name : `${t.name} (no VAT)`,
  }))];
  const carOptions = [{ value: "", label: "General" }, ...cars.map((c) => ({
    value: String(c.id), label: [c.reg, c.make_model].filter(Boolean).join(" · "),
  }))];

  const patch = async (x, body) => {
    if (await run(() => api.patch(`/admin/api/expenses/${x.id}`, body))) refresh();
  };
  const upload = async (x, files) => {
    if (!files.length) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    if (await run(() => api.post(`/admin/api/transactions/${x.id}/receipts`, fd))) refresh();
  };
  const remove = async (x) => {
    if (!window.confirm(`Delete "${x.description}" ${money(x.gross)}? This can't be undone.`)) return;
    if (await run(() => api.del(`/admin/api/expenses/${x.id}`))) {
      toast("success", "Expense deleted.");
      refresh();
    }
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Date</th><th>Description</th><th>Type</th><th>Car</th>
            <th className="r">Amount</th><th className="r">VAT</th><th>Receipt</th><th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && <tr><td colSpan={8} className="muted">{empty}</td></tr>}
          {lines.map((x) => (
            <tr key={x.id} className="click-row" onClick={(e) => {
              if (!e.target.closest("select, button, a, label, input")) navigate(`/admin/expense/${x.id}`);
            }}>
              <td style={{ whiteSpace: "nowrap" }}>{ukDate(x.date)}</td>
              <td style={{ minWidth: 180 }}>
                <a className="row-link" href={`/admin/expense/${x.id}`}>{x.description}</a>
                {x.refund && <span className="refund-tag">Refund</span>}
                {x.paid_by !== "Bank" && <span className="muted small">{x.paid_by}</span>}
              </td>
              <td style={{ minWidth: 190 }}>
                <Select aria-label="Type" options={types} value={x.type_set ? x.expense_type : ""} disabled={busy}
                  onChange={(v) => v && patch(x, { expense_type: v })} />
                {!x.type_set && x.expense_type && (
                  <button type="button" className="link-btn small" disabled={busy}
                    onClick={() => patch(x, { expense_type: x.expense_type })}>
                    <Check size={12} /> {x.expense_type}?
                  </button>
                )}
              </td>
              <td style={{ minWidth: 150 }}>
                <Select aria-label="Car" options={carOptions} value={x.car_id ? String(x.car_id) : ""} disabled={busy}
                  onChange={(v) => patch(x, { car_id: v ? Number(v) : null })} />
              </td>
              <td className={`r ${x.refund ? "refund-amt" : ""}`}>{money(x.gross)}</td>
              <td className={`r ${x.refund ? "refund-amt" : ""}`}>{Number(x.vat) ? money(x.vat) : <span className="muted">-</span>}</td>
              <td>
                {x.receipts > 0
                  ? <ReceiptsPopover x={x} meta={meta} upload={upload} />
                  : (
                    <label className={`btn btn-sm ${x.needs_receipt ? "btn-secondary warn" : "btn-secondary"}`}
                      title="Attach a receipt">
                      <Paperclip size={14} />{x.needs_receipt ? "Needed" : "Add"}
                      <input type="file" hidden multiple accept={(meta.receipt_types || []).map((t) => `.${t}`).join(",")}
                        onChange={(e) => { upload(x, e.target.files); e.target.value = ""; }} />
                    </label>
                  )}
              </td>
              <td className="r">
                {x.paid_by !== "Bank" && (
                  <button type="button" className="icon-btn" aria-label="Delete expense" disabled={busy}
                    onClick={() => remove(x)}><Trash2 size={16} /></button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddExpense({ meta, cars, onDone, onCancel }) {
  const toast = useToast();
  const [run, busy] = useAction();
  const [f, setF] = useState({
    date: today(), description: "", amount: "", expense_type: meta.expense_types[0].name,
    paid_by: "Cash", vat: "", car_id: "", notes: "", refund: false,
  });
  const [files, setFiles] = useState([]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const typeHasVat = meta.expense_types.find((t) => t.name === f.expense_type)?.vat;
  const defaultVat = typeHasVat && Number(f.amount) > 0 ? (Number(f.amount) / 6).toFixed(2) : "0.00";

  const save = async () => {
    if (!f.description.trim() || !(Number(f.amount) > 0)) {
      toast("error", "Enter what it was and the amount paid.");
      return;
    }
    const res = await run(() => api.post("/admin/api/expenses", {
      ...f, amount: Number(f.amount), vat: f.vat === "" ? null : Number(f.vat),
      car_id: f.car_id ? Number(f.car_id) : null,
    }));
    if (!res) return;
    if (files.length) {
      const fd = new FormData();
      files.forEach((file) => fd.append("files", file));
      await run(() => api.post(`/admin/api/transactions/${res.id}/receipts`, fd));
    }
    onDone();
  };

  return (
    <Card title="Add an expense not paid from Tide" icon={Plus}>
      <div className="stack">
        <div className="grid-3">
          <Field label="Date"><Input type="date" value={f.date} onChange={set("date")} /></Field>
          <Field label="What was it"><Input value={f.description} onChange={set("description")} placeholder="e.g. Brake pads" /></Field>
          <Field label={f.refund ? "Amount refunded (incl. VAT)" : "Amount paid (incl. VAT)"}>
            <MoneyInput value={f.amount} onChange={set("amount")} />
          </Field>
          <Field label="Money" hint="A refund is money back on a cost, e.g. a returned part">
            <Select options={[{ value: "out", label: "Paid out (expense)" }, { value: "in", label: "Paid back to us (refund)" }]}
              value={f.refund ? "in" : "out"} onChange={(v) => setF((st) => ({ ...st, refund: v === "in" }))} />
          </Field>
          <Field label="Type"><Select options={meta.expense_types.map((t) => t.name)} value={f.expense_type} onChange={set("expense_type")} /></Field>
          <Field label="Paid by"><Select options={meta.paid_by.filter((p) => p !== "Bank")} value={f.paid_by} onChange={set("paid_by")} /></Field>
          <Field label="Car" hint="Leave as General for business costs">
            <Select options={[{ value: "", label: "General" }, ...cars.map((c) => ({ value: String(c.id), label: [c.reg, c.make_model].filter(Boolean).join(" · ") }))]}
              value={f.car_id} onChange={set("car_id")} />
          </Field>
          <Field label="VAT" hint={`Blank uses ${money(defaultVat)}${typeHasVat ? " (amount / 6)" : ""}`}>
            <MoneyInput value={f.vat} onChange={set("vat")} placeholder={defaultVat} />
          </Field>
          <Field label="Notes"><Input value={f.notes} onChange={set("notes")} /></Field>
          <Field label="Receipt">
            <input className="input" type="file" multiple accept={(meta.receipt_types || []).map((t) => `.${t}`).join(",")}
              onChange={(e) => setFiles(Array.from(e.target.files))} />
          </Field>
        </div>
        <p className="muted small">
          If the company later pays you back from Tide, mark that bank line as Exclude so the cost isn't counted twice.
        </p>
        <div className="row-end">
          <Button icon={X} disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button variant="primary" icon={Plus} busy={busy} onClick={save}>Add Expense</Button>
        </div>
      </div>
    </Card>
  );
}

// The receipts on one expense: open, add more, remove.
function ReceiptsPopover({ x, meta, upload }) {
  const { version, refresh } = useApp();
  const [run, busy] = useAction();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const list = useLoad(() => (open ? api.get(`/admin/api/transactions/${x.id}/receipts`) : Promise.resolve(null)),
    [open, x.id, version]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const remove = async (rc) => {
    if (!window.confirm(`Remove ${rc.filename}?`)) return;
    if (await run(() => api.del(`/admin/api/receipts/${rc.id}`))) refresh();
  };

  return (
    <div className="receipt-pop" ref={box}>
      <button type="button" className="btn btn-sm btn-secondary ok" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>
        <Paperclip size={14} />{x.receipts}
      </button>
      {open && (
        <div className="receipt-panel" role="dialog" aria-label="Receipts">
          {(list.data ?? []).map((rc) => (
            <div key={rc.id} className="receipt-item">
              <span className="row" style={{ gap: 6, minWidth: 0 }}><FileText size={14} />
                <span className="ellipsis">{rc.filename}</span></span>
              <span className="row" style={{ gap: 2, flexWrap: "nowrap" }}>
                <a className="icon-btn" href={`/admin/api/receipts/${rc.id}/file`} target="_blank" rel="noreferrer"
                  aria-label={`Open ${rc.filename}`} title="Open"><ExternalLink size={14} /></a>
                <button type="button" className="icon-btn" aria-label={`Remove ${rc.filename}`} title="Remove"
                  disabled={busy} onClick={() => remove(rc)}><Trash2 size={14} /></button>
              </span>
            </div>
          ))}
          <label className="btn btn-sm btn-secondary" style={{ marginTop: 6 }}>
            <Plus size={14} />Add another
            <input type="file" hidden multiple accept={(meta.receipt_types || []).map((t) => `.${t}`).join(",")}
              onChange={(e) => { upload(x, e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      )}
    </div>
  );
}
