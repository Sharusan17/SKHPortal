"use client";

import { useMemo, useState } from "react";
import CarCard from "@/components/CarCard";
import Star from "@/components/Star";
import {
  BRANDS,
  BODY_TYPES,
  FUELS,
  GEARBOXES,
  PRICE_BANDS,
  YEAR_BANDS,
  MILEAGE_BANDS,
  SORT_OPTIONS,
  EMPTY_FILTERS,
  filterVehicles,
  sortVehicles,
  countActiveFilters,
  fmt,
  type Filters,
  type SortKey,
  type Vehicle,
  type PriceBand,
} from "@/lib/cars";

export default function Inventory({
  vehicles,
  initial,
}: {
  vehicles: Vehicle[];
  initial: Filters;
}) {
  const [filters, setFilters] = useState<Filters>(initial);
  const [sort, setSort] = useState<SortKey>("newest");
  const [mobileOpen, setMobileOpen] = useState(false);

  const results = useMemo(
    () => sortVehicles(filterVehicles(vehicles, filters), sort),
    [vehicles, filters, sort]
  );
  const activeCount = countActiveFilters(filters);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  const Select = ({
    label,
    value,
    onChange,
    children,
  }: {
    label: string;
    value: string | number;
    onChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <label className="fg">
      <span className="fg-label">{label}</span>
      <select className="fg-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );

  const bandOptions = (bands: PriceBand[]) =>
    bands.map((b) => (
      <option key={b.value} value={b.value}>
        {b.label}
      </option>
    ));

  return (
    <>
      <section className="inv-hero">
        <div className="inv-hero-bg" />
        <div className="wrap" style={{ position: "relative" }}>
          <p className="eyebrow" style={{ color: "var(--cream)" }}>The showroom</p>
          <h1 className="inv-title">Find your car</h1>
          <p className="inv-sub">
            Every car hand-picked, 120-point inspected and detailed before collection. Filter the full
            range, or reserve any car online for £99 — fully refundable.
          </p>
        </div>
      </section>

      <section className="section" id="stock" style={{ paddingTop: "clamp(8px,2vw,20px)" }}>
        <div className="wrap">
          <div className="inv-layout">
            {/* ---- filter sidebar ---- */}
            <aside className={"inv-sidebar" + (mobileOpen ? " open" : "")}>
              <div className="inv-sidebar-inner panel">
                <div className="inv-sidebar-head">
                  <h2>Filters</h2>
                  {activeCount > 0 && (
                    <button className="fclear" onClick={() => setFilters(EMPTY_FILTERS)}>Clear all</button>
                  )}
                </div>

                <Select label="Make" value={filters.make} onChange={(v) => set({ make: v })}>
                  <option value="">Any make</option>
                  {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>

                <label className="fg">
                  <span className="fg-label">Model / keyword</span>
                  <input
                    className="fg-select"
                    type="text"
                    placeholder="e.g. Golf, M Sport"
                    value={filters.model}
                    onChange={(e) => set({ model: e.target.value })}
                  />
                </label>

                <Select label="Body type" value={filters.body} onChange={(v) => set({ body: v })}>
                  <option value="">Any body</option>
                  {BODY_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>

                <Select label="Fuel" value={filters.fuel} onChange={(v) => set({ fuel: v })}>
                  <option value="">Any fuel</option>
                  {FUELS.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>

                <Select label="Gearbox" value={filters.gearbox} onChange={(v) => set({ gearbox: v })}>
                  <option value="">Any gearbox</option>
                  {GEARBOXES.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>

                <Select label="Max price" value={filters.priceMax} onChange={(v) => set({ priceMax: Number(v) })}>
                  {bandOptions(PRICE_BANDS)}
                </Select>

                <Select label="Year" value={filters.yearMin} onChange={(v) => set({ yearMin: Number(v) })}>
                  {bandOptions(YEAR_BANDS)}
                </Select>

                <Select label="Max mileage" value={filters.mileageMax} onChange={(v) => set({ mileageMax: Number(v) })}>
                  {bandOptions(MILEAGE_BANDS)}
                </Select>

                <button className="btn btn-amber inv-apply" onClick={() => setMobileOpen(false)}>
                  Show {results.length} {results.length === 1 ? "car" : "cars"}
                </button>
              </div>
            </aside>

            {/* ---- results ---- */}
            <div className="inv-results">
              <div className="inv-bar">
                <button className="inv-filters-toggle" onClick={() => setMobileOpen(true)}>
                  ☰ Filters{activeCount ? ` (${activeCount})` : ""}
                </button>
                <span className="result-count">
                  {results.length} {results.length === 1 ? "car" : "cars"} available
                </span>
                <label className="inv-sort">
                  <span>Sort</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                    {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </label>
              </div>

              {activeCount > 0 && (
                <div className="filter-row">
                  {filters.make && <span className="fpill">{filters.make}<button onClick={() => set({ make: "" })}>×</button></span>}
                  {filters.body && <span className="fpill">{filters.body}<button onClick={() => set({ body: "" })}>×</button></span>}
                  {filters.fuel && <span className="fpill">{filters.fuel}<button onClick={() => set({ fuel: "" })}>×</button></span>}
                  {filters.gearbox && <span className="fpill">{filters.gearbox}<button onClick={() => set({ gearbox: "" })}>×</button></span>}
                  {filters.model && <span className="fpill">“{filters.model}”<button onClick={() => set({ model: "" })}>×</button></span>}
                  {filters.priceMax < 999999 && <span className="fpill">{"≤ " + fmt(filters.priceMax)}<button onClick={() => set({ priceMax: 999999 })}>×</button></span>}
                  {filters.yearMin > 0 && <span className="fpill">{filters.yearMin}+<button onClick={() => set({ yearMin: 0 })}>×</button></span>}
                  {filters.mileageMax > 0 && <span className="fpill">{"≤ " + filters.mileageMax.toLocaleString("en-GB") + " mi"}<button onClick={() => set({ mileageMax: 0 })}>×</button></span>}
                </div>
              )}

              {results.length > 0 ? (
                <div className="car-grid inv-grid">
                  {results.map((c) => <CarCard key={c.id} car={c} />)}
                </div>
              ) : (
                <div className="panel sheen empty">
                  <Star variant="cream" size={48} />
                  <h3>No cars match that search yet</h3>
                  <p>Our stock changes daily — adjust your filters, or tell us what you’re after and we’ll source it.</p>
                  <button className="btn btn-cream" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>
                </div>
              )}

              <p className="car-disclaimer">*Monthly figures shown on cards are illustrative examples only and not a financial promotion.</p>
            </div>
          </div>
        </div>
      </section>

      {mobileOpen && <div className="inv-overlay" onClick={() => setMobileOpen(false)} />}
    </>
  );
}
