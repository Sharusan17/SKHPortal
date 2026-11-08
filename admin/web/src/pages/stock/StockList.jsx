import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge, Segmented } from "../../components/ui.jsx";
import { money, ukDate } from "../../format.js";

const FILTERS = ["All", "In stock", "Sold"];
const STAGE_TONE = { completed: "green", sold: "blue", in_prep: "orange", for_sale: "teal" };

// Read-only list of every car; a row opens the car's own page, where its details are edited.
export default function StockList({ cars, onOpen }) {
  const [filter, setFilter] = useState("All");
  const shown = cars.filter((c) => (filter === "In stock" ? !c.sale_date : filter === "Sold" ? !!c.sale_date : true));
  return (
    <div className="stack-sm">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Segmented ariaLabel="Show" options={FILTERS} value={filter} onChange={setFilter} />
        <span className="small muted">{shown.length} of {cars.length} cars</span>
      </div>
      <div className="table-wrap">
        <table className="table stock-list">
          <thead>
            <tr>
              <th>Car</th>
              <th>Stage</th>
              <th>Bought</th>
              <th className="r">Cost</th>
              <th className="r">Price</th>
              <th className="r">Profit</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={7} className="muted">No cars here.</td></tr>}
            {shown.map((c) => (
              <tr key={c.id} onClick={() => onOpen(c.id)} tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") onOpen(c.id); }} aria-label={`Open ${c.reg}`}>
                <td>
                  <div className="sl-car">
                    <span className="sl-stock">{c.stock_no}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="sl-reg">{c.reg || "No reg"}</div>
                      <div className="small muted sl-model">{c.make_model || "No make or model yet"}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <Badge tone={STAGE_TONE[c.stage] || "gray"}>{c.stage_label}</Badge>
                    {!c.sale_date && !c.bill_paid && <Badge tone="orange">Bill unpaid</Badge>}
                  </div>
                </td>
                <td>
                  <div>{ukDate(c.purchase_date)}</div>
                  <div className="small muted">
                    {c.sale_date ? `Sold ${ukDate(c.sale_date)}` : `${c.days_in_stock ?? 0} days in stock`}
                  </div>
                </td>
                <td className="r">{money(c.bought_for ?? c.purchase_price)}</td>
                <td className="r">
                  {c.sale_price != null ? money(c.sale_price)
                    : c.asking_price != null ? <span className="muted">asking {money(c.asking_price)}</span> : ""}
                </td>
                <td className="r" style={{ color: c.profit < 0 ? "var(--red)" : c.profit > 0 ? "var(--green)" : undefined }}>
                  {c.profit != null ? money(c.profit) : ""}
                </td>
                <td className="r"><ChevronRight size={16} className="muted" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        .stock-list tbody tr { cursor: pointer; }
        .stock-list tbody tr:hover td { background: var(--panel); }
        .stock-list tbody tr:focus-visible td { background: var(--panel); outline: none; }
        .sl-car { display: flex; gap: 12px; align-items: center; min-width: 0; }
        .sl-stock { font-size: 12px; color: var(--muted); background: var(--panel-2); border-radius: 8px; padding: 4px 8px; }
        .sl-reg { font-weight: 600; letter-spacing: .02em; }
        .sl-model { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; }
      `}</style>
    </div>
  );
}
