import { useEffect, useState } from "react";
import {
  Building2, Check, Contact, FileText, FlaskConical, Upload, DatabaseBackup, Download, Landmark, ReceiptText, Save,
  Search, ShieldCheck,
} from "lucide-react";
import { api, download } from "../api.js";
import { useApp } from "../context.js";
import {
  Alert, Badge, Button, Card, Collapsible, Field, Input, PageHeader, Select, Textarea, Toggle, useAction, useToast,
} from "../components/ui.jsx";

const EMPTY = {
  company_number: "", company_name: "", company_status: "", registered_office: "", sic_codes: "",
  incorporation_date: "", directors: "", vrn: "", stagger: "MAR", vat_reg_date: "",
  accounting_scheme: "", uses_margin_scheme: true, trading_name: "", owner_name: "", email: "", phone: "",
  sort_code: "", account_no: "", invoice_start: "", stock_start: "", year_end: "",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
  "October", "November", "December"];

// Financial year end as "MM-DD", picked as day + month (Companies House calls it the accounting reference date).
function YearEndPicker({ value, onChange }) {
  const [mm, dd] = (value || "").split("-");
  const put = (m, d) => onChange(m && d ? `${m}-${d}` : "");
  return (
    <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
      <Select aria-label="Year end day" value={dd || ""} onChange={(d) => put(mm || "03", d)}
        options={[{ value: "", label: "Day" }, ...Array.from({ length: 31 }, (_, i) => {
          const v = String(i + 1).padStart(2, "0");
          return { value: v, label: String(i + 1) };
        })]} />
      <Select aria-label="Year end month" value={mm || ""} onChange={(m) => put(m, dd || "31")}
        options={[{ value: "", label: "Month" }, ...MONTHS.map((n, i) => ({ value: String(i + 1).padStart(2, "0"), label: n }))]} />
    </div>
  );
}

function fromBusiness(b, meta) {
  const f = { ...EMPTY, accounting_scheme: meta.accounting_schemes[0] };
  if (!b) return f;
  for (const k of Object.keys(EMPTY)) if (b[k] !== null && b[k] !== undefined) f[k] = b[k];
  f.vrn = b.vrn_formatted || b.vrn;
  f.uses_margin_scheme = !!b.uses_margin_scheme;
  return f;
}

function SectionTitle({ n, icon: IconC, children }) {
  return (
    <span className="form-section-title">
      <span className="step-num">{n}</span><IconC size={18} />{children}
    </span>
  );
}

// VAT number feedback: check digits worked out by the server, plus what HMRC holds once verified.
function useVrnCheck(vrn, hmrcVrn) {
  const [check, setCheck] = useState(null);
  useEffect(() => {
    if (!vrn.trim()) { setCheck(null); return undefined; }
    const t = setTimeout(() => api.get("/admin/api/vrn-check", { vrn }).then(setCheck).catch(() => setCheck(null)), 250);
    return () => clearTimeout(t);
  }, [vrn, hmrcVrn]);
  return check;
}

function LogoUpload({ hasLogo }) {
  const [run, busy] = useAction();
  const [version, setVersion] = useState(Date.now());
  const [shown, setShown] = useState(hasLogo);
  async function upload(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    if (await run(() => api.post("/admin/api/logo", fd))) {
      setShown(true);
      setVersion(Date.now());
    }
  }
  return (
    <div className="row" style={{ alignItems: "center" }}>
      <div style={{ width: 150, height: 82, border: "1px solid var(--border)", borderRadius: 8, display: "grid",
        placeItems: "center", background: "var(--surface)", overflow: "hidden" }}>
        {shown ? <img src={`/admin/api/logo?v=${version}`} alt="Invoice logo" style={{ maxWidth: "100%", maxHeight: "100%" }} />
          : <span className="muted small">No logo</span>}
      </div>
      <div className="stack-sm">
        <label className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>
          <Upload size={16} /><span>{busy ? "Uploading..." : shown ? "Replace logo" : "Upload logo"}</span>
          <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => upload(e.target.files[0])} />
        </label>
        <span className="field-hint">PNG or JPG, wider than tall. Printed top left, about 34 × 18 mm.</span>
      </div>
    </div>
  );
}

export function BusinessForm({ onSaved }) {
  const { meta, business } = useApp();
  const toast = useToast();
  const [form, setForm] = useState(() => fromBusiness(business, meta));
  const [hmrc, setHmrc] = useState(null);
  const [run, busy] = useAction();
  const [lookupBusy, setLookupBusy] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setText = (k) => (e) => set(k)(e.target.value);
  const check = useVrnCheck(form.vrn, hmrc?.vrn);
  const hmrcHere = hmrc && check && hmrc.vrn === check.vrn;
  const nameMismatch = !!(hmrcHere && form.company_name && !hmrc.name_matches);

  async function chLookup() {
    setLookupBusy("ch");
    try {
      const data = await api.post("/admin/api/lookup/companies-house", { company_number: form.company_number });
      setForm((f) => ({ ...f, ...data }));
      toast("success", `Loaded ${data.company_name} from Companies House.`);
    } catch (e) {
      toast("error", e.message);
    } finally {
      setLookupBusy(null);
    }
  }

  async function hmrcVerify() {
    setLookupBusy("hmrc");
    setHmrc(null);
    try {
      setHmrc(await api.post("/admin/api/lookup/hmrc", { vrn: form.vrn, company_name: form.company_name }));
    } catch (e) {
      toast("error", e.message);
    } finally {
      setLookupBusy(null);
    }
  }

  async function save() {
    const start = (v) => (String(v ?? "").trim() === "" ? null : Number(v));
    const saved = await run(() => api.put("/admin/api/business", {
      ...form, vat_reg_date: form.vat_reg_date || null,
      invoice_start: start(form.invoice_start), stock_start: start(form.stock_start),
    }), { quiet: true });
    if (saved) {
      toast("success", "Business details saved.");
      setForm(fromBusiness(saved, meta));
      onSaved?.(saved);
    }
  }

  const status = form.company_status.trim();

  // Companies House and HMRC lookup buttons and their results. Shown inline during onboarding,
  // folded into a collapsible once the business exists.
  const lookupTools = (
    <div className="stack">
      {meta.lookups.companies_house ? (
        <div className="row">
          <Button icon={Search} onClick={chLookup} busy={lookupBusy === "ch"}
            disabled={!form.company_number.trim()}>Look up company number</Button>
          <span className="muted small">Fills in the name, status, office, directors and SIC codes.</span>
        </div>
      ) : (
        <span className="muted small">Add COMPANIES_HOUSE_API_KEY to .env to look this up.</span>
      )}
      {meta.lookups.hmrc && (
        <>
          <div className="row">
            <Button icon={ShieldCheck} onClick={hmrcVerify} busy={lookupBusy === "hmrc"}
              disabled={!check?.shape_ok}>Verify VAT number with HMRC</Button>
          </div>
          {meta.lookups.hmrc_sandbox && (
            <div className="row small muted">
              <Badge tone="orange" icon={FlaskConical}>HMRC test mode</Badge>
              <span>Verify only recognises HMRC&apos;s test numbers (such as 553557881) until production credentials are set up.</span>
            </div>
          )}
          {hmrcHere && (
            <>
              <Alert tone="info" title={`HMRC holds: ${hmrc.name}`}>{hmrc.address}</Alert>
              {nameMismatch && (
                <Alert tone="warning">
                  HMRC&apos;s name ({hmrc.name}) doesn&apos;t match the company name ({form.company_name}).
                </Alert>
              )}
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="stack">
      {business ? (
        <Card className="tone-sky">
          <Collapsible title={(
            <span className="row" style={{ gap: 8 }}>
              Check details with Companies House and HMRC
              {nameMismatch && <Badge tone="orange" icon={ShieldCheck}>HMRC name mismatch</Badge>}
            </span>
          )}>
            {lookupTools}
          </Collapsible>
        </Card>
      ) : (
        <Card title="Check details" icon={Search} className="tone-sky">
          {lookupTools}
        </Card>
      )}

      <Card title={<SectionTitle n={1} icon={Building2}>Company</SectionTitle>} className="tone-lilac">
        <div className="stack">
          <Field label="Company number">
            <Input value={form.company_number} onChange={setText("company_number")} maxLength={10} />
          </Field>
          <Field variant="line" label="Company name">
            <Input value={form.company_name} onChange={setText("company_name")} />
          </Field>
          <div className="grid-2">
            <Field variant="line" label="Status"><Input value={form.company_status} onChange={setText("company_status")} /></Field>
            <Field label="Incorporated">
              <Input type="date" value={form.incorporation_date} onChange={setText("incorporation_date")} />
            </Field>
          </div>
          {status && status.toLowerCase() !== "active" && (
            <Alert tone="warning">Companies House lists this company as <strong>{status}</strong>, not active.</Alert>
          )}
          <div className="grid-2">
            <Field label="Registered office address">
              <Textarea value={form.registered_office} onChange={setText("registered_office")} />
            </Field>
            <Field label="Active directors (one per line)">
              <Textarea value={form.directors} onChange={setText("directors")} />
            </Field>
          </div>
          <Field variant="line" label="SIC codes"><Input value={form.sic_codes} onChange={setText("sic_codes")} /></Field>
        </div>
      </Card>

      <Card title={<SectionTitle n={2} icon={ReceiptText}>VAT</SectionTitle>} className="tone-sage">
        <div className="stack">
          <Field label="VAT registration number">
            <Input value={form.vrn} onChange={setText("vrn")} placeholder="GB 123 4567 82" />
          </Field>
          {check && (check.checksum_ok ? (
            <div><Badge tone="green" icon={Check}>{check.formatted} passes the HMRC check-digit test</Badge></div>
          ) : !check.shape_ok ? (
            <Alert tone="error">A VAT number is 9 digits (or 12 with a branch code).</Alert>
          ) : !hmrcHere && !check.hmrc_confirmed && (
            <Alert tone="warning">
              This VAT number fails the check-digit test. Check it against your VAT certificate
              {meta.lookups.hmrc ? " or verify it with HMRC (see the check box at the top)." : "."}
            </Alert>
          ))}
          <div className="grid-2">
            <Field label="VAT stagger">
              <Select value={form.stagger} onChange={set("stagger")}
                options={Object.entries(meta.staggers).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="VAT effective registration date">
              <Input type="date" min="1973-04-01" value={form.vat_reg_date} onChange={setText("vat_reg_date")} />
            </Field>
          </div>
          <div className="grid-2" style={{ alignItems: "end" }}>
            <Field label="Accounting scheme">
              <Select value={form.accounting_scheme} onChange={set("accounting_scheme")} options={meta.accounting_schemes} />
            </Field>
            <div style={{ paddingBottom: 8 }}>
              <Toggle checked={form.uses_margin_scheme} onChange={set("uses_margin_scheme")}
                label="Uses the margin scheme for second-hand cars" />
            </div>
          </div>
          <div className="grid-2" style={{ alignItems: "end" }}>
            <Field label="Financial year end" hint="Your company's accounting year end; the Financial year period uses it.">
              <YearEndPicker value={form.year_end} onChange={set("year_end")} />
            </Field>
          </div>
          {form.accounting_scheme !== meta.accounting_schemes[0] && (
            <Alert tone="warning">
              Margin-scheme car sales can&apos;t be accounted for under {form.accounting_scheme}. All
              calculations here assume standard (invoice) accounting.
            </Alert>
          )}
        </div>
      </Card>

      <Card title={<SectionTitle n={3} icon={Contact}>Contact</SectionTitle>} className="tone-sky">
        <div className="grid-3">
          <Field variant="line" label="Your name" hint="Home greets you with it"><Input value={form.owner_name} onChange={setText("owner_name")} placeholder="e.g. Sharusan" /></Field>
          <Field variant="line" label="Trading name (optional)"><Input value={form.trading_name} onChange={setText("trading_name")} /></Field>
          <Field variant="line" label="Contact email"><Input type="email" value={form.email} onChange={setText("email")} /></Field>
          <Field variant="line" label="Phone"><Input type="tel" value={form.phone} onChange={setText("phone")} /></Field>
        </div>
      </Card>

      <Card title={<SectionTitle n={4} icon={FileText}>Invoices</SectionTitle>} className="tone-sand">
        <div className="stack">
          <p className="small muted">
            Printed on your sales invoices, with the company name, phone, email, VAT number, registered
            office and company number above.
          </p>
          <div className="grid-2">
            <Field variant="line" label="Sort code"><Input value={form.sort_code} onChange={setText("sort_code")} placeholder="e.g. 20-19-97" /></Field>
            <Field variant="line" label="Account number"><Input value={form.account_no} onChange={setText("account_no")} inputMode="numeric" /></Field>
          </div>
          <div className="grid-2">
            <Field label="First invoice number"
              hint={business?.numbers_locked ? `Locked once invoices exist. Next: ${business.next_invoice_no}`
                : "Carry on from your last paper or Word invoice, so no number is used twice."}>
              <Input type="number" min="1" max="9999" value={form.invoice_start ?? ""}
                disabled={!!business?.numbers_locked} onChange={setText("invoice_start")} placeholder="1" />
            </Field>
            <Field label="First stock number"
              hint={business?.numbers_locked ? `Locked once invoices exist. Next: ${business.next_stock_no}`
                : "Changing it renumbers the cars already in the stock book, in the order they were added."}>
              <Input type="number" min="1" max="9999" value={form.stock_start ?? ""}
                disabled={!!business?.numbers_locked} onChange={setText("stock_start")} placeholder="1" />
            </Field>
          </div>
          {business && <LogoUpload hasLogo={business.has_logo} />}
        </div>
      </Card>

      <div className="row">
        <Button variant="primary" icon={Save} onClick={save} busy={busy}>Save business details</Button>
      </div>
    </div>
  );
}

export default function BusinessPage() {
  const { setBusiness, refresh } = useApp();
  return (
    <div className="stack">
      <PageHeader title="Business" subtitle="Company and VAT details used for your returns." />
      <BusinessForm onSaved={(b) => { setBusiness(b); refresh(); }} />
      <Card title="Backup" icon={DatabaseBackup} className="tone-blush">
        <div className="row">
          <p className="muted spacer" style={{ minWidth: 260 }}>
            All your data is in vat.db and the receipts folder on this computer. Keep a copy somewhere
            else, such as a USB stick. To restore, unzip it into the app folder.
          </p>
          <Button icon={Download} onClick={() => download("/admin/api/backup.zip")}>Download backup</Button>
        </div>
      </Card>
      <p className="muted small row"><Landmark size={14} /> Figures are worked out here; file them through your MTD bridging software.</p>
    </div>
  );
}
