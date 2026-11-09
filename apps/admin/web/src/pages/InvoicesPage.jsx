import { useEffect, useRef, useState } from "react";
import {
  Ban, Car, Check, CheckCircle2, ChevronDown, Clock, Download, ExternalLink, Eye, FileText, Loader2, Pencil, Plus,
  FileMinus, ReceiptPoundSterling, RefreshCw, Search, Trash2, Wallet, X,
} from "lucide-react";
import { api, download } from "../api.js";
import {
  Alert, Badge, Button, Card, Empty, Field, IconButton, Input, Metric, MoneyInput, PageHeader, Panel, Segmented, Select,
  StatCard, useAction, useLoad,
} from "../components/ui.jsx";
import { useApp } from "../context.js";
import { money, plural, todayIso, ukDate } from "../format.js";
import "./invoices/invoices-form.css";
import CreditNotePanel from "./invoices/CreditNotePanel.jsx";

// Field order and labels follow the printed invoice (invoice_pdf.py).
const PRICING = [
  ["selling_price", "Selling Price"],
  ["delivery", "Delivery Charge"],
  ["accessories", "Accessories"],
  ["rf_licence", "RF Licence"],
  ["cherished", "Cherished Transfer"],
  ["warranty", "Warranty and Services"],
  ["warranty_ipt", "Warranty IPT"],
  ["px_allowance", "Less PX Allowance"],
  ["hp_settlement", "HP Settlement Amount"],
  ["finance", "Finance Amount"],
  ["deposit", "Less Deposit / Payments"],
];
const PRICING_KEYS = PRICING.map(([k]) => k);
const EXTRA_KEYS = ["rf_licence", "cherished", "warranty", "warranty_ipt", "px_allowance", "hp_settlement", "finance", "deposit"];

const VEH_MAIN = [
  [
    { key: "reg", label: "Reg No", ro: true },
    { key: "colour", label: "Colour" },
    { key: "first_reg", label: "First Reg Date", type: "date" },
  ],
  [
    { key: "make", label: "Make" },
    { key: "engine_no", label: "Engine No" },
    { key: "mfr_date", label: "Mfr Date", placeholder: "e.g. 03/2019" },
  ],
  [
    { key: "model", label: "Model" },
    { key: "chassis_no", label: "Chassis No" },
    { key: "mileage", label: "Mileage", type: "number" },
  ],
];
const VEH_MORE = [
  { key: "wheel_nut", label: "Wheel Nut No" },
  { key: "immobiliser", label: "Immobiliser" },
  { key: "warranty_no", label: "Warranty No" },
  { key: "radio_code", label: "Radio Code" },
  { key: "order_no", label: "Order No" },
  { key: "keys", label: "Key No", placeholder: "e.g. 2 Keys" },
];
const VEHICLE_KEYS = [...VEH_MAIN.flat(), ...VEH_MORE].map((v) => v.key).filter((k) => k !== "reg");

const PAY_METHODS = ["Bank transfer", "Card", "Cash", "Finance company", "Other"];
const PAY_BADGE = {
  paid: { tone: "green", text: "Paid" },
  part_paid: { tone: "orange", text: "Part paid" },
  unpaid: { tone: "gray", text: "Unpaid" },
  refund_owed: { tone: "red", text: "Refund owed" },
  credited: { tone: "gray", text: "Credited" },
  void: { tone: "red", text: "Void" },
};

const ITEM_MAX = 9;
const WARRANTY_MAX = 5;
const SPECIAL_MAX = 5;
const SPECIAL_MAX_STANDARD = 4;
const ADDRESS_LINES = 4;

let seq = 0;
const newItem = (row = {}) => ({ k: ++seq, desc: "", qty: "1", cost: "", ...row });
// Keeps at least ADDRESS_LINES boxes; a longer saved address keeps every line.
const padAddress = (list) => {
  const src = Array.isArray(list) ? list.map((x) => (x === null || x === undefined ? "" : String(x))) : [];
  const n = Math.max(ADDRESS_LINES, src.length);
  return Array.from({ length: n }, (_, i) => src[i] ?? "");
};
const blankParty = () => ({ name: "", address: padAddress([]), email: "", phone: "" });
const blankVehicle = () => Object.fromEntries(VEHICLE_KEYS.map((k) => [k, ""]));
const blankForm = (today, salesperson = "") => ({
  carId: "", invoiceDate: today, salesperson,
  buyer: blankParty(), sameAsBuyer: true, deliver: blankParty(),
  vehicle: blankVehicle(), items: [newItem()], warranty: [], special: [],
  pricing: Object.fromEntries(PRICING_KEYS.map((k) => [k, ""])), margin: false,
});

const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");
const numOr0 = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v) || 0);
const clean = (list) => list.map((s) => String(s).trim()).filter(Boolean);
const carLabel = (c) => [c.stock_no, c.reg, c.make_model, c.scheme].filter(Boolean).join(" · ");
const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

const partyOf = (p) => ({ name: p.name.trim(), address: clean(p.address), email: p.email.trim(), phone: p.phone.trim() });
const itemsOf = (items) => items
  .filter((it) => it.desc.trim() || it.cost !== "")
  .map((it) => ({ desc: it.desc.trim(), qty: Number(it.qty) || 1, cost: numOr0(it.cost) }));
const pricingOf = (p) => Object.fromEntries(PRICING_KEYS.map((k) => [k, numOr0(p[k])]));

// Standard cars get the VAT line added on the server, so one fewer special line is sent.
function invoicePayload(f, standard) {
  return {
    vehicle_id: f.carId ? Number(f.carId) : null,
    invoice_date: f.invoiceDate,
    salesperson: f.salesperson.trim(),
    buyer: partyOf(f.buyer),
    deliver_same: f.sameAsBuyer,
    deliver_to: partyOf(f.deliver),
    vehicle: Object.fromEntries(VEHICLE_KEYS.map((k) => [k, f.vehicle[k].trim()])),
    items: itemsOf(f.items),
    warranty_lines: clean(f.warranty),
    special_instructions: clean(standard ? f.special.slice(0, SPECIAL_MAX_STANDARD) : f.special),
    pricing: pricingOf(f.pricing),
    margin_scheme: f.margin && !standard,
  };
}

// Input classes: fit errors are red, required-but-missing (after a Create attempt) amber.
const inputCls = (err, warn) => (err ? "input fit-err" : warn ? "input req-warn" : "input");

// Lines that grow: the filled lines plus one empty "Add a line" box while under the limit.
function LineList({ idBase, lines, max, onLine, errMsg, placeholder }) {
  const shown = lines.length < max ? [...lines, ""] : lines;
  return (
    <div className="line-list">
      {shown.map((line, i) => (
        <Input key={i} id={i === 0 ? idBase : `${idBase}.${i}`} value={line}
          placeholder={i === lines.length ? placeholder : undefined}
          className={errMsg ? "input fit-err" : "input"}
          onChange={(e) => onLine(i, e.target.value)} />
      ))}
      {errMsg && <div className="field-error">{errMsg}</div>}
    </div>
  );
}

export default function InvoicesPage() {
  const { meta, version, refresh, quarter, search, period } = useApp();
  const today = meta.today || todayIso();

  const cars = useLoad(() => api.get("/admin/api/cars"), [version]);
  const defaults = useLoad(() => api.get("/admin/api/invoices/defaults"), [version]);
  const list = useLoad(() => api.get("/admin/api/invoices"), [version]);
  // Saved buyers (trade companies included). Optional: the form still works without them.
  const customers = useLoad(() => api.get("/admin/api/invoices/customers"), [version]);
  const [payId, setPayId] = useState(null);
  const [creditId, setCreditId] = useState(null);
  const payments = useLoad(
    () => (payId ? api.get(`/admin/api/invoices/${payId}/payments`) : Promise.resolve(null)),
    [payId, version],
  );

  const [run, busy] = useAction();
  const [busyId, setBusyId] = useState(null);
  const [f, setF] = useState(() => blankForm(today));
  const [editingId, setEditingId] = useState(null);
  const [tried, setTried] = useState(false);
  const [serverErr, setServerErr] = useState("");
  const [totals, setTotals] = useState(null);
  const [check, setCheck] = useState(null);
  const [shown, setShown] = useState(null); // invoice in the result panel, with `v` cache-buster
  const [view, setView] = useState("edit");
  const [moreOpen, setMoreOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewErr, setPreviewErr] = useState("");
  const [pay, setPay] = useState({ paidOn: "", amount: "", method: "Bank transfer", note: "" });
  const [payErr, setPayErr] = useState("");
  // "Create invoice" on a car page opens /admin/invoices?car=<id>: start the form with that car.
  const [wantCar, setWantCar] = useState(() => (window.location.search.match(/[?&]car=(\d+)/) || [])[1] || null);
  const formRef = useRef(null);
  const shownRef = useRef(null);
  const urlRef = useRef(null);

  const allCars = cars.data ?? [];
  const car = allCars.find((c) => String(c.id) === f.carId) || null;
  const standard = !!car && car.scheme === "Standard";
  const specialMax = standard ? SPECIAL_MAX_STANDARD : SPECIAL_MAX;
  // Unsold cars, plus the car on the invoice being edited (it is sold by that invoice).
  const carOptions = allCars.filter((c) => !c.sale_date || String(c.id) === f.carId);
  const editing = editingId ? list.data?.find((i) => i.id === editingId) : null;
  const savedBuyers = (customers.data ?? []).filter((c) => c && String(c.name || "").trim());

  // Seed the salesperson from the last one used, once the defaults arrive.
  useEffect(() => {
    if (defaults.data && !editingId) {
      setF((prev) => (prev.salesperson ? prev : { ...prev, salesperson: defaults.data.salesperson || "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults.data]);

  // Live price build-up, debounced.
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api.post("/admin/api/invoices/totals", { items: itemsOf(f.items), pricing: pricingOf(f.pricing), standard })
        .then((r) => live && setTotals(r))
        .catch(() => live && setTotals(null));
    }, 250);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.items, f.pricing, standard]);

  // The same body as a save, used for the server checks and the draft preview.
  const draft = { ...invoicePayload(f, standard), ...(editingId ? { invoice_id: editingId } : {}) };
  const draftJson = JSON.stringify(draft);
  const hasCar = !!car;

  // Server checks: which fields won't fit on the printed page, and seller details.
  useEffect(() => {
    if (!hasCar) { setCheck(null); return undefined; }
    let live = true;
    const t = setTimeout(() => {
      api.post("/admin/api/invoices/check", JSON.parse(draftJson))
        .then((r) => live && setCheck(r))
        .catch(() => live && setCheck(null));
    }, 300);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftJson, hasCar]);

  // Draft PNG of page 1, for Preview mode.
  useEffect(() => {
    if (view !== "preview" || !hasCar) return undefined;
    let live = true;
    const ctrl = new AbortController();
    setPreviewBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/admin/api/invoices/draft.png", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: draftJson, signal: ctrl.signal,
        });
        if (!res.ok) {
          let msg = `Request failed (${res.status})`;
          try { const j = await res.json(); if (typeof j.detail === "string") msg = j.detail; } catch { /* keep default */ }
          throw new Error(msg);
        }
        const url = URL.createObjectURL(await res.blob());
        if (!live) { URL.revokeObjectURL(url); return; }
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPreviewUrl(url);
        setPreviewErr("");
        setPreviewBusy(false);
      } catch (e) {
        if (live && e.name !== "AbortError") { setPreviewErr(e.message); setPreviewBusy(false); }
      }
    }, 600);
    return () => { live = false; clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, draftJson, hasCar]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  useEffect(() => {
    if (editingId && formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editingId]);

  useEffect(() => {
    if (shown && shownRef.current) shownRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.v]);

  const err = cars.error || defaults.error || list.error;
  if (err) return <Alert tone="error">{err.message}</Alert>;
  if (!cars.data || !defaults.data || !list.data) return <div className="muted"><Loader2 size={18} className="spin" /></div>;

  const sellerProblems = defaults.data.seller_problems || [];
  const seller = defaults.data.seller || {};
  const invoiceNo = editing ? editing.invoice_no : defaults.data.next_invoice_no;
  const extrasUsed = EXTRA_KEYS.some((k) => numOr0(f.pricing[k]) !== 0);
  const t = totals || {};

  // Summary strip figures (always the whole book, not the search filter).
  const all = list.data;
  const inQuarter = (inv) => !!period && dateOnly(inv.invoice_date) >= dateOnly(period.start)
    && dateOnly(inv.invoice_date) <= dateOnly(period.end);
  const qInvoices = all.filter((inv) => !inv.void && inQuarter(inv));
  const qTotal = qInvoices.reduce((s, inv) => s + numOr0(inv.totals && inv.totals.total_price), 0);
  const waiting = all.filter((inv) => inv.payment && (inv.payment.status === "unpaid" || inv.payment.status === "part_paid"));
  const waitingSum = waiting.reduce((s, inv) => s + numOr0(inv.payment.outstanding), 0);
  const paidCount = all.filter((inv) => inv.payment && inv.payment.status === "paid").length;

  // Global search filters the list by number, reg or buyer.
  const q = (search || "").trim();
  const ql = q.toLowerCase();
  const rows = ql
    ? all.filter((inv) => [inv.invoice_no, inv.reg, inv.buyer_name].some((v) => String(v || "").toLowerCase().includes(ql)))
    : all;
  const payInv = payId ? all.find((inv) => inv.id === payId) : null;

  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));
  const setIn = (group, key, value) => setF((prev) => {
    const next = { ...prev, [group]: { ...prev[group], [key]: value } };
    // The "Vehicle (REG)" line follows the selling price until its cost is edited by hand.
    const first = prev.items[0];
    if (group === "pricing" && key === "selling_price" && first && /^Vehicle \(/.test(first.desc || "")
        && (first.cost === "" || first.cost == null || Number(first.cost) === Number(prev.pricing.selling_price || 0))) {
      next.items = [{ ...first, cost: value }, ...prev.items.slice(1)];
    }
    return next;
  });
  // Typing a saved buyer's name exactly fills their address, email and phone.
  const onBuyerName = (value) => setF((prev) => {
    const hit = value.trim() ? savedBuyers.find((c) => sameName(c.name, value)) : null;
    if (!hit) return { ...prev, buyer: { ...prev.buyer, name: value } };
    return {
      ...prev,
      buyer: {
        name: value,
        address: padAddress(hit.address),
        email: hit.email || "",
        phone: hit.phone || "",
      },
    };
  });
  const setAddr = (group, i, value) => setF((prev) => ({
    ...prev, [group]: { ...prev[group], address: prev[group].address.map((a, j) => (j === i ? value : a)) },
  }));
  const setList = (key, i, value) => setF((prev) => ({
    ...prev,
    [key]: i < prev[key].length ? prev[key].map((x, j) => (j === i ? value : x)) : [...prev[key], value],
  }));
  const setItem = (i, patch) => setF((prev) => ({
    ...prev, items: prev.items.map((it, j) => (j === i ? { ...it, ...patch } : it)),
  }));
  const addItem = () => setF((prev) => ({ ...prev, items: [...prev.items, newItem()] }));
  const removeItem = (i) => setF((prev) => {
    const items = prev.items.filter((_, j) => j !== i);
    return { ...prev, items: items.length ? items : [newItem()] };
  });

  if (wantCar && allCars.length) {
    setWantCar(null);
    if (!f.carId) setTimeout(() => pickCar(wantCar), 0);
    window.history.replaceState(null, "", "/admin/invoices");
  }

  // Picking a different car fills in the vehicle, the "Vehicle (REG)" line and the selling price.
  const pickCar = (id) => {
    if (id === f.carId) return;
    const c = allCars.find((x) => String(x.id) === id);
    if (!c) { set({ carId: "" }); return; }
    const price = c.sale_price === null || c.sale_price === undefined ? "" : String(c.sale_price);
    const [make, ...rest] = (c.make_model || "").trim().split(/\s+/);
    setF((prev) => ({
      ...prev,
      carId: id,
      vehicle: {
        ...prev.vehicle,
        make: make || "",
        model: rest.join(" "),
        colour: c.colour || "",
        first_reg: dateOnly(c.first_reg),
        mileage: c.mileage === null || c.mileage === undefined ? "" : String(c.mileage),
      },
      items: [newItem({ desc: `Vehicle (${c.reg})`, qty: "1", cost: price }), ...prev.items.slice(1)],
      pricing: { ...prev.pricing, selling_price: price },
      margin: c.scheme === "Margin",
    }));
  };

  const resetForm = (salesperson) => {
    setF(blankForm(today, salesperson));
    setEditingId(null);
    setTried(false);
    setServerErr("");
  };
  const cancelEdit = () => resetForm(defaults.data.salesperson || "");

  const loadInvoice = (inv) => {
    const v = inv.vehicle || {};
    const vehicle = blankVehicle();
    for (const k of VEHICLE_KEYS) vehicle[k] = v[k] === null || v[k] === undefined ? "" : String(v[k]);
    vehicle.first_reg = dateOnly(v.first_reg);
    const pricing = Object.fromEntries(PRICING_KEYS.map((k) => [k, inv.pricing && inv.pricing[k] ? String(inv.pricing[k]) : ""]));
    const items = (inv.items || []).map((it) => newItem({ desc: it.desc || "", qty: String(it.qty ?? 1), cost: String(it.cost ?? "") }));
    setF({
      carId: String(inv.vehicle_id),
      invoiceDate: dateOnly(inv.invoice_date),
      salesperson: inv.salesperson || "",
      buyer: { name: inv.buyer_name || "", address: padAddress(inv.buyer_address), email: inv.buyer_email || "", phone: inv.buyer_phone || "" },
      sameAsBuyer: !!inv.deliver_same,
      deliver: { name: inv.deliver_name || "", address: padAddress(inv.deliver_address), email: inv.deliver_email || "", phone: inv.deliver_phone || "" },
      vehicle,
      items: items.length ? items : [newItem()],
      warranty: [...(inv.warranty_lines || [])],
      special: [...(inv.special_instructions || [])],
      pricing,
      margin: !!inv.margin_scheme,
    });
    setEditingId(inv.id);
    setView("edit");
    setTried(false);
    setServerErr("");
  };

  // Client-side checks; the server re-validates everything on save.
  const required = [];
  if (!car) required.push(["car", "Pick a car from the stock book."]);
  if (!f.buyer.name.trim()) required.push(["buyer.name", "Enter the buyer's name."]);
  if (!clean(f.buyer.address).length) required.push(["buyer.address", "Enter at least one line of the buyer's address."]);
  if (!f.sameAsBuyer && !f.deliver.name.trim()) required.push(["deliver_to.name", "Enter the deliver-to name, or tick 'Same as buyer'."]);
  if (!(numOr0(f.pricing.selling_price) > 0)) required.push(["pricing.selling_price", "Enter a selling price above zero."]);
  if (!f.invoiceDate) required.push(["invoice_date", "Enter the invoice date."]);
  f.items.forEach((it, i) => {
    if (!it.desc.trim() && it.cost !== "") required.push([`items.${i}.desc`, "Every item row needs a description."]);
  });
  const requiredKeys = new Set(required.map(([k]) => k));
  const problems = [...new Set([...required.map(([, m]) => m), ...((tried && check?.problems) || [])])];

  const fields = (check && check.fields) || {};
  const errOf = (key) => fields[key];
  const warnOf = (key) => tried && requiredKeys.has(key);
  const cls = (key) => inputCls(errOf(key), warnOf(key));
  const fitEntries = Object.entries(fields).filter(([k]) => !k.startsWith("seller."));
  const sellerFieldProblem = Object.keys(fields).some((k) => k.startsWith("seller."));
  const moreHasError = VEH_MORE.some((v) => errOf(`vehicle.${v.key}`));
  const showMore = moreOpen || moreHasError || VEH_MORE.some((v) => f.vehicle[v.key]);

  const onSave = async () => {
    setTried(true);
    if (sellerProblems.length || required.length) return;
    setServerErr("");
    const payload = invoicePayload(f, standard);
    const res = await run(async () => {
      try {
        return editingId
          ? await api.put(`/admin/api/invoices/${editingId}`, payload)
          : await api.post("/admin/api/invoices", payload);
      } catch (e) {
        setServerErr(e.message);
        throw e;
      }
    });
    if (res) {
      refresh();
      setShown({ ...res, v: Date.now() });
      resetForm(res.salesperson || "");
    }
  };

  const act = async (inv, fn) => {
    setBusyId(inv.id);
    const res = await run(fn);
    setBusyId(null);
    return res;
  };
  const onRegen = async (inv) => {
    const res = await act(inv, () => api.post(`/admin/api/invoices/${inv.id}/regenerate`));
    if (res) { refresh(); setShown({ ...res, v: Date.now() }); }
  };
  const onVoid = async (inv) => {
    if (!window.confirm(`Void invoice ${inv.invoice_no}? The number stays used and ${inv.reg} goes back into stock.`)) return;
    const res = await act(inv, () => api.post(`/admin/api/invoices/${inv.id}/void`));
    if (res) {
      refresh();
      if (editingId === inv.id) cancelEdit();
    }
  };

  // Payments panel: open/close for an invoice, record a payment, delete one.
  const openPayments = (inv) => {
    if (payId === inv.id) { setPayId(null); return; }
    setPayId(inv.id);
    setPay({ paidOn: today, amount: "", method: "Bank transfer", note: "" });
    setPayErr("");
  };
  const addPayment = async () => {
    const amount = numOr0(pay.amount);
    if (!pay.paidOn) { setPayErr("Enter the date the money was paid."); return; }
    if (!(amount > 0)) { setPayErr("Enter an amount above zero."); return; }
    setPayErr("");
    const res = await run(() => api.post(`/admin/api/invoices/${payId}/payments`, {
      paid_on: pay.paidOn, amount, method: pay.method, note: pay.note.trim(),
    }).then(() => ({ message: "Payment recorded." })));
    if (res) {
      setPay((p) => ({ ...p, amount: "", note: "" }));
      refresh();
    }
  };
  const deletePayment = async (p) => {
    if (!window.confirm(`Delete the payment of ${money(p.amount)} dated ${ukDate(p.paid_on)}? It will no longer count as paid.`)) return;
    const res = await run(() => api.del(`/admin/api/payments/${p.id}`).then(() => ({ message: "Payment deleted." })));
    if (res) refresh();
  };

  const focusField = (key) => {
    const el = document.getElementById(`f-${key}`) || document.getElementById(`f-${key}.0`);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus(); }
  };

  const vehicleInput = (v) => {
    const isRo = !!v.ro;
    const value = isRo ? (car ? car.reg : "") : f.vehicle[v.key];
    return (
      <Field key={v.key} variant="line" label={v.label} error={isRo ? undefined : errOf(`vehicle.${v.key}`)}>
        <Input id={`f-vehicle.${v.key}`} type={v.type || "text"} placeholder={v.placeholder} value={value}
          readOnly={isRo} className={isRo ? "input" : cls(`vehicle.${v.key}`)}
          onChange={isRo ? undefined : (e) => setIn("vehicle", v.key, e.target.value)} />
      </Field>
    );
  };

  // Name, address (one box per line), email and phone for the buyer or the deliver-to party.
  const partyInputs = (prefix, party, onName) => (
    <>
      <Field variant="line" label="Name" error={errOf(`${prefix}.name`)}>
        <Input id={`f-${prefix}.name`} value={party.name} className={cls(`${prefix}.name`)}
          list={prefix === "buyer" ? "saved-buyers" : undefined} autoComplete="off"
          onChange={(e) => onName(e.target.value)} />
      </Field>
      {party.address.map((line, i) => (
        <Field key={i} variant="line" label={i === 0 ? "Address" : " "}
          error={i === 0 ? errOf(`${prefix}.address`) : undefined}>
          <Input id={i === 0 ? `f-${prefix}.address` : `f-${prefix}.address.${i}`} value={line}
            placeholder={`Address line ${i + 1}`} className={cls(`${prefix}.address`)}
            onChange={(e) => setAddr(prefix === "buyer" ? "buyer" : "deliver", i, e.target.value)} />
        </Field>
      ))}
      <Field variant="line" label="Email" error={errOf(`${prefix}.email`)}>
        <Input id={`f-${prefix}.email`} type="email" value={party.email} className={cls(`${prefix}.email`)}
          onChange={(e) => setIn(prefix === "buyer" ? "buyer" : "deliver", "email", e.target.value)} />
      </Field>
      <Field variant="line" label="Phone" error={errOf(`${prefix}.phone`)}>
        <Input id={`f-${prefix}.phone`} value={party.phone} className={cls(`${prefix}.phone`)}
          onChange={(e) => setIn(prefix === "buyer" ? "buyer" : "deliver", "phone", e.target.value)} />
      </Field>
    </>
  );

  const shownLines = (p) => [p.name, ...p.address].filter((x) => x && String(x).trim());
  const payStatus = payments.data ? PAY_BADGE[payments.data.status] || PAY_BADGE.unpaid : null;
  const payVoid = payments.data?.status === "void";

  return (
    <div className="stack inv-page">
      <PageHeader title="Create Invoice"
        subtitle={editing ? `Editing invoice ${editing.invoice_no}` : `Next number ${defaults.data.next_invoice_no}`}
        actions={
          <Segmented ariaLabel="Edit or preview" value={view} onChange={setView}
            options={[{ value: "edit", label: "Edit", icon: Pencil }, { value: "preview", label: "Preview", icon: Eye }]} />
        } />

      {/* Summary strip */}
      <div className="grid-3 inv-summary">
        <StatCard tone="lilac" icon={FileText} label="Invoiced"
          sub={period ? `${plural(qInvoices.length, "invoice")} · ${period.label}` : plural(qInvoices.length, "invoice")}
          value={money(qTotal)} />
        <StatCard tone="sand" icon={Clock} label="Waiting for payment"
          sub={plural(waiting.length, "invoice")} value={money(waitingSum)} />
        <StatCard tone="sage" icon={CheckCircle2} label="Paid in full"
          sub={plural(paidCount, "invoice")} value={String(paidCount)} />
      </div>

      {sellerProblems.length > 0 && (
        <Alert tone="error" title="Business details are needed before invoices can be created">
          {sellerProblems.map((p) => <div key={p}>{p}</div>)}
          <div><a href="/admin/business">Open Business</a></div>
        </Alert>
      )}
      {view === "edit" && fitEntries.length > 0 && (
        <Alert tone="warning" title={`${plural(fitEntries.length, "field")} won't fit`}>
          {fitEntries.map(([k, msg]) => (
            <div key={k}>
              <button type="button" className="link-btn" style={{ padding: 0, textDecoration: "underline" }}
                onClick={() => focusField(k)}>{msg}</button>
            </div>
          ))}
        </Alert>
      )}
      {view === "edit" && sellerFieldProblem && (
        <Alert tone="error" title="Business details are missing from the invoice">
          <a href="/admin/business">Open Business</a>
        </Alert>
      )}

      <div ref={formRef} className="stack">
        {view === "edit" ? (
          <>
            {/* Parties and sales details */}
            <div className="cols-3">
              <Panel title="Invoice to" className="tone-lilac">
                <div className="stack-sm">
                  <p className="trade-hint">
                    Selling to another dealer or trade company? Pick or enter the company here — it's still a normal sale for VAT.
                  </p>
                  <datalist id="saved-buyers">
                    {savedBuyers.map((c) => <option key={c.name} value={c.name} />)}
                  </datalist>
                  {partyInputs("buyer", f.buyer, onBuyerName)}
                </div>
              </Panel>

              <Panel title="Deliver to" className="tone-sage">
                <div className="stack-sm">
                  <label className="check-row">
                    <input type="checkbox" checked={f.sameAsBuyer} onChange={(e) => set({ sameAsBuyer: e.target.checked })} />
                    Same as buyer
                  </label>
                  {f.sameAsBuyer ? (
                    <div className="ro-box">
                      {shownLines(f.buyer).length
                        ? shownLines(f.buyer).map((l, i) => <div key={i}>{l}</div>)
                        : <span className="muted">Same as the invoice-to details.</span>}
                    </div>
                  ) : partyInputs("deliver_to", f.deliver, (v) => setIn("deliver", "name", v))}
                </div>
              </Panel>

              <Panel title="Sales invoice" className="tone-sky">
                <div className="stack-sm">
                  <div className="kv-row"><span>Invoice no</span><span>{invoiceNo}</span></div>
                  <div className="kv-row"><span>Stock number</span><span>{car && car.stock_no ? String(car.stock_no) : "—"}</span></div>
                  <div className="kv-row"><span>VAT number</span><span>{seller.vat_no || "—"}</span></div>
                  <Field variant="line" label="Invoice date" error={errOf("invoice_date")}>
                    <Input id="f-invoice_date" type="date" value={f.invoiceDate} className={cls("invoice_date")}
                      onChange={(e) => set({ invoiceDate: e.target.value })} />
                  </Field>
                  <Field variant="line" label="Salesperson" error={errOf("salesperson")}>
                    <Input id="f-salesperson" value={f.salesperson} className={cls("salesperson")}
                      onChange={(e) => set({ salesperson: e.target.value })} />
                  </Field>
                </div>
              </Panel>
            </div>

            {/* Vehicle */}
            <Panel title="Vehicle" className="tone-blush">
              <div className="stack">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                    <Field variant="line" label="Car from stock">
                      <Select id="f-car" value={f.carId} onChange={pickCar}
                        className={tried && warnOf("car") ? "input req-warn" : "input"}
                        options={[{ value: "", label: "Choose a car from stock" }, ...carOptions.map((c) => ({ value: String(c.id), label: carLabel(c) }))]} />
                    </Field>
                  </div>
                  <label className="check-row" title={standard ? "Standard cars are sold with VAT, so the margin scheme can't apply." : "Ticked for margin cars, where VAT is not shown."}>
                    <input type="checkbox" checked={f.margin} disabled={standard}
                      onChange={(e) => set({ margin: e.target.checked })} />
                    Margin scheme
                  </label>
                </div>
                {!hasCar ? (
                  <p className="muted small" style={{ margin: 0 }}>Choose a car from stock to fill in the vehicle details.</p>
                ) : (
                  <>
                    <div className="cols-3">
                      {VEH_MAIN.map((col, ci) => (
                        <div key={ci} className="stack-sm">{col.map(vehicleInput)}</div>
                      ))}
                    </div>
                    <div>
                      <button type="button" className={`disclose-head ${showMore ? "open" : ""}`}
                        onClick={() => setMoreOpen(!showMore)} aria-expanded={showMore}>
                        More vehicle details <ChevronDown size={16} />
                      </button>
                      {showMore && (
                        <div className="cols-3" style={{ marginTop: 10 }}>
                          {[VEH_MORE.slice(0, 2), VEH_MORE.slice(2, 4), VEH_MORE.slice(4)].map((col, ci) => (
                            <div key={ci} className="stack-sm">{col.map((v) => vehicleInput(v))}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Panel>

            {/* Accessories and warranty */}
            <Panel title="Accessories" className="tone-sage">
              <div className="split-cols">
                <div className="stack-sm">
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th style={{ width: 80 }}>Qty</th>
                          <th style={{ width: 150, textAlign: "right" }}>Cost</th>
                          <th style={{ width: 48 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {f.items.map((it, i) => (
                          <tr key={it.k}>
                            <td>
                              <Input id={`f-items.${i}.desc`} value={it.desc} placeholder="e.g. 2 Keys"
                                className={cls(`items.${i}.desc`)} onChange={(e) => setItem(i, { desc: e.target.value })} />
                              {errOf(`items.${i}.desc`) && <div className="item-err">{errOf(`items.${i}.desc`)}</div>}
                            </td>
                            <td>
                              <Input id={`f-items.${i}.qty`} type="number" min="1" max="99" step="1" value={it.qty}
                                className={inputCls(errOf(`items.${i}.qty`), false)}
                                onChange={(e) => setItem(i, { qty: e.target.value })} />
                              {errOf(`items.${i}.qty`) && <div className="item-err">{errOf(`items.${i}.qty`)}</div>}
                            </td>
                            <td>
                              <MoneyInput id={`f-items.${i}.cost`} value={it.cost} className={inputCls(errOf(`items.${i}.cost`), false)}
                                onChange={(v) => setItem(i, { cost: v })} />
                              {errOf(`items.${i}.cost`) && <div className="item-err">{errOf(`items.${i}.cost`)}</div>}
                            </td>
                            <td>
                              <IconButton icon={Trash2} label="Delete item" onClick={() => removeItem(i)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <button type="button" className="link-btn" onClick={addItem} disabled={f.items.length >= ITEM_MAX}>
                      <Plus size={14} style={{ verticalAlign: "-2px" }} /> Add item (up to {ITEM_MAX})
                    </button>
                    <span className="small">
                      <strong>Totals</strong> {money(t.items_total ?? 0)}
                      {errOf("items") && <span className="field-error" style={{ marginLeft: 8 }}>{errOf("items")}</span>}
                    </span>
                  </div>
                </div>

                <div className="stack">
                  <div className="stack-sm">
                    <div className="sub-head">Warranty and services</div>
                    <LineList idBase="f-warranty_lines" lines={f.warranty} max={WARRANTY_MAX}
                      onLine={(i, v) => setList("warranty", i, v)} errMsg={errOf("warranty_lines")}
                      placeholder="Add a line" />
                  </div>
                  <div className="stack-sm">
                    <div className="sub-head">Special instructions</div>
                    {standard && (
                      <div className="ro-box">{t.vat_line || "Incl. VAT at 20%"}</div>
                    )}
                    <LineList idBase="f-special_instructions" lines={f.special} max={specialMax}
                      onLine={(i, v) => setList("special", i, v)} errMsg={errOf("special_instructions")}
                      placeholder="Add a line" />
                  </div>
                </div>
              </div>
            </Panel>

            {/* Price build-up */}
            <Panel title="Price build-up" className="tone-sand">
              <div className="split-cols split-even">
                <div className="grid-2">
                  {PRICING.map(([k, label]) => (
                    <Field key={k} label={label} error={errOf(`pricing.${k}`)}>
                      <MoneyInput id={`f-pricing.${k}`} value={f.pricing[k]} className={cls(`pricing.${k}`)}
                        onChange={(v) => setIn("pricing", k, v)} />
                    </Field>
                  ))}
                </div>
                <div className="stack-sm">
                  <div className="summary-panel">
                    <div className="kv-row"><span>Selling Price</span><span>{money(t.selling_price ?? 0)}</span></div>
                    <div className="kv-row"><span>Sub Total</span><span>{money(t.sub_total ?? 0)}</span></div>
                    <div className="kv-row"><span>Total Price</span><span>{money(t.total_price ?? 0)}</span></div>
                    {numOr0(f.pricing.px_allowance) !== 0 && (
                      <div className="kv-row"><span>Less PX Allowance</span><span>{money(numOr0(f.pricing.px_allowance))}</span></div>
                    )}
                    {extrasUsed && (
                      <div className="kv-row"><span>Net Price</span><span>{money(t.net_price ?? 0)}</span></div>
                    )}
                    <div className="summary-balance">
                      <span>Balance due</span>
                      <span>{t.balance === undefined ? "—" : money(t.balance)}</span>
                    </div>
                  </div>
                  {errOf("pricing.total") && <Alert tone="error">{errOf("pricing.total")}</Alert>}
                  {f.margin && defaults.data.margin_scheme_text && (
                    <p className="small muted" style={{ margin: 0 }}>{defaults.data.margin_scheme_text}</p>
                  )}
                </div>
              </div>
            </Panel>
          </>
        ) : !hasCar ? (
          <Empty icon={Car} title="Choose a car to preview">Pick a car on the Edit view. The preview shows page 1 as it will print.</Empty>
        ) : (
          <div style={{ position: "relative", width: "100%", minHeight: 300 }}>
            {previewUrl && (
              <img src={previewUrl} alt="Draft of page 1"
                style={{ display: "block", width: "100%", maxWidth: 900, margin: "0 auto", background: "#fff",
                  border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }} />
            )}
            {previewBusy && (
              <div className="sh-overlay" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.55)" }}>
                <Loader2 size={24} className="spin" />
              </div>
            )}
            {previewErr && <Alert tone="error">{previewErr}</Alert>}
          </div>
        )}

        {tried && problems.length > 0 && (
          <Alert tone="warning" title="Check these before saving">
            {problems.map((p) => <div key={p}>{p}</div>)}
          </Alert>
        )}
        {serverErr && <Alert tone="error" onClose={() => setServerErr("")}>{serverErr}</Alert>}

        <div className="action-bar">
          <Button variant="primary" icon={Check} busy={busy} disabled={sellerProblems.length > 0} onClick={onSave}>
            {editing ? "Save and re-generate PDF" : "Create Invoice"}
          </Button>
          {editing && <Button icon={X} onClick={cancelEdit}>Cancel</Button>}
          <span className="summary">
            Balance {t.balance === undefined ? "—" : money(t.balance)} · {car ? car.reg : "No car chosen"}
          </span>
        </div>
      </div>

      <Card title="Invoices" icon={ReceiptPoundSterling}
        actions={ql ? <Badge tone="blue" icon={Search}>{`Search: ${q}`}</Badge> : null}>
        {all.length === 0 ? (
          <Empty icon={FileText} title="No invoices yet">Create the first one above.</Empty>
        ) : rows.length === 0 ? (
          <Empty icon={Search} title="No invoices match">Nothing matches "{q}". Clear the search box to see every invoice.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Date</th>
                  <th>Reg</th>
                  <th>Buyer</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => {
                  const dim = inv.void ? { textDecoration: "line-through", color: "var(--muted)" } : undefined;
                  const pst = PAY_BADGE[inv.payment?.status] || PAY_BADGE.unpaid;
                  return (
                    <tr key={inv.id} style={inv.void ? { opacity: 0.6 } : undefined}>
                      <td style={dim}>
                        {inv.invoice_no}
                        {(inv.credit_notes || []).map((n) => (
                          <div key={n.id} className="small muted">{`${n.credit_no} · ${n.kind === "return" ? "returned" : `-${money(n.amount)}`}`}</div>
                        ))}
                      </td>
                      <td style={dim}>{ukDate(inv.invoice_date)}</td>
                      <td style={dim}>{inv.reg}</td>
                      <td style={dim}>{inv.buyer_name}</td>
                      <td style={{ textAlign: "right", ...dim }}>{money(inv.totals.total_price)}</td>
                      <td style={{ textAlign: "right", ...dim }}>{money(inv.totals.balance)}</td>
                      <td>
                        <Badge tone={pst.tone}>
                          {pst.text}{inv.payment?.status === "part_paid" ? ` · ${money(inv.payment.outstanding)} due` : ""}
                          {inv.payment?.status === "refund_owed" ? ` · ${money(inv.payment.refund_owed)}` : ""}
                        </Badge>
                      </td>
                      <td>
                        <div className="inv-actions">
                          <Button size="sm" variant="ghost" icon={Eye} onClick={() => setShown({ ...inv, v: Date.now() })}>Preview</Button>
                          <Button size="sm" variant="ghost" icon={Download}
                            onClick={() => download(`/admin/api/invoices/${inv.id}/pdf`, { download: 1 })}>Download</Button>
                          <Button size="sm" variant="ghost" icon={Wallet} onClick={() => openPayments(inv)}>Payments</Button>
                          {!inv.void && (
                            <>
                              <Button size="sm" variant="ghost" icon={FileMinus}
                                onClick={() => { setPayId(null); setCreditId(inv.id); }}>Credit note</Button>
                              {!(inv.credit_notes || []).length && (
                                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => loadInvoice(inv)}>Edit</Button>
                              )}
                              <Button size="sm" variant="ghost" icon={RefreshCw} busy={busy && busyId === inv.id}
                                onClick={() => onRegen(inv)}>Re-generate PDF</Button>
                              {!(inv.credit_notes || []).length && (
                                <Button size="sm" variant="ghost" icon={Ban} busy={busy && busyId === inv.id}
                                  onClick={() => onVoid(inv)}>Void</Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 12 }}>
          Invoices are never deleted. Voiding keeps the number and takes the sale out of the stock book; once a
          quarter is filed, use a credit note instead.
        </p>
      </Card>

      {creditId && all.find((i) => i.id === creditId) && (
        <CreditNotePanel inv={all.find((i) => i.id === creditId)} onClose={() => setCreditId(null)} />
      )}

      {payId && (
        <Card title={`Payments · ${payInv ? payInv.invoice_no : ""}${payInv ? ` · ${payInv.reg}` : ""}`} icon={Wallet}
          actions={<Button size="sm" icon={X} onClick={() => setPayId(null)}>Close</Button>}>
          {payments.error ? (
            <Alert tone="error">{payments.error.message}</Alert>
          ) : !payments.data ? (
            <div className="muted"><Loader2 size={18} className="spin" /></div>
          ) : (
            <div className="stack">
              <div className="grid-3">
                <Metric label="Due" value={money(payments.data.due)} />
                <Metric label="Paid" value={money(payments.data.paid)} />
                <Metric label="Outstanding" value={money(payments.data.outstanding)}
                  hint={payStatus ? payStatus.text : undefined} tone={payments.data.outstanding > 0 ? "orange" : "green"} />
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                The deposit or payments entered on the invoice count as paid too.
              </p>

              {payments.data.payments.length === 0 ? (
                <p className="muted small" style={{ margin: 0 }}>No payments recorded yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date paid</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                        <th>Method</th>
                        <th>Note</th>
                        <th>Reference</th>
                        <th style={{ width: 48 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {payments.data.payments.map((p) => (
                        <tr key={p.id}>
                          <td>{ukDate(p.paid_on)}</td>
                          <td style={{ textAlign: "right" }}>{money(p.amount)}</td>
                          <td>{p.method || "—"}</td>
                          <td>{p.note || "—"}</td>
                          <td>{p.txn_id || "—"}</td>
                          <td>
                            <IconButton icon={Trash2} label="Delete payment" disabled={busy}
                              onClick={() => deletePayment(p)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Panel title="Record a payment" className="tone-lilac">
                {payVoid ? (
                  <p className="muted small" style={{ margin: 0 }}>This invoice is void, so payments can't be added.</p>
                ) : (
                  <div className="stack">
                    <div className="pay-form">
                      <Field label="Date paid">
                        <Input type="date" value={pay.paidOn} onChange={(e) => setPay((p) => ({ ...p, paidOn: e.target.value }))} />
                      </Field>
                      <Field label="Amount">
                        <MoneyInput value={pay.amount} onChange={(v) => setPay((p) => ({ ...p, amount: v }))} />
                      </Field>
                      <Field label="Method">
                        <Select value={pay.method} options={PAY_METHODS}
                          onChange={(v) => setPay((p) => ({ ...p, method: v }))} />
                      </Field>
                      <Field label="Note">
                        <Input value={pay.note} placeholder="Optional" onChange={(e) => setPay((p) => ({ ...p, note: e.target.value }))} />
                      </Field>
                    </div>
                    {payErr && <Alert tone="error">{payErr}</Alert>}
                    <div className="row">
                      <Button variant="primary" icon={Plus} busy={busy} onClick={addPayment}>Record payment</Button>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          )}
        </Card>
      )}

      {shown && (
        <div ref={shownRef}>
          <Card title={`Invoice ${shown.invoice_no} · ${shown.reg}`} icon={FileText}
            actions={<Button size="sm" icon={X} onClick={() => setShown(null)}>Close</Button>}>
            <div className="stack">
              <div className="row">
                <Button variant="primary" icon={Download}
                  onClick={() => download(`/admin/api/invoices/${shown.id}/pdf`, { download: 1 })}>Download PDF</Button>
                <a className="btn btn-secondary" href={`/admin/api/invoices/${shown.id}/pdf`} target="_blank" rel="noopener">
                  <ExternalLink size={16} /><span>Open PDF</span>
                </a>
              </div>
              {shown.pdf_exists === false && (
                <Alert tone="warning">The PDF is missing. Use Re-generate PDF in the list below.</Alert>
              )}
              {shown.failed ? (
                <p className="small muted">Preview not available. Use Re-generate PDF in the list below.</p>
              ) : (
                // The real PDF, so text and lines stay sharp at any zoom.
                <iframe key={shown.v} title={`Invoice ${shown.invoice_no}`}
                  src={`/admin/api/invoices/${shown.id}/pdf?v=${shown.v}#view=FitH&toolbar=0&navpanes=0`}
                  style={{ display: "block", width: "100%", maxWidth: 900, height: "min(1270px, 85vh)", background: "#fff",
                    border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-lg)" }} />
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
