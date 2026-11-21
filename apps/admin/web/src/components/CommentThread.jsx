import { useState } from "react";
import { Send } from "lucide-react";
import { api } from "../api.js";
import { useApp } from "../context.js";
import { Card, Field, Select, Textarea, useAction, useLoad } from "./ui.jsx";

const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? ""
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

// The questions and answers on one expense (a bank line). Used on the expense page and the flag
// page. Posting a comment on an expense that isn't flagged flags it, so it shows on the Flags page.
export default function CommentThread({ txnId, title = "Comments" }) {
  const { version, refresh } = useApp();
  const load = useLoad(() => api.get(`/admin/api/flags/${txnId}`), [txnId, version]);
  const people = useLoad(() => api.get("/admin/api/people"), []);
  const [body, setBody] = useState("");
  const [ask, setAsk] = useState("");
  const [run, busy] = useAction();
  const thread = load.data?.thread || [];

  const post = async () => {
    const res = await run(() => api.post(`/admin/api/flags/${txnId}/comments`, { body, ask_email: ask }), { quiet: true });
    if (res) { setBody(""); setAsk(""); refresh(); }
  };
  const askOptions = [{ value: "", label: "Nobody in particular" },
    ...(people.data || []).map((p) => ({ value: p.email, label: p.name }))];

  return (
    <Card title={title}>
      <div className="stack">
        {load.error && <p className="small muted">{load.error.message}</p>}
        {load.data && thread.length === 0 && (
          <p className="muted small">No comments yet. Ask a question below; it flags the expense so it shows on the Flags page.</p>
        )}
        {thread.length > 0 && (
          <ol className="thread">
            {thread.map((c) => (
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
        )}
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
            <button type="button" className="btn btn-primary" disabled={busy || !body.trim()} onClick={post}>
              <Send size={16} /><span>{busy ? "Posting…" : "Post"}</span>
            </button>
          </div>
          <p className="small muted">The person you ask sees it under "Waiting on me" until they reply. Ctrl+Enter posts.</p>
        </div>
      </div>
    </Card>
  );
}
