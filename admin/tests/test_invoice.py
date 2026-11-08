import copy

import pdfplumber

import invoice_pdf as ip


def test_sample_matches_template_text(tmp_path):
    out = tmp_path / "inv.pdf"
    ip.build_invoice(ip.SAMPLE, out)
    text = pdfplumber.open(out).pages[0].extract_text()
    for s in ("SALES INVOICE", "0023", "09/10/2026", "468 3334 70", "MF69 VPP", "X5 XDRIVE 30D M SPORT", "£29,500.00"):
        assert s in text
    assert "Margin scheme" not in text  # off in the sample


def test_price_build_up(tmp_path):
    d = copy.deepcopy(ip.SAMPLE)
    d["pricing"].update(warranty=450, px_allowance=5000, finance=10000, deposit=1000)
    r = ip.build_invoice(d, tmp_path / "inv.pdf")
    assert r["total_price"] == 29950
    assert r["balance"] == 13950


def test_margin_wording_and_seller_details(tmp_path):
    d = copy.deepcopy(ip.SAMPLE)
    d["margin_scheme"] = True
    d["seller"].update(address_line="ADDRESSLINE1, TOWN, POSTCODE", company_no="00000000")
    out = tmp_path / "inv.pdf"
    ip.build_invoice(d, out)
    text = pdfplumber.open(out).pages[0].extract_text()
    assert "Margin scheme - second-hand goods" in text
    assert "Registered in England & Wales No. 00000000" in text
