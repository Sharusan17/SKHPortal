"use client";

import { useState } from "react";
import Link from "next/link";
import Star from "@/components/Star";
import PlaceholderPhoto from "@/components/PlaceholderPhoto";
import { fmt, fmtMiles, type Vehicle } from "@/lib/cars";
import { createReservation, createEnquiry } from "@/lib/api";

type Stage = "view" | "reserving" | "reserved" | "enquiring" | "enquired";

export default function CarView({ car }: { car: Vehicle }) {
  const [stage, setStage] = useState<Stage>("view");
  const [ref, setRef] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const specs: [string, string | number][] = [
    ["Year", car.year],
    ["Mileage", fmtMiles(car.mileage)],
    ["Fuel", car.fuel],
    ["Gearbox", car.gearbox],
    ["Body", car.body],
    ["Make", car.brand],
  ];

  async function submitReservation(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { ref } = await createReservation({
        name: form.name,
        email: form.email,
        phone: form.phone,
        vehicleId: car.id,
      });
      setRef(ref);
      setStage("reserved");
    } catch {
      setError("Something went wrong — please try again, or call us on 07511 849893.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEnquiry(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createEnquiry({
        name: form.name,
        email: form.email,
        phone: form.phone,
        division: "prestige",
        message: form.message || `Enquiry about ${car.name}`,
        vehicleId: car.id,
      });
      setStage("enquired");
    } catch {
      setError("Something went wrong — please try again, or call us on 07511 849893.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" style={{ paddingTop: "clamp(28px,5vw,56px)" }}>
      <div className="wrap">
        <Link className="cv-back" href="/prestige/stock">← Back to stock</Link>

        <div className="cv-panel panel">
          <div className="cd-media">
            {car.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cd-img" src={car.images[0].url} alt={car.images[0].alt ?? car.name} />
            ) : (
              <PlaceholderPhoto label={car.name} tall />
            )}
            <div className="cd-thumbs">
              {car.images.length > 1
                ? car.images.slice(1, 4).map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={img.id} className="cd-thumb-img" src={img.url} alt={img.alt ?? car.name} />
                  ))
                : (
                  <>
                    <span className="cd-thumb">front ¾</span>
                    <span className="cd-thumb">interior</span>
                    <span className="cd-thumb">rear</span>
                  </>
                )}
            </div>
          </div>

          <div className="cd-info">
            {stage === "view" && (
              <>
                <span className="cd-eyebrow">SKH Prestige · 120-point inspected</span>
                <h1 className="cd-title">{car.name}</h1>
                <div className="cd-pricing">
                  <span className="cd-price">{fmt(car.price)}</span>
                  <span className="cd-mo">or from <strong>{fmt(car.monthly)}</strong>/mo<i>*</i></span>
                </div>
                <div className="cd-specs">
                  {specs.map(([k, v], i) => (
                    <div key={i} className="cd-spec"><span>{k}</span><strong>{v}</strong></div>
                  ))}
                </div>
                <div className="cd-note">Reserve online for just <strong>£99</strong> — fully refundable. We’ll hold the car for 48 hours while we sort the details.</div>
                <div className="cd-actions">
                  <button className="btn btn-amber" onClick={() => { setError(""); setStage("reserving"); }}>Reserve for £99</button>
                  <button className="btn btn-cream" onClick={() => { setError(""); setStage("enquiring"); }}>Enquire</button>
                </div>
                <Link className="cd-link" href="/prestige#finance">See the illustrative finance example →</Link>
                <p className="cd-disclaimer">*Monthly figures are illustrative examples only and not a financial promotion. SKH is not yet FCA-authorised; no live finance is offered until authorisation is in place.</p>
              </>
            )}

            {stage === "reserving" && (
              <form className="cd-form" onSubmit={submitReservation}>
                <span className="cd-eyebrow">Reserve · {car.name}</span>
                <h2 className="cd-title">Hold this car for £99</h2>
                <p className="cd-sub">Pop your details in and we’ll be in touch to confirm. The £99 is fully refundable and comes off the price if you go ahead.</p>
                <label className="cd-field"><span>Full name</span><input required type="text" placeholder="Your name" value={form.name} onChange={set("name")} /></label>
                <label className="cd-field"><span>Phone</span><input required type="tel" placeholder="07…" value={form.phone} onChange={set("phone")} /></label>
                <label className="cd-field"><span>Email</span><input required type="email" placeholder="you@email.com" value={form.email} onChange={set("email")} /></label>
                {error && <p className="cd-error">{error}</p>}
                <div className="cd-actions">
                  <button className="btn btn-amber" type="submit" disabled={busy}>{busy ? "Sending…" : "Confirm reservation"}</button>
                  <button className="btn btn-cream" type="button" onClick={() => setStage("view")} disabled={busy}>Back</button>
                </div>
                <p className="cd-disclaimer">No payment is taken now — we’ll call to arrange the refundable £99. SKH is not yet FCA-authorised.</p>
              </form>
            )}

            {stage === "reserved" && (
              <div className="cd-success">
                <Star variant="cream" size={54} />
                <h2 className="cd-title">Reserved — nicely done.</h2>
                <p className="cd-sub">We’ve provisionally held the <strong>{car.name}</strong> for you. A member of the SKH Prestige team will call shortly to confirm.</p>
                <div className="cd-ref">Reference <strong>{ref}</strong></div>
                <div className="cd-actions">
                  <a className="btn btn-amber" href="tel:07511849893">Call us now</a>
                  <Link className="btn btn-cream" href="/prestige/stock">Keep browsing</Link>
                </div>
              </div>
            )}

            {stage === "enquiring" && (
              <form className="cd-form" onSubmit={submitEnquiry}>
                <span className="cd-eyebrow">Enquire · {car.name}</span>
                <h2 className="cd-title">Ask us about this car</h2>
                <p className="cd-sub">Spec, history, finance or part-exchange — send your question and we’ll get straight back to you.</p>
                <label className="cd-field"><span>Full name</span><input required type="text" placeholder="Your name" value={form.name} onChange={set("name")} /></label>
                <label className="cd-field"><span>Email</span><input required type="email" placeholder="you@email.com" value={form.email} onChange={set("email")} /></label>
                <label className="cd-field"><span>Phone (optional)</span><input type="tel" placeholder="07…" value={form.phone} onChange={set("phone")} /></label>
                <label className="cd-field"><span>Message</span><input type="text" placeholder="Is this still available?" value={form.message} onChange={set("message")} /></label>
                {error && <p className="cd-error">{error}</p>}
                <div className="cd-actions">
                  <button className="btn btn-amber" type="submit" disabled={busy}>{busy ? "Sending…" : "Send enquiry"}</button>
                  <button className="btn btn-cream" type="button" onClick={() => setStage("view")} disabled={busy}>Back</button>
                </div>
              </form>
            )}

            {stage === "enquired" && (
              <div className="cd-success">
                <Star variant="cream" size={54} />
                <h2 className="cd-title">Enquiry sent — thank you.</h2>
                <p className="cd-sub">Thanks {form.name || "there"} — we’ve got your enquiry about the <strong>{car.name}</strong> and a member of the SKH Prestige team will be in touch shortly.</p>
                <div className="cd-ref">Mon–Sat 8–18 · Sun 10–16</div>
                <div className="cd-actions">
                  <a className="btn btn-amber" href="tel:07511849893">Call us now</a>
                  <Link className="btn btn-cream" href="/prestige/stock">Keep browsing</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
