import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { Alert, Button, Field, Input, useAction } from "./ui.jsx";
import { api } from "../api.js";

// Change your own password. The owner's is set on Railway, so they're told how instead.
export default function PasswordDialog({ me, onClose }) {
  const [run, busy] = useAction();
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (f.next !== f.again) { setError("The two new passwords don't match."); return; }
    setError(null);
    const res = await run(() => api.post("/admin/api/me/password", { current: f.current, new: f.next }));
    if (res) onClose();
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal" role="dialog" aria-modal="true" aria-label="Change your password"
        onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 className="row" style={{ gap: 8 }}><KeyRound size={18} /> Change your password</h3>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        {me.owner ? (
          <Alert tone="info">
            The owner's password is set on Railway. Run <code>python api/auth.py</code> for a new
            ADMIN_PASSWORD_HASH and put it in the admin service's Variables.
          </Alert>
        ) : (
          <>
            <Field label="Current password">
              <Input type="password" autoComplete="current-password" required value={f.current} onChange={set("current")} />
            </Field>
            <Field label="New password" hint="At least 8 characters.">
              <Input type="password" autoComplete="new-password" required value={f.next} onChange={set("next")} />
            </Field>
            <Field label="New password again">
              <Input type="password" autoComplete="new-password" required value={f.again} onChange={set("again")} />
            </Field>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="row-end">
              <Button type="button" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary" busy={busy}>Change password</Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
