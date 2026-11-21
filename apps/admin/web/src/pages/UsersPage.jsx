import { useState } from "react";
import { KeyRound, Pencil, Plus, Save, ShieldCheck, UserRound, Users, X } from "lucide-react";
import {
  Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Toggle, useAction, useLoad,
} from "../components/ui.jsx";
import { api } from "../api.js";
import { useApp } from "../context.js";

const BLANK = { first_name: "", last_name: "", email: "", role: "user", password: "" };

// Admins only (/admin/users): who can sign in, their role, and what users may do.
export default function UsersPage() {
  const { me } = useApp();
  const load = useLoad(() => api.get("/admin/api/users"), []);
  const [editing, setEditing] = useState(null); // null, "new", or a user id
  const [run, busy] = useAction();

  if (load.error) return <Alert tone="error">{load.error.message}</Alert>;
  if (!load.data) return <p className="muted">Loading…</p>;
  const { users, roles, permissions, permission_labels: labels, owner_email: ownerEmail, min_password: minPw } = load.data;
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
      <PageHeader title="Users" subtitle="Who can sign in, and what they can do"
        actions={<Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>Add user</Button>} />

      {editing === "new" && (
        <UserForm roles={roleOptions} minPw={minPw} onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); load.reload(); }} />
      )}

      <div className="grid-expenses">
        <Card title="People" icon={Users}>
          <div className="stack-sm">
            <div className="list-row" style={{ alignItems: "center" }}>
              <span className="list-icon"><ShieldCheck size={16} /></span>
              <span className="list-text">
                <span className="list-title">Owner</span>
                <span className="list-sub">{ownerEmail} · signs in with the password set on Railway</span>
              </span>
              <Badge tone="blue">Admin</Badge>
            </div>
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
