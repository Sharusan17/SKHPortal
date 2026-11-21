import { Fragment, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowDownLeft, ArrowUp, ArrowUpRight, CheckCircle2, ChevronDown, Download,
  FileText, ListChecks, ListPlus, Link, Plus, Save, Sparkles, SlidersHorizontal,
  Trash2, Undo2, Upload, X, Zap,
} from "lucide-react";
import {
  Alert, Badge, Button, Card, Collapsible, Field, Input, MoneyInput, PageHeader, Progress, Segmented, Select, StatCard, Tabs, Toggle,
  useAction, useLoad, useToast,
} from "../components/ui.jsx";
import { useApp } from "../context.js";
import { api } from "../api.js";
import { money, plural, shortCategory, ukDate } from "../format.js";

const ROLES = [
  ["date", "Date"], ["description", "Description"], ["paid_in", "Paid in"], ["paid_out", "Paid out"],
];
const EMPTY_MAP = Object.fromEntries(ROLES.map(([role]) => [role, null]));

// "2026-08-24" -> "August 2026", for the divider row between months.
const monthLabel = (d) => {
  const [y, m] = String(d ?? "").slice(0, 7).split("-").map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "";
};

// VAT text box -> number, or null for blank (= restore the default). NaN if not a number.
const vatValue = (s) => (String(s ?? "").trim() === "" ? null : Number(s));

// Invoices that still have money to come in (not void, not fully paid).
const isOpenInvoice = (i) => !i.void && (i.payment?.status === "unpaid" || i.payment?.status === "part_paid");

// ---------------------------------------------------------------- page

export default function BankPage() {
  const { meta, period, version, refresh, search } = useApp();
  const [tab, setTab] = useState("transactions");
  const [drafts, setDrafts] = useState({});
  const [allDates, setAllDates] = useState(true); // list every transaction, not just the period's

  const txnLoad = useLoad(() => api.get("/admin/api/transactions", { p: "all" }), [version]);
  const stock = useLoad(() => api.get("/admin/api/stock"), [version]);
  const invoices = useLoad(() => api.get("/admin/api/invoices"), [version]);

  useEffect(() => setDrafts({}), [period.id]);

  if (!txnLoad.data) {
    return txnLoad.error
      ? <Alert tone="error">{txnLoad.error.message}</Alert>
      : <p className="muted">Loading…</p>;
  }

  const everything = txnLoad.data;
  const inPeriod = (t) => {
    const d = String(t.date ?? "").slice(0, 10);
    return d >= period.start && d <= period.end;
  };
  const periodTxns = everything.filter(inPeriod);
  const txns = allDates ? everything : periodTxns; // what the list shows
  // The boxes at the top are always for the selected period.
  const amounts = periodTxns.map((t) => Number(t.amount) || 0);
  const prog = {
    money_in: amounts.filter((a) => a > 0).reduce((s, a) => s + a, 0),
    money_out: -amounts.filter((a) => a < 0).reduce((s, a) => s + a, 0),
    total: txns.length, categorised: txns.filter((t) => t.category !== meta.uncategorised).length,
  };
  const uncat = txns.filter((t) => t.category === meta.uncategorised).length;

  const tabs = [
    { id: "transactions", label: "Transactions", icon: ListChecks, count: uncat },
    { id: "import", label: "Import statement", icon: Upload },
  ];

  // Panels stay mounted so unsaved work survives switching tabs.
  const panel = (id) => ({ display: tab === id ? "block" : "none" });

  return (
    <div className="stack">
      <PageHeader title="Bank" subtitle={`${period.label} · Tide and Barclays transactions and categories`} />
      <div className="grid-3">
        <StatCard tone="sage" icon={ArrowDownLeft} label="Money in" sub={period.label}
          value={prog ? money(prog.money_in) : "…"} />
        <StatCard tone="blush" icon={ArrowUpRight} label="Money out" sub={period.label}
          value={prog ? money(prog.money_out) : "…"} />
        <StatCard tone="lilac" icon={CheckCircle2} label="Categorised"
          sub={allDates ? "All dates" : period.label}
          value={prog ? `${prog.categorised} / ${prog.total}` : "…"} />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <div style={panel("transactions")} className="stack">
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <Segmented ariaLabel="Which dates to list" value={allDates ? "all" : "period"}
            onChange={(v) => setAllDates(v === "all")}
            options={[{ value: "all", label: `All dates (${everything.length})` },
              { value: "period", label: `${period.label} (${periodTxns.length})` }]} />
        </div>
        <TransactionsTab txns={txns} prog={prog} drafts={drafts} setDrafts={setDrafts}
          quarter={period} meta={meta} cars={stock.data ?? []} invoices={invoices.data ?? []}
          search={search} />
        <KeepOpen title="Categorising rules" icon={SlidersHorizontal}>
          <RulesTab />
        </KeepOpen>
      </div>
      <div style={panel("import")}>
        <ImportTab refresh={refresh} />
      </div>
    </div>
  );
}

// A value shown as plain text (wrapping); click it, or Tab to it and press Enter, to edit. Leaving
// the box (or Enter / Esc) shows the text again. type="date" edits with the date picker.
function ClickToEdit({ value, onChange, label, type = "text" }) {
  const [editing, setEditing] = useState(false);
  const done = (e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); setEditing(false); } };
  if (editing) {
    return type === "date" ? (
      <input className="input" type="date" aria-label={label} autoFocus value={value}
        onChange={(e) => onChange(e.target.value)} onBlur={() => setEditing(false)} onKeyDown={done} />
    ) : (
      <textarea className="input click-edit-box" aria-label={label} autoFocus rows={2} value={value}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
        onBlur={() => setEditing(false)} onKeyDown={done} />
    );
  }
  const shown = type === "date" ? (value ? ukDate(value) : "") : value;
  return (
    <span className={`click-edit ${type === "date" ? "nowrap" : ""}`} role="button" tabIndex={0} title="Click to edit"
      aria-label={`${label}: ${shown || "empty"}, click to edit`}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); } }}>
      {shown || <span className="muted">{type === "date" ? "Add a date" : "Add a description"}</span>}
    </span>
  );
}

// Collapsible that stays mounted when closed, so unsaved edits inside it survive.
function KeepOpen({ title, icon: IconC, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`collapsible ${open ? "open" : ""}`}>
      <button type="button" className="collapsible-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{IconC && <IconC size={16} />}{title}</span>
        <ChevronDown size={18} className="chev" />
      </button>
      <div className="collapsible-body" hidden={!open}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- transactions

function TransactionsTab({ txns, prog, drafts, setDrafts, quarter, meta, cars, invoices, search }) {
  const { refresh } = useApp();
  const toast = useToast();
  const [run, busy] = useAction();
  const [onlyUncat, setOnlyUncat] = useState(false);

  if (txns.length === 0) {
    return <Alert tone="info">No bank transactions in {quarter.label}. Import a Tide CSV or Barclays PDF in the Import statement tab.</Alert>;
  }

  const baseOf = (t) => ({
    category: t.category, vat: Number(t.vat).toFixed(2), notes: t.notes ?? "",
    date: String(t.date ?? "").slice(0, 10), description: t.description ?? "",
  });
  const current = (t) => drafts[t.id] ?? baseOf(t);
  const isDirty = (t) => {
    const d = drafts[t.id];
    const b = baseOf(t);
    return !!d && (d.category !== t.category || vatValue(d.vat) !== Number(t.vat) || d.notes !== b.notes
      || d.date !== b.date || d.description !== b.description);
  };
  const dirty = txns.filter(isDirty);
  const edit = (t, patch) => setDrafts((d) => ({ ...d, [t.id]: { ...(d[t.id] ?? baseOf(t)), ...patch } }));

  // The VAT a category gives by default, the same rule the server uses: 1/6 of the gross for a
  // with-VAT category (money out counts as positive for expenses), otherwise 0.00.
  const defaultVat = (category, amount) => {
    if (!(meta.vat_categories || []).includes(category)) return "0.00";
    const gross = (meta.expense_categories || []).includes(category) ? -Number(amount) : Number(amount);
    return (Math.round((gross / 6) * 100) / 100).toFixed(2);
  };
  const pickCategory = (t, category) => edit(t, { category, vat: defaultVat(category, t.amount) });

  const done = prog ? prog.categorised : txns.filter((t) => t.category !== meta.uncategorised).length;
  const total = prog ? prog.total : txns.length;
  const term = String(search ?? "").trim().toLowerCase();
  const view = txns.filter((t) =>
    (!onlyUncat || t.category === meta.uncategorised)
    && (!term || String(t.description ?? "").toLowerCase().includes(term)));

  const openInvoices = invoices.filter(isOpenInvoice);
  // Not linked to anything means a general business line; pick a car or invoice to link it.
  const carOptions = [
    { value: "", label: "General" },
    ...cars.map((c) => ({ value: String(c.id), label: [c.stock_no, c.reg, c.make_model].filter(Boolean).join(" · ") })),
  ];
  // After a credit note, money paid back to the buyer is matched to the invoice as a refund.
  const refundInvoices = invoices.filter((i) => !i.void && Number(i.payment?.refund_owed) > 0);
  const refundOptions = [
    { value: "", label: "Refund for invoice…" },
    ...refundInvoices.map((i) => ({
      value: String(i.id), label: `${i.invoice_no} · ${i.reg ?? ""} · ${money(i.payment.refund_owed)} owed`,
    })),
  ];
  const invoiceOptions = [
    { value: "", label: "General" },
    ...openInvoices.map((i) => ({
      value: String(i.id),
      label: `${i.invoice_no} · ${i.reg ?? ""} · ${i.buyer_name ?? ""} · ${money(i.payment?.outstanding)} due`,
    })),
  ];

  const save = async () => {
    const body = dirty.map((t) => {
      const d = drafts[t.id];
      // VAT left at the category's default goes as blank, so the server keeps it as the default
      // (and not as a figure typed by hand).
      const vat = d.category !== t.category && d.vat === defaultVat(d.category, t.amount) ? null : vatValue(d.vat);
      return {
        id: t.id, category: d.category, vat, notes: d.notes,
        date: d.date || null, description: d.description.trim() || null,
      };
    });
    if (body.some((b) => Number.isNaN(b.vat))) {
      toast("error", "VAT must be a number, or blank to restore the default.");
      return;
    }
    const res = await run(() => api.patch("/admin/api/transactions", body));
    if (res) {
      setDrafts({});
      refresh();
    }
  };

  const autoCategorise = async () => {
    const res = await run(() => api.post("/admin/api/transactions/auto-categorise"));
    if (res) refresh();
  };

  const linkTo = async (t, carId) => {
    const res = await run(() => api.post(`/admin/api/transactions/${t.id}/link`, { car_id: carId }));
    if (res) refresh();
  };

  const payInvoice = async (t, invoiceId) => {
    const res = await run(() => api.post(`/admin/api/transactions/${t.id}/pay-invoice`, { invoice_id: invoiceId }));
    if (res) refresh();
  };

  const unpayInvoice = async (t) => {
    if (!window.confirm(`Take this line off invoice ${t.invoice_no}? The invoice will show ${money(Math.abs(t.amount))} less paid.`)) return;
    const res = await run(() => api.del(`/admin/api/transactions/${t.id}/pay-invoice`));
    if (res) refresh();
  };

  // Only a Car sale line (or one not sorted yet) can pay an invoice. Any other money in, such as
  // a refund from a supplier, is a cost or income of its own: it can be tied to a car or stay General.
  const linkCell = (t) => {
    const moneyIn = Number(t.amount) > 0;
    const canPay = t.category === meta.car_sale || t.category === meta.uncategorised;
    const isCost = (meta.expense_categories || []).includes(t.category);
    return (
      <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
        {t.invoice_no && (
          <>
            <Badge tone="green" icon={FileText}>{`Invoice ${t.invoice_no}`}</Badge>
            <button type="button" className="icon-btn" aria-label={`Take off invoice ${t.invoice_no}`}
              title={`Take off invoice ${t.invoice_no}`} disabled={busy} onClick={() => unpayInvoice(t)}>
              <X size={14} />
            </button>
          </>
        )}
        {t.car_id && (
          <>
            <Badge tone="blue" icon={Link}>{t.car_reg || `Car ${t.car_id}`}</Badge>
            {!t.invoice_id && (
              <button type="button" className="icon-btn" aria-label="Unlink from car" title="Unlink from car"
                disabled={busy} onClick={() => linkTo(t, null)}>
                <X size={14} />
              </button>
            )}
          </>
        )}
        {!t.invoice_id && !t.car_id && (moneyIn ? (
          canPay && openInvoices.length > 0 ? (
            <Select aria-label="Pay invoice" options={invoiceOptions} value="" disabled={busy}
              onChange={(v) => v && payInvoice(t, Number(v))} />
          ) : isCost ? (
            <Select aria-label="Link to car" options={carOptions} value="" disabled={busy}
              onChange={(v) => linkTo(t, v ? Number(v) : null)} />
          ) : <span className="muted small">General</span>
        ) : (
          <>
            <Select aria-label="Link to car" options={carOptions} value="" disabled={busy}
              onChange={(v) => linkTo(t, v ? Number(v) : null)} />
            {canPay && refundInvoices.length > 0 && (
              <Select aria-label="Refund for invoice" options={refundOptions} value="" disabled={busy}
                onChange={(v) => v && payInvoice(t, Number(v))} />
            )}
          </>
        ))}
      </div>
    );
  };

  return (
    <Card className="tone-sky">
      <Progress value={total ? done / total : 0} label={`${done} of ${total} transactions categorised`} />

      <div className="row" style={{ justifyContent: "space-between", marginTop: 14 }}>
        <Toggle checked={onlyUncat} onChange={setOnlyUncat} label="Only uncategorised" />
        <Button icon={Sparkles} busy={busy} onClick={autoCategorise}
          title="Uses your rules, how the same payee was categorised before, and matches car payments to the stock book.">
          Auto-categorise
        </Button>
      </div>

      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th><th>Description</th><th className="r">Amount</th><th>Category</th>
              <th className="r">VAT</th><th>Notes</th><th>Linked to</th>
            </tr>
          </thead>
          <tbody>
            {view.length === 0 && (
              <tr><td colSpan={7} className="muted">
                {term && !onlyUncat ? `Nothing matches "${search}".` : "Everything is categorised."}
              </td></tr>
            )}
            {view.map((t, i) => {
              const d = current(t);
              const month = String(t.date ?? "").slice(0, 7);
              const newMonth = i === 0 || month !== String(view[i - 1].date ?? "").slice(0, 7);
              return (
                <Fragment key={t.id}>
                  {newMonth && (
                    <tr className="month-row">
                      <td colSpan={7}>{monthLabel(t.date)}</td>
                    </tr>
                  )}
                <tr className={isDirty(t) ? "dirty" : ""}>
                  <td style={{ width: 150 }}>
                    <ClickToEdit type="date" label="Date" value={d.date}
                      onChange={(v) => edit(t, { date: v })} />
                  </td>
                  <td style={{ minWidth: 240 }}>
                    <ClickToEdit label="Description" value={d.description}
                      onChange={(v) => edit(t, { description: v })} />
                  </td>
                  <td className="r" style={{ whiteSpace: "nowrap", color: Number(t.amount) > 0 ? "var(--green)" : undefined }}>
                    {money(t.amount)}
                  </td>
                  <td style={{ minWidth: 220 }}>
                    <Select aria-label="Category" options={meta.categories} value={d.category}
                      onChange={(v) => pickCategory(t, v)} />
                  </td>
                  <td className="r" style={{ width: 120 }}>
                    <input className="input" type="number" step="0.01" inputMode="decimal" aria-label="VAT"
                      title="Clear to restore the default (gross / 6)" value={d.vat}
                      style={{ textAlign: "right" }} onChange={(e) => edit(t, { vat: e.target.value })} />
                  </td>
                  <td>
                    <input className="input" aria-label="Notes" value={d.notes}
                      onChange={(e) => edit(t, { notes: e.target.value })} />
                  </td>
                  <td style={{ minWidth: 200 }}>{linkCell(t)}</td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {dirty.length > 0 && (
        <div className="row-end" style={{
          position: "sticky", bottom: 0, zIndex: 2, background: "var(--surface)",
          borderTop: "1px solid var(--border)", padding: "12px 0 0", marginTop: 8,
          justifyContent: "space-between",
        }}>
          <span className="muted small">{plural(dirty.length, "transaction")} changed</span>
          <div className="row">
            <Button icon={Undo2} disabled={busy} onClick={() => setDrafts({})}>Discard</Button>
            <Button variant="primary" icon={Save} busy={busy} onClick={save}>Save transactions</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- import

function ImportTab({ refresh }) {
  const [run, busy] = useAction();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]); // the lines to import, as edited on screen
  const [mapping, setMapping] = useState(EMPTY_MAP);
  const [failed, setFailed] = useState(null); // { id, rows } from the last import
  const [dropKey, setDropKey] = useState(0);
  const [account, setAccount] = useState("Tide");
  const nextId = useRef(1);

  const withIds = (list) => list.map((r) => ({ ...r, id: nextId.current++ }));

  // Read the file (again, after the account or a column changes) into rows to check.
  const load = async (f, opts = {}) => {
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    if (opts.mapping) fd.append("mapping", JSON.stringify(opts.mapping));
    if (opts.account) fd.append("account", opts.account);
    const res = await run(() => api.post("/admin/api/import/preview", fd), { quiet: true });
    if (!res) {
      if (!opts.mapping && !opts.account) reset();
      return;
    }
    setFile(f);
    setPreview(res);
    setRows(withIds(res.rows));
    setMapping({ ...EMPTY_MAP, ...res.guess });
    setAccount(res.account || "Tide");
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setRows([]);
    setMapping(EMPTY_MAP);
    setDropKey((k) => k + 1);
  };

  const edits = rows.some((r) => !r.key) || (preview && rows.length !== preview.rows.length);
  const reload = (opts) => {
    if (edits && !window.confirm("Re-reading the file loses the rows you've added or removed. Carry on?")) return;
    load(file, { mapping, account, ...opts });
  };
  const pickColumn = (role, v) => {
    const next = { ...mapping, [role]: v || null };
    setMapping(next);
    reload({ mapping: next });
  };

  const setRow = (id, k) => (v) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const removeRow = (id) => setRows((rs) => rs.filter((r) => r.id !== id));
  const addRow = () => setRows((rs) => [...rs, ...withIds([{
    key: "", date: rs.length ? rs[rs.length - 1].date : "", description: "", paid_in: "", paid_out: "",
  }])]);

  const bad = (r) => !r.date || !(Number(r.paid_in) || Number(r.paid_out));
  const problems = rows.filter(bad).length;
  const sum = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);

  const doImport = async () => {
    const res = await run(() => api.post("/admin/api/import", {
      account, rows: rows.map(({ key, date, description, paid_in, paid_out }) => ({ key, date, description, paid_in, paid_out })),
    }));
    if (!res) return;
    setFailed(res.failed && res.failed.length ? { id: Date.now(), rows: res.failed } : null);
    reset();
    refresh();
  };

  return (
    <div className="stack">
      {failed && (
        <Collapsible key={failed.id} tone="warning" defaultOpen
          title={<><AlertTriangle size={16} />{`${plural(failed.rows.length, "row")} in the last import had no date or amount and were left out`}</>}>
          <div className="stack-sm">
            <ul className="plain">
              {failed.rows.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <div>
              <Button size="sm" onClick={() => setFailed(null)}>Dismiss</Button>
            </div>
          </div>
        </Collapsible>
      )}

      <Card title="Import a bank statement" icon={Upload} className="tone-lilac">
        <div className="stack">
          <Dropzone key={dropKey} accept=".csv,.pdf" disabled={busy} onFiles={(fs) => load(fs[0])}>
            <strong>Drop a Tide CSV or a Barclays statement PDF here, or click to choose one</strong>
            <span className="small">
              PDFs are read page by page: only the transaction lines are taken, so balances, the summary
              and the legal pages are skipped.
            </span>
          </Dropzone>

          {preview && (
            <>
              <div style={{ width: 220, maxWidth: "100%" }}>
                <Field label="Bank account">
                  <Select value={account} onChange={(v) => { setAccount(v); reload({ account: v }); }}
                    options={(preview.accounts || ["Tide", "Barclays"]).map((a) => ({ value: a, label: a }))} />
                </Field>
              </div>

              {!preview.pdf && (
                <Collapsible title="Columns in the CSV (picked automatically, change if wrong)">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                    {ROLES.map(([role, label]) => (
                      <Field key={role} label={label}>
                        <Select value={mapping[role] ?? ""} onChange={(v) => pickColumn(role, v)}
                          options={[{ value: "", label: "(not used)" }, ...preview.columns.map((c) => ({ value: c, label: c }))]} />
                      </Field>
                    ))}
                  </div>
                </Collapsible>
              )}

              {preview.failed.length > 0 && (
                <Collapsible tone="warning"
                  title={<><AlertTriangle size={16} />{`${plural(preview.failed.length, "line")} in the file had no date or amount`}</>}>
                  <div className="stack-sm">
                    <p className="muted small">
                      Usually totals, balances or headings. If one is a real transaction, add it with Add a row.
                    </p>
                    <ul className="plain">{preview.failed.map((f, i) => <li key={i}>{f}</li>)}</ul>
                  </div>
                </Collapsible>
              )}

              <div className="muted small">
                {file.name}: {plural(rows.length, "row")} to import. Check them, change anything that's wrong,
                and add or remove rows before importing.
              </div>
              <div className="table-wrap">
                <table className="table import-edit">
                  <thead>
                    <tr>
                      <th style={{ width: 160 }}>Date</th><th>Description</th>
                      <th className="r" style={{ width: 150 }}>Paid out</th>
                      <th className="r" style={{ width: 150 }}>Paid in</th><th style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={5} className="muted">No rows. Add one below.</td></tr>
                    )}
                    {rows.map((r) => (
                      <tr key={r.id} className={bad(r) ? "row-problem" : ""}>
                        <td>
                          <Input type="date" aria-label="Date" value={r.date}
                            onChange={(e) => setRow(r.id, "date")(e.target.value)} />
                        </td>
                        <td>
                          <Input aria-label="Description" value={r.description}
                            onChange={(e) => setRow(r.id, "description")(e.target.value)} />
                        </td>
                        <td><MoneyInput aria-label="Paid out" value={r.paid_out} onChange={setRow(r.id, "paid_out")} /></td>
                        <td><MoneyInput aria-label="Paid in" value={r.paid_in} onChange={setRow(r.id, "paid_in")} /></td>
                        <td>
                          <button type="button" className="btn btn-ghost btn-sm" aria-label="Remove this row"
                            onClick={() => removeRow(r.id)}><Trash2 size={15} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={2}><strong>Total</strong></td>
                        <td className="r"><strong>{money(sum("paid_out"))}</strong></td>
                        <td className="r"><strong>{money(sum("paid_in"))}</strong></td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <style>{`
                .import-edit td { vertical-align: middle; }
                .import-edit .input { min-width: 0; }
                .import-edit tr.row-problem td { background: rgba(220, 120, 40, .08); }
              `}</style>

              {problems > 0 && (
                <Alert tone="warning">
                  {plural(problems, "row")} {problems === 1 ? "needs" : "need"} a date and a paid out or paid in
                  amount. Fill it in or remove it.
                </Alert>
              )}
              <div className="row" style={{ justifyContent: "space-between" }}>
                <Button icon={Plus} onClick={addRow}>Add a row</Button>
                <div className="row" style={{ gap: 8 }}>
                  <Button variant="ghost" icon={X} onClick={reset}>Cancel</Button>
                  <Button variant="primary" icon={Download} busy={busy} disabled={!rows.length || problems > 0}
                    onClick={doImport}>
                    {`Import ${plural(rows.length, "row")}`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

// Drop target that also works as a plain file picker. `children` is the prompt text.
function Dropzone({ accept, multiple = false, disabled = false, onFiles, children }) {
  const [over, setOver] = useState(false);
  const pick = (list) => {
    if (list && list.length) onFiles(Array.from(list));
  };
  return (
    <label className={`dropzone ${over ? "over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) pick(e.dataTransfer.files);
      }}>
      <Upload size={24} />
      {children}
      <input type="file" accept={accept} multiple={multiple} disabled={disabled}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }} />
    </label>
  );
}

// ---------------------------------------------------------------- rules

function RulesTab() {
  const { meta, version, refresh } = useApp();
  const toast = useToast();
  const [run, busy] = useAction();
  const rules = useLoad(() => api.get("/admin/api/rules"), [version]);
  const [rows, setRows] = useState([]);
  const seq = useRef(0);

  useEffect(() => {
    if (rules.data) setRows(rules.data.map((r) => ({ ...r, key: ++seq.current })));
  }, [rules.data]);

  const cats = meta.categories;
  const quickCats = cats.filter((c) => c !== meta.uncategorised);
  const starter = meta.starter_rules || [];

  const [kw, setKw] = useState("");
  const [qcat, setQcat] = useState(quickCats[0]);
  const quick = quickCats.includes(qcat) ? qcat : quickCats[0];

  const patch = (key, p) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const removeRow = (key) => setRows((rs) => rs.filter((r) => r.key !== key));
  const addRow = () => setRows((rs) => [...rs, { key: ++seq.current, keyword: "", category: quickCats[0] }]);
  const move = (i, dir) => setRows((rs) => {
    const j = i + dir;
    if (j < 0 || j >= rs.length) return rs;
    const next = [...rs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const saveRules = async () => {
    const blank = rows.findIndex((r) => !r.keyword.trim());
    if (blank !== -1) {
      toast("error", `Rule ${blank + 1} needs a keyword.`);
      return;
    }
    const res = await run(() => api.put("/admin/api/rules", rows.map(({ keyword, category }) => ({
      keyword: keyword.trim(), category,
    }))));
    if (res) refresh();
  };

  const addQuick = async () => {
    if (!kw.trim()) {
      toast("error", "Enter a keyword.");
      return;
    }
    const res = await run(() => api.post("/admin/api/rules", { keyword: kw.trim(), category: quick }));
    if (res) {
      setKw("");
      refresh();
    }
  };

  const addStarter = async () => {
    const res = await run(() => api.post("/admin/api/rules/starter"));
    if (res) refresh();
  };

  return (
    <div className="stack">
      <Card title="Rules" icon={SlidersHorizontal} className="tone-lilac">
        <p className="muted small">Applied on import, top to bottom. The first keyword found in the description wins.</p>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr><th>Keyword</th><th>Category</th><th className="r" aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td>
                    <input className="input" aria-label="Keyword" value={r.keyword}
                      onChange={(e) => patch(r.key, { keyword: e.target.value })} />
                  </td>
                  <td style={{ minWidth: 240 }}>
                    <Select aria-label="Category" options={cats} value={r.category}
                      onChange={(v) => patch(r.key, { category: v })} />
                  </td>
                  <td className="r">
                    <span className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap", gap: 4 }}>
                      <button className="icon-btn" aria-label="Move up" disabled={i === 0}
                        style={{ opacity: i === 0 ? 0.3 : undefined }} onClick={() => move(i, -1)}>
                        <ArrowUp size={16} />
                      </button>
                      <button className="icon-btn" aria-label="Move down" disabled={i === rows.length - 1}
                        style={{ opacity: i === rows.length - 1 ? 0.3 : undefined }} onClick={() => move(i, 1)}>
                        <ArrowDown size={16} />
                      </button>
                      <button className="icon-btn" aria-label="Delete rule" onClick={() => removeRow(r.key)}>
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <Button icon={Plus} onClick={addRow} disabled={busy}>Add rule</Button>
          <Button variant="primary" icon={Save} busy={busy} onClick={saveRules}>Save rules</Button>
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Quick rule" icon={Zap} className="tone-sand">
          <div className="stack">
            <Field label="When the description contains">
              <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="e.g. shell" />
            </Field>
            <Field label="Set category to">
              <Select options={quickCats} value={quick} onChange={setQcat} />
            </Field>
            <div>
              <Button variant="primary" icon={Plus} busy={busy} onClick={addQuick}>Add rule and apply</Button>
            </div>
          </div>
        </Card>

        <Card title="Starter rules" icon={ListPlus} className="tone-blush">
          <div className="stack">
            <p className="muted small">
              Common payees for a car dealer: {starter.map(([k, c]) => `${k} → ${shortCategory(c)}`).join(", ")}.
            </p>
            <div>
              <Button icon={ListPlus} busy={busy} onClick={addStarter}>Add starter rules</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
