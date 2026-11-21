import { ArrowLeft, CheckCircle2, ExternalLink, Flag, RotateCcw } from "lucide-react";
import { Alert, Badge, Button, Card, PageHeader, useAction, useLoad } from "../components/ui.jsx";
import { useApp } from "../context.js";
import CommentThread from "../components/CommentThread.jsx";
import { api } from "../api.js";
import { money, ukDate } from "../format.js";
import { navigate } from "../router.js";

// One flag (/admin/flag/<expense id>): the expense at a glance, and its comment thread.
export default function FlagPage({ flagId }) {
  const { version, refresh } = useApp();
  const load = useLoad(() => api.get(`/admin/api/flags/${flagId}`), [flagId, version]);
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

  const setState = async (state) => {
    if (await run(() => api.post(`/admin/api/flags/${f.id}/state`, { state }))) refresh();
  };

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
        <CommentThread txnId={f.id} />

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
