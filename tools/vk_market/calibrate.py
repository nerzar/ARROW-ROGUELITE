"""Stage 0: compare apps.get members_count with the 'N игроков' label of the public VK Games UI.

No API calls: uses calibration_ui_sample.json (manual, logged-out read of https://vk.ru/games) and the
apps.get raw files of a finished run. Title-only UI cards are mapped by exact, unique title.

UI labels are rounded. Rounding rule is unknown, so the accepted interval covers both floor and
round-half: [v - unit/2, v + unit), unit = one step of the last displayed significant digit
(labels show at most 2 significant digits: 750K -> 10K, 18M -> 1M, 6K -> 1K).
"""

import csv
import os
import statistics

from .client import REPO_ROOT, read_json
from .details import iter_details

SAMPLE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "calibration_ui_sample.json")
OUT = os.path.join(REPO_ROOT, "research", "vk-market", "metric-calibration.csv")
MULT = {"K": 1_000, "M": 1_000_000}
COLUMNS = ["app_id", "title", "mapping", "ui_block", "ui_label", "ui_value", "ui_lower", "ui_upper",
           "members_count", "ratio_members_to_ui", "members_within_ui_rounding", "ui_captured_at", "api_captured_at"]


def parse_label(label):
    num, suffix = label[:-1], label[-1]
    mult = MULT[suffix]
    digits = len(num)
    unit = mult * 10 ** max(0, digits - 2)
    value = int(num) * mult
    return value, value - unit // 2, value + unit


def run(run_dir):
    sample = read_json(SAMPLE)
    items, captured = {}, {}
    for _, env in iter_details(run_dir):
        for it in (env["body"].get("response") or {}).get("items", []):
            items.setdefault(it["id"], it)
            captured.setdefault(it["id"], env["captured_at"])
    by_title = {}
    for it in items.values():
        by_title.setdefault(it.get("title"), []).append(it["id"])

    rows = []
    for s in sample["items"]:
        app_id, mapping = s["app_id"], "card_link_app_id"
        if app_id is None:
            matches = by_title.get(s["title"], [])
            app_id = matches[0] if len(matches) == 1 else None
            mapping = "exact_unique_title" if app_id else f"unmapped ({len(matches)} title matches)"
        it = items.get(app_id) if app_id else None
        value, lo, hi = parse_label(s["ui_label"])
        mc = it.get("members_count") if it else None
        rows.append({
            "app_id": app_id or "", "title": (it or {}).get("title") or s["title"] or "", "mapping": mapping,
            "ui_block": s["block"], "ui_label": s["ui_label"], "ui_value": value, "ui_lower": lo, "ui_upper": hi,
            "members_count": "" if mc is None else mc,
            "ratio_members_to_ui": "" if mc is None else round(mc / value, 3),
            "members_within_ui_rounding": "" if mc is None else int(lo <= mc < hi),
            "ui_captured_at": sample["captured_at"], "api_captured_at": captured.get(app_id, ""),
        })
    rows.sort(key=lambda r: -r["ui_value"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    compared = [r for r in rows if r["members_count"] != ""]
    ratios = [r["ratio_members_to_ui"] for r in compared]
    result = {
        "sample": len(rows), "compared": len(compared), "unmapped": len(rows) - len(compared),
        "within_ui_rounding": sum(r["members_within_ui_rounding"] for r in compared),
        "ratio_min": min(ratios) if ratios else None, "ratio_median": statistics.median(ratios) if ratios else None,
        "ratio_max": max(ratios) if ratios else None,
    }
    print(f"[calibrate] {OUT}")
    for r in rows:
        print(f"  {r['ui_label']:>5} ui  members_count={r['members_count']!s:>10}  ratio={r['ratio_members_to_ui']!s:>6}"
              f"  within={r['members_within_ui_rounding']!s}  {r['mapping']}  app_id={r['app_id']}")
    print(result)
    return result
