import { Badge, Empty, Panel } from "../../components/ui.jsx";
import { money, ukDate } from "../../format.js";
import { BOARD_COLUMNS, columnOf } from "./stockShared.js";

const cardStyle = {
  display: "flex", flexDirection: "column", gap: 6, width: "100%", textAlign: "left", font: "inherit",
  color: "var(--ink)", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12,
  padding: 12, cursor: "pointer",
};

// Invoice payment state for a sold car; completed cars are always Paid.
function SoldBadge({ car }) {
  if (car.stage === "completed") return <Badge tone="green">Paid</Badge>;
  const inv = car.invoice;
  if (!inv) return <Badge tone="orange">No invoice</Badge>;
  if (inv.status === "part_paid") return <Badge tone="orange">Part paid</Badge>;
  return <Badge tone="gray">Unpaid</Badge>;
}

function MiniCard({ car, onOpen }) {
  const sold = !!car.sale_date;
  const noPurchaseInvoice = car.scheme === "Margin" && car.documents === 0;
  return (
    <button type="button" style={cardStyle} onClick={() => onOpen(car.id)} aria-label={`Open ${car.reg || "car"}`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <strong style={{ fontSize: 15 }}>{car.reg || "No reg"}</strong>
        <span className="small muted mono">{car.stock_no}</span>
      </div>
      <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {car.make_model || "No make or model yet"}
      </div>
      <div className="small muted">
        {sold
          ? `Sold ${ukDate(car.sale_date)}`
          : `${car.days_in_stock ?? 0} days in stock · ${car.days_in_stage ?? 0} in stage`}
      </div>
      <div className="small">
        <strong>{money(car.bought_for ?? car.purchase_price) || "No price"}</strong>
        {car.asking_price ? <span className="muted"> · asking {money(car.asking_price)}</span> : null}
      </div>
      {sold && car.invoice && <div className="small muted">Invoice {car.invoice.invoice_no}</div>}
      <div className="row" style={{ gap: 6 }}>
        {sold ? <SoldBadge car={car} /> : !car.bill_paid && <Badge tone="orange">Bill unpaid</Badge>}
        {noPurchaseInvoice && <Badge tone="red">No purchase invoice</Badge>}
      </div>
    </button>
  );
}

// Kanban-style view. Columns scroll sideways inside this box only, never the page.
export default function StockBoard({ cars, onOpen }) {
  return (
    <div style={{ overflowX: "auto", paddingBottom: 6 }}>
      <div style={{ display: "grid", gap: 14, alignItems: "stretch",
        gridTemplateColumns: `repeat(${BOARD_COLUMNS.length}, minmax(220px, 1fr))` }}>
        {BOARD_COLUMNS.map((col) => {
          const items = cars.filter((c) => columnOf(c.stage) === col.key);
          return (
            <div key={col.key} style={{ display: "grid" }}>
              <Panel>
                <div className="panel-head">
                  <h3>{col.label}</h3>
                  <Badge tone="gray">{items.length}</Badge>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {items.length === 0 && <p className="small muted">Nothing here.</p>}
                  {items.map((c) => <MiniCard key={c.id} car={c} onOpen={onOpen} />)}
                </div>
              </Panel>
            </div>
          );
        })}
      </div>
      {cars.length === 0 && <Empty title="No cars match">Try a different search, or add a car.</Empty>}
    </div>
  );
}
