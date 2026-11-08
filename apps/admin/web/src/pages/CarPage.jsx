import { Loader2 } from "lucide-react";
import { api } from "../api.js";
import { Alert, Button, useLoad } from "../components/ui.jsx";
import { useApp } from "../context.js";
import CarPanel from "./stock/CarPanel.jsx";
import { navigate } from "../router.js";

// One car on its own page (/admin/car/<id>): the car panel laid out full width.
export default function CarPage({ carId }) {
  const { version } = useApp();
  const stock = useLoad(() => api.get("/admin/api/stock"), [version]);
  const back = () => { navigate("/admin/stock"); };

  if (stock.error) return <Alert tone="error">{stock.error.message}</Alert>;
  if (!stock.data) return <div className="muted"><Loader2 size={18} className="spin" /></div>;
  const car = stock.data.find((c) => c.id === carId);
  if (!car) {
    return (
      <div className="stack">
        <Alert tone="warning" title="Car not found">It may have been deleted.</Alert>
        <div><Button onClick={back}>Back to Stock Book</Button></div>
      </div>
    );
  }
  return <CarPanel car={car} onClose={back} page />;
}
