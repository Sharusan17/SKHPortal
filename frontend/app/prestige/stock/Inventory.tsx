"use client";

import { useMemo, useState } from "react";
import CarCard from "@/components/CarCard";
import Star from "@/components/Star";
import {
  BRANDS,
  BODY_TYPES,
  PRICE_BANDS,
  EMPTY_FILTERS,
  filterVehicles,
  fmt,
  type Filters,
  type Vehicle,
} from "@/lib/cars";

export default function Inventory({
  vehicles,
  initial,
}: {
  vehicles: Vehicle[];
  initial: Filters;
}) {
  const [filters, setFilters] = useState<Filters>(initial);

  const results = useMemo(() => filterVehicles(vehicles, filters), [vehicles, filters]);
  const active =
    filters.make || filters.body || filters.model || filters.priceMax < 999999;

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <>
      <section className="inv-hero">
        <div className="inv-hero-bg" />
        <div className="wrap" style={{ position: "relative" }}>
          <p className="eyebrow" style={{ color: "var(--cream)" }}>The showroom</p>
          <h1 className="inv-title">Browse our stock</h1>
          <p className="inv-sub">
            Every car hand-picked, 120-point inspected and detailed before collection. Filter the full
            range below, or reserve any car online for £99 — fully refundable.
          </p>

          <div className="inv-filters panel sheen">
            <div className="inv-filter-row">
              <label className="search-field">
                <span>Make</span>
                <select value={filters.make} onChange={(e) => set({ make: e.target.value })}>
                  <option value="">Any make</option>
                  {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="search-field">
                <span>Model / keyword</span>
                <input
                  type="text"
                  placeholder="e.g. Golf, M Sport"
                  value={filters.model}
                  onChange={(e) => set({ model: e.target.value })}
                />
              </label>
              <label className="search-field">
                <span>Body type</span>
                <select value={filters.body} onChange={(e) => set({ body: e.target.value })}>
                  <option value="">Any body</option>
                  {BODY_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="search-field">
                <span>Max price</span>
                <select
                  value={filters.priceMax}
                  onChange={(e) => set({ priceMax: Number(e.target.value) })}
                >
                  {PRICE_BANDS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="stock" style={{ paddingTop: "clamp(20px,3vw,32px)" }}>
        <div className="wrap">
          <div className="inv-toolbar">
            <span className="result-count">
              {results.length} {results.length === 1 ? "car" : "cars"} available
            </span>
            {active && (
              <div className="filter-row" style={{ marginBottom: 0 }}>
                {filters.make && <span className="fpill">{filters.make}<button onClick={() => set({ make: "" })}>×</button></span>}
                {filters.body && <span className="fpill">{filters.body}<button onClick={() => set({ body: "" })}>×</button></span>}
                {filters.model && <span className="fpill">“{filters.model}”<button onClick={() => set({ model: "" })}>×</button></span>}
                {filters.priceMax < 999999 && <span className="fpill">{"≤ " + fmt(filters.priceMax)}<button onClick={() => set({ priceMax: 999999 })}>×</button></span>}
                <button className="fclear" onClick={() => setFilters(EMPTY_FILTERS)}>Clear all</button>
              </div>
            )}
          </div>

          {results.length > 0 ? (
            <div className="car-grid">
              {results.map((c) => <CarCard key={c.id} car={c} />)}
            </div>
          ) : (
            <div className="panel sheen empty">
              <Star variant="cream" size={48} />
              <h3>No cars match that search yet</h3>
              <p>Our stock changes daily — tell us what you’re after and we’ll source it, or browse the full range.</p>
              <button className="btn btn-cream" onClick={() => setFilters(EMPTY_FILTERS)}>Show all cars</button>
            </div>
          )}

          <p className="car-disclaimer">*Monthly figures shown on cards are illustrative examples only and not a financial promotion. See the finance example on the Prestige Motors page.</p>
        </div>
      </section>
    </>
  );
}
