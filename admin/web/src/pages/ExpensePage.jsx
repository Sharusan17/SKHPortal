import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Landmark, Lock, LockOpen, Paperclip, Save, Trash2, Undo2 } from "lucide-react";
import {
  Alert, Badge, Button, Card, Field, Input, MoneyInput, PageHeader, Select, Textarea, useAction, useLoad, useToast,
} from "../components/ui.jsx";
import { useApp } from "../context.js";
import { api } from "../api.js";
import { money, plural, ukDate } from "../format.js";
import { navigate } from "../router.js";

const back = () => { navigate("/admin/expenses"); };

const formOf = (x) => ({
  date: String(x.date).slice(0, 10), description: x.description, amount: String(Math.abs(Number(x.gross)).toFixed(2)),
  paid_by: x.paid_by, expense_type: x.type_set ? x.expense_type : "",
  vat: x.vat_manual ? String(Math.abs(Number(x.vat)).toFixed(2)) : "", car_id: x.car_id ? String(x.car_id) : "", notes: x.notes,
});

// One expense on its own page (/admin/expense/<id>). Bank lines keep the Tide date, description and amount.
export default function ExpensePage({ expenseId }) {
  const { meta, version, refresh } = useApp();
  const toast = useToast();
  const [run, busy] = useAction();
  const load = useLoad(() => api.get(`/admin/api/expenses/${expenseId}`), [expenseId, version]);
  const stock = useLoad(() => api.get("/admin/api/stock"), [version]);
  const [f, setF] = useState(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => { if (load.data) setF(formOf(load.data)); }, [load.data]);

  if (load.error) {
    return (
      <div className="stack">
        <Alert tone="warning" title="Expense not found">It may have been deleted.</Alert>
        <div><Button icon={ArrowLeft} onClick={back}>Back to Add Expenses</Button></div>
      </div>
    );
  }
  if (!load.data || !f) return <p className="muted">Loading…</p>;

  const x = load.data;
  const manual = x.manual;
  const editable = manual || unlocked; // a Tide line opens with Unlock
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const base = formOf(x);
  const dirty = Object.keys(f).some((k) => f[k] !== base[k]);
  const typeInfo = meta.expense_types.find((t) => t.name === f.expense_type);
  const amount = Number(f.amount) || 0;
  const defaultVat = typeInfo ? (typeInfo.vat ? amount / 6 : 0) : Math.abs(Number(x.default_vat));
  const cars = stock.data ?? [];

  const save = async () => {
    if (!f.expense_type) {
      toast("error", "Pick the type of expense.");
      return;
    }
    const body = {
      expense_type: f.expense_type, vat: f.vat === "" ? null : Number(f.vat),
      car_id: f.car_id ? Number(f.car_id) : null, notes: f.notes,
    };
    if (manual) Object.assign(body, { date: f.date, description: f.description, amount: Number(f.amount), paid_by: f.paid_by });
    else if (unlocked) Object.assign(body, { date: f.date, description: f.description, amount: Number(f.amount), unlocked: true });
    if (await run(() => api.patch(`/admin/api/expenses/${x.id}`, body))) {
      setUnlocked(false);
      refresh();
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${x.description}" ${money(x.gross)}? Its receipts go too. This can't be undone.`)) return;
    if (await run(() => api.del(`/admin/api/expenses/${x.id}`))) {
      toast("success", "Expense deleted.");
      refresh();
      back();
    }
  };

  return (
    <div className="stack">
      <div><button type="button" className="back-link" onClick={back}><ArrowLeft size={16} />Add Expenses</button></div>
      <PageHeader title={x.description} subtitle={`${x.refund ? "Refund · " : ""}${ukDate(x.date)} · ${money(x.gross)} · ${x.paid_by === "Bank" ? "Paid from Tide" : `Paid by ${x.paid_by.toLowerCase()}`}`}
        actions={manual && <Button variant="danger" icon={Trash2} busy={busy} onClick={remove}>Delete</Button>} />

      <div className="grid-expenses">
        <Card title="Details">
          <div className="stack">
            {!manual && (
              <div className={`lock-bar ${unlocked ? "is-open" : ""}`}>
                <span className="row" style={{ gap: 8 }}>
                  {unlocked ? <LockOpen size={16} /> : <Lock size={16} />}
                  {unlocked
                    ? "Unlocked: the date, description and amount will no longer match the Tide statement."
                    : "Date, description and amount come from the Tide import."}
                </span>
                <Button size="sm" icon={unlocked ? Lock : LockOpen} onClick={() => {
                  if (unlocked) setF((s) => ({ ...s, date: base.date, description: base.description, amount: base.amount }));
                  setUnlocked(!unlocked);
                }}>{unlocked ? "Lock" : "Unlock"}</Button>
              </div>
            )}
            <div className="grid-2">
              <Field label="Date"><Input type="date" value={f.date} disabled={!editable} onChange={set("date")} /></Field>
              <Field label="Paid by">
                {manual
                  ? <Select options={meta.paid_by.filter((p) => p !== "Bank")} value={f.paid_by} onChange={set("paid_by")} />
                  : <Input value="Bank (Tide)" disabled />}
              </Field>
              <Field label="What was it" className="span-2">
                <Input value={f.description} disabled={!editable} onChange={set("description")} />
              </Field>
              <Field label={x.refund ? "Amount refunded (incl. VAT)" : "Amount paid (incl. VAT)"}><MoneyInput value={f.amount} disabled={!editable} onChange={set("amount")} /></Field>
              <Field label="Type">
                <Select options={[{ value: "", label: "Pick a type…" }, ...meta.expense_types.map((t) => ({
                  value: t.name, label: t.vat || t.name.includes("no VAT") ? t.name : `${t.name} (no VAT)`,
                }))]} value={f.expense_type} onChange={set("expense_type")} />
              </Field>
              <Field label="VAT" hint={`Blank uses ${money(defaultVat)}${typeInfo?.vat ? " (amount / 6)" : ""}`}>
                <MoneyInput value={f.vat} onChange={set("vat")} placeholder={defaultVat.toFixed(2)} />
              </Field>
              <Field label="Car" hint="General for business running costs">
                <Select options={[{ value: "", label: "General" }, ...cars.map((c) => ({
                  value: String(c.id), label: [c.stock_no, c.reg, c.make_model].filter(Boolean).join(" · "),
                }))]} value={f.car_id} onChange={set("car_id")} />
              </Field>
              <Field label="Notes" className="span-2"><Textarea value={f.notes} onChange={set("notes")} /></Field>
            </div>
            <div className="row-end">
              <Button icon={Undo2} disabled={!dirty || busy} onClick={() => setF(base)}>Discard</Button>
              <Button variant="primary" icon={Save} busy={busy} disabled={!dirty} onClick={save}>Save expense</Button>
            </div>
          </div>
        </Card>

        <div className="stack">
          <Card title="Summary">
            <ul className="plain by-type">
              <li><span>Amount</span><strong>{money(x.gross)}</strong></li>
              <li><span>VAT reclaimed</span><strong>{money(x.vat)}</strong></li>
              <li><span>Cost before VAT</span><strong>{money(x.net)}</strong></li>
              <li><span>Linked to</span>{x.car_id
                ? <a href={`/admin/car/${x.car_id}`}><Badge tone="blue">{x.car_reg}</Badge></a>
                : <span className="muted">General</span>}</li>
              <li><span>Source</span><Badge tone="gray" icon={Landmark}>{manual ? "Added by hand" : "Tide"}</Badge></li>
            </ul>
          </Card>
          <Receipts x={x} meta={meta} />
        </div>
      </div>
    </div>
  );
}

function Receipts({ x, meta }) {
  const { version, refresh } = useApp();
  const [run, busy] = useAction();
  const list = useLoad(() => api.get(`/admin/api/transactions/${x.id}/receipts`), [x.id, version]);
  const upload = async (files) => {
    if (!files.length) return;
    const fd = new FormData();
    Array.from(files).forEach((file) => fd.append("files", file));
    if (await run(() => api.post(`/admin/api/transactions/${x.id}/receipts`, fd))) refresh();
  };
  const remove = async (rc) => {
    if (!window.confirm(`Remove ${rc.filename}?`)) return;
    if (await run(() => api.del(`/admin/api/receipts/${rc.id}`))) refresh();
  };
  const rows = list.data ?? [];
  return (
    <Card title={`Receipts${rows.length ? ` · ${rows.length}` : ""}`} icon={Paperclip}>
      <div className="stack-sm">
        {x.needs_receipt && <Alert tone="warning">VAT is being reclaimed, so keep a receipt.</Alert>}
        {rows.length === 0 && !x.needs_receipt && <p className="muted small">No receipts attached.</p>}
        {rows.map((rc) => (
          <div key={rc.id} className="receipt-item">
            <span className="row" style={{ gap: 6, minWidth: 0 }}><FileText size={14} /><span className="ellipsis">{rc.filename}</span></span>
            <span className="row" style={{ gap: 2, flexWrap: "nowrap" }}>
              <a className="icon-btn" href={`/admin/api/receipts/${rc.id}/file`} target="_blank" rel="noreferrer"
                aria-label={`Open ${rc.filename}`} title="Open"><ExternalLink size={14} /></a>
              <button type="button" className="icon-btn" aria-label={`Remove ${rc.filename}`} title="Remove"
                disabled={busy} onClick={() => remove(rc)}><Trash2 size={14} /></button>
            </span>
          </div>
        ))}
        <label className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>
          <Paperclip size={16} />{rows.length ? "Add another" : "Attach receipt"}
          <input type="file" hidden multiple accept={(meta.receipt_types || []).map((t) => `.${t}`).join(",")}
            onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
        {rows.length > 0 && <span className="muted small">{plural(rows.length, "file")} kept on this computer</span>}
      </div>
    </Card>
  );
}
