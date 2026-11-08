import { useState } from "react";
import { AlertTriangle, Plus, Search, X } from "lucide-react";
import { api } from "../../api.js";
import {
  Alert, Button, Card, Field, IconButton, Input, MoneyInput, Segmented, useAction, useToast,
} from "../../components/ui.jsx";
import { useApp } from "../../context.js";
import { todayIso } from "../../format.js";

const SCHEME_HINT = "Margin: no VAT shown on the purchase. Standard: VAT shown.";

const blankCar = (today, scheme) => ({
  reg: "", makeModel: "", scheme, date: today, price: "", vat: "",
  invoiceNo: "", seller: "", colour: "", firstReg: "", mileage: "",
});

// Add-a-car form, opened from the page header. Line fields give the reference look.
export default function AddCar({ onClose }) {
  const { meta, refresh } = useApp();
  const today = meta.today || todayIso();
  const schemes = meta.car_schemes;
  const [car, setCar] = useState(() => blankCar(today, schemes[0]));
  const [add, busy] = useAction();
  const toast = useToast();
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState(null);
  const canLookUp = meta.lookups && (meta.lookups.dvla || meta.lookups.mot);

  // Fill the form from the DVLA and DVSA; anything already typed is kept.
  const lookUp = async () => {
    setLooking(true);
    try {
      const r = await api.get("/admin/api/vehicle-lookup", { reg: car.reg });
      setFound(r);
      setCar((c) => ({
        ...c, reg: r.reg || c.reg, makeModel: c.makeModel || r.make_model || "",
        colour: c.colour || r.colour || "", firstReg: c.firstReg || (r.first_reg || "").slice(0, 10),
        mileage: c.mileage || (r.last_mot_miles != null ? String(r.last_mot_miles) : ""),
      }));
      toast("success", `Found ${r.make_model || r.reg}.`);
    } catch (e) {
      toast("error", e.message);
    } finally {
      setLooking(false);
    }
  };

  const set = (k) => (e) => setCar((c) => ({ ...c, [k]: e.target.value }));
  const setVal = (k) => (v) => setCar((c) => ({ ...c, [k]: v }));

  const submit = async () => {
    const res = await add(() => api.post("/admin/api/cars", {
      reg: car.reg.trim(), make_model: car.makeModel.trim(), scheme: car.scheme,
      purchase_date: car.date, purchase_price: Number(car.price),
      purchase_vat: car.scheme === "Standard" ? Number(car.vat) : null,
      purchase_invoice_no: car.invoiceNo.trim(), seller_name: car.seller.trim(),
      colour: car.colour.trim(), first_reg: car.firstReg || null, mileage: car.mileage.trim(),
    }));
    if (res) {
      // Keep the tax and MOT dates and mileage history from the lookup on the new car.
      if (found && res.id) await api.post(`/admin/api/cars/${res.id}/check`).catch(() => {});
      setFound(null);
      setCar(blankCar(today, schemes[0]));
      refresh();
      onClose();
    }
  };

  return (
    <Card title="Add a car" icon={Plus} actions={<IconButton icon={X} label="Close add a car" onClick={onClose} />}>
      <div className="stack">
        <div className="grid-2">
          <Field variant="line" label="Reg" trailing={canLookUp ? (
            <Button size="sm" icon={Search} busy={looking} disabled={!car.reg.trim()} onClick={lookUp}>Look up</Button>
          ) : null}>
            <Input value={car.reg} onChange={set("reg")} />
          </Field>
          <Field variant="line" label="Make / model">
            <Input value={car.makeModel} onChange={set("makeModel")} />
          </Field>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="field-label">Scheme</span>
            <Segmented ariaLabel="Scheme" options={schemes} value={car.scheme} onChange={setVal("scheme")} />
            <span className="field-hint">{SCHEME_HINT}</span>
          </div>
          <Field variant="line" label="Purchase date">
            <Input type="date" value={car.date} onChange={set("date")} />
          </Field>
          <Field variant="line" label="Purchase price">
            <MoneyInput value={car.price} onChange={setVal("price")} />
          </Field>
          <Field variant="line" label="Purchase VAT"
            hint={car.scheme === "Standard" ? "Standard cars only." : "Margin cars have no purchase VAT."}>
            <MoneyInput value={car.vat} disabled={car.scheme !== "Standard"} onChange={setVal("vat")} />
          </Field>
          <Field variant="line" label="Purchase invoice no">
            <Input value={car.invoiceNo} onChange={set("invoiceNo")} />
          </Field>
          <Field variant="line" label="Bought from">
            <Input value={car.seller} onChange={set("seller")} />
          </Field>
          <Field variant="line" label="Colour">
            <Input value={car.colour} onChange={set("colour")} />
          </Field>
          <Field variant="line" label="First registered">
            <Input type="date" value={car.firstReg} onChange={set("firstReg")} />
          </Field>
          <Field variant="line" label="Mileage">
            <Input inputMode="numeric" value={car.mileage} onChange={set("mileage")} />
          </Field>
        </div>
        {found && (
          <div className="stack-sm">
            <p className="small muted">
              {[found.fuel, found.engine_cc ? `${found.engine_cc}cc` : null,
                found.tax_due ? `Tax ${found.tax_status || ""} until ${found.tax_due}` : found.tax_status,
                found.mot_expiry ? `MOT until ${found.mot_expiry}` : null].filter(Boolean).join(" · ")}
            </p>
            {found.mileage_warnings?.length > 0 && (
              <Alert tone="warning" title="Check the mileage before you buy">
                {found.mileage_warnings.join(" ")}
              </Alert>
            )}
            {found.errors?.length > 0 && <p className="small muted">{found.errors.join(" ")}</p>}
          </div>
        )}
        <p className="small muted">The margin scheme needs these for every car; the stock number is given automatically.</p>
        <div className="row">
          <Button variant="primary" icon={Plus} busy={busy} disabled={!car.date} onClick={submit}>
            Add to stock
          </Button>
        </div>
      </div>
    </Card>
  );
}
