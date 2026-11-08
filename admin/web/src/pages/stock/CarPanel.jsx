import { useEffect, useState } from "react";
import { ArrowLeft, Calculator, CheckCircle2, FileText, Save, Trash2, X } from "lucide-react";
import { api } from "../../api.js";
import {
  Alert, Badge, Button, Card, Field, IconButton, Input, MoneyInput, Segmented, Select, Tabs, Textarea,
  Toggle, useAction, useLoad, useToast,
} from "../../components/ui.jsx";
import { useApp } from "../../context.js";
import { money, plural, shortCategory, todayIso, ukDate } from "../../format.js";
import { dateOnly, numOrNull, STATUS_OPTIONS } from "./stockShared.js";
import { navigate } from "../../router.js";

const TABS = [
  { id: "purchase", label: "Purchase" },
  { id: "vehicle", label: "Vehicle" },
  { id: "costs", label: "Costs" },
  { id: "documents", label: "Documents" },
  { id: "sale", label: "Sale" },
];
const DOC_KINDS = ["Purchase invoice", "Auction bill", "Repair receipt", "Other"];
const FEE_VAT_HINT = "No VAT on the fee (auctioneers' scheme) — it counts towards the margin. "
  + "VAT shown — it's reclaimed in Box 4.";
const PURCHASE_KEYS = ["auction_house", "lot_no", "purchase_date", "scheme", "purchase_price", "purchase_vat",
  "buyer_fee", "buyer_fee_vat", "purchase_invoice_no", "seller_name", "purchase_paid_on"];
const VEHICLE_KEYS = ["reg", "make_model", "colour", "first_reg", "mileage", "asking_price", "notes"];
const NUMBER_KEYS = ["purchase_price", "purchase_vat", "buyer_fee", "buyer_fee_vat", "asking_price"];
const DATE_KEYS = ["purchase_date", "purchase_paid_on", "first_reg"];

const str = (v) => (v === null || v === undefined ? "" : String(v));

function formFrom(c) {
  return {
    reg: str(c.reg), make_model: str(c.make_model), scheme: c.scheme || "Margin",
    purchase_date: dateOnly(c.purchase_date), purchase_price: str(c.purchase_price), purchase_vat: str(c.purchase_vat),
    auction_house: str(c.auction_house), lot_no: str(c.lot_no), buyer_fee: str(c.buyer_fee),
    buyer_fee_vat: str(c.buyer_fee_vat), purchase_invoice_no: str(c.purchase_invoice_no),
    seller_name: str(c.seller_name), purchase_paid_on: dateOnly(c.purchase_paid_on),
    colour: str(c.colour), first_reg: dateOnly(c.first_reg), mileage: str(c.mileage),
    asking_price: str(c.asking_price), notes: str(c.notes),
  };
}

// Builds the PATCH body for the given keys: blanks become null, numbers and dates are typed.
function payload(form, keys) {
  const out = {};
  for (const k of keys) {
    const v = form[k];
    if (NUMBER_KEYS.includes(k)) out[k] = numOrNull(v);
    else if (DATE_KEYS.includes(k)) out[k] = v || null;
    else if (k === "scheme") out[k] = v;
    else out[k] = str(v).trim() || null;
  }
  return out;
}

const STAGE_TONE = { completed: "green", sold: "blue" };

// Side drawer for one car (full width on a phone). Each section saves its own fields.
export default function CarPanel({ car, onClose, page = false }) {
  const { meta, refresh } = useApp();
  const today = meta.today || todayIso();
  const schemes = meta.car_schemes;
  const [tab, setTab] = useState("purchase");
  const [form, setForm] = useState(() => formFrom(car));
  const [stageTo, setStageTo] = useState(car.status || "bought");
  const [save, saving] = useAction();

  // A different car: reset the form and the tab. The same car reloading keeps what is typed.
  useEffect(() => {
    setForm(formFrom(car));
    setStageTo(car.status || "bought");
    setTab("purchase");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car.id]);

  useEffect(() => {
    if (page) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, page]);

  const put = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const inp = (k) => ({ value: form[k] ?? "", onChange: (e) => put(k)(e.target.value) });

  const saveFields = async (keys, extra = {}) => {
    const res = await save(() => api.patch(`/admin/api/cars/${car.id}`, { ...payload(form, keys), ...extra }));
    if (res) refresh();
  };

  const savePurchase = () => saveFields(PURCHASE_KEYS, form.scheme === "Standard" ? {} : { purchase_vat: null });
  const saveVehicle = () => saveFields(VEHICLE_KEYS);

  const markBillPaid = async () => {
    const res = await save(() => api.patch(`/admin/api/cars/${car.id}`, { purchase_paid_on: today }));
    if (res) { put("purchase_paid_on")(today); refresh(); }
  };

  const moveStage = async () => {
    const res = await save(() => api.patch(`/admin/api/cars/${car.id}`, { status: stageTo }));
    if (res) refresh();
  };

  const stageTone = STAGE_TONE[car.stage] || "gray";

  const deleteCar = async () => {
    if (!window.confirm(`Delete ${car.reg || "this car"} from the stock book? This can't be undone.`)) return;
    const res = await save(() => api.put("/admin/api/cars", { rows: [], shown_ids: [car.id] }));
    if (res) { refresh(); onClose(); }
  };

  const sections = (
    <>

        {!car.sale_date && (
          <div className="row" style={{ gap: 8 }}>
            <div style={{ width: 200, maxWidth: "100%" }}>
              <Select value={stageTo} onChange={setStageTo} aria-label="Move to stage"
                options={STATUS_OPTIONS.map((k) => ({ value: k, label: meta.car_stages[k] || k }))} />
            </div>
            <Button size="sm" busy={saving} disabled={stageTo === car.status} onClick={moveStage}>
              Move to this stage
            </Button>
          </div>
        )}

        <Tabs tabs={TABS} value={tab} onChange={setTab} />

        {tab === "purchase" && (
          <Card>
            <div className="stack">
              <div className="grid-2">
                <Field label="Auction house"><Input {...inp("auction_house")} /></Field>
                <Field label="Lot no"><Input {...inp("lot_no")} /></Field>
                <Field label="Purchase date"><Input type="date" {...inp("purchase_date")} /></Field>
                <Field label="Scheme">
                  <Segmented ariaLabel="Scheme" options={schemes} value={form.scheme} onChange={put("scheme")} />
                </Field>
                <Field label="Purchase price">
                  <MoneyInput value={form.purchase_price} onChange={put("purchase_price")} />
                </Field>
                <Field label="Purchase VAT"
                  hint={form.scheme === "Standard" ? undefined : "Margin cars have no purchase VAT."}>
                  <MoneyInput value={form.purchase_vat} disabled={form.scheme !== "Standard"}
                    onChange={put("purchase_vat")} />
                </Field>
                <Field label="Buyer's fee">
                  <MoneyInput value={form.buyer_fee} onChange={put("buyer_fee")} />
                </Field>
                <Field label="VAT shown on the fee">
                  <MoneyInput value={form.buyer_fee_vat} onChange={put("buyer_fee_vat")} />
                </Field>
              </div>
              <p className="small muted" style={{ marginTop: -6 }}>{FEE_VAT_HINT}</p>
              <div className="grid-2">
                <Field label="Purchase invoice no"><Input {...inp("purchase_invoice_no")} /></Field>
                <Field label="Bought from"><Input {...inp("seller_name")} /></Field>
                <Field label="Bill paid on"
                  hint={car.bill_paid && !car.purchase_paid_on
                    ? "Marked paid from a matching bank payment." : undefined}>
                  <Input type="date" {...inp("purchase_paid_on")} />
                </Field>
                {!car.purchase_paid_on && (
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <Button icon={CheckCircle2} busy={saving} onClick={markBillPaid}>Mark bill paid today</Button>
                  </div>
                )}
              </div>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Button variant="primary" icon={Save} busy={saving} onClick={savePurchase}>Save purchase</Button>
              </div>
            </div>
          </Card>
        )}

        {tab === "vehicle" && (
          <Card>
            <div className="stack">
              <div className="grid-2">
                <Field label="Reg"><Input {...inp("reg")} /></Field>
                <Field label="Make / model"><Input {...inp("make_model")} /></Field>
                <Field label="Colour"><Input {...inp("colour")} /></Field>
                <Field label="First registered"><Input type="date" {...inp("first_reg")} /></Field>
                <Field label="Mileage"><Input inputMode="numeric" {...inp("mileage")} /></Field>
                <Field label="Asking price">
                  <MoneyInput value={form.asking_price} onChange={put("asking_price")} />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea {...inp("notes")} />
              </Field>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Button variant="primary" icon={Save} busy={saving} onClick={saveVehicle}>Save vehicle</Button>
              </div>
            </div>
          </Card>
        )}

        {tab === "vehicle" && <VehicleCheck car={car} />}
        {tab === "costs" && <CostsSection car={car} />}
        {tab === "documents" && <DocumentsSection car={car} />}
        {tab === "sale" && <SaleSection car={car} today={today} />}
    </>
  );

  if (page) {
    return (
      <div className="stack">
        <div className="page-head">
          <div style={{ minWidth: 0 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginLeft: -10 }}>
              <ArrowLeft size={16} /> <span>Stock Book</span>
            </button>
            <h1 style={{ marginTop: 4 }}>{car.reg || "No reg yet"}</h1>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <span className="muted">{car.make_model || "No make or model yet"} · {car.stock_no}</span>
              <Badge tone={stageTone}>{car.stage_label}</Badge>
              {!car.sale_date && !car.bill_paid && <Badge tone="orange">Bill unpaid</Badge>}
            </div>
          </div>
          {!car.invoice && (
            <div className="page-actions">
              <Button variant="danger" icon={Trash2} busy={saving} onClick={deleteCar}>Delete car</Button>
            </div>
          )}
        </div>
        <div className="car-page">
          <div className="stack" style={{ minWidth: 0 }}>{sections}</div>
          <CarSummary car={car} />
        </div>
        <style>{`
          .car-page { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
          @media (max-width: 1000px) { .car-page { grid-template-columns: minmax(0, 1fr); } }
        `}</style>
      </div>
    );
  }

  return (
    <div style={overlay} onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={`${car.reg || "Car"} details`} style={drawer}
        onClick={(e) => e.stopPropagation()}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 22 }}>{car.reg || "No reg yet"}</h2>
            <div className="small muted">{car.make_model || "No make or model yet"} · {car.stock_no}</div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <Badge tone={stageTone}>{car.stage_label}</Badge>
              {car.days_in_stock != null && <span className="small muted">{car.days_in_stock} days in stock</span>}
            </div>
          </div>
          <IconButton icon={X} label="Close car details" onClick={onClose} />
        </header>
        {sections}
      </aside>
    </div>
  );
}

// DVLA and DVSA facts for the car: tax and MOT dates, fuel, engine and the mileage at every MOT.
function VehicleCheck({ car }) {
  const { meta, refresh } = useApp();
  const [run, busy] = useAction();
  const enabled = meta.lookups && (meta.lookups.dvla || meta.lookups.mot);
  const history = car.mileage_history || [];
  const drops = [];
  history.reduce((last, t) => {
    if (t.miles == null) return last;
    if (last && t.miles < last.miles) drops.push(`${last.miles.toLocaleString("en-GB")} on ${ukDate(last.date)} → ${t.miles.toLocaleString("en-GB")} on ${ukDate(t.date)}`);
    return t;
  }, null);
  const check = async () => {
    const res = await run(() => api.post(`/admin/api/cars/${car.id}/check`));
    if (res) refresh();
  };
  const facts = [
    ["Road tax due", car.tax_due ? ukDate(car.tax_due) : null],
    ["MOT expires", car.mot_expiry ? ukDate(car.mot_expiry) : null],
    ["Fuel", car.fuel_type],
    ["Engine", car.engine_cc ? `${car.engine_cc}cc` : null],
  ].filter(([, v]) => v);
  return (
    <Card title="DVLA and MOT check" actions={enabled ? (
      <Button size="sm" busy={busy} onClick={check} disabled={!car.reg}>
        {car.checked_at ? "Check again" : "Check with DVLA and DVSA"}
      </Button>
    ) : null}>
      <div className="stack-sm">
        {!enabled && (
          <p className="small muted">
            Add your DVLA key (and DVSA MOT history keys) to .env to fill in tax, MOT and mileage history from the reg.
          </p>
        )}
        {enabled && !car.checked_at && <p className="small muted">Not checked yet.</p>}
        {car.checked_at && <p className="small muted">Last checked {ukDate(car.checked_at)}.</p>}
        {facts.map(([label, v]) => <Line key={label} label={label} value={v} />)}
        {drops.length > 0 && (
          <Alert tone="warning" title="Mileage went down between MOTs">
            {drops.join("; ")}. The mileage may have been altered or a reading mistyped; check before selling.
          </Alert>
        )}
        {history.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>MOT date</th><th>Result</th><th className="r">Mileage</th></tr></thead>
              <tbody>
                {[...history].reverse().map((t) => (
                  <tr key={t.date + t.result}>
                    <td>{ukDate(t.date)}</td>
                    <td><Badge tone={/pass/i.test(t.result) ? "green" : "red"}>{/pass/i.test(t.result) ? "Pass" : "Fail"}</Badge></td>
                    <td className="r">{t.miles != null ? t.miles.toLocaleString("en-GB") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

// The money for one car at a glance, beside its details on the car page.
function CarSummary({ car }) {
  const rows = [
    ["Bought for", car.bought_for],
    ["Prep and repair costs", car.costs_net],
    ["Asking price", car.asking_price],
    ["Sold for", car.sale_price],
    ["VAT due on the sale", car.vat_due],
  ].filter(([, v]) => v !== null && v !== undefined);
  return (
    <Card title="Summary">
      <div className="stack-sm">
        {rows.map(([label, v]) => <Line key={label} label={label} value={money(v)} />)}
        {car.profit != null && <Line label="Profit before tax" value={money(car.profit)} strong />}
        <Line label="Days in stock" value={car.days_in_stock ?? 0} />
        {car.invoice && <Line label={`Invoice ${car.invoice.invoice_no}`} value={car.invoice.status === "paid"
          ? "Paid" : `${money(car.invoice.outstanding)} to come`} />}
        {(car.credit_notes || []).map((n) => (
          <Line key={n.credit_no} label={`${n.credit_no} · ${n.kind_label} (invoice ${n.invoice_no})`}
            value={`-${money(n.amount)}`} />
        ))}
      </div>
    </Card>
  );
}

const overlay = {
  position: "fixed", inset: 0, background: "rgba(17, 17, 17, .32)", zIndex: 40,
  display: "flex", justifyContent: "flex-end",
};
const drawer = {
  width: "min(580px, 100%)", height: "100%", overflowY: "auto", background: "var(--bg)",
  padding: 20, display: "flex", flexDirection: "column", gap: 14, boxShadow: "var(--shadow-lg)",
};

// ---------------------------------------------------------------- costs

function CostsSection({ car }) {
  const { quarter, version, refresh } = useApp();
  const txns = useLoad(() => api.get("/admin/api/transactions", { q: quarter.id }), [quarter.id, version]);
  const [pick, setPick] = useState("");
  const [linkAct, linking] = useAction();
  const costs = car.costs || [];
  const available = (txns.data || [])
    .filter((t) => t.amount < 0 && t.car_id == null)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const link = async (txnId, carId) => {
    const res = await linkAct(() => api.post(`/admin/api/transactions/${txnId}/link`, { car_id: carId }));
    if (res) { setPick(""); refresh(); txns.reload(); }
  };

  const pickOptions = [
    { value: "", label: available.length ? "Choose a bank payment…" : "No unlinked payments this quarter" },
    ...available.map((t) => ({
      value: String(t.id), label: `${ukDate(t.date)} · ${t.description} · ${money(-t.amount)}`,
    })),
  ];

  return (
    <Card>
      <div className="stack">
        <div>
          <h3 style={{ marginBottom: 4 }}>Linked costs</h3>
          <p className="small muted">
            Bank payments that are costs of this car. They count towards profit. Linking doesn't change the VAT on a line.
          </p>
        </div>

        {costs.length === 0 && <p className="small muted">No costs linked yet.</p>}
        {costs.map((c) => (
          <div key={c.id} className="list-row" style={{ alignItems: "center" }}>
            <span className="list-text">
              <span className="list-title">{c.description}</span>
              <span className="list-sub">
                {ukDate(c.date)} · {shortCategory(c.category)} · VAT {money(c.vat)}
                {c.receipts ? ` · ${plural(c.receipts, "receipt")}` : ""}
              </span>
            </span>
            <span className="list-value">{money(c.net)} net</span>
            <IconButton icon={X} label={`Unlink ${c.description}`} disabled={linking}
              onClick={() => link(c.id, null)} />
          </div>
        ))}
        {costs.length > 0 && (
          <div className="small" style={{ textAlign: "right" }}>
            Total net <strong>{money(car.costs_net)}</strong>
          </div>
        )}

        <div className="stack-sm" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <strong>Link a bank payment</strong>
          {txns.error && <Alert tone="error">{txns.error.message}</Alert>}
          <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <Select value={pick} onChange={setPick} options={pickOptions} aria-label="Bank payment" />
            </div>
            <Button icon={CheckCircle2} disabled={!pick} busy={linking} onClick={() => link(Number(pick), car.id)}>
              Link
            </Button>
          </div>
          <p className="small muted">Only money-out lines from {quarter.label} that aren't linked to a car are listed.</p>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- documents

function DocumentsSection({ car }) {
  const { version, refresh } = useApp();
  const docs = useLoad(() => api.get(`/admin/api/cars/${car.id}/documents`), [car.id, version]);
  const [kind, setKind] = useState(DOC_KINDS[0]);
  const [dragOver, setDragOver] = useState(false);
  const [upload, uploading] = useAction();
  const [remove, removing] = useAction();
  const toast = useToast();

  const send = async (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    fd.append("kind", kind);
    const res = await upload(() => api.post(`/admin/api/cars/${car.id}/documents`, fd));
    if (res) { docs.reload(); refresh(); }
  };

  const drop = (e) => {
    e.preventDefault();
    setDragOver(false);
    send(e.dataTransfer.files);
  };

  const removeDoc = async (d) => {
    if (!window.confirm(`Delete ${d.filename}? This can't be undone.`)) return;
    const res = await remove(() => api.del(`/admin/api/documents/${d.id}`));
    if (res) { toast("success", "Document deleted."); docs.reload(); refresh(); }
  };

  const list = docs.data || [];

  return (
    <Card>
      <div className="stack">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div style={{ width: 220, maxWidth: "100%" }}>
            <Field variant="line" label="Kind">
              <Select value={kind} onChange={setKind} options={DOC_KINDS} aria-label="Document kind" />
            </Field>
          </div>
        </div>
        <label className={`dropzone ${dragOver ? "over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={drop}>
          <input type="file" multiple disabled={uploading}
            onChange={(e) => { send(e.target.files); e.target.value = ""; }} />
          <FileText size={22} />
          <span>{uploading ? "Keeping the files…" : "Drop files here, or tap to choose"}</span>
        </label>

        {docs.error && <Alert tone="error">{docs.error.message}</Alert>}
        {docs.data && list.length === 0 && <p className="small muted">No documents kept for this car yet.</p>}
        {list.map((d) => (
          <div key={d.id} className="list-row" style={{ alignItems: "center" }}>
            <span className="list-icon"><FileText size={16} /></span>
            <span className="list-text">
              <span className="list-title">{d.filename}</span>
              <span className="list-sub">{d.kind}</span>
            </span>
            <Button size="sm" onClick={() => window.open(`/admin/api/documents/${d.id}/file`, "_blank")}>Open</Button>
            <IconButton icon={Trash2} label={`Delete ${d.filename}`} disabled={removing} onClick={() => removeDoc(d)} />
          </div>
        ))}
        {list.length === 0 && docs.loading && <p className="small muted">Loading…</p>}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- sale

function Line({ label, value, strong = false }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", padding: "6px 0" }}>
      <span className={strong ? "" : "muted"}>{label}</span>
      <span className="num" style={strong ? { fontWeight: 600 } : undefined}>{value}</span>
    </div>
  );
}

function SaleSection({ car, today }) {
  const [showForm, setShowForm] = useState(false);
  if (car.sale_date) return <SoldSummary car={car} />;
  return (
    <Card>
      <div className="stack">
        <p className="small muted">Most sales go through an invoice, which tracks the payment too.</p>
        <div className="row">
          <Button variant="primary" icon={FileText} onClick={() => { navigate(`/admin/invoices?car=${car.id}`); }}>
            Create Invoice
          </Button>
          <Button icon={Calculator} onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Hide sale form" : "Record sale without an invoice"}
          </Button>
        </div>
        {showForm && <RecordSaleForm car={car} today={today} onDone={() => setShowForm(false)} />}
      </div>
    </Card>
  );
}

function SoldSummary({ car }) {
  const inv = car.invoice;
  const invTone = !inv ? "gray" : inv.status === "paid" ? "green" : inv.status === "part_paid" ? "orange" : "gray";
  const invText = !inv ? "" : inv.status === "paid" ? "Paid" : inv.status === "part_paid" ? "Part paid" : "Unpaid";
  return (
    <div className="stack">
      <Card>
        <Line label="Sold on" value={ukDate(car.sale_date)} />
        <Line label="Sale price" value={money(car.sale_price)} />
        <Line label="Sold to" value={car.buyer_name || "Not recorded"} />
        {car.px_allowance ? <Line label="Part-ex allowance" value={money(car.px_allowance)} /> : null}
        <div className="row" style={{ justifyContent: "space-between", padding: "6px 0" }}>
          <span className="muted">Invoice</span>
          <span className="row" style={{ gap: 8 }}>
            <span>{inv ? inv.invoice_no : car.sales_invoice_no || "None"}</span>
            {inv && <Badge tone={invTone}>{invText}</Badge>}
          </span>
        </div>
        {inv && <Line label="Outstanding" value={money(inv.outstanding)} />}
        <div className="row" style={{ marginTop: 10 }}>
          <Button icon={FileText} onClick={() => { navigate("/admin/invoices"); }}>Open invoices</Button>
        </div>
      </Card>
      <div className="panel tone-sand">
        <div className="panel-head"><h3>Profit</h3></div>
        <Line label="Sale price" value={money(car.sale_price)} />
        <Line label="less VAT due" value={money(car.vat_due) || "None"} />
        <Line label="less bought for" value={money(car.bought_for) || "Not recorded"} />
        <Line label="less costs (net)" value={money(car.costs_net)} />
        <div style={{ borderTop: "1px solid var(--border-strong)", marginTop: 6 }}>
          <Line label="Profit ex VAT" value={car.profit != null ? money(car.profit) : "Needs a purchase price"} strong />
        </div>
      </div>
    </div>
  );
}

// Record a sale without an invoice, with optional part-exchange. Sent to the car's sale endpoint.
function RecordSaleForm({ car, today, onDone }) {
  const { refresh } = useApp();
  const [saleDate, setSaleDate] = useState(today);
  const [salePrice, setSalePrice] = useState("");
  const [pxOn, setPxOn] = useState(false);
  const [pxAllow, setPxAllow] = useState("");
  const [pxReg, setPxReg] = useState("");
  const [pxModel, setPxModel] = useState("");
  const [preview, setPreview] = useState(null);
  const [recordAct, busy] = useAction();

  const priceNum = Number(salePrice) || 0;
  const allowance = pxOn ? Number(pxAllow) || 0 : 0;

  // Live sale preview, debounced; a stale response is ignored once the inputs change.
  useEffect(() => {
    setPreview(null);
    if (!(priceNum > 0)) return undefined;
    let live = true;
    const t = setTimeout(() => {
      api.post("/admin/api/sale-preview", { car_id: car.id, sale_price: priceNum })
        .then((p) => live && setPreview(p))
        .catch(() => live && setPreview(null));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [car.id, priceNum]);

  const pxCaption = allowance > 0 && allowance <= priceNum
    ? `Customer pays ${money(priceNum - allowance)} in money. ${pxReg.trim().toUpperCase() || "The part-ex car"} `
      + `goes into stock as a margin purchase at ${money(allowance)}.`
    : null;

  const previewText = preview ? [
    preview.margin != null ? `Margin ${money(preview.margin)}` : null,
    `VAT due ${money(preview.vat)}`,
    preview.profit != null ? `profit ex VAT ${money(preview.profit)}` : null,
  ].filter(Boolean).join(" · ") : null;

  const record = async () => {
    const res = await recordAct(() => api.post(`/admin/api/cars/${car.id}/sale`, {
      sale_date: saleDate, sale_price: priceNum,
      px_allowance: allowance > 0 ? allowance : null,
      px_reg: pxOn ? pxReg.trim() : "", px_make_model: pxOn ? pxModel.trim() : "",
    }));
    if (res) { refresh(); onDone(); }
  };

  return (
    <div className="stack">
      <div className="grid-2">
        <Field variant="line" label="Sale date">
          <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
        </Field>
        <Field variant="line" label="Sale price" hint="The full price agreed, including any part-exchange.">
          <MoneyInput value={salePrice} onChange={setSalePrice} />
        </Field>
      </div>
      <Toggle checked={pxOn} onChange={setPxOn} label="Part-exchange taken" />
      {pxOn && (
        <>
          <div className="grid-3">
            <Field variant="line" label="Part-ex allowance">
              <MoneyInput value={pxAllow} onChange={setPxAllow} />
            </Field>
            <Field variant="line" label="Part-ex reg">
              <Input value={pxReg} onChange={(e) => setPxReg(e.target.value)} />
            </Field>
            <Field variant="line" label="Part-ex make / model">
              <Input value={pxModel} onChange={(e) => setPxModel(e.target.value)} />
            </Field>
          </div>
          {pxCaption && <p className="small muted">{pxCaption}</p>}
        </>
      )}
      {previewText && (
        <div className="stack-sm">
          <Alert tone="info">{previewText}</Alert>
          {preview.margin != null && preview.margin <= 0 && (
            <p className="small muted">Sold at a loss, so no VAT is due on this car.</p>
          )}
        </div>
      )}
      <div className="row">
        <Button variant="primary" icon={CheckCircle2} busy={busy}
          disabled={!(priceNum > 0) || !saleDate} onClick={record}>
          Record sale
        </Button>
      </div>
    </div>
  );
}
