"use client";

import { useState } from "react";
import Link from "next/link";
import Star from "@/components/Star";
import PlaceholderPhoto from "@/components/PlaceholderPhoto";
import { fmt, fmtMiles, type Car } from "@/lib/cars";

export default function CarView({ car }: { car: Car }) {
  const [stage, setStage] = useState<"view" | "reserving" | "reserved" | "enquired">("view");
  const [ref] = useState(() => "SKH-" + Math.floor(10000 + Math.random() * 89999));

  const specs: [string, string | number][] = [
    ["Year", car.year],
    ["Mileage", fmtMiles(car.mileage)],
    ["Fuel", car.fuel],
    ["Gearbox", car.gearbox],
    ["Body", car.body],
    ["Make", car.brand],
  ];

  return (
    <section className="section" style={{ paddingTop: "clamp(28px,5vw,56px)" }}>
      <div className="wrap">
        <Link className="cv-back" href="/prestige/stock">← Back to stock</Link>

        <div className="cv-panel panel">
          <div className="cd-media">
            <PlaceholderPhoto label={car.name} tall />
            <div className="cd-thumbs">
              <span className="cd-thumb">front ¾</span>
              <span className="cd-thumb">interior</span>
              <span className="cd-thumb">rear</span>
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
                  <button className="btn btn-amber" onClick={() => setStage("reserving")}>Reserve for £99</button>
                  <button className="btn btn-cream" onClick={() => setStage("enquired")}>Enquire</button>
                </div>
                <Link className="cd-link" href="/prestige#finance">See the illustrative finance example →</Link>
                <p className="cd-disclaimer">*Monthly figures are illustrative examples only and not a financial promotion. SKH is not yet FCA-authorised; no live finance is offered until authorisation is in place.</p>
              </>
            )}

            {stage === "reserving" && (
              <form className="cd-form" onSubmit={(e) => { e.preventDefault(); setStage("reserved"); }}>
                <span className="cd-eyebrow">Reserve · {car.name}</span>
                <h2 className="cd-title">Hold this car for £99</h2>
                <p className="cd-sub">Pop your details in and we’ll be in touch to confirm. The £99 is fully refundable and comes off the price if you go ahead.</p>
                <label className="cd-field"><span>Full name</span><input required type="text" placeholder="Your name" /></label>
                <label className="cd-field"><span>Phone</span><input required type="tel" placeholder="07…" /></label>
                <label className="cd-field"><span>Email</span><input required type="email" placeholder="you@email.com" /></label>
                <div className="cd-actions">
                  <button className="btn btn-amber" type="submit">Confirm reservation</button>
                  <button className="btn btn-cream" type="button" onClick={() => setStage("view")}>Back</button>
                </div>
                <p className="cd-disclaimer">No payment is taken now — this is a demonstration form. SKH is not yet FCA-authorised.</p>
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

            {stage === "enquired" && (
              <div className="cd-success">
                <Star variant="cream" size={54} />
                <h2 className="cd-title">Let’s talk it through.</h2>
                <p className="cd-sub">Call the showroom and quote <strong>{car.name}</strong> — we’ll answer anything on spec, history, finance or part-exchange.</p>
                <div className="cd-ref">Mon–Sat 8–18 · Sun 10–16</div>
                <div className="cd-actions">
                  <a className="btn btn-amber" href="tel:07511849893">07511 849893</a>
                  <a className="btn btn-cream" href="mailto:info@skhinc.co.uk">Email us</a>
                </div>
                <button className="cd-link" onClick={() => setStage("view")}>← Back to the car</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
