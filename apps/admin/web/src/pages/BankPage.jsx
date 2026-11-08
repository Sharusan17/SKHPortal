import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowDownLeft, ArrowUp, ArrowUpRight, CheckCircle2, ChevronDown, Download,
  FileText, ListChecks, ListPlus, Link, Plus, Save, Sparkles, SlidersHorizontal,
  Trash2, Undo2, Upload, X, Zap,
} from "lucide-react";
import {
  Alert, Badge, Button, Card, Collapsible, Field, Input, PageHeader, Progress, Select, StatCard, Tabs, Toggle,
  useAction, useLoad, useToast,
} from "../components/ui.jsx";
import { useApp } from "../context.js";
import { api } from "../api.js";
import { money, plural, shortCategory, ukDate } from "../format.js";

const ROLES = [
  ["date", "Date"], ["description", "Description"], ["paid_in", "Paid in"],
  ["paid_out", "Paid out"], ["amount", "Signed amount"],
];
const EMPTY_MAP = Object.fromEntries(ROLES.map(([role]) => [role, null]));

// VAT text box -> number, or null for blank (= restore the default). NaN if not a number.
const vatValue = (s) => (String(s ?? "").trim() === "" ? null : Number(s));

// Invoices that still have money to come in (not void, not fully paid).
const isOpenInvoice = (i) => !i.void && (i.payment?.status === "unpaid" || i.payment?.status === "part_paid");

// ---------------------------------------------------------------- page

export default function BankPage() {
  const { meta, period, version, refresh, search } = useApp();
  const [tab, setTab] = useState("transactions");
  const [drafts, setDrafts] = useState({});

  const txnLoad = useLoad(() => api.get("/admin/api/transactions", { p: period.id }), [period.id, version]);
  const stock = useLoad(() => api.get("/admin/api/stock"), [version]);
  const invoices = useLoad(() => api.get("/admin/api/invoices"), [version]);

  useEffect(() => setDrafts({}), [period.id]);

  if (!txnLoad.data) {
    return txnLoad.error
      ? <Alert tone="error">{txnLoad.error.message}</Alert>
      : <p className="muted">Loading…</p>;
  }

  const txns = txnLoad.data;
  const amounts = txns.map((t) => Number(t.amount) || 0);
  const prog = {
    money_in: amounts.filter((a) => a > 0).reduce((s, a) => s + a, 0),
    money_out: -amounts.filter((a) => a < 0).reduce((s, a) => s + a, 0),
    total: txns.length, categorised: txns.filter((t) => t.category !== meta.uncategorised).length,
  };
  const uncat = txns.filter((t) => t.category === meta.uncategorised).length;

  const tabs = [
    { id: "transactions", label: "Transactions", icon: ListChecks, count: uncat },
    { id: "import", label: "Import CSV", icon: Upload },
  ];

  // Panels stay mounted so unsaved work survives switching tabs.
  const panel = (id) => ({ display: tab === id ? "block" : "none" });

  return (
    <div className="stack">
      <PageHeader title="Bank" subtitle={`${period.label} · Tide transactions and categories`} />
      <div className="grid-3">
        <StatCard tone="sage" icon={ArrowDownLeft} label="Money in" sub={period.label}
          value={prog ? money(prog.money_in) : "…"} />
        <StatCard tone="blush" icon={ArrowUpRight} label="Money out" sub={period.label}
          value={prog ? money(prog.money_out) : "…"} />
        <StatCard tone="lilac" icon={CheckCircle2} label="Categorised" sub="Transactions done"
          value={prog ? `${prog.categorised} / ${prog.total}` : "…"} />
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <div style={panel("transactions")} className="stack">
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
    return <Alert tone="info">No bank transactions in {quarter.label}. Import a Tide CSV in the Import CSV tab.</Alert>;
  }

  const baseOf = (t) => ({ category: t.category, vat: Number(t.vat).toFixed(2), notes: t.notes ?? "" });
  const current = (t) => drafts[t.id] ?? baseOf(t);
  const isDirty = (t) => {
    const d = drafts[t.id];
    return !!d && (d.category !== t.category || vatValue(d.vat) !== Number(t.vat) || d.notes !== (t.notes ?? ""));
  };
  const dirty = txns.filter(isDirty);
  const edit = (t, patch) => setDrafts((d) => ({ ...d, [t.id]: { ...(d[t.id] ?? baseOf(t)), ...patch } }));

  const done = prog ? prog.categorised : txns.filter((t) => t.category !== meta.uncategorised).length;
  const total = prog ? prog.total : txns.length;
  const term = String(search ?? "").trim().toLowerCase();
  const view = txns.filter((t) =>
    (!onlyUncat || t.category === meta.uncategorised)
    && (!term || String(t.description ?? "").toLowerCase().includes(term)));

  const openInvoices = invoices.filter(isOpenInvoice);
  const carOptions = [
    { value: "", label: "Link to car…" },
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
    { value: "", label: "Pay invoice…" },
    ...openInvoices.map((i) => ({
      value: String(i.id),
      label: `${i.invoice_no} · ${i.reg ?? ""} · ${i.buyer_name ?? ""} · ${money(i.payment?.outstanding)} due`,
    })),
  ];

  const save = async () => {
    const body = dirty.map((t) => {
      const d = drafts[t.id];
      return { id: t.id, category: d.category, vat: vatValue(d.vat), notes: d.notes };
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

  // Money in can be paid against an invoice; money out can be linked to a car.
  const linkCell = (t) => {
    const moneyIn = Number(t.amount) > 0;
    return (
      <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
        {t.invoice_no && <Badge tone="green" icon={FileText}>{`Invoice ${t.invoice_no}`}</Badge>}
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
          openInvoices.length > 0 ? (
            <Select aria-label="Pay invoice" options={invoiceOptions} value="" disabled={busy}
              onChange={(v) => v && payInvoice(t, Number(v))} />
          ) : <span className="muted small">No open invoices</span>
        ) : (
          <>
            <Select aria-label="Link to car" options={carOptions} value="" disabled={busy}
              onChange={(v) => linkTo(t, v ? Number(v) : null)} />
            {refundInvoices.length > 0 && (
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
            {view.map((t) => {
              const d = current(t);
              return (
                <tr key={t.id} className={isDirty(t) ? "dirty" : ""}>
                  <td style={{ whiteSpace: "nowrap" }}>{ukDate(t.date)}</td>
                  <td>{t.description}</td>
                  <td className="r" style={{ color: Number(t.amount) > 0 ? "var(--green)" : undefined }}>
                    {money(t.amount)}
                  </td>
                  <td style={{ minWidth: 220 }}>
                    <Select aria-label="Category" options={meta.categories} value={d.category}
                      onChange={(v) => edit(t, { category: v })} />
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
  const [mapping, setMapping] = useState(EMPTY_MAP);
  const [failed, setFailed] = useState(null); // { id, rows } from the last import
  const [dropKey, setDropKey] = useState(0);

  const chooseFile = async (f) => {
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    const res = await run(() => api.post("/admin/api/import/preview", fd));
    if (!res) {
      setFile(null);
      setPreview(null);
      setDropKey((k) => k + 1);
      return;
    }
    setFile(f);
    setPreview(res);
    setMapping({ ...EMPTY_MAP, ...res.guess });
  };

  const ready = !!(mapping.date && (mapping.amount || mapping.paid_in || mapping.paid_out));
  const colOptions = [{ value: "", label: "(not used)" }, ...(preview ? preview.columns : []).map((c) => ({ value: c, label: c }))];

  const doImport = async () => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapping", JSON.stringify(Object.fromEntries(ROLES.map(([r]) => [r, mapping[r] || null]))));
    const res = await run(() => api.post("/admin/api/import", fd));
    if (!res) return;
    setFailed(res.failed && res.failed.length ? { id: Date.now(), rows: res.failed } : null);
    setFile(null);
    setPreview(null);
    setMapping(EMPTY_MAP);
    setDropKey((k) => k + 1);
    refresh();
  };

  return (
    <div className="stack">
      {failed && (
        <Collapsible key={failed.id} tone="warning" defaultOpen
          title={<><AlertTriangle size={16} />{`${plural(failed.rows.length, "row")} in the last import couldn't be read and were skipped`}</>}>
          <div className="stack-sm">
            <p className="muted small">
              Usually totals, balances or blank lines, which is fine. Check any that look like real transactions.
            </p>
            <ul className="plain">
              {failed.rows.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <div>
              <Button size="sm" onClick={() => setFailed(null)}>Dismiss</Button>
            </div>
          </div>
        </Collapsible>
      )}

      <Card title="Import a Tide CSV" icon={Upload} className="tone-lilac">
        <div className="stack">
          <Dropzone key={dropKey} accept=".csv" disabled={busy} onFiles={(fs) => chooseFile(fs[0])}>
            <strong>Drop a Tide CSV here, or click to choose one</strong>
            <span className="small">Exported from Tide as CSV</span>
          </Dropzone>

          {preview && (
            <>
              <div>
                <strong>Columns</strong>{" "}
                <span className="muted small">(detected automatically, change if wrong)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                {ROLES.map(([role, label]) => (
                  <Field key={role} label={label}>
                    <Select options={colOptions} value={mapping[role] ?? ""}
                      onChange={(v) => setMapping((m) => ({ ...m, [role]: v || null }))} />
                  </Field>
                ))}
              </div>

              <div>
                <span className="muted small">
                  {file.name}. Showing the first {preview.preview.length} of {plural(preview.rows, "row")}.
                </span>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>{preview.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, i) => (
                      <tr key={i}>{preview.columns.map((c) => <td key={c}>{row[c]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!ready && (
                <Alert tone="warning">Pick a date column and either paid in / paid out or a signed amount.</Alert>
              )}
              <div className="row-end">
                <Button variant="primary" icon={Download} busy={busy} disabled={!ready} onClick={doImport}>
                  {`Import ${plural(preview.rows, "row")}`}
                </Button>
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
