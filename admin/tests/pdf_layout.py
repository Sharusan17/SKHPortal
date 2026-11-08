"""Layout checks for generated PDFs: text that overlaps other text, crosses a box line or leaves the page."""
from dataclasses import dataclass

import pdfplumber

PAGE_MARGIN = 5.0  # points; text closer than this to the page edge counts as off the page


@dataclass
class Problem:
    kind: str
    text: str
    detail: str

    def __str__(self):
        return f"{self.kind}: {self.text!r} {self.detail}"


def runs(chars) -> list[dict]:
    """Group chars into runs drawn together: same baseline, touching left to right."""
    out = []
    for c in sorted(chars, key=lambda c: (round(c["top"]), c["x0"])):
        r = out[-1] if out else None
        if r and abs(r["top"] - c["top"]) < 0.5 and -0.5 < c["x0"] - r["x1"] < 3.5 and c["size"] == r["size"]:
            r["x1"], r["text"] = c["x1"], r["text"] + c["text"]
        else:
            out.append({"top": c["top"], "bottom": c["bottom"], "x0": c["x0"], "x1": c["x1"],
                        "text": c["text"], "size": c["size"]})
    return out


def check(path) -> list[Problem]:
    problems = []
    with pdfplumber.open(path) as pdf:
        page = pdf.pages[0]
        chars = [c for c in page.chars if c["text"].strip()]
        width, height = page.width, page.height
        # vertical rules: box sides and column lines
        verticals = [(ln["x0"], ln["top"], ln["bottom"]) for ln in page.lines if abs(ln["x0"] - ln["x1"]) < 0.5]
        for r in page.rects:
            verticals += [(r["x0"], r["top"], r["bottom"]), (r["x1"], r["top"], r["bottom"])]

    for c in chars:
        if c["x0"] < PAGE_MARGIN or c["x1"] > width - PAGE_MARGIN or c["top"] < 0 or c["bottom"] > height:
            problems.append(Problem("off page", c["text"], f"at x {c['x0']:.1f}-{c['x1']:.1f}"))

    # two characters on top of each other (from different text runs)
    by_x = sorted(chars, key=lambda c: c["x0"])
    for i, a in enumerate(by_x):
        for b in by_x[i + 1:]:
            if b["x0"] >= a["x1"] - 0.6:
                break
            v = min(a["bottom"], b["bottom"]) - max(a["top"], b["top"])
            if v > 0.5 * min(a["size"], b["size"]):
                problems.append(Problem("overlap", a["text"] + "/" + b["text"],
                                        f"at x {b['x0']:.1f}, y {a['top']:.1f}"))

    # text crossing a column or box line
    for run in runs(chars):
        for x, top, bottom in verticals:
            if run["x0"] + 0.5 < x < run["x1"] - 0.5 and top < run["bottom"] - 1 and bottom > run["top"] + 1:
                problems.append(Problem("crosses line", run["text"], f"at x {x:.1f}"))
    return problems


def text_runs(path) -> list[dict]:
    with pdfplumber.open(path) as pdf:
        return runs([c for c in pdf.pages[0].chars if c["text"].strip()])


def text(path) -> str:
    with pdfplumber.open(path) as pdf:
        return pdf.pages[0].extract_text()
