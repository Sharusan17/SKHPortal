import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock } from "lucide-react";
import { api } from "../api.js";
import { useApp } from "../context.js";
import { IconButton, useLoad } from "./ui.jsx";
import { navigate } from "../router.js";

// The bell in the top bar: a count of what needs attention, opening the list from /api/reminders.
export default function Reminders() {
  const { version } = useApp();
  const { data } = useLoad(() => api.get("/admin/api/reminders"), [version]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const items = data || [];
  const overdue = items.filter((r) => r.level === "overdue").length;

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const go = (link) => { setOpen(false); navigate(link); };

  return (
    <div className="reminders" ref={box}>
      <IconButton icon={Bell} label={items.length ? `Reminders: ${items.length}` : "Reminders"}
        aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      {items.length > 0 && (
        <span className={`reminders-count ${overdue ? "is-overdue" : ""}`} aria-hidden="true">{items.length}</span>
      )}
      {open && (
        <div className="reminders-panel" role="dialog" aria-label="Reminders">
          <div className="reminders-head">
            <strong>Reminders</strong>
            <span className="small muted">{items.length ? `${overdue} overdue · ${items.length - overdue} coming up` : ""}</span>
          </div>
          {items.length === 0 ? (
            <div className="reminders-empty"><CheckCircle2 size={18} /> Nothing needs attention</div>
          ) : (
            <ul className="reminders-list">
              {items.map((r, i) => (
                <li key={`${r.kind}-${i}`}>
                  <button type="button" onClick={() => go(r.link)}>
                    {r.level === "overdue"
                      ? <AlertTriangle size={16} className="rem-icon is-overdue" />
                      : <Clock size={16} className="rem-icon" />}
                    <span>{r.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <style>{`
        .reminders { position: relative; }
        .reminders-count { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px;
          border-radius: 999px; background: var(--ink); color: #fff; font-size: 11px; font-weight: 600;
          display: grid; place-items: center; pointer-events: none; }
        .reminders-count.is-overdue { background: var(--red); }
        .reminders-panel { position: absolute; right: 0; top: calc(100% + 8px); width: min(380px, calc(100vw - 32px));
          max-height: 70vh; overflow-y: auto; background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 30; padding: 8px; }
        .reminders-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 8px 10px; }
        .reminders-list { list-style: none; margin: 0; padding: 0; }
        .reminders-list button { width: 100%; display: flex; gap: 10px; align-items: flex-start; text-align: left;
          background: none; border: 0; padding: 10px; border-radius: 10px; font: inherit; font-size: 13px;
          color: var(--ink); cursor: pointer; }
        .reminders-list button:hover { background: var(--panel); }
        .rem-icon { flex: none; margin-top: 1px; color: var(--orange); }
        .rem-icon.is-overdue { color: var(--red); }
        .reminders-empty { display: flex; gap: 8px; align-items: center; padding: 12px 10px; color: var(--green); font-size: 14px; }
      `}</style>
    </div>
  );
}
