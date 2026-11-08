"""Sales invoice PDF, same layout as the Word template (A4, Aptos).

Coordinates are PDF points from the bottom-left, measured off the original file.
Put Aptos.ttf / Aptos-Bold.ttf / Aptos-Italic.ttf in ./fonts for an exact match;
without them it falls back to Helvetica (same layout, slightly different letter widths).
"""
from pathlib import Path

from reportlab.lib.colors import Color, black
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

BASE = Path(__file__).parent
FONTS_DIR = BASE / "fonts"
DEFAULT_LOGO = BASE / "assets" / "logo.png"
NAVY = Color(0.0157, 0.1412, 0.2)  # right-hand panel border

S_SMALL, S_PANEL, S_BODY = 7.92, 9.12, 10.08


def _fonts():
    """Returns (font names, horizontal scale). Helvetica is ~6% wider than Aptos, so it is squeezed to keep the layout."""
    files = {"R": "Aptos.ttf", "B": "Aptos-Bold.ttf", "I": "Aptos-Italic.ttf"}
    if all((FONTS_DIR / f).exists() for f in files.values()):
        for k, f in files.items():
            pdfmetrics.registerFont(TTFont(f"Aptos-{k}", str(FONTS_DIR / f)))
        return {k: f"Aptos-{k}" for k in files}, 1.0
    return {"R": "Helvetica", "B": "Helvetica-Bold", "I": "Helvetica-Oblique"}, 0.94


def money(v):
    return f"£{v:,.2f}"


def build_invoice(d: dict, out_path, logo=None):
    """d = invoice data (see SAMPLE). Returns totals used on the invoice."""
    F, SCALE = _fonts()
    c = canvas.Canvas(str(out_path), pagesize=A4)
    c.setTitle(f"Invoice {d['invoice_no']} {d['reg']}")
    c.setAuthor(d["seller"]["name"])

    def width(s, font="R", size=S_BODY):
        return pdfmetrics.stringWidth(str(s), F[font], size) * SCALE

    def t(x, y, s, font="R", size=S_BODY):
        tx = c.beginText(x, y)
        tx.setFont(F[font], size)
        tx.setHorizScale(SCALE * 100)
        tx.textOut(str(s))
        c.drawText(tx)

    def tr(x, y, s, font="R", size=S_BODY):  # right-aligned
        t(x - width(s, font, size), y, s, font, size)

    # ---- header ----
    logo = Path(logo) if logo else DEFAULT_LOGO
    if logo.exists():
        c.drawImage(str(logo), 53.0, 757.7, width=96.0, height=52.5, mask="auto")
    tr(572.3, 770.9, d["seller"]["phone"], size=S_PANEL)
    tr(572.3, 759.8, d["seller"]["email"], size=S_PANEL)

    t(74.4, 734.9, "INVOICE TO", "B")
    t(217.9, 734.6, "DELIVER TO", "B")
    t(435.1, 734.9, "SALES INVOICE", "B")

    # buyer / delivery blocks: address lines, blank line, email, phone
    for x, party in ((72.5, d["invoice_to"]), (218.6, d["deliver_to"] or d["invoice_to"])):
        lines = [party["name"], *party["address"]][:5]
        for i, line in enumerate(lines):
            t(x, 717.8 - i * 9.82, line, size=S_SMALL)
        t(x, 659.3, party.get("email", ""), size=S_SMALL)
        t(x, 649.4, party.get("phone", ""), size=S_SMALL)

    for y, label, val in (
        (710.4, "Invoice No", d["invoice_no"]),
        (696.2, "Invoice Date", d["invoice_date"]),
        (682.3, "Stock Number", d["stock_no"]),
        (668.1, "VAT Number", d["seller"]["vat_no"]),
        (654.2, "Salesperson", d["salesperson"]),
    ):
        t(435.1, y, label)
        tr(583.4, y, val)

    c.setLineWidth(1)
    c.line(51.0, 630.8, 547.1, 630.8)

    # ---- vehicle grid: 3 label/value columns ----
    v = d["vehicle"]
    cols = [  # (label x, value right edge, dash x, rows)
        (59.8, 189.2, 167.8, [("Reg No", d["reg"]), ("Colour", v.get("colour")), ("First Reg Date", v.get("first_reg")),
                              ("Wheel Nut No", v.get("wheel_nut")), ("Immobiliser", v.get("immobiliser"))]),
        (227.3, 352.7, 335.3, [("Make", v.get("make")), ("Engine No", v.get("engine_no")), ("Mfr Date", v.get("mfr_date")),
                               ("Warranty No", v.get("warranty_no")), ("Radio Code", v.get("radio_code"))]),
        (418.8, 576.4, 526.8, [("Model", v.get("model")), ("Chassis No", v.get("chassis_no")), ("Mileage", v.get("mileage")),
                               ("Order No", v.get("order_no")), ("Key No", v.get("keys"))]),
    ]
    for lx, vx, dx, rows in cols:
        for i, (label, val) in enumerate(rows):
            y = (593.0, 574.5, 556.3, 538.1, 519.8)[i]
            t(lx, y, label)
            if val in (None, ""):
                t(dx, y, "-")  # empty fields show a dash, as on the template
            else:
                tr(vx, y, val)

    # ---- items box ----
    t(59.5, 489.3, "Accessories")
    t(160.6, 489.1, "Qty")
    t(232.3, 489.1, "Cost")
    t(270.2, 489.3, "Warranty and Services")

    c.setLineWidth(1)
    c.rect(51.2, 312.4, 370.2, 170.1)        # main box
    c.rect(51.0, 289.4, 370.2, 22.4)         # totals row
    c.setLineWidth(0.5)
    for x in (156.1, 182.6, 263.0):
        c.line(x, 482.5, x, 312.4)
    for x in (182.5, 263.0):
        c.line(x, 311.9, x, 289.5)

    items = d["items"]
    for i, it in enumerate(items[:9]):
        y = 464.4 - i * 12.3
        t(59.3, y, it["desc"])
        t(164.4, y, it.get("qty", 1))
        tr(247.2, y, money(it["cost"]))
    for i, line in enumerate(d.get("warranty_lines", [])[:5]):
        t(268.5, 464.4 - i * 12.3, line)

    t(271.0, 387.8, "Special Instructions")
    for i, line in enumerate(d.get("special_instructions", [])[:5]):
        t(280.1, 366.2 - i * 12.25, line)

    items_total = sum(it["cost"] * it.get("qty", 1) for it in items)
    t(59.5, 296.9, "Totals", "B")
    tr(241.9, 298.3, money(items_total))
    t(265.9, 297.8, "* Total", "B")

    # ---- right panel: price build-up ----
    c.setStrokeColor(NAVY)
    c.setLineWidth(1)
    c.rect(421.3, 12.7, 168.0, 469.7)
    c.setStrokeColor(black)

    p = d.get("pricing", {})
    g = lambda k: float(p.get(k) or 0)  # noqa: E731
    selling = g("selling_price") or items_total
    sub1 = selling + g("delivery") + g("accessories")
    total_price = sub1 + g("rf_licence") + g("cherished") + g("warranty") + g("warranty_ipt")
    sub2 = total_price - g("px_allowance")
    net = sub2 + g("hp_settlement")
    balance1 = net - g("finance")
    balance = balance1 - g("deposit")

    # (label, label baseline, bold, value, value baseline, always show)
    rows = [
        ("Selling Price", 466.3, False, selling, 466.3, True),
        ("Delivery Charge", 449.7, False, g("delivery"), 450.5, True),
        ("Accessories", 433.4, False, g("accessories"), 434.6, True),
        ("Sub Total", 416.9, False, sub1, 419.0, True),
        ("RF Licence", 384.0, False, g("rf_licence"), 384.0, False),
        ("Cherished Transfer", 367.4, False, g("cherished"), 367.4, False),
        ("Warranty and Services", 334.5, False, g("warranty"), 334.5, False),
        ("Warranty IPT", 318.0, False, g("warranty_ipt"), 318.0, False),
        ("Total Price", 301.4, True, total_price, 301.4, None),
        ("Less PX Allowance", 285.1, False, g("px_allowance"), 285.1, False),
        ("Sub Total", 268.5, True, sub2, 268.5, None),
        ("HP Settlement Amount", 252.0, False, g("hp_settlement"), 252.0, False),
        ("Net Price", 235.7, False, net, 235.7, None),
        ("Finance Amount", 219.1, False, g("finance"), 219.1, False),
        ("Balance", 202.5, False, balance1, 202.5, None),
        ("Less Deposit / Payments", 186.2, False, g("deposit"), 186.2, False),
        ("Balance", 136.8, True, balance, 136.8, True),
    ]
    for label, ly, bold, val, vy, _show in rows:
        t(431.0, ly, label, "B" if bold else "R", S_PANEL)
        # every row shows a figure, so an unused charge reads £0.00 rather than a blank
        tr(576.6 if label != "Balance" or ly != 136.8 else 577.1, vy, money(val), size=S_PANEL)

    # margin scheme wording + seller details (only printed when supplied)
    if d.get("margin_scheme"):
        for i, line in enumerate(simpleSplit(d["margin_scheme_text"], F["R"], S_SMALL, 150 / SCALE)):
            t(431.0, 110 - i * 9.8, line, size=S_SMALL)

    # ---- declaration ----
    s = S_SMALL
    t(57.8, 272.6, "I certify that I am the buyer of the above-mentioned vehicle at the price stated. I acknowledge receiving", size=s)
    t(57.8, 261.3, "delivery. I am over 18 years old.", size=s)
    for y, q in ((238.3, "Were you given the impression verbally or otherwise that the mileage was correct?"),
                 (226.5, "Were you made aware of the pre-delivery inspection content and accept that"),
                 (203.5, "Have you been made aware of the operation and controls of the vehicle purchased?"),
                 (191.7, "If no were they shown on a similar vehicle?")):
        t(57.8, y, "\u2022", size=s)
        t(75.8, y, q, size=s)
        t(369.8, y, "Yes/No", size=s)
    t(75.8, 215.3, "this forms part of the contract of sale?", size=s)
    t(57.8, 169.4, "Customer Signature", size=s)
    t(309.8, 169.4, "Date", size=s)
    t(57.8, 146.9, "Sellers Signature", size=s)
    t(309.8, 146.9, "Date", size=s)
    for y, line in ((124.3, "Nothing herein contained is intended to affect, nor will it affect a consumer\u2019s statutory rights under the"),
                    (113.3, "Consumer Rights Act 2015 or any amendment thereof. The goods shall remain the property of the"),
                    (102.0, "sellers until such time as the purchase price in full is received by the seller and any cheques have been"),
                    (90.7, "cleared.")):
        t(57.8, y, line, size=s)

    # ---- footer: payee + bank ----
    sel = d["seller"]
    t(48.5, 55.4, sel["name"].upper(), size=s)
    for y, label, val in ((44.1, "Sort Code", sel.get("sort_code", "")),
                          (32.9, "Account Number", sel.get("account_no", "")),
                          (21.6, "Payment Ref", "(Reg Number)")):
        t(48.5, y, label, "I", s)
        t(48.5 + width(label + " ", "I", s), y, val, size=s)

    legal = [x for x in (sel.get("address_line"),
                         f"Registered in England & Wales No. {sel['company_no']}" if sel.get("company_no") else None)
             if x]
    for i, line in enumerate(legal):
        t(200.0, 55.4 - i * 11.2, line, size=s)

    c.showPage()
    c.save()
    return {"items_total": items_total, "total_price": total_price, "balance": balance}


# Values from invoice 0023 - used by tests to compare against the original PDF
SAMPLE = {
    "invoice_no": "0023", "invoice_date": "09/10/2026", "stock_no": "0010", "salesperson": "San",
    "reg": "MF69 VPP",
    "seller": {"name": "SKH Prestige Motors Ltd", "phone": "07436 0191915", "email": "info@skhinc.co.uk",
               "vat_no": "468 3334 70", "sort_code": "20-19-97", "account_no": "40839531"},
    "invoice_to": {"name": "4C3 Automotive T/A Ace Automotive",
                   "address": ["18 Whitethorns", "Newport Pagnell", "Buckinghamshire", "MK16 0AY"],
                   "email": "aceautomotiveuk@outlook.com", "phone": "07436 019195"},
    "deliver_to": {"name": "City Cars Scotland", "address": ["Murltleden Road", "Milltimber", "Aberdeen", "AB13 0HS"],
                   "email": "sales@citycarsscotland.co.uk", "phone": "01224 548820"},
    "vehicle": {"make": "BMW", "model": "X5 XDRIVE 30D M SPORT", "colour": "Black", "first_reg": "19/09/2019",
                "mileage": "53000", "keys": "2"},
    "items": [{"desc": "Vehicle (MF69 VPP)", "qty": 1, "cost": 29500.00}],
    "special_instructions": ["Soft Prep (£250)", "V5 Logbook", "2 Key"],
    "pricing": {"selling_price": 29500.00},
    "margin_scheme": False,
    "margin_scheme_text": "Margin scheme - second-hand goods. VAT is not shown separately.",
}

if __name__ == "__main__":
    print(build_invoice(SAMPLE, BASE / "sample_invoice.pdf"))
