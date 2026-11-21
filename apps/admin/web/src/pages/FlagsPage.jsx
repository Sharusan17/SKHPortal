import { useState } from "react";
import { Flag, MessageSquare } from "lucide-react";
import { Alert, Badge, Card, PageHeader, Segmented, useLoad } from "../components/ui.jsx";
import { useApp } from "../context.js";
import { api } from "../api.js";
import { money, plural, ukDate } from "../format.js";
import { navigate } from "../router.js";

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "waiting", label: "Waiting on me" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

// Every flagged expense, with the latest word on each. Click one to open the expense and its comments.
export default function FlagsPage() {
  const { version, search } = useApp();
  const [view, setView] = useState("open");
  const load = useLoad(() => api.get("/admin/api/flags", { status: view }), [view, version]);
  const term = String(search ?? "").trim().toLowerCase();
  const list = (load.data || []).filter((f) => !term
    || `${f.description} ${f.car_reg ?? ""} ${f.last_comment?.body ?? ""}`.toLowerCase().includes(term));

  return (
    <div className="stack">
      <PageHeader title="Flags" subtitle="Expenses flagged to look at again, and the questions about them" />
      <Card title="Flagged expenses" icon={Flag}>
        <div className="stack">
          <Segmented ariaLabel="Which flags" options={VIEWS} value={view} onChange={setView} />
          {load.error && <Alert tone="error">{load.error.message}</Alert>}
          {load.data && list.length === 0 && (
            <p className="muted small">
              {view === "waiting" ? "Nothing is waiting on you." : view === "resolved" ? "No resolved flags yet."
                : "No flags. Use the flag button on an expense to add one."}
            </p>
          )}
          {list.map((f) => (
            <a key={f.id} href={`/admin/expense/${f.id}`} className="flag-row" onClick={(e) => {
              if (e.metaKey || e.ctrlKey) return;
              e.preventDefault();
              navigate(`/admin/expense/${f.id}`);
            }}>
              <span className="flag-row-main">
                <span className="flag-row-title">
                  <Flag size={14} className={f.state === "open" ? "flag-icon" : "muted"} />
                  {f.description}
                </span>
                <span className="list-sub">
                  {ukDate(f.date)} · {money(Math.abs(Number(f.amount)))}
                  {f.car_reg ? ` · ${f.car_reg}` : ""}
                  {f.flagged_by ? ` · flagged by ${f.flagged_by}` : ""}
                </span>
                {f.last_comment && (
                  <span className="flag-row-last">
                    <MessageSquare size={12} />
                    <strong>{f.last_comment.author_name}:</strong> {f.last_comment.body}
                  </span>
                )}
              </span>
              <span className="flag-row-side">
                {f.state === "resolved" ? <Badge tone="gray">Resolved</Badge>
                  : f.waiting_on ? <Badge tone="orange">{`Waiting on ${f.waiting_on.name}`}</Badge>
                    : <Badge tone="blue">Open</Badge>}
                <span className="small muted">{plural(f.comments, "comment")}</span>
              </span>
            </a>
          ))}
          {!load.data && load.loading && <p className="muted small">Loading…</p>}
        </div>
      </Card>
    </div>
  );
}
