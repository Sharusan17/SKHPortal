import { useEffect, useState } from "react";
import { Check, ClipboardCheck, Eye, Pencil, X } from "lucide-react";
import { Alert, Badge, Button, Card, PageHeader, Segmented, useAction, useLoad } from "../components/ui.jsx";
import { api } from "../api.js";
import { useApp } from "../context.js";
import { plural } from "../format.js";
import { navigate } from "../router.js";

const FILTERS = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
];
const TONE = { pending: "orange", approved: "green", rejected: "red" };
const WORD = { pending: "Waiting for approval", approved: "Approved", rejected: "Rejected" };

const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
};

// A new invoice (POST /api/invoices) or a change to one (PUT /api/invoices/<id>).
const invoiceOf = (r) => {
  if (r.method === "POST" && r.path === "/api/invoices") return { id: null };
  const m = r.method === "PUT" && r.path.match(/^\/api\/invoices\/(\d+)$/);
  return m ? { id: Number(m[1]) } : null;
};

// "buyer_name" -> "Buyer name"
const nice = (k) => String(k).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// The fields a user sent, as a readable list instead of JSON.
function Fields({ details }) {
  let data = null;
  try { data = JSON.parse(details); } catch { /* not JSON: shown as it is */ }
  if (!data || typeof data !== "object") return <p className="small approval-text">{details}</p>;
  const show = (v) => {
    if (v === null || v === undefined || v === "") return <span className="muted">-</span>;
    if (Array.isArray(v)) {
      if (!v.length) return <span className="muted">-</span>;
      if (v.every((x) => typeof x !== "object")) return v.join(", ");
      return (
        <ul className="plain approval-sub">
          {v.map((x, i) => <li key={i}>{typeof x === "object" ? Object.entries(x).map(([k, y]) => `${nice(k)}: ${y}`).join(" · ") : String(x)}</li>)}
        </ul>
      );
    }
    if (typeof v === "object") {
      const parts = Object.entries(v).filter(([, y]) => y !== "" && y !== null && y !== 0 && !(Array.isArray(y) && !y.length));
      if (!parts.length) return <span className="muted">-</span>;
      return <ul className="plain approval-sub">{parts.map(([k, y]) => <li key={k}><span className="muted">{nice(k)}:</span> {Array.isArray(y) ? y.join(", ") : String(y)}</li>)}</ul>;
    }
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
  };
  return (
    <dl className="approval-fields">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="approval-field">
          <dt>{nice(k)}</dt>
          <dd>{show(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

// The change as before/after fields, saved with the request when the user made it.
const changesOf = (r) => {
  try {
    const c = JSON.parse(r.changes || "");
    return c && Array.isArray(c.fields) ? c : null;
  } catch { return null; }
};

// Changed fields lead, highlighted, with what they were underneath; the rest are tucked away.
function Changes({ change }) {
  const [all, setAll] = useState(false);
  const isNew = change.kind === "new";
  const changed = change.fields.filter((f) => isNew || f.changed);
  const same = isNew ? [] : change.fields.filter((f) => !f.changed && (f.before || f.after));
  if (!changed.length && !same.length) return null;
  return (
    <div className="diff">
      {!isNew && !changed.length && <p className="small muted">Nothing would change.</p>}
      {changed.map((f) => (
        <div key={f.key} className={`diff-row ${isNew ? "is-new" : "is-changed"}`}>
          <div className="diff-label">{f.label}</div>
          <div className="diff-value">
            <span className="diff-after">{f.after || <em className="muted">Removed</em>}</span>
            {!isNew && <span className="diff-before">Was: <s>{f.before || "blank"}</s></span>}
          </div>
        </div>
      ))}
      {same.length > 0 && (
        <>
          <button type="button" className="link-btn small diff-toggle" onClick={() => setAll(!all)}>
            {all ? "Hide unchanged fields" : `Show ${same.length} unchanged field${same.length === 1 ? "" : "s"}`}
          </button>
          {all && same.map((f) => (
            <div key={f.key} className="diff-row">
              <div className="diff-label">{f.label}</div>
              <div className="diff-value">{f.after || f.before}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

async function pdfUrl(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `Couldn't draw the invoice (${res.status})`;
    try { const j = await res.json(); if (typeof j.detail === "string") msg = j.detail; } catch { /* keep */ }
    throw new Error(msg);
  }
  return URL.createObjectURL(await res.blob());
}

// The invoice as it would be printed, drawn from what the user sent; next to the original for an edit.
function InvoicePreview({ r, inv }) {
  const [state, setState] = useState({ url: null, before: null, err: "", loading: false });
  const load = async () => {
    setState({ url: null, before: null, err: "", loading: true });
    try {
      const d = await api.get(`/admin/api/approvals/${r.id}/data`);
      if (!d.data) throw new Error("This request has no invoice to show.");
      const body = { ...d.data, ...(inv.id ? { invoice_id: inv.id } : {}) };
      const [url, before] = await Promise.all([
        pdfUrl("/admin/api/invoices/draft.pdf", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }),
        inv.id ? pdfUrl(`/admin/api/invoices/${inv.id}/pdf`).catch(() => null) : null,
      ]);
      setState({ url, before, err: "", loading: false });
    } catch (e) {
      setState({ url: null, before: null, err: e.message, loading: false });
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id]);
  useEffect(() => () => { if (state.url) URL.revokeObjectURL(state.url); }, [state.url]);
  useEffect(() => () => { if (state.before) URL.revokeObjectURL(state.before); }, [state.before]);
  if (state.loading || (!state.url && !state.err)) return <p className="small muted">Drawing the invoice…</p>;
  if (state.err) return <Alert tone="warning">{state.err}</Alert>;
  if (!inv.id) return <iframe className="approval-pdf" src={state.url} title={`Invoice in request ${r.id}`} />;
  return (
    <div className="pdf-compare">
      <div className="pdf-side is-before">
        <div className="pdf-tag">Original</div>
        {state.before ? <iframe className="approval-pdf" src={state.before} title="The invoice as it is now" />
          : <p className="small muted">The original PDF isn't available.</p>}
      </div>
      <div className="pdf-side is-after">
        <div className="pdf-tag">New</div>
        <iframe className="approval-pdf" src={state.url} title="The invoice with the changes" />
      </div>
    </div>
  );
}

// Admins: every user's held changes, to approve, amend or reject. Users: their own requests.
export default function ApprovalsPage() {
  const { me, refresh, version } = useApp();
  const isAdmin = me.role === "admin";
  const [status, setStatus] = useState("pending");
  const load = useLoad(() => api.get("/admin/api/approvals", status ? { status } : undefined), [status, version]);
  const [run, busy] = useAction();
  const [open, setOpen] = useState(null);
  const [preview, setPreview] = useState(null);

  const approve = async (r) => {
    if (await run(() => api.post(`/admin/api/approvals/${r.id}/approve`))) { load.reload(); refresh(); }
  };
  const reject = async (r) => {
    const note = window.prompt(`Reject "${r.summary}"? Add a short reason for ${r.user_name} (optional):`, "");
    if (note === null) return;
    if (await run(() => api.post(`/admin/api/approvals/${r.id}/reject`, { note }))) { load.reload(); refresh(); }
  };

  const list = load.data || [];
  return (
    <div className="stack">
      <PageHeader title={isAdmin ? "Approvals" : "My requests"}
        subtitle={isAdmin ? "Changes made by users wait here until an admin approves them"
          : "What you've saved waits here until an admin approves it"} />
      <div><Segmented options={FILTERS} value={status} onChange={setStatus} ariaLabel="Which requests" /></div>
      {load.error && <Alert tone="error">{load.error.message}</Alert>}
      <Card title={plural(list.length, "request")} icon={ClipboardCheck}>
        {load.data && list.length === 0 && (
          <p className="small muted">{status === "pending" ? "Nothing waiting." : "Nothing here."}</p>
        )}
        <div className="stack-sm">
          {list.map((r) => {
            const inv = invoiceOf(r);
            const change = changesOf(r);
            const canAmend = isAdmin && r.status === "pending" && inv;
            return (
              <div key={r.id} className="approval">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="list-title">{r.summary}</div>
                    <div className="small muted">
                      {isAdmin ? `${r.user_name} · ` : ""}{when(r.created_at)}
                      {r.decided_at ? ` · ${WORD[r.status]} by ${r.decided_by} ${when(r.decided_at)}` : ""}
                    </div>
                    {r.status === "rejected" && r.note && <div className="small">Reason: {r.note}</div>}
                    {r.status === "approved" && r.note?.startsWith("Amended") && <div className="small muted">Amended before approving</div>}
                  </div>
                  <div className="row approval-actions" style={{ gap: 8 }}>
                    <Badge tone={TONE[r.status]}>{WORD[r.status]}</Badge>
                    {isAdmin && r.status === "pending" && (
                      <>
                        <Button size="sm" icon={X} disabled={busy} onClick={() => reject(r)}>Reject</Button>
                        {canAmend && (
                          <Button size="sm" icon={Pencil} disabled={busy}
                            onClick={() => navigate(`/admin/invoices?approval=${r.id}`)}>Amend</Button>
                        )}
                        <Button size="sm" variant="primary" icon={Check} busy={busy} onClick={() => approve(r)}>Approve</Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="row" style={{ gap: 14 }}>
                  {isAdmin && inv && r.status === "pending" && (
                    <button type="button" className="link-btn small" onClick={() => setPreview(preview === r.id ? null : r.id)}>
                      <Eye size={13} /> {preview === r.id ? "Hide invoice" : inv.id ? "Compare invoices" : "View invoice"}
                    </button>
                  )}
                  {r.details && (!change || change.kind === "new") && (
                    <button type="button" className="link-btn small" onClick={() => setOpen(open === r.id ? null : r.id)}>
                      {open === r.id ? "Hide details" : "Show details"}
                    </button>
                  )}
                </div>
                {change && change.kind === "edit" && <Changes change={change} />}
                {preview === r.id && <InvoicePreview r={r} inv={inv} />}
                {open === r.id && (change ? <Changes change={change} /> : <Fields details={r.details} />)}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
