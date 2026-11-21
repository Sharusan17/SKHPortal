import { useState } from "react";
import { KeyRound, LogOut, Pencil, Plus, Save, ShieldCheck, UserRound, Users, X } from "lucide-react";
import {
  Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Toggle, useAction, useLoad,
} from "../components/ui.jsx";
import { api, signOut } from "../api.js";
import { useApp } from "../context.js";
import PasswordDialog from "../components/PasswordDialog.jsx";

const BLANK = { first_name: "", last_name: "", email: "", role: "user", password: "" };

// /admin/users, from the people icon at the top. Everyone sees their own account (change password,
// sign out); admins also manage who can sign in, their role, and what users may do.
export default function UsersPage() {
  const { me, isAdmin } = useApp();
  return (
    <div className="stack">
      <PageHeader title={isAdmin ? "Users" : "Your account"}
        subtitle={isAdmin ? "Your account, who can sign in, and what they can do" : "Your sign-in"} />
      <AccountCard me={me} />
      {isAdmin && <PeopleAdmin />}
    </div>
  );
}

function AccountCard({ me }) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  return (
    <Card title="Your account" icon={UserRound}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div className="list-text">
          <span className="list-title">{me.name}</span>
          <span className="list-sub">{me.email}{me.owner ? " · owner" : ""}</span>
        </div>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <Badge tone={me.role === "admin" ? "blue" : "gray"}>{me.role === "admin" ? "Admin" : "User"}</Badge>
          <Button icon={KeyRound} onClick={() => setPasswordOpen(true)}>Change password</Button>
          <Button icon={LogOut} onClick={signOut}>Sign out</Button>
        </div>
      </div>
      {passwordOpen && <PasswordDialog me={me} onClose={() => setPasswordOpen(false)} />}
    </Card>
  );
}

// Admins only: the people who can sign in, and the toggles for what users may do.
function PeopleAdmin() {
  const { me } = useApp();
  const load = useLoad(() => api.get("/admin/api/users"), []);
  const [editing, setEditing] = useState(null); // null, "new", or a user id
  const [run, busy] = useAction();

  if (load.error) return <Alert tone="error">{load.error.message}</Alert>;
  if (!load.data) return <p className="muted">Loading…</p>;
  const { users, roles, permissions, permission_labels: labels, owner_email: ownerEmail, min_password: minPw,
    owner } = load.data;
  const roleOptions = Object.entries(roles).map(([value, label]) => ({ value, label }));

  const toggle = async (key, on) => {
    if (await run(() => api.put("/admin/api/settings/permissions", { [key]: on }))) load.reload();
  };
  const setActive = async (u, active) => {
    if (!active && !window.confirm(`Switch off ${u.name}? They won't be able to sign in until switched back on.`)) return;
    if (await run(() => api.patch(`/admin/api/users/${u.id}`, { active }))) load.reload();
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>Add user</Button>
      </div>

      {editing === "new" && (
        <UserForm roles={roleOptions} minPw={minPw} onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); load.reload(); }} />
      )}

      <div className="grid-expenses">
        <Card title="People" icon={Users}>
          <div className="stack-sm">
            {editing === "owner" ? (
              <OwnerForm owner={owner} onCancel={() => setEditing(null)}
                onSaved={() => { setEditing(null); load.reload(); window.dispatchEvent(new Event("approvals-changed")); }} />
            ) : (
              <div className="list-row" style={{ alignItems: "center" }}>
                <span className="list-icon"><ShieldCheck size={16} /></span>
                <span className="list-text">
                  <span className="list-title">{owner?.name || "Owner"}{me.owner ? " (you)" : ""}</span>
                  <span className="list-sub">{ownerEmail} · owner · signs in with the password set on Railway</span>
                </span>
                <Badge tone="blue">Admin</Badge>
                <Button size="sm" icon={Pencil} onClick={() => setEditing("owner")}>Edit</Button>
              </div>
            )}
            {users.length === 0 && <p className="small muted">No other users yet. Add one to give someone their own sign-in.</p>}
            {users.map((u) => (editing === u.id ? (
              <UserForm key={u.id} user={u} roles={roleOptions} minPw={minPw} self={u.email === me.email}
                onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load.reload(); }} />
            ) : (
              <div key={u.id} className="list-row" style={{ alignItems: "center", opacity: u.active ? 1 : 0.55 }}>
                <span className="list-icon"><UserRound size={16} /></span>
                <span className="list-text">
                  <span className="list-title">{u.name}{u.email === me.email ? " (you)" : ""}</span>
                  <span className="list-sub">{u.email}{u.active ? "" : " · switched off"}</span>
                </span>
                <Badge tone={u.role === "admin" ? "blue" : "gray"}>{roles[u.role]}</Badge>
                <Button size="sm" icon={Pencil} onClick={() => setEditing(u.id)}>Edit</Button>
                {u.email !== me.email && (
                  <Toggle checked={u.active} onChange={(on) => setActive(u, on)} label={u.active ? "On" : "Off"} />
                )}
              </div>
            )))}
          </div>
        </Card>

        <Card title="What users can do" icon={KeyRound}>
          <div className="stack-sm">
            <p className="small muted">
              Users see Home, Stock Book, Invoices and Expenses only, never the bank, the VAT return or the
              business settings. Everything they save waits for an admin to approve it on the Approvals page.
            </p>
            {Object.entries(labels).map(([key, label]) => (
              <Toggle key={key} checked={!!permissions[key]} disabled={busy} label={label}
                onChange={(on) => toggle(key, on)} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function UserForm({ user, roles, minPw, self = false, onCancel, onSaved }) {
  const [run, busy] = useAction();
  const [f, setF] = useState(user ? { ...BLANK, ...user, password: "" } : BLANK);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));

  const save = async () => {
    const body = user
      ? { first_name: f.first_name, last_name: f.last_name, role: f.role, ...(f.password ? { password: f.password } : {}) }
      : f;
    const res = await run(() => (user ? api.patch(`/admin/api/users/${user.id}`, body) : api.post("/admin/api/users", body)));
    if (res) onSaved();
  };

  return (
    <Card title={user ? `Edit ${user.name}` : "Add a user"}>
      <div className="stack">
        <div className="grid-2">
          <Field label="First name"><Input value={f.first_name} onChange={set("first_name")} autoComplete="off" /></Field>
          <Field label="Last name"><Input value={f.last_name} onChange={set("last_name")} autoComplete="off" /></Field>
          <Field label="Email they sign in with" hint={user ? "The email can't be changed; add a new user instead." : undefined}>
            <Input type="email" value={f.email} disabled={!!user} onChange={set("email")} autoComplete="off" />
          </Field>
          <Field label="Role" hint={self ? "You can't take away your own admin access." : undefined}>
            <Select options={roles} value={f.role} disabled={self} onChange={set("role")} />
          </Field>
          <Field label={user ? "New password (leave blank to keep theirs)" : "First password"}
            hint={`At least ${minPw} characters. Tell them separately; they can change it after signing in.`}>
            <Input type="password" value={f.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
        </div>
        <div className="row-end">
          <Button icon={X} onClick={onCancel}>Cancel</Button>
          <Button variant="primary" icon={Save} busy={busy} onClick={save}>{user ? "Save" : "Add user"}</Button>
        </div>
      </div>
    </Card>
  );
}

// The owner's name only: their email and password are set on Railway (ADMIN_EMAIL and
// ADMIN_PASSWORD_HASH), so they can't be changed here.
function OwnerForm({ owner, onCancel, onSaved }) {
  const [f, setF] = useState({ first_name: owner?.name === "Owner" ? "" : owner?.first_name || "",
    last_name: owner?.last_name || "" });
  const [run, busy] = useAction();
  const save = async () => {
    if (await run(() => api.put("/admin/api/owner", f))) onSaved();
  };
  return (
    <div className="user-form">
      <div className="grid-2">
        <Field label="First name"><Input value={f.first_name} autoFocus
          onChange={(e) => setF((s) => ({ ...s, first_name: e.target.value }))} /></Field>
        <Field label="Last name"><Input value={f.last_name}
          onChange={(e) => setF((s) => ({ ...s, last_name: e.target.value }))} /></Field>
      </div>
      <p className="small muted">
        Shown on this page, in the Home greeting and on comments. It's the same as Owner name in Business
        details. The owner's email and password are set on Railway.
      </p>
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <Button icon={X} onClick={onCancel}>Cancel</Button>
        <Button variant="primary" icon={Save} busy={busy} disabled={!f.first_name.trim()} onClick={save}>Save</Button>
      </div>
    </div>
  );
}
