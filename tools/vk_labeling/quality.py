"""Blind-repeat agreement QC (EXP-004 QC steps 2-4).

Compares research/vk-market/labeling/muse-labels.csv with the blind repeat
labels (default local path artifacts/vk-labeling/repeat/labels_repeat.csv,
committed copy NOT required) on a shared sample of app_ids.

Agreement fields: primary_mechanic, primary_theme, combat, roguelite,
arrow_tapaway. Thresholds: primary_mechanic >= 0.90, arrow_tapaway >= 0.95.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LABELS = ROOT / "research/vk-market/labeling/muse-labels.csv"
REPEAT = ROOT / "artifacts/vk-labeling/repeat/labels_repeat.csv"

FIELDS = ["primary_mechanic", "primary_theme", "combat", "roguelite", "arrow_tapaway"]


def load(path: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    with path.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            out[row["app_id"]] = row
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repeat", type=Path, default=REPEAT)
    ap.add_argument("--out", type=Path,
                    default=ROOT / "research/vk-market/labeling/quality.json")
    args = ap.parse_args(argv)

    base = load(LABELS)
    rep = load(args.repeat)
    shared = sorted(set(base) & set(rep), key=int)
    agreement = {}
    for fld in FIELDS:
        agree = sum(1 for i in shared if (base[i].get(fld) or "") == (rep[i].get(fld) or ""))
        agreement[fld] = {"n": len(shared), "agree": agree,
                          "rate": round(agree / len(shared), 4) if shared else None}
    arrow_yes = sorted(i for i in shared if base[i].get("arrow_tapaway") == "yes"
                       or rep[i].get("arrow_tapaway") == "yes")
    arrow_details = [
        {"app_id": i, "main": base[i].get("arrow_tapaway"),
         "repeat": rep[i].get("arrow_tapaway"),
         "main_mechanic": base[i].get("primary_mechanic"),
         "repeat_mechanic": rep[i].get("primary_mechanic")} for i in arrow_yes
    ]
    mech_ok = (agreement["primary_mechanic"]["rate"] or 0) >= 0.90
    arrow_ok = (agreement["arrow_tapaway"]["rate"] or 0) >= 0.95
    quality = {
        "sample_n": len(shared),
        "agreement": agreement,
        "thresholds": {"primary_mechanic_min": 0.90, "arrow_tapaway_min": 0.95},
        "thresholds_pass": bool(mech_ok and arrow_ok),
        "arrow_tapaway_yes_review": arrow_details,
        "repeat_source": str(args.repeat),
    }
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with args.out.open("w", encoding="utf-8") as f:
            json.dump(quality, f, ensure_ascii=False, indent=2)
        print(f"wrote {args.out}")
    print(json.dumps(quality, ensure_ascii=False, indent=2))
    print("QUALITY:", "PASS" if quality["thresholds_pass"] else "FAIL")
    return 0 if quality["thresholds_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
