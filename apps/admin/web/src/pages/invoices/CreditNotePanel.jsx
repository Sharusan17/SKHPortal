import { useState } from "react";
import { Download, Eye, FileMinus, Plus, Undo2, X } from "lucide-react";
import { api, download } from "../../api.js";
import { Alert, Badge, Button, Card, Field, Input, MoneyInput, Panel, Segmented, Select, useAction } from "../../components/ui.jsx";
import { useApp } from "../../context.js";
import { money, todayIso, ukDate } from "../../format.js";

const KINDS = [
  { value: "return", label: "Car returned" },
  { value: "discount", label: "Price reduction" },
];
const REFUND_METHODS = ["Bank transfer", "Card", "Cash", "Other"];

// Credit notes on one invoice: issue one, see the ones issued, and record the refund paid back.
export default function CreditNotePanel({ inv, onClose }) {
  const { refresh } = useApp();
  const [run, busy] = useAction();
  const [f, setF] = useState({ kind: "discount", date: todayIso(), amount: "", reason: "" });
  const [refund, setRefund] = useState({ date: todayIso(), amount: "", method: "Bank transfer" });
  const notes = inv.credit_notes || [];
  const returned = notes.some((n) => n.kind === "return");
  const pay = inv.payment || {};
  const owed = Number(pay.refund_owed) || 0;

  const issue = async () => {
    const what = f.kind === "return"
      ? `Credit the whole sale of ${inv.reg} and put the car back in stock?`
      : `Take ${money(f.amount || 0)} off the price of ${inv.reg}?`;
    if (!window.confirm(`${what} A credit note can't be deleted.`)) return;
    const res = await run(() => api.post(`/admin/api/invoices/${inv.id}/credit-notes`, {
      kind: f.kind, credit_date: f.date, amount: f.kind === "discount" ? Number(f.amount) : null, reason: f.reason,
    }));
    if (res) {
      setF((s) => ({ ...s, amount: "", reason: "" }));
      refresh();
    }
  };

  const recordRefund = async () => {
    const res = await run(() => api.post(`/admin/api/invoices/${inv.id}/refunds`, {
      paid_on: refund.date, amount: Number(refund.amount), method: refund.method, note: "Refund to buyer",
    }));
    if (res) {
      setRefund((s) => ({ ...s, amount: "" }));
      refresh();
    }
  };

  return (
    <Card title={`Credit notes · ${inv.invoice_no} · ${inv.reg}`} icon={FileMinus}
      actions={<Button size="sm" icon={X} onClick={onClose}>Close</Button>}>
      <div className="stack">
        {notes.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>No</th><th>Date</th><th>Type</th><th className="r">Credited</th><th className="r">VAT back</th><th>Reason</th><th /></tr>
              </thead>
              <tbody>
                {notes.map((n) => (
                  <tr key={n.id}>
                    <td>{n.credit_no}</td>
                    <td>{ukDate(n.credit_date)}</td>
                    <td><Badge tone={n.kind === "return" ? "red" : "orange"}>{n.kind_label}</Badge></td>
                    <td className="r">{money(n.amount)}</td>
                    <td className="r">{money(n.vat)}</td>
                    <td>{n.reason || "-"}</td>
                    <td>
                      <div className="inv-actions">
                        <a className="btn btn-ghost btn-sm" href={`/admin/api/credit-notes/${n.id}/pdf`} target="_blank" rel="noreferrer">
                          <Eye size={14} />View
                        </a>
                        <Button size="sm" variant="ghost" icon={Download}
                          onClick={() => download(`/admin/api/credit-notes/${n.id}/pdf`, { download: 1 })}>Download</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {owed > 0 && (
          <Panel title={`Refund owed to ${inv.buyer_name}: ${money(owed)}`}>
            <div className="stack">
              <p className="small muted" style={{ margin: 0 }}>
                Paid back from Tide? Match that bank line to this invoice on the Bank page instead, so it isn't counted twice.
              </p>
              <div className="pay-form">
                <Field label="Date refunded">
                  <Input type="date" value={refund.date} onChange={(e) => setRefund((s) => ({ ...s, date: e.target.value }))} />
                </Field>
                <Field label="Amount">
                  <MoneyInput value={refund.amount} placeholder={owed.toFixed(2)}
                    onChange={(v) => setRefund((s) => ({ ...s, amount: v }))} />
                </Field>
                <Field label="Method">
                  <Select value={refund.method} options={REFUND_METHODS} onChange={(v) => setRefund((s) => ({ ...s, method: v }))} />
                </Field>
              </div>
              <div className="row">
                <Button icon={Undo2} busy={busy} onClick={recordRefund}>Record refund</Button>
              </div>
            </div>
          </Panel>
        )}

        {returned ? (
          <Alert tone="info">The car was returned, so this invoice is fully credited.</Alert>
        ) : (
          <Panel title="Issue a credit note">
            <div className="stack">
              <Segmented options={KINDS} value={f.kind} onChange={(v) => setF((s) => ({ ...s, kind: v }))} ariaLabel="Credit note type" />
              <div className="pay-form">
                <Field label="Credit note date">
                  <Input type="date" value={f.date} onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))} />
                </Field>
                {f.kind === "discount" && (
                  <Field label="Amount off the price">
                    <MoneyInput value={f.amount} onChange={(v) => setF((s) => ({ ...s, amount: v }))} />
                  </Field>
                )}
                <Field label="Reason">
                  <Input value={f.reason} placeholder="e.g. Gearbox fault" onChange={(e) => setF((s) => ({ ...s, reason: e.target.value }))} />
                </Field>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                {f.kind === "return"
                  ? "The whole sale is credited and the car goes back into stock to sell again. "
                  : "The price is reduced and the VAT on the sale is worked out again. "}
                The VAT comes back on the return for the credit note's date, so a return already filed isn't changed.
              </p>
              <div className="row">
                <Button variant="primary" icon={Plus} busy={busy} onClick={issue}>Issue credit note</Button>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </Card>
  );
}
