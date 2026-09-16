"""python -m tools.vk_analytics {build,baseline,candidates,audit}"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import build as b


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m tools.vk_analytics")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("build", help="recreate DuckDB + parquet from snapshot CSVs and apps_full.csv")
    p.add_argument("--snapshot-dir", type=Path, default=b.DEFAULT_SNAPSHOT)
    p.add_argument("--full-csv", type=Path, default=b.DEFAULT_FULL_CSV)
    p.add_argument("--out-dir", type=Path, default=b.DEFAULT_OUT)

    p = sub.add_parser("baseline", help="run analysis.sql, write market-baseline.json")
    p.add_argument("--out", type=Path, default=b.ROOT / "research/vk-market/analysis/market-baseline.json")

    p = sub.add_parser("candidates", help="keyword/genre retrieval, write candidate-set.csv")
    p.add_argument("--out", type=Path, default=b.ROOT / "research/vk-market/analysis/candidate-set.csv")

    p = sub.add_parser("audit", help="print seeded positive/negative samples for manual recall/precision audit")
    p.add_argument("--seed", type=int, default=2)
    p.add_argument("--neg", type=int, default=150)
    p.add_argument("--pos-per-bucket", type=int, default=8)
    p.add_argument("--out", type=Path, default=None, help="write the sample as CSV (for manual labels)")

    args = ap.parse_args(argv)
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")

    if args.cmd == "build":
        res = b.build(args.snapshot_dir, args.full_csv, args.out_dir)
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return 0 if res["ok"] else 1
    if args.cmd == "baseline":
        from .baseline import run
        return run(args.out)
    if args.cmd == "candidates":
        from .candidates import run
        return run(args.out)
    if args.cmd == "audit":
        from .candidates import audit
        return audit(args.seed, args.neg, args.pos_per_bucket, args.out)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
