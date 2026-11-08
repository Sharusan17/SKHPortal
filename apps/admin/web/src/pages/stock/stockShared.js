// Shared constants and helpers for the Stock book (board, table and car panel).
import { money } from "../../format.js";

// Stock-book records the margin scheme needs for every car.
export const MARGIN_FIELDS = [
  ["purchase_invoice_no", "Purchase invoice no"], ["seller_name", "Bought from"], ["colour", "Colour"],
  ["first_reg", "First registered"], ["mileage", "Mileage"], ["buyer_name", "Sold to"],
  ["sales_invoice_no", "Sales invoice no"],
];
export const EDIT_FIELDS = ["reg", "make_model", "scheme", "purchase_date", "purchase_price", "purchase_vat",
  "sale_date", "sale_price", "px_allowance", ...MARGIN_FIELDS.map(([f]) => f)];
export const DATE_FIELDS = ["purchase_date", "sale_date", "first_reg"];
export const NUM_FIELDS = ["purchase_price", "purchase_vat", "sale_price", "px_allowance"];

export const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");
export const numOrNull = (v) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v))
  ? null : Number(v));

export const carLabel = (c) => [c.reg, c.make_model, c.scheme,
  c.purchase_price != null ? `bought ${money(c.purchase_price)}` : null].filter(Boolean).join(" · ");

// Board columns. "completed" cars (sold and paid in full) sit in the Sold column with a Paid badge.
export const BOARD_COLUMNS = [
  { key: "bought", label: "Bought" },
  { key: "in_prep", label: "In prep" },
  { key: "for_sale", label: "For sale" },
  { key: "sold", label: "Sold" },
];
export const columnOf = (stage) => (stage === "completed" ? "sold" : stage);

// Stages a car can be moved to by hand (sold cars follow their invoice).
export const STATUS_OPTIONS = ["bought", "in_prep", "for_sale"];

// Search text from the top bar, matched against reg, make/model, stock no and buyer.
export const matchesSearch = (c, q) => {
  if (!q) return true;
  return [c.reg, c.make_model, c.stock_no, c.buyer_name].some((v) => String(v ?? "").toLowerCase().includes(q));
};
