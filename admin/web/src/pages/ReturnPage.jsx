import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Car, Check, CheckCircle2, ChevronDown, Copy,
  CalendarClock, ChevronRight, Download, FileSpreadsheet, FolderArchive, Globe, Landmark, Undo2, Upload,
} from "lucide-react";
import { api, download } from "../api.js";
import { useApp } from "../context.js";
import {
  Alert, Badge, Button, Card, IconButton, InkCard, Input, PageHeader, Progress,
  StatCard, useAction, useLoad, useToast,
} from "../components/ui.jsx";
import { longDate, money, plural, todayIso, ukDate } from "../format.js";

// Boxes shown one by one. Boxes 2, 8 and 9 only apply to Northern Ireland and EU trade, so they sit in one group row.
const MAIN_BOXES = [1, 3, 4, 5, 6, 7];
const GROUP_BOXES = [2, 8, 9];
const BRIDGE_BOX = 5;

const num = (v) => Number(v) || 0;

// Saves a Blob as a file. Used for the receipts zip, which needs a status check before downloading.
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const S = {
  line: { background: "var(--panel)", borderRadius: "var(--radius-sm)" },
  lineHl: { background: "var(--panel)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" },
  nested: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" },
  row: { display: "flex", alignItems: "center", gap: 8, padding: 8, minHeight: 52 },
  toggle: {
    flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: 4,
    background: "none", border: 0, font: "inherit", color: "var(--ink)", textAlign: "left", cursor: "pointer",
  },
  chip: {
    width: 28, height: 28, borderRadius: "50%", background: "var(--panel-2)", color: "var(--ink)",
    display: "grid", placeItems: "center", fontSize: 13, fontWeight: 600, flex: "none",
  },
  chipInk: { background: "var(--ink)", color: "#FFFFFF" },
  text: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  label: { fontSize: 14, fontWeight: 500, lineHeight: 1.3 },
  sub: { fontSize: 12, color: "var(--muted)" },
  chev: { color: "var(--muted)", flex: "none", transition: "transform .15s" },
  value: { fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", padding: "0 4px", fontVariantNumeric: "tabular-nums" },
  detail: { padding: "0 12px 12px 52px", display: "flex", flexDirection: "column", gap: 6 },
  drill: {
    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)",
    padding: "8px 10px", fontSize: 13,
  },
  menu: {
    position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, minWidth: 280,
    padding: 6, display: "flex", flexDirection: "column", gap: 2, boxShadow: "var(--shadow-lg)",
  },
  menuItem: { justifyContent: "flex-start", width: "100%", height: 40 },
  groupValue: { fontSize: 13, fontWeight: 500, color: "var(--muted)", textAlign: "right", padding: "0 4px" },
};

// One box line: number chip, label, value, copy button. Optional toggle opens `children`.
function ValueRow({ n, label, value, copied, onCopy, open, onToggle, highlight, nested, children }) {
  const chip = <span style={{ ...S.chip, ...(highlight ? S.chipInk : null) }}>{n}</span>;
  const text = <span style={S.text}><span style={S.label}>{label}</span></span>;
  const rowStyle = highlight ? S.lineHl : nested ? S.nested : S.line;
  return (
    <div style={rowStyle}>
      <div style={S.row}>
        {onToggle ? (
          <button type="button" onClick={onToggle} aria-expanded={!!open} style={S.toggle}>
            {chip}
            {text}
            <ChevronDown size={16} style={{ ...S.chev, transform: open ? "rotate(180deg)" : "none" }} />
          </button>
        ) : (
          <div style={S.toggle}>{chip}{text}</div>
        )}
        <span className="num" style={S.value}>{money(num(value))}</span>
        <IconButton icon={copied ? Check : Copy} label={`Copy Box ${n}`} onClick={onCopy} />
      </div>
      {open && children && <div style={S.detail}>{children}</div>}
    </div>
  );
}

// One drill-down entry: car sales link to the stock page, bank lines to the bank page.
function DrillRow({ d }) {
  const car = d.kind === "car";
  const credit = d.kind === "credit";
  const Icon = car || credit ? Car : Landmark;
  return (
    <div style={S.drill}>
      <span style={{ flex: 1, minWidth: 180 }}>
        <a href={car ? "/admin/stock" : credit ? "/admin/invoices" : "/admin/bank"} style={{ fontWeight: 500, textDecoration: "none" }}>{d.label}</a>
        {d.ref && <span className="muted small" style={{ marginLeft: 8 }}>{d.ref}</span>}
      </span>
      <Badge tone={car ? "teal" : credit ? "orange" : "gray"} icon={Icon}>{car ? "Car" : credit ? "Credit note" : "Bank"}</Badge>
      <span className="num" style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{money(num(d.amount))}</span>
    </div>
  );
}

function ExportMenu({ busy, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Button icon={Download} busy={busy} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>
        Export
      </Button>
      {open && (
        <div role="menu" className="card" style={S.menu}>
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button key={it.label} type="button" role="menuitem" className="btn btn-ghost" style={S.menuItem}
                onClick={() => { setOpen(false); it.run(); }}>
                <Icon size={16} />
                <span>{it.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// One line of the quarter checklist: done tick or count, progress bar, and a link to where it gets fixed.
function PrepStep({ done, total, label, sub, href, action, optional }) {
  const ok = total === 0 ? !!optional || done > 0 : done >= total;
  const frac = total ? Math.min(done / total, 1) : (ok ? 1 : 0);
  return (
    <div className={`prep-step ${ok ? "is-done" : ""}`}>
      <span className="prep-mark">{ok ? <CheckCircle2 size={18} /> : <span className="prep-dot" />}</span>
      <div className="prep-text">
        <div className="prep-label">{label}</div>
        <div className="prep-sub">{sub}</div>
        <div className="prep-bar"><span style={{ width: `${Math.round(frac * 100)}%` }} /></div>
      </div>
      {!ok && href && <a className="btn btn-sm btn-secondary" href={href}>{action}<ChevronRight size={14} /></a>}
    </div>
  );
}

function QuarterPrep({ quarter, p, cars, warnings, version }) {
  const exp = useLoad(() => api.get("/admin/api/expenses", { p: `q:${quarter.id}` }), [quarter.id, version]);
  const inv = useLoad(() => api.get("/admin/api/invoices"), [version]);
  const lines = exp.data?.lines ?? [];
  const typed = lines.filter((x) => x.type_set).length;
  const live = (inv.data ?? []).filter((i) => !i.void);
  const invoiceFor = (c) => live.find((i) => i.reg && c.reg && i.reg.replace(/\s/g, "") === c.reg.replace(/\s/g, ""));
  const sold = cars.filter((c) => c.in_quarter === "Sold");
  const invoiced = sold.filter(invoiceFor);
  const paid = invoiced.filter((c) => invoiceFor(c).payment?.status === "paid");

  const steps = [
    { label: "Bank statement imported", done: p.total > 0 ? 1 : 0, total: 1, href: "/admin/bank", action: "Import CSV",
      sub: p.total ? `${plural(p.total, "transaction")} · ${money(p.money_in)} in, ${money(p.money_out)} out` : "No Tide lines for this quarter yet" },
    { label: "Transactions categorised", done: p.categorised, total: p.total, href: "/admin/bank", action: "Categorise",
      sub: `${p.categorised} of ${p.total}` },
    { label: "VAT receipts attached", done: p.receipts_attached, total: p.receipts_needed, optional: true,
      href: "/admin/expenses", action: "Add receipts",
      sub: p.receipts_needed ? `${p.receipts_attached} of ${p.receipts_needed} costs with VAT` : "No VAT costs need a receipt" },
    { label: "Expense types sorted", done: typed, total: lines.length, optional: true, href: "/admin/expenses", action: "Sort",
      sub: lines.length ? `${typed} of ${lines.length} costs given a type` : "No costs this quarter" },
    { label: "Sales invoiced", done: invoiced.length, total: sold.length, optional: true, href: "/admin/invoices", action: "Invoice",
      sub: sold.length ? `${invoiced.length} of ${plural(sold.length, "car")} sold` : "No cars sold this quarter" },
    { label: "Sales paid", done: paid.length, total: invoiced.length, optional: true, href: "/admin/invoices", action: "Record payment",
      sub: invoiced.length ? `${paid.length} of ${invoiced.length} invoices paid in full` : "Nothing invoiced yet" },
  ];
  const doneCount = steps.filter((s) => (s.total === 0 ? s.optional || s.done > 0 : s.done >= s.total)).length;

  return (
    <Card title="Quarter prep" actions={<span className="muted small">{`${doneCount} of ${steps.length} done`}</span>}>
      <Progress value={doneCount / steps.length} label={doneCount === steps.length ? "Ready to file" : "Getting the quarter ready"} />
      <div className="prep-grid">
        {steps.map((s) => <PrepStep key={s.label} {...s} />)}
      </div>
      {warnings.length > 0 && (
        <div className="prep-warnings">
          <div className="prep-label"><AlertTriangle size={16} /> {`${plural(warnings.length, "thing")} to check before filing`}</div>
          <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
    </Card>
  );
}

export default function ReturnPage() {
  const { quarter, meta, version, refresh, period, setPeriodId, business } = useApp();
  const toast = useToast();
  const [copied, setCopied] = useState(null);
  const copyTimer = useRef(null);
  const [filedOn, setFiledOn] = useState(todayIso);
  const [openRows, setOpenRows] = useState({});
  const [runFiling, filing] = useAction();
  const [runExport, exporting] = useAction();
  const { data, error } = useLoad(() => api.get("/admin/api/return", { q: quarter.id }), [quarter.id, version]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  // A year, tax year or all time: one row per VAT quarter. Filing stays per quarter.
  if (period.kind !== "quarter") return <PeriodView period={period} onOpen={(id) => setPeriodId(`q:${id}`)} />;
  if (error) {
    return <Alert tone="error" title="Couldn't load the VAT return">{error.message}</Alert>;
  }
  if (!data || data.quarter.id !== quarter.id) {
    return <p className="muted">Loading the return…</p>;
  }

  // A quarter before VAT registration: there is no return for it.
  if (data.registered === false) {
    return (
      <div className="stack">
        <PageHeader title="VAT Return" subtitle={`${data.quarter.label} · Not VAT registered`} />
        <Alert tone="info" title="No VAT return for this quarter">
          {business.vat_reg_date
            ? `You were VAT registered from ${longDate(business.vat_reg_date)}, so nothing before then goes on a return. Your first return starts on that date.`
            : "This quarter is before your VAT registration, so there is no return for it."}
        </Alert>
      </div>
    );
  }


  const { boxes, cars_sold: cars, progress: p, warnings } = data;
  const detail = data.detail || [];
  const slug = data.quarter.label.replace(/ /g, "_");
  const net = num(data.net);
  const owe = net > 0;
  const refund = net < 0;
  const netLabel = `${owe ? "To pay HMRC" : refund ? "HMRC owes you" : "Nothing to pay"}${data.in_progress ? " so far" : ""}`;
  const netIcon = refund ? ArrowDownLeft : owe ? ArrowUpRight : Check;
  const firstReturn = data.vat_from && data.vat_from !== data.quarter.start;
  const status = data.filed_on
    ? `Filed ${longDate(data.filed_on)}`
    : data.in_progress
      ? "Quarter in progress"
      : `File and pay by ${longDate(data.deadline)}`;
  const dueText = data.filed_on ? `Filed ${ukDate(data.filed_on).slice(0, 5)}` : `Due ${ukDate(data.deadline)}`;

  const daysLeft = Math.round((new Date(data.deadline) - new Date(new Date().toDateString())) / 86400000);
  const checks = warnings.length ? ` · ${plural(warnings.length, "check")} open` : " · no checks open";
  const deadlineSub = data.filed_on ? `Sent ${ukDate(data.filed_on)}`
    : (data.in_progress ? "Quarter in progress" : daysLeft < 0 ? "Overdue" : `${plural(daysLeft, "day")} left`) + checks;

  const toggleRow = (key) => setOpenRows((s) => ({ ...s, [key]: !s[key] }));

  const copy = async (n) => {
    try {
      await navigator.clipboard.writeText(boxes[n]);
      setCopied(n);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      toast("error", "Couldn't copy to the clipboard.");
    }
  };

  const markFiled = () => runFiling(async () => {
    await api.post("/admin/api/filing", { filed_on: filedOn }, { q: quarter.id });
    refresh();
    return { message: `${data.quarter.label} marked as filed.` };
  });

  const undoFiled = () => runFiling(async () => {
    await api.del("/admin/api/filing", { q: quarter.id });
    refresh();
    return { message: `${data.quarter.label} is no longer marked as filed.` };
  });

  const downloadReceipts = () => runExport(async () => {
    const res = await fetch(`/admin/api/export/receipts.zip?${new URLSearchParams({ q: quarter.id })}`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(res.status === 404 ? "No receipts attached this quarter."
        : (body && body.detail) || `Request failed (${res.status})`);
    }
    saveBlob(await res.blob(), `receipts_${slug}.zip`);
  }, { quiet: true });

  const exportItems = [
    { label: "Quarter CSV", icon: FileSpreadsheet, run: () => download("/admin/api/export/quarter.csv", { q: quarter.id }) },
    { label: "Box figures for bridging software", icon: Upload, run: () => download("/admin/api/export/boxes.csv", { q: quarter.id }) },
    { label: "Receipts zip", icon: FolderArchive, run: downloadReceipts },
  ];

  const detailFor = (n) => detail.filter((d) => Number(d.box) === n);

  const boxRow = (n) => {
    let body;
    if (n === 3) {
      body = <p className="muted small">{`Box 1 + Box 2 = ${money(num(boxes[1]) + num(boxes[2]))}`}</p>;
    } else if (n === 5) {
      body = <p className="muted small">{`Box 3 − Box 4 = ${money(num(boxes[3]) - num(boxes[4]))}`}</p>;
    } else {
      const list = detailFor(n);
      body = list.length > 0
        ? list.map((d, i) => <DrillRow key={`${d.kind}-${d.ref}-${i}`} d={d} />)
        : <p className="muted small">Nothing in this box this quarter.</p>;
    }
    return (
      <ValueRow key={n} n={n} label={meta.box_labels[n]} value={boxes[n]}
        copied={copied === n} onCopy={() => copy(n)}
        highlight={n === BRIDGE_BOX} open={!!openRows[n]} onToggle={() => toggleRow(n)}>
        {body}
      </ValueRow>
    );
  };

  const actions = (
    <>
      <ExportMenu busy={exporting} items={exportItems} />
      {data.filed_on ? (
        <>
          <Badge tone="green" icon={CheckCircle2}>{`Filed ${longDate(data.filed_on)}`}</Badge>
          <Button variant="ghost" icon={Undo2} busy={filing} onClick={undoFiled}>Undo filed</Button>
        </>
      ) : (
        <>
          <Input type="date" aria-label="Filed with HMRC on" value={filedOn} max={todayIso()}
            onChange={(e) => setFiledOn(e.target.value)} style={{ width: 168 }} />
          <Button variant="primary" icon={CheckCircle2} busy={filing}
            disabled={!data.ended || !filedOn}
            title={data.ended ? undefined : "You can file once the quarter has ended."}
            onClick={markFiled}>
            Mark as filed
          </Button>
        </>
      )}
    </>
  );

  return (
    <div className="stack">
      <PageHeader title="VAT Return" actions={actions}
        subtitle={`${firstReturn ? `First return: ${ukDate(data.vat_from)} to ${ukDate(data.quarter.end)}` : data.quarter.label} · ${status}`} />

      {data.filed_on && (
        <Alert tone="success">
          The figures sent to HMRC are saved, and you'll be warned if later edits change them.
        </Alert>
      )}

      <div className="grid-4">
        <StatCard tone="sage" icon={ArrowUpRight} label="Sales" sub={`Box 6 · ${plural(cars.length, "car")} sold`}
          value={money(num(boxes[6]))} />
        <StatCard tone="blush" icon={ArrowDownLeft} label="Purchases and costs" sub="Box 7, before VAT"
          value={money(num(boxes[7]))} />
        <InkCard title={data.quarter.label} chip="HMRC" amount={money(Math.abs(net))}
          footLeft={netLabel} footRight={dueText} />
        <StatCard tone="lilac" icon={CalendarClock} label="Deadline" sub={deadlineSub}
          value={data.filed_on ? "Filed" : longDate(data.deadline)} />
      </div>

      <QuarterPrep quarter={quarter} p={p} cars={cars} warnings={warnings} version={version} />

      <Card title="Boxes for HMRC">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MAIN_BOXES.map((n) => boxRow(n))}

          <div style={S.line}>
            <div style={S.row}>
              <button type="button" onClick={() => toggleRow("group")} aria-expanded={!!openRows.group} style={S.toggle}>
                <span style={S.chip}><Globe size={14} /></span>
                <span style={S.text}>
                  <span style={S.label}>Boxes 2, 8 and 9</span>
                  <span style={S.sub}>Northern Ireland and EU only</span>
                </span>
                <ChevronDown size={16} style={{ ...S.chev, transform: openRows.group ? "rotate(180deg)" : "none" }} />
              </button>
              <span className="num" style={S.groupValue}>
                {GROUP_BOXES.map((n) => money(num(boxes[n]))).join(" · ")}
              </span>
            </div>
            {openRows.group && (
              <div style={S.detail}>
                {GROUP_BOXES.map((n) => (
                  <ValueRow key={n} n={n} label={meta.box_labels[n]} value={boxes[n]} nested
                    copied={copied === n} onCopy={() => copy(n)} />
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="muted small" style={{ marginTop: 14 }}>
          Copy each value into your bridging software. Enter Box 5 without a minus sign;
          a negative Box 5 means a refund.
        </p>
      </Card>

      <Card title="Cars sold this quarter">
        {cars.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reg</th><th>Make / model</th><th>Scheme</th><th>Bought</th>
                  <th className="r">Purchase price</th><th>Sold</th><th className="r">Sale price</th>
                  <th className="r">Part-ex</th><th className="r">Margin</th><th className="r">VAT</th>
                  <th className="r">Profit ex VAT</th>
                </tr>
              </thead>
              <tbody>
                {cars.map((c, i) => (
                  <tr key={`${c.reg}-${i}`}>
                    <td>{c.reg}</td>
                    <td>{c.make_model}</td>
                    <td>{c.scheme}</td>
                    <td>{ukDate(c.purchase_date)}</td>
                    <td className="r">{money(c.purchase_price)}</td>
                    <td>{ukDate(c.sale_date)}</td>
                    <td className="r">{money(c.sale_price)}</td>
                    <td className="r">{money(c.px_allowance)}</td>
                    <td className="r">{money(c.margin)}</td>
                    <td className="r">{money(c.output_vat)}</td>
                    <td className="r">{money(c.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No cars sold in this quarter.</p>
        )}
      </Card>
    </div>
  );
}


// ---------------------------------------------------------------- a longer period, split by VAT quarter

function quarterStatus(q) {
  if (q.filed_on) return <Badge tone="green">{`Filed ${ukDate(q.filed_on)}`}</Badge>;
  if (q.in_progress) return <Badge tone="blue">In progress</Badge>;
  const late = new Date(q.deadline) < new Date(new Date().toDateString());
  return <Badge tone={late ? "red" : "orange"}>{`${late ? "Was due" : "Due"} ${ukDate(q.deadline)}`}</Badge>;
}

function PeriodView({ period, onOpen }) {
  const { version } = useApp();
  const { data, error } = useLoad(() => api.get("/admin/api/period-summary", { p: period.id }), [period.id, version]);
  if (error) return <Alert tone="error" title="Couldn't load the figures">{error.message}</Alert>;
  if (!data || data.period.id !== period.id) return <p className="muted">Loading…</p>;
  const { quarters, totals, sold } = data;
  const net = num(data.net);
  const cols = [[1, "Box 1"], [4, "Box 4"], [5, "Box 5"], [6, "Box 6"], [7, "Box 7"]];
  return (
    <div className="stack">
      <PageHeader title="VAT Returns" subtitle={`${period.label} · ${plural(quarters.length, "quarter")} · ${ukDate(period.start)} to ${ukDate(period.end)}`} />
      <div className="grid-4">
        <StatCard tone="sage" icon={ArrowUpRight} label="Sales" sub={`Box 6 · ${plural(sold.count, "car")} sold`}
          value={money(num(totals[6]))} />
        <StatCard tone="blush" icon={ArrowDownLeft} label="Purchases and costs" sub="Box 7, before VAT"
          value={money(num(totals[7]))} />
        <InkCard title={period.label} chip="HMRC" amount={money(Math.abs(net))}
          footLeft={net > 0 ? "To pay HMRC" : net < 0 ? "HMRC owes you" : "Nothing to pay"}
          footRight={plural(quarters.length, "return")} />
        <StatCard tone="lilac" icon={Car} label="Profit on cars" sub={`${plural(sold.count, "car")} sold, before VAT`}
          value={money(sold.profit)} />
      </div>
      <Card title="Each VAT quarter">
        {quarters.length === 0 ? <p className="muted">No VAT quarters end in this period.</p> : (
          <div className="table-wrap">
            <table className="table period-table">
              <thead>
                <tr>
                  <th>Quarter</th>
                  {cols.map(([n, l]) => <th key={n} className="r">{l}</th>)}
                  <th>Status</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {quarters.map((q) => (
                  <tr key={q.id} onClick={() => onOpen(q.id)} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") onOpen(q.id); }}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{q.label}</div>
                      <div className="small muted">{plural(q.cars_sold, "car")} sold{q.warnings ? ` · ${plural(q.warnings, "check")}` : ""}</div>
                    </td>
                    {cols.map(([n]) => <td key={n} className="r">{n <= 5 ? money(num(q.boxes[n])) : `£${num(q.boxes[n]).toLocaleString("en-GB")}`}</td>)}
                    <td>{quarterStatus(q)}</td>
                    <td className="r"><ChevronRight size={16} className="muted" /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total</td>
                  {cols.map(([n]) => <td key={n} className="r" style={{ fontWeight: 600 }}>{n <= 5 ? money(num(totals[n])) : `£${num(totals[n]).toLocaleString("en-GB")}`}</td>)}
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>
          Click a quarter to open its return, see what's in each box and mark it filed.
          Returns are filed per quarter; each one counts in the period its quarter ends in.
        </p>
      </Card>
      <style>{`
        .period-table tbody tr { cursor: pointer; }
        .period-table tbody tr:hover td { background: var(--panel); }
        .period-table tfoot td { border-top: 1px solid var(--border-strong); }
      `}</style>
    </div>
  );
}
