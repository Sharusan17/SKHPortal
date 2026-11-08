import { useState } from "react";
import { Calculator, Car, CheckCircle2, Loader2, Plus } from "lucide-react";
import { api } from "../api.js";
import {
  Alert, Card, Collapsible, Empty, PageHeader, Segmented, StatCard, Button, useLoad,
} from "../components/ui.jsx";
import { useApp } from "../context.js";
import { money, plural, ukDate } from "../format.js";
import AddCar from "./stock/AddCar.jsx";
import StockBoard from "./stock/StockBoard.jsx";
import StockList from "./stock/StockList.jsx";
import { matchesSearch } from "./stock/stockShared.js";
import { navigate } from "../router.js";

const VIEWS = [{ value: "board", label: "Board" }, { value: "list", label: "List" }];
const openCar = (id) => { navigate(`/admin/car/${id}`); };

const Spinner = () => <Loader2 size={18} className="spin" />;

export default function StockPage() {
  const { quarter, period, version, search = "" } = useApp();

  // /api/stock feeds the board, the list and the metrics; each car opens on its own page.
  const stockLoad = useLoad(() => api.get("/admin/api/stock"), [version]);
  const rec = useLoad(() => api.get("/admin/api/reconciliation", { q: quarter.id }), [quarter.id, version]);

  const [view, setView] = useState("board");
  const [adding, setAdding] = useState(false);

  if (stockLoad.error) return <Alert tone="error">{stockLoad.error.message}</Alert>;
  if (!stockLoad.data) return <div className="muted"><Spinner /></div>;

  const all = stockLoad.data;
  const unsold = all.filter((c) => !c.sale_date);
  const atCost = unsold.reduce((s, c) => s + (Number(c.bought_for ?? c.purchase_price) || 0), 0);
  const inPeriod = (d) => !!d && d.slice(0, 10) >= period.start && d.slice(0, 10) <= period.end;
  const soldQ = all.filter((c) => inPeriod(c.sale_date));
  const profit = soldQ.reduce((s, c) => (c.profit == null ? s : s + Number(c.profit)), 0);

  const q = search.trim().toLowerCase();
  const shown = all.filter((c) => matchesSearch(c, q));

  // Bank matching
  const recData = rec.data;
  const toCheck = recData
    ? recData.unlinked_txns.length + recData.sold_unpaid.length + recData.bought_unpaid.length
    : 0;

  return (
    <div className="stack">
      <PageHeader title="Stock Book"
        actions={
          <>
            <Segmented ariaLabel="View" options={VIEWS} value={view} onChange={setView} />
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Add a car</Button>
          </>
        } />

      <div className="grid-4">
        <StatCard tone="sage" icon={Car} label="In stock" value={unsold.length} sub="Unsold cars" />
        <StatCard tone="sand" icon={Calculator} label="Stock at cost" value={money(atCost)} sub="Unsold, bought price" />
        <StatCard tone="blush" icon={CheckCircle2} label={`Sold · ${period.label}`}
          value={soldQ ? soldQ.length : <Spinner />} />
        <StatCard tone="lilac" icon={Calculator} label="Profit" sub={`${period.label}, before VAT`}
          value={profit !== null ? money(profit) : <Spinner />} />
      </div>

      {adding && <AddCar onClose={() => setAdding(false)} />}

      {view === "board" ? (
        <Card title="Board" icon={Car}
          actions={search.trim() ? <span className="small muted">Matching “{search.trim()}”</span> : null}>
          {all.length === 0 ? (
            <Empty icon={Car} title="No cars yet">Use Add a car to put the first one into stock.</Empty>
          ) : (
            <StockBoard cars={shown} onOpen={openCar} />
          )}
        </Card>
      ) : (
        <Card title="All cars" icon={Car}>
          <StockList cars={shown} onOpen={openCar} />
        </Card>
      )}

      {recData && (
        <Collapsible title={`Bank matching, ${quarter.label} · ${toCheck ? `${plural(toCheck, "item")} to look at` : "all matched"}`}
          tone={toCheck ? "warning" : undefined}>
          <div className="stack-sm">
            <p className="small muted">
              Bank lines are matched to cars when the amount equals the money paid (sale price less any
              part-ex) or the purchase price, within 7 days. Cash, finance payouts and deposits paid in parts
              won't match, which is fine.
            </p>
            {!toCheck && (
              <div className="row" style={{ color: "var(--green)" }}>
                <CheckCircle2 size={16} /> <span>Nothing unmatched this quarter.</span>
              </div>
            )}
            <ul className="plain">
              {recData.sold_unpaid.map((c) => (
                <li key={`s${c.id}`}>
                  <strong>{c.reg}</strong> sold {ukDate(c.sale_date)}, {money(c.cash_price)} in money: no matching money in.
                </li>
              ))}
              {recData.bought_unpaid.map((c) => (
                <li key={`b${c.id}`}>
                  <strong>{c.reg}</strong> bought {ukDate(c.purchase_date)} for {money(c.purchase_price)}: no matching payment out.
                </li>
              ))}
              {recData.unlinked_txns.map((t, i) => (
                <li key={`t${i}`}>
                  Bank line {ukDate(t.date)} {t.description} ({money(t.amount)}) is marked {t.category} but matches no car.
                </li>
              ))}
            </ul>
          </div>
        </Collapsible>
      )}

    </div>
  );
}
