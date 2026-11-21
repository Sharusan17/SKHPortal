import { useState } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink, Flag, RotateCcw, Send } from "lucide-react";
import { Alert, Badge, Button, Card, Field, PageHeader, Select, Textarea, useAction, useLoad } from "../components/ui.jsx";
import { useApp } from "../context.js";
import { api } from "../api.js";
import { money, ukDate } from "../format.js";
import { navigate } from "../router.js";

const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

// One flag (/admin/flag/<expense id>): the expense at a glance, and its comment thread.
export default function FlagPage({ flagId }) {
  const { version, refresh } = useApp();
  const load = useLoad(() => api.get(`/admin/api/flags/${flagId}`), [flagId, version]);
  const people = useLoad(() => api.get("/admin/api/people"), []);
  const [body, setBody] = useState("");
  const [ask, setAsk] = useState("");
  const [run, busy] = useAction();

  if (load.error) {
    return (
      <div className="stack">
        <Alert tone="warning" title="Flag not found">The expense may have been deleted.</Alert>
        <div><Button icon={ArrowLeft} onClick={() => navigate("/admin/flags")}>Back to Flags</Button></div>
      </div>
    );
  }
  const f = load.data;
  if (!f) return <p className="muted">Loading…</p>;

  const post = async () => {
    const res = await run(() => api.post(`/admin/api/flags/${f.id}/comments`, { body, ask_email: ask }), { quiet: true });
    if (res) { setBody(""); setAsk(""); refresh(); }
  };
  const setState = async (state) => {
    if (await run(() => api.post(`/admin/api/flags/${f.id}/state`, { state }))) refresh();
  };
  const askOptions = [{ value: "", label: "Nobody in particular" },
    ...(people.data || []).map((p) => ({ value: p.email, label: p.name }))];

  return (
    <div className="stack">
      <div><button type="button" className="back-link" onClick={() => navigate("/admin/flags")}><ArrowLeft size={16} />Flags</button></div>
      <PageHeader title={f.description}
        subtitle={`${ukDate(f.date)} · ${money(Math.abs(Number(f.amount)))}${f.flagged_by ? ` · flagged by ${f.flagged_by}` : ""}`}
        actions={
          <>
            <Button icon={ExternalLink} onClick={() => navigate(`/admin/expense/${f.id}`)}>Open expense</Button>
            {f.state === "open"
              ? <Button variant="primary" icon={CheckCircle2} busy={busy} onClick={() => setState("resolved")}>Resolve</Button>
              : <Button icon={RotateCcw} busy={busy} onClick={() => setState("open")}>Reopen</Button>}
          </>
        } />

      <div className="grid-expenses">
        <Card title="Comments">
          <div className="stack">
            {f.thread.length === 0 && <p className="muted small">No comments yet. Ask a question below.</p>}
            <ol className="thread">
              {f.thread.map((c) => (
                <li key={c.id} className="thread-item">
                  <div className="thread-head">
                    <span className="thread-avatar" aria-hidden="true">{(c.author_name || "?").slice(0, 1).toUpperCase()}</span>
                    <strong>{c.author_name}</strong>
                    {c.ask_name && <span className="thread-ask">asked {c.ask_name}</span>}
                    <span className="muted small">{when(c.created_at)}</span>
                  </div>
                  <p className="thread-body">{c.body}</p>
                </li>
              ))}
            </ol>

            <div className="thread-new">
              <Field label="Add a comment">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
                  placeholder="Ask a question or answer one…"
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && body.trim()) post(); }} />
              </Field>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
                <div style={{ width: 260, maxWidth: "100%" }}>
                  <Field label="Ask">
                    <Select value={ask} onChange={setAsk} options={askOptions} aria-label="Who the question is for" />
                  </Field>
                </div>
                <Button variant="primary" icon={Send} busy={busy} disabled={!body.trim()} onClick={post}>Post</Button>
              </div>
              <p className="small muted">The person you ask sees it under "Waiting on me" until they reply. Ctrl+Enter posts.</p>
            </div>
          </div>
        </Card>

        <div className="stack">
          <Card title="Status">
            <div className="stack-sm">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Flag</span>
                {f.state === "resolved" ? <Badge tone="gray">Resolved</Badge> : <Badge tone="red" icon={Flag}>Open</Badge>}
              </div>
              {f.waiting_on && f.state === "open" && (
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">Waiting on</span><strong>{f.waiting_on.name}</strong>
                </div>
              )}
              {f.state === "resolved" && f.resolved_by && (
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">Resolved by</span><span>{f.resolved_by}</span>
                </div>
              )}
            </div>
          </Card>
          <Card title="Expense">
            <ul className="plain by-type">
              <li><span>Amount</span><strong>{money(Math.abs(Number(f.amount)))}</strong></li>
              <li><span>VAT</span><span>{money(Math.abs(Number(f.vat)))}</span></li>
              <li><span>Type</span><span>{f.expense_type || f.category}</span></li>
              <li><span>Car</span>{f.car_reg ? <a href={`/admin/car/${f.car_id}`}><Badge tone="blue">{f.car_reg}</Badge></a> : <span className="muted">General</span>}</li>
              <li><span>Paid by</span><span>{f.paid_by === "Bank" ? "Bank" : f.paid_by}</span></li>
              <li><span>Receipts</span><span>{f.receipts || "None"}</span></li>
            </ul>
            {f.notes && <p className="small muted" style={{ marginTop: 8 }}>{f.notes}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
