"""Credit note PDF, drawn in the same fonts, logo and colours as invoice_pdf.py (which is not changed)."""
from pathlib import Path

from reportlab.lib.colors import black
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

import invoice_pdf
from invoice_pdf import DEFAULT_LOGO, NAVY, S_BODY, S_PANEL, S_SMALL, money


def build_credit_note(d: dict, out_path, logo=None) -> None:
    """d: credit_no, credit_date, invoice_no, invoice_date, reg, make_model, kind_label, reason,
    lines [(desc, amount)], total, vat_text, seller {...}, buyer {name, address}."""
    F, SCALE = invoice_pdf._fonts()
    c = canvas.Canvas(str(out_path), pagesize=A4)
    c.setTitle(f"Credit note {d['credit_no']} {d['reg']}")
    c.setAuthor(d["seller"]["name"])

    def width(s, font="R", size=S_BODY):
        return pdfmetrics.stringWidth(str(s), F[font], size) * SCALE

    def t(x, y, s, font="R", size=S_BODY):
        tx = c.beginText(x, y)
        tx.setFont(F[font], size)
        tx.setHorizScale(SCALE * 100)
        tx.textOut(str(s))
        c.drawText(tx)

    def tr(x, y, s, font="R", size=S_BODY):
        t(x - width(s, font, size), y, s, font, size)

    logo = Path(logo) if logo else DEFAULT_LOGO
    if logo.exists():
        c.drawImage(str(logo), 53.0, 757.7, width=96.0, height=52.5, mask="auto")
    tr(572.3, 770.9, d["seller"].get("phone", ""), size=S_PANEL)
    tr(572.3, 759.8, d["seller"].get("email", ""), size=S_PANEL)

    t(53.0, 715.0, "CREDIT NOTE", "B", 18)
    t(53.0, 690.0, "CREDIT TO", "B")
    for i, line in enumerate([d["buyer"]["name"], *d["buyer"]["address"]][:5]):
        t(53.0, 674.0 - i * 11.0, line, size=S_SMALL + 1)

    c.setStrokeColor(NAVY)
    c.setLineWidth(1.2)
    c.rect(360.0, 600.0, 212.3, 112.0)
    for i, (label, val) in enumerate((("Credit Note No", d["credit_no"]), ("Date", d["credit_date"]),
                                      ("Against Invoice", d["invoice_no"]), ("Invoice Date", d["invoice_date"]),
                                      ("Vehicle", d["reg"]), ("Reason", d["kind_label"]))):
        y = 694.0 - i * 16.0
        t(368.0, y, label, "B", S_PANEL)
        tr(564.0, y, val, size=S_PANEL)

    y = 560.0
    c.setStrokeColor(black)
    c.setLineWidth(0.6)
    t(53.0, y, "Description", "B")
    tr(572.3, y, "Amount", "B")
    c.line(53.0, y - 6, 572.3, y - 6)
    y -= 24
    for desc, amount in d["lines"]:
        t(53.0, y, desc)
        tr(572.3, y, money(amount))
        y -= 18
    if d.get("reason"):
        y -= 4
        t(53.0, y, f"Note: {d['reason']}"[:110], "I", S_SMALL + 1)
        y -= 18
    c.line(360.0, y + 6, 572.3, y + 6)
    t(360.0, y - 10, "Total credited", "B")
    tr(572.3, y - 10, money(d["total"]), "B")
    if d.get("vat_text"):
        t(53.0, y - 40, d["vat_text"], size=S_SMALL + 1)

    s = d["seller"]
    foot = 70.0
    t(53.0, foot, s["name"].upper(), "B", S_SMALL)
    t(53.0, foot - 11, s.get("address_line", ""), size=S_SMALL)
    bits = [f"Company No {s['company_no']}" if s.get("company_no") else "",
            f"VAT No {s['vat_no']}" if s.get("vat_no") else ""]
    t(53.0, foot - 22, "   ".join(b for b in bits if b), size=S_SMALL)
    c.showPage()
    c.save()
