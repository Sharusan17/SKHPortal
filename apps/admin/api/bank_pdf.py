"""Read the transactions out of a bank statement PDF (built for Barclays business statements).

Barclays prints a table with the columns Date, Description, Money out, Money in and Balance.
Only rows with a money-in or money-out figure are transactions; balances, brought / carried
forward lines, summary boxes and the legal pages are skipped, so it doesn't matter which pages
the transactions sit on. Several lines on the same day often print the date only once, so a line
without a date takes the date above it. A description that wraps onto more lines is joined up.
"""
from __future__ import annotations

import io
import re
from datetime import date, datetime

import pandas as pd
import pdfplumber

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}
AMOUNT = re.compile(r"^-?£?\d{1,3}(?:,\d{3})*\.\d{2}-?$|^-?£?\d+\.\d{2}-?$")
FULL_DATE = re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]{3,9})\.? (\d{4})\b")
NUM_DATE = re.compile(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$")
SKIP = re.compile(r"(?i)\b(start|opening|closing|end) balance\b|balance (brought|carried) forward"
                  r"|^(total|totals)\b|brought forward|carried forward")
OUT_WORDS = ("out", "debit", "debits", "payments", "paid out", "withdrawn")
IN_WORDS = ("in", "credit", "credits", "receipts", "paid in")


def is_pdf(data: bytes) -> bool:
    return data[:5] == b"%PDF-"


def _month(word: str) -> int | None:
    return MONTHS.get(word.strip(".,").lower()[:3])


def _period(text: str) -> tuple[date | None, date | None]:
    """The first and last full dates printed on the statement, to give the year to '3 Jan' rows."""
    found = []
    for d, m, y in FULL_DATE.findall(text):
        mo = _month(m)
        if mo:
            try:
                found.append(date(int(y), mo, int(d)))
            except ValueError:
                pass
    return (min(found), max(found)) if found else (None, None)


def _row_date(tokens: list[str], end: date | None) -> date | None:
    """A date from the first words of a row: '3 Jan', '03 Jan 2026', '03/01/2026' or '03/01/26'."""
    if not tokens:
        return None
    m = NUM_DATE.match(tokens[0])
    if m:
        d, mo, y = (int(x) for x in m.groups())
        y += 2000 if y < 100 else 0
        try:
            return date(y, mo, d)
        except ValueError:
            return None
    if len(tokens) >= 2 and re.fullmatch(r"\d{1,2}(st|nd|rd|th)?", tokens[0]) and _month(tokens[1]):
        d, mo = int(re.match(r"\d+", tokens[0]).group()), _month(tokens[1])
        if len(tokens) >= 3 and re.fullmatch(r"\d{4}", tokens[2]):
            y = int(tokens[2])
        else:
            y = (end or datetime.now().date()).year
            # A December line on a statement that ends in January belongs to the year before.
            if end and (mo, d) > (end.month, end.day):
                y -= 1
        try:
            return date(y, mo, d)
        except ValueError:
            return None
    return None


def _date_len(tokens: list[str]) -> int:
    """How many of the first words make up the date."""
    if tokens and NUM_DATE.match(tokens[0]):
        return 1
    if len(tokens) >= 2 and re.fullmatch(r"\d{1,2}(st|nd|rd|th)?", tokens[0]) and _month(tokens[1]):
        return 3 if len(tokens) >= 3 and re.fullmatch(r"\d{4}", tokens[2]) else 2
    return 0


def _money(word: str) -> str:
    neg = word.startswith("-") or word.endswith("-")
    v = word.strip("-").replace("£", "").replace(",", "")
    return f"-{v}" if neg else v


def _lines(words: list[dict], tol: float = 3.0) -> list[list[dict]]:
    """Group words into printed lines by their height on the page."""
    lines: list[list[dict]] = []
    for w in sorted(words, key=lambda w: (round(w["top"]), w["x0"])):
        if lines and abs(lines[-1][0]["top"] - w["top"]) <= tol:
            lines[-1].append(w)
        else:
            lines.append([w])
    return [sorted(line, key=lambda w: w["x0"]) for line in lines]


def _header(line: list[dict]) -> dict | None:
    """Where the money columns sit, if this line is the table's heading row."""
    words = [w["text"].lower().strip("£():") for w in line]
    if "date" not in words or not any(w.startswith("description") or w == "details" for w in words):
        return None
    cols: dict[str, float] = {}
    for i, w in enumerate(line):
        t = words[i]
        prev = words[i - 1] if i else ""
        nxt = words[i + 1] if i + 1 < len(words) else ""
        if t == "balance":
            cols["balance"] = w["x1"]
        elif t in OUT_WORDS or (t == "out" and prev in ("money", "paid", "payments")):
            cols.setdefault("out", w["x1"])
        elif t in IN_WORDS or (t == "in" and prev in ("money", "paid", "payments")):
            cols.setdefault("in", w["x1"])
        elif t in ("money", "paid") and nxt in ("out", "in"):
            continue
        elif t.startswith("description") or t == "details":
            cols["desc"] = w["x0"]
    if "out" not in cols or "in" not in cols:
        return None
    cols["date"] = next(w["x0"] for i, w in enumerate(line) if words[i] == "date")
    return cols


def _column(x1: float, cols: dict) -> str:
    """Which money column a figure belongs to: the heading whose right edge is nearest."""
    options = {k: cols[k] for k in ("out", "in", "balance") if k in cols}
    return min(options, key=lambda k: abs(options[k] - x1))


def read_statement(data: bytes) -> pd.DataFrame:
    """Transactions as a table of strings: Date (ISO), Description, Paid out, Paid in."""
    rows: list[dict] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages[:2])
        _start, end = _period(text)
        current: date | None = None
        for page in pdf.pages:
            cols = None
            last_top = None
            pending: str | None = None
            for line in _lines(page.extract_words(keep_blank_chars=False, use_text_flow=False)):
                head = _header(line)
                if head:
                    cols, last_top = head, line[0]["top"]
                    continue
                if not cols:
                    continue
                tokens = [w["text"] for w in line]
                n = _date_len(tokens)
                d = _row_date(tokens, end) if n else None
                if d:
                    current = d
                money = [w for w in line[n:] if AMOUNT.match(w["text"])]
                desc_words = [w["text"] for w in line[n:] if w not in money]
                desc = " ".join(desc_words).strip()
                figures = {_column(w["x1"], cols): _money(w["text"]) for w in money}
                paid_out, paid_in = figures.get("out"), figures.get("in")
                gap = line[0]["top"] - last_top if last_top is not None else 0
                last_top = line[0]["top"]
                if SKIP.search(desc):
                    pending = None
                    continue
                if paid_out or paid_in:
                    if current is None or not any(float(v or 0) for v in (paid_out, paid_in)):
                        pending = None
                        continue  # no date yet, or a £0.00 line (e.g. no charges this month)
                    full = f"{pending} {desc}".strip() if pending else desc
                    pending = None
                    rows.append({"Date": current.isoformat(), "Description": full,
                                 "Paid out": paid_out or "", "Paid in": paid_in or ""})
                elif not desc or gap >= 30:
                    pending = None
                elif d or pending:
                    # A dated line with no figure: its description carries on until the line that has one.
                    pending = f"{pending} {desc}".strip() if pending else desc
                elif rows and line[0]["x0"] >= cols.get("desc", cols["date"]) - 5:
                    # A description that runs onto the next line belongs to the row above.
                    rows[-1]["Description"] = f'{rows[-1]["Description"]} {desc}'.strip()
    df = pd.DataFrame(rows, columns=["Date", "Description", "Paid out", "Paid in"])
    if df.empty:
        raise ValueError("No transactions found. Is this a Barclays statement PDF (not a scan)?")
    return df
