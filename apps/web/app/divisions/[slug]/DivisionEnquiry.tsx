"use client";

import { useState } from "react";
import Star from "@/components/Star";
import { createEnquiry } from "@/lib/api";
import type { StarVariant } from "@/components/Star";

export default function DivisionEnquiry({
  division,
  full,
  star,
}: {
  division: string;
  full: string;
  star: StarVariant;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createEnquiry({
        name: form.name,
        email: form.email,
        phone: form.phone,
        division,
        message: form.message || `Register interest — ${full}`,
      });
      setDone(true);
    } catch {
      setError("Something went wrong — please try again, or call us on 07511 849893.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="dv-form-done">
        <Star variant={star} size={50} />
        <h3>You’re on the list — thank you.</h3>
        <p>Thanks {form.name || "there"} — we’ve registered your interest in <strong>{full}</strong> and we’ll be in touch the moment it launches.</p>
      </div>
    );
  }

  return (
    <form className="dv-form" onSubmit={submit}>
      <label className="dv-field"><span>Full name</span><input required type="text" placeholder="Your name" value={form.name} onChange={set("name")} /></label>
      <label className="dv-field"><span>Email</span><input required type="email" placeholder="you@email.com" value={form.email} onChange={set("email")} /></label>
      <label className="dv-field"><span>Phone (optional)</span><input type="tel" placeholder="07…" value={form.phone} onChange={set("phone")} /></label>
      <label className="dv-field dv-field-wide"><span>Anything you’d like us to know? (optional)</span><input type="text" placeholder="What are you after?" value={form.message} onChange={set("message")} /></label>
      {error && <p className="dv-error">{error}</p>}
      <button className="btn btn-amber dv-submit" type="submit" disabled={busy}>{busy ? "Sending…" : "Register my interest"}</button>
    </form>
  );
}
