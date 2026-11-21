import { useState } from "react";
import { Check, ClipboardCheck, X } from "lucide-react";
import { Alert, Badge, Button, Card, PageHeader, Segmented, useAction, useLoad } from "../components/ui.jsx";
import { api } from "../api.js";
import { useApp } from "../context.js";
import { plural } from "../format.js";

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

// Admins: every user's held changes, to approve or reject. Users: their own requests.
export default function ApprovalsPage() {
  const { me, refresh, version } = useApp();
  const isAdmin = me.role === "admin";
  const [status, setStatus] = useState("pending");
  const load = useLoad(() => api.get("/admin/api/approvals", status ? { status } : undefined), [status, version]);
  const [run, busy] = useAction();
  const [open, setOpen] = useState(null);

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
          {list.map((r) => (
            <div key={r.id} className="approval">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="list-title">{r.summary}</div>
                  <div className="small muted">
                    {isAdmin ? `${r.user_name} · ` : ""}{when(r.created_at)}
                    {r.decided_at ? ` · ${WORD[r.status]} by ${r.decided_by} ${when(r.decided_at)}` : ""}
                  </div>
                  {r.status === "rejected" && r.note && <div className="small">Reason: {r.note}</div>}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                  <Badge tone={TONE[r.status]}>{WORD[r.status]}</Badge>
                  {isAdmin && r.status === "pending" && (
                    <>
                      <Button size="sm" icon={X} disabled={busy} onClick={() => reject(r)}>Reject</Button>
                      <Button size="sm" variant="primary" icon={Check} busy={busy} onClick={() => approve(r)}>Approve</Button>
                    </>
                  )}
                </div>
              </div>
              {r.details && (
                <button type="button" className="link-btn small" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  {open === r.id ? "Hide details" : "Show details"}
                </button>
              )}
              {open === r.id && <pre className="approval-details">{r.details}</pre>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
