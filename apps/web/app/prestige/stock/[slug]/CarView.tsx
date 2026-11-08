"use client";

import { useState } from "react";
import Link from "next/link";
import Star from "@/components/Star";
import CarCard from "@/components/CarCard";
import PlaceholderPhoto from "@/components/PlaceholderPhoto";
import { fmt, fmtMiles, type Vehicle } from "@/lib/cars";
import { createReservation, createEnquiry } from "@/lib/api";

type Stage = "view" | "reserving" | "reserved" | "enquiring" | "enquired";

const INCLUDED = [
  "120-point mechanical inspection, road-tested by SKH Mechanic",
  "Showroom-grade valet & detail by SKH Detailing",
  "14-day money-back guarantee",
  "HPI-clear history, finance-ready paperwork",
  "£99 fully-refundable online reservation",
  "Nationwide delivery available",
];

export default function CarView({ car, related }: { car: Vehicle; related: Vehicle[] }) {
  const [stage, setStage] = useState<Stage>("view");
  const [active, setActive] = useState(0);
  const [ref, setRef] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const quickSpecs: [string, string | number][] = [
    ["Year", car.year],
    ["Mileage", fmtMiles(car.mileage)],
    ["Fuel", car.fuel],
    ["Transmission", car.gearbox],
  ];

  const fullSpecs: [string, string | number][] = [
    ["Make", car.brand],
    ["Model", car.name],
    ["Year", car.year],
    ["Mileage", fmtMiles(car.mileage)],
    ["Fuel", car.fuel],
    ["Transmission", car.gearbox],
    ["Body style", car.body],
    ["Price", fmt(car.price)],
  ];

  async function submitReservation(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await createReservation({ name: form.name, email: form.email, phone: form.phone, vehicleId: car.id });
      setRef(res.ref);
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

  const hasImages = car.images.length > 0;

  return (
    <section className="section" style={{ paddingTop: "clamp(28px,5vw,48px)" }}>
      <div className="wrap">
        <Link className="cv-back" href="/prestige/stock">← Back to stock</Link>

        <div className="cdp-top">
          {/* gallery */}
          <div className="cdp-gallery">
            <div className="cdp-stage">
              {hasImages ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="cdp-main-img" src={car.images[active].url} alt={car.images[active].alt ?? car.name} />
              ) : (
                <PlaceholderPhoto label={car.name} />
              )}
              <span className="cdp-badge chip">SKH Prestige</span>
              {hasImages && <span className="cdp-counter">{active + 1} / {car.images.length}</span>}
            </div>
            <div className="cdp-thumbs">
              {hasImages
                ? car.images.map((img, i) => (
                    <button
                      key={img.id}
                      className={"cdp-thumb" + (i === active ? " on" : "")}
                      onClick={() => setActive(i)}
                      aria-label={`View image ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.alt ?? car.name} />
                    </button>
                  ))
                : ["front ¾", "interior", "rear", "detail"].map((t) => (
                    <span key={t} className="cdp-thumb">{t}</span>
                  ))}
            </div>
          </div>

          {/* sidebar */}
          <aside className="cdp-side panel sheen">
            <span className="cdp-eyebrow">SKH Prestige · 120-point inspected</span>
            <h1 className="cdp-title">{car.name}</h1>
            <div className="cdp-meta">
              <span className="chip">📍 Lancashire</span>
              <span className="chip">{car.year}</span>
              <span className="chip">{car.status === "AVAILABLE" ? "Available now" : car.status.toLowerCase()}</span>
            </div>

            <div className="cdp-price-row">
              <span className="cdp-price">{fmt(car.price)}</span>
              <span className="cdp-mo">or from <strong>{fmt(car.monthly)}</strong>/mo<i>*</i></span>
            </div>

            <div className="cdp-specs">
              {quickSpecs.map(([k, v], i) => (
                <div key={i} className="cdp-spec"><span>{k}</span><strong>{v}</strong></div>
              ))}
            </div>

            {stage === "view" && (
              <>
                <div className="cdp-cta">
                  <button className="btn btn-amber" onClick={() => { setError(""); setStage("reserving"); }}>Reserve for £99</button>
                  <button className="btn btn-cream" onClick={() => { setError(""); setStage("enquiring"); }}>Enquire now</button>
                  <a className="btn btn-ghost" href="tel:07511849893">Call 07511 849893</a>
                </div>
                <ul className="cdp-trust">
                  <li>Best-price guarantee on every car</li>
                  <li>120-point inspection passed</li>
                  <li>Road-tested by in-house specialists</li>
                  <li>Recent MOT &amp; service where required</li>
                </ul>
                <p className="cdp-note">*Monthly figures are illustrative examples only and not a financial promotion. SKH is not yet FCA-authorised; no live finance is offered until authorisation is in place.</p>
              </>
            )}

            {stage === "reserving" && (
              <form className="cd-form" style={{ marginTop: 20 }} onSubmit={submitReservation}>
                <span className="cd-eyebrow">Reserve · {car.name}</span>
                <p className="cd-sub" style={{ marginTop: 8 }}>Pop your details in and we’ll be in touch to confirm. The £99 is fully refundable and comes off the price.</p>
                <label className="cd-field"><span>Full name</span><input required type="text" placeholder="Your name" value={form.name} onChange={set("name")} /></label>
                <label className="cd-field"><span>Phone</span><input required type="tel" placeholder="07…" value={form.phone} onChange={set("phone")} /></label>
                <label className="cd-field"><span>Email</span><input required type="email" placeholder="you@email.com" value={form.email} onChange={set("email")} /></label>
                {error && <p className="cd-error">{error}</p>}
                <div className="cd-actions">
                  <button className="btn btn-amber" type="submit" disabled={busy}>{busy ? "Sending…" : "Confirm reservation"}</button>
                  <button className="btn btn-cream" type="button" onClick={() => setStage("view")} disabled={busy}>Back</button>
                </div>
              </form>
            )}

            {stage === "reserved" && (
              <div className="cd-success" style={{ marginTop: 20 }}>
                <Star variant="cream" size={48} />
                <h2 className="cd-title">Reserved — nicely done.</h2>
                <p className="cd-sub">We’ve provisionally held the <strong>{car.name}</strong> for you. A member of the team will call shortly to confirm.</p>
                <div className="cd-ref">Reference <strong>{ref}</strong></div>
                <div className="cd-actions">
                  <a className="btn btn-amber" href="tel:07511849893">Call us now</a>
                  <Link className="btn btn-cream" href="/prestige/stock">Keep browsing</Link>
                </div>
              </div>
            )}

            {stage === "enquiring" && (
              <form className="cd-form" style={{ marginTop: 20 }} onSubmit={submitEnquiry}>
                <span className="cd-eyebrow">Enquire · {car.name}</span>
                <p className="cd-sub" style={{ marginTop: 8 }}>Ask us anything — spec, history, finance or part-exchange.</p>
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
              <div className="cd-success" style={{ marginTop: 20 }}>
                <Star variant="cream" size={48} />
                <h2 className="cd-title">Enquiry sent — thank you.</h2>
                <p className="cd-sub">Thanks {form.name || "there"} — we’ve got your enquiry about the <strong>{car.name}</strong> and will be in touch shortly.</p>
                <div className="cd-actions">
                  <a className="btn btn-amber" href="tel:07511849893">Call us now</a>
                  <Link className="btn btn-cream" href="/prestige/stock">Keep browsing</Link>
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* lower: description + included */}
        <div className="cdp-lower">
          <div className="cdp-desc panel sheen">
            <h2 className="cdp-h2">About this {car.brand}</h2>
            {car.description && <p>{car.description}</p>}
            <p>
              Every car at SKH Prestige is hand-picked, fully inspected and detailed before it reaches the
              showroom. Reserve online for £99 (fully refundable), or get in touch to arrange a viewing or
              a no-obligation part-exchange valuation.
            </p>
            <h3 className="cdp-h2" style={{ fontSize: "1.15rem", margin: "22px 0 10px" }}>Specification</h3>
            <div className="cdp-spectable">
              {fullSpecs.map(([k, v], i) => (
                <div key={i} className="cdp-row"><span>{k}</span><strong>{v}</strong></div>
              ))}
            </div>
          </div>

          <aside className="cdp-included panel sheen">
            <h2 className="cdp-h2" style={{ fontSize: "1.25rem" }}>Included with every car</h2>
            <ul>
              {INCLUDED.map((it) => <li key={it}>{it}</li>)}
            </ul>
          </aside>
        </div>

        {/* similar */}
        {related.length > 0 && (
          <div className="cdp-similar">
            <div className="section-head">
              <div>
                <p className="eyebrow">Keep looking</p>
                <h2>More from the showroom</h2>
              </div>
              <Link className="seeall" href="/prestige/stock">View all stock →</Link>
            </div>
            <div className="car-grid">
              {related.map((v) => <CarCard key={v.id} car={v} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
