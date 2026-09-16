"""Join labels back to VK data via DuckDB and build EXP-004 analytics outputs.

Reads:
  research/vk-market/labeling/muse-labels.csv
  research/vk-market/labeling/labeling-corpus.csv
  artifacts/vk-analytics/magic-arrow.duckdb (apps_x view)

Writes:
  research/vk-market/labeling/magic-arrow-neighbors.csv
  research/vk-market/labeling/mechanic-market.csv

Overlap definition (documented in EXP-004-REPORT.md): count of `yes` over the
16 Magic Arrow feature columns (arrow_tapaway + 15 projectile/target/run
flags). Neighbors = overlap >= 2.
"""

from __future__ import annotations

import csv
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
LABELS = ROOT / "research/vk-market/labeling/muse-labels.csv"
NEIGHBORS = ROOT / "research/vk-market/labeling/magic-arrow-neighbors.csv"
MECHANIC_CSV = ROOT / "research/vk-market/labeling/mechanic-market.csv"
DB = ROOT / "artifacts/vk-analytics/magic-arrow.duckdb"

FEATURES = ["arrow_tapaway", "projectile_continues_outside_board",
            "external_targets", "external_mobs_or_enemies", "bosses",
            "direction_is_resource", "board_rotation_or_direction_change",
            "temporary_targets_or_move_windows", "run_upgrades",
            "choose_one_of_three", "projectile_modifiers", "ricochet", "pierce",
            "split_or_multishot", "chain_or_bounce", "elemental_effects"]


def main() -> int:
    con = duckdb.connect(str(DB), read_only=True)
    con.execute("SET TimeZone = 'UTC'")
    con.execute(
        "CREATE OR REPLACE TEMP VIEW labels AS "
        f"SELECT * FROM read_csv('{LABELS.as_posix()}', header=true, all_varchar=true)"
    )
    overlap_expr = " + ".join(
        f"(CASE WHEN l.{c} = 'yes' THEN 1 ELSE 0 END)" for c in FEATURES
    )
    neighbors_rel = con.sql(f"""
        SELECT CAST(l.app_id AS BIGINT) AS app_id, a.title, a.genre,
               CAST(a.members_count AS BIGINT) AS members_count,
               CAST(a.published_at AS DATE) AS published,
               a.age_days, l.primary_mechanic, l.primary_theme,
               l.combat, l.roguelite,
               ({overlap_expr}) AS overlap,
               {", ".join("l." + c for c in FEATURES)}
        FROM labels l JOIN apps_x a ON CAST(l.app_id AS BIGINT) = a.app_id
        WHERE ({overlap_expr}) >= 2
        ORDER BY overlap DESC, a.members_count DESC
    """)
    cols = neighbors_rel.columns
    neighbors = neighbors_rel.fetchall()
    with NEIGHBORS.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(cols)
        w.writerows(neighbors)
    print(f"wrote {NEIGHBORS}: {len(neighbors)} rows")

    stats_rel = con.sql("""
        WITH j AS (
          SELECT l.primary_mechanic AS mechanic, a.members_count,
                 a.age_days, a.rank_growth_rate, a.rank_popular_today,
                 a.rank_popular_week
          FROM labels l JOIN apps_x a
            ON CAST(l.app_id AS BIGINT) = a.app_id
        )
        SELECT mechanic,
               count(*) AS n,
               CAST(median(members_count) AS BIGINT) AS median_members,
               CAST(quantile_disc(members_count, 0.75) AS BIGINT) AS p75_members,
               CAST(quantile_disc(members_count, 0.90) AS BIGINT) AS p90_members,
               SUM(CASE WHEN age_days <= 365 THEN 1 ELSE 0 END) AS n_fresh_365,
               CAST(median(CASE WHEN age_days <= 365 THEN members_count END) AS BIGINT)
                 AS fresh_median_members,
               CAST(quantile_disc(CASE WHEN age_days <= 365 THEN members_count END, 0.90) AS BIGINT)
                 AS fresh_p90_members,
               SUM(CASE WHEN age_days <= 365 AND members_count >= 50000 THEN 1 ELSE 0 END)
                 AS fresh_ge_50k,
               SUM(CASE WHEN age_days <= 365 AND members_count >= 100000 THEN 1 ELSE 0 END)
                 AS fresh_ge_100k,
               SUM(CASE WHEN rank_growth_rate <= 100 THEN 1 ELSE 0 END) AS in_growth_top100,
               SUM(CASE WHEN rank_growth_rate <= 200 THEN 1 ELSE 0 END) AS in_growth_top200,
               SUM(CASE WHEN rank_popular_today <= 100 THEN 1 ELSE 0 END) AS in_today_top100,
               SUM(CASE WHEN rank_popular_today <= 200 THEN 1 ELSE 0 END) AS in_today_top200
        FROM j GROUP BY 1 ORDER BY n DESC
    """)
    mcols = stats_rel.columns
    stats = stats_rel.fetchall()
    with MECHANIC_CSV.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(mcols)
        w.writerows(stats)
    print(f"wrote {MECHANIC_CSV}: {len(stats)} mechanics")
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
