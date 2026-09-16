"""Build labeling-corpus.csv for EXP-004.

Union with dedupe by app_id (deterministic, fixed seeds):
  A. all unique apps from the 10 REQUIRED candidate buckets of EXP-002
  B. top 200 growth_rate
  C. top 200 popular_today
  D. top 100 popular_week
  E. 100 largest members_count among puzzle-like (genre in Puzzle/Three in a row),
     published within the last 365 days (age_days <= 365)
  F. control: 200 random apps outside the A-E union, stratified
     100 puzzle-like + 100 other genres, seed CONTROL_SEED.

Puzzle-like definition = EXP-002 PUZZLE_GENRES (genre in Puzzle/Three in a row).

Output: research/vk-market/labeling/labeling-corpus.csv with columns
  app_id, source  (source = |-separated inclusion tags, no descriptions)
"""

from __future__ import annotations

import csv
import random
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
CANDIDATE_SET = ROOT / "research/vk-market/analysis/candidate-set.csv"
SNAPSHOT_DIR = ROOT / "research/vk-market/snapshots/2026-09-16"
OUT = ROOT / "research/vk-market/labeling/labeling-corpus.csv"
DB = ROOT / "artifacts/vk-analytics/magic-arrow.duckdb"

REQUIRED_BUCKETS = [
    "arrow_tapaway", "sort", "screw", "bubble", "merge", "match3",
    "puzzle_combat_roguelite", "magic_fantasy_puzzle",
    "romance_love_puzzle", "treasure_adventure_puzzle",
]
PUZZLE_GENRES = ("Puzzle", "Three in a row")
CONTROL_SEED = 42
CHUNK_NOTE = "union A-E + stratified control; deterministic"


def load_required_ids() -> set[str]:
    ids: set[str] = set()
    with CANDIDATE_SET.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row["bucket"] in REQUIRED_BUCKETS:
                ids.add(row["app_id"])
    return ids


def main() -> int:
    if not CANDIDATE_SET.exists():
        raise SystemExit(f"missing input: {CANDIDATE_SET}")
    if not DB.exists():
        raise SystemExit(f"missing DB: {DB} (run python -m tools.vk_analytics build)")

    required_ids = load_required_ids()

    con = duckdb.connect(str(DB), read_only=True)
    con.execute("SET TimeZone = 'UTC'")

    def top_ids(sort: str, n: int) -> set[str]:
        rows = con.sql(
            f"SELECT app_id FROM apps WHERE rank_{sort} IS NOT NULL "
            f"ORDER BY rank_{sort} ASC LIMIT {n}"
        ).fetchall()
        return {str(r[0]) for r in rows}

    growth200 = top_ids("growth_rate", 200)
    today200 = top_ids("popular_today", 200)
    week100 = top_ids("popular_week", 100)

    fresh_rows = con.sql(
        "SELECT app_id FROM apps_x "
        "WHERE age_days <= 365 AND genre IN ('Puzzle', 'Three in a row') "
        "ORDER BY members_count DESC LIMIT 100"
    ).fetchall()
    fresh100 = {str(r[0]) for r in fresh_rows}

    union = required_ids | growth200 | today200 | week100 | fresh100

    all_ids = [str(r[0]) for r in con.sql("SELECT app_id FROM apps").fetchall()]
    genre_of = {
        str(r[0]): r[1] for r in con.sql("SELECT app_id, genre FROM apps").fetchall()
    }
    pool_puzzle = sorted(
        i for i in all_ids if i not in union and genre_of.get(i) in PUZZLE_GENRES
    )
    pool_other = sorted(
        i for i in all_ids if i not in union and genre_of.get(i) not in PUZZLE_GENRES
    )
    rng = random.Random(CONTROL_SEED)
    control_puzzle = rng.sample(pool_puzzle, min(100, len(pool_puzzle)))
    control_other = rng.sample(pool_other, min(100, len(pool_other)))
    con.close()

    sources: dict[str, list[str]] = {}

    def tag(ids: set[str] | list[str], name: str) -> None:
        for i in ids:
            sources.setdefault(str(i), []).append(name)

    tag(required_ids, "src_candidate_required")
    tag(growth200, "src_growth200")
    tag(today200, "src_today200")
    tag(week100, "src_week100")
    tag(fresh100, "src_fresh_puzzle100")
    tag(control_puzzle, "control_puzzle")
    tag(control_other, "control_other")

    rows = [
        {"app_id": app_id, "source": "|".join(sorted(s))}
        for app_id, s in sorted(sources.items(), key=lambda kv: int(kv[0]))
    ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["app_id", "source"], lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    tmp.replace(OUT)

    n_control = len(control_puzzle) + len(control_other)
    print(f"wrote {OUT}: {len(rows)} unique apps")
    print(f"  required_buckets_unique={len(required_ids)}")
    print(f"  growth200={len(growth200)} today200={len(today200)} week100={len(week100)}")
    print(f"  fresh_puzzle100={len(fresh100)}")
    print(f"  union_A_E={len(union)} control={n_control} "
          f"(puzzle={len(control_puzzle)}, other={len(control_other)}, seed={CONTROL_SEED})")
    print(f"  note: {CHUNK_NOTE}")
    if len(rows) > 2000:
        print("WARNING: corpus > 2k, task says stop and record reason in FOUND")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
