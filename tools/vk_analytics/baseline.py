"""Run analysis.sql against the local DuckDB and write market-baseline.json."""

from __future__ import annotations

import json
import re
from decimal import Decimal
from pathlib import Path

from .build import connect

SQL_FILE = Path(__file__).with_name("analysis.sql")


def split_sql(text: str) -> tuple[str, list[tuple[str, str]]]:
    parts = re.split(r"^-- name: *(\S+) *$", text, flags=re.M)
    preamble, rest = parts[0], parts[1:]
    return preamble, [(rest[i], rest[i + 1].strip()) for i in range(0, len(rest), 2)]


def _jsonable(v):
    if isinstance(v, Decimal):
        return float(v)
    return v


def run_queries(con) -> dict:
    preamble, queries = split_sql(SQL_FILE.read_text(encoding="utf-8"))
    con.execute(preamble)
    out = {}
    for name, sql in queries:
        rel = con.sql(sql)
        cols = rel.columns
        out[name] = [dict(zip(cols, map(_jsonable, row))) for row in rel.fetchall()]
    return out


def run(out: Path) -> int:
    con = connect()
    result = {
        "_note": ("EXP-002 baseline from snapshot 2026-09-16. members_count is not MAU. "
                  "Ranks are best (lowest) rank per app per sort; deep popular/popular_today ranks are approximate. "
                  "age_days is counted from the snapshot capture time."),
        **run_queries(con),
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {out} ({len(result) - 1} queries)")
    return 0
