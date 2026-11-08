import { useState } from "react";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";

// The admin sign-in. The server sets a secure session cookie; nothing is kept in the browser here.
export default function LoginPage({ onSignedIn, notSetUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Couldn't sign in.");
      setPassword("");
      onSignedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-head">
          <span className="login-mark"><ShieldCheck size={22} /></span>
          <div>
            <h1>SKH Admin</h1>
            <p className="muted small">Sign in to the accounts and VAT dashboard.</p>
          </div>
        </div>
        {notSetUp && (
          <div className="login-error">Sign-in isn't set up on the server yet. Add ADMIN_EMAIL, ADMIN_PASSWORD_HASH and SESSION_SECRET.</div>
        )}
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input className="input" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="login-error" role="alert">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />}Sign in
        </button>
      </form>
    </div>
  );
}
