"""Rebuild artifacts/vk-analytics/magic-arrow.duckdb (+ parquet) from the snapshot CSVs.

Inputs are read-only: committed snapshot apps.csv / rankings.csv and the local apps_full.csv.
The database is dropped and recreated on every run, so the result depends only on the inputs.
"""

from __future__ import annotations

import time
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SNAPSHOT = ROOT / "research/vk-market/snapshots/2026-09-16"
DEFAULT_FULL_CSV = ROOT / "artifacts/vk-market/20260916T163154Z/export/apps_full.csv"
DEFAULT_OUT = ROOT / "artifacts/vk-analytics"
DB_NAME = "magic-arrow.duckdb"

EXPECTED_ROWS = {"apps": 4985, "rankings": 29852}

SORTS = ("popular_today", "popular_week", "visitors", "growth_rate", "create_date", "popular")


def _p(path: Path) -> str:
    return path.as_posix().replace("'", "''")


def connect(out_dir: Path = DEFAULT_OUT, read_only: bool = True) -> duckdb.DuckDBPyConnection:
    db = out_dir / DB_NAME
    if not db.exists():
        raise SystemExit(f"{db} not found: run `python -m tools.vk_analytics build` first")
    con = duckdb.connect(str(db), read_only=read_only)
    con.execute("SET TimeZone = 'UTC'")
    return con


def build(snapshot_dir: Path = DEFAULT_SNAPSHOT, full_csv: Path = DEFAULT_FULL_CSV,
          out_dir: Path = DEFAULT_OUT) -> dict:
    apps_csv, rankings_csv = snapshot_dir / "apps.csv", snapshot_dir / "rankings.csv"
    for f in (apps_csv, rankings_csv, full_csv):
        if not f.exists():
            raise SystemExit(f"missing input: {f}")

    out_dir.mkdir(parents=True, exist_ok=True)
    pq_dir = out_dir / "parquet"
    pq_dir.mkdir(exist_ok=True)
    db = out_dir / DB_NAME
    for stale in (db, db.with_name(DB_NAME + ".wal")):
        stale.unlink(missing_ok=True)

    t0 = time.perf_counter()
    con = duckdb.connect(str(db))
    con.execute("SET TimeZone = 'UTC'")  # to_timestamp/TIMESTAMPTZ casts must not depend on the machine zone
    # all_varchar + explicit casts: types do not depend on DuckDB sniffing heuristics.
    con.execute(f"""
        CREATE TABLE apps_raw AS
        SELECT * FROM read_csv('{_p(apps_csv)}', header=true, all_varchar=true)
    """)
    rank_cols = ",\n".join(f"TRY_CAST(rank_{s} AS INTEGER) AS rank_{s}" for s in SORTS)
    con.execute(f"""
        CREATE TABLE apps AS
        SELECT
            CAST(app_id AS BIGINT) AS app_id,
            title, type, section, genre,
            CAST(genre_id AS INTEGER) AS genre_id,
            CAST(published_date AS BIGINT) AS published_date,
            CAST(to_timestamp(CAST(published_date AS BIGINT)) AS TIMESTAMP) AS published_at,
            CAST(members_count AS BIGINT) AS members_count,
            TRY_CAST(catalog_position AS INTEGER) AS catalog_position,
            CAST(author_owner_id AS BIGINT) AS author_owner_id,
            TRY_CAST(official_group_id AS BIGINT) AS official_group_id,
            official_group_type,
            TRY_CAST(official_group_is_closed AS INTEGER) AS official_group_is_closed,
            TRY_CAST(screen_orientation AS INTEGER) AS screen_orientation,
            TRY_CAST(is_new AS INTEGER) AS is_new,
            CAST(description_len AS INTEGER) AS description_len,
            TRY_CAST(screenshots_count AS INTEGER) AS screenshots_count,
            sorts_seen,
            CAST(sorts_seen_count AS INTEGER) AS sorts_seen_count,
            {rank_cols},
            details_status,
            CAST(CAST(details_captured_at AS TIMESTAMPTZ) AT TIME ZONE 'UTC' AS TIMESTAMP) AS details_captured_at
        FROM apps_raw
    """)
    con.execute("DROP TABLE apps_raw")
    con.execute(f"""
        CREATE TABLE rankings AS
        SELECT sort,
               CAST(rank AS INTEGER) AS rank,
               CAST(page_index AS INTEGER) AS page_index,
               CAST("offset" AS INTEGER) AS "offset",
               CAST(app_id AS BIGINT) AS app_id,
               TRY_CAST(catalog_position AS INTEGER) AS catalog_position,
               CAST(count_reported AS INTEGER) AS count_reported,
               CAST(CAST(captured_at AS TIMESTAMPTZ) AT TIME ZONE 'UTC' AS TIMESTAMP) AS captured_at
        FROM read_csv('{_p(rankings_csv)}', header=true, all_varchar=true)
    """)
    # Only the text columns missing from the committed snapshot; everything else comes from apps.csv.
    con.execute(f"""
        CREATE TABLE app_text AS
        SELECT CAST(app_id AS BIGINT) AS app_id,
               title AS full_title,
               coalesce(description, '') AS description,
               official_group_name,
               screenshot_urls
        FROM read_csv('{_p(full_csv)}', header=true, all_varchar=true)
    """)
    # Reference "now" = latest apps.get capture in the snapshot, not the wall clock.
    con.execute("""
        CREATE TABLE meta AS
        SELECT max(details_captured_at) AS snapshot_ref_ts FROM apps
    """)
    con.execute("""
        CREATE VIEW apps_x AS
        SELECT a.*, t.description, t.official_group_name,
               date_diff('day', a.published_at, m.snapshot_ref_ts) AS age_days,
               a.author_owner_id < 0 AS has_official_community
        FROM apps a
        JOIN app_text t USING (app_id)
        CROSS JOIN meta m
    """)
    build_s = time.perf_counter() - t0

    checks = {
        "apps_rows": con.sql("SELECT count(*) FROM apps").fetchone()[0],
        "apps_unique_ids": con.sql("SELECT count(DISTINCT app_id) FROM apps").fetchone()[0],
        "rankings_rows": con.sql("SELECT count(*) FROM rankings").fetchone()[0],
        "app_text_rows": con.sql("SELECT count(*) FROM app_text").fetchone()[0],
        "text_ids_not_in_apps": con.sql(
            "SELECT count(*) FROM app_text t ANTI JOIN apps a USING (app_id)").fetchone()[0],
        "apps_ids_without_text": con.sql(
            "SELECT count(*) FROM apps a ANTI JOIN app_text t USING (app_id)").fetchone()[0],
        "title_mismatch_full_vs_snapshot": con.sql(
            "SELECT count(*) FROM apps a JOIN app_text t USING (app_id) WHERE a.title IS DISTINCT FROM t.full_title"
        ).fetchone()[0],
        "ranking_ids_not_in_apps": con.sql(
            "SELECT count(*) FROM rankings r ANTI JOIN apps a USING (app_id)").fetchone()[0],
    }
    ok = (checks["apps_rows"] == EXPECTED_ROWS["apps"] == checks["apps_unique_ids"] == checks["app_text_rows"]
          and checks["rankings_rows"] == EXPECTED_ROWS["rankings"]
          and checks["text_ids_not_in_apps"] == checks["apps_ids_without_text"] == 0
          and checks["title_mismatch_full_vs_snapshot"] == 0
          and checks["ranking_ids_not_in_apps"] == 0)

    for table in ("apps", "rankings", "app_text"):
        con.execute(f"COPY {table} TO '{_p(pq_dir / (table + '.parquet'))}' (FORMAT parquet, COMPRESSION zstd)")
    # Like-for-like size comparison: every CSV column, auto-detected types.
    for name, src in (("same_columns_apps_snapshot", apps_csv), ("same_columns_rankings", rankings_csv),
                      ("same_columns_apps_full", full_csv)):
        con.execute(f"COPY (SELECT * FROM read_csv_auto('{_p(src)}')) "
                    f"TO '{_p(pq_dir / (name + '.parquet'))}' (FORMAT parquet, COMPRESSION zstd)")
    con.execute("CHECKPOINT")
    con.close()

    def mb(p: Path) -> float:
        return round(p.stat().st_size / 1_000_000, 3)

    sizes = {
        "csv_apps_snapshot_mb": mb(apps_csv),
        "csv_rankings_mb": mb(rankings_csv),
        "csv_apps_full_mb": mb(full_csv),
        "parquet_apps_mb": mb(pq_dir / "apps.parquet"),
        "parquet_rankings_mb": mb(pq_dir / "rankings.parquet"),
        "parquet_app_text_mb": mb(pq_dir / "app_text.parquet"),
        "duckdb_file_mb": mb(db),
        "parquet_same_columns_apps_snapshot_mb": mb(pq_dir / "same_columns_apps_snapshot.parquet"),
        "parquet_same_columns_rankings_mb": mb(pq_dir / "same_columns_rankings.parquet"),
        "parquet_same_columns_apps_full_mb": mb(pq_dir / "same_columns_apps_full.parquet"),
    }
    sizes["csv_total_mb"] = round(sizes["csv_apps_snapshot_mb"] + sizes["csv_rankings_mb"] + sizes["csv_apps_full_mb"], 3)
    sizes["parquet_total_mb"] = round(sizes["parquet_apps_mb"] + sizes["parquet_rankings_mb"] + sizes["parquet_app_text_mb"], 3)
    return {"ok": ok, "checks": checks, "sizes": sizes, "build_seconds": round(build_s, 2),
            "timing": _timing(apps_csv, full_csv, pq_dir)}


def _timing(apps_csv: Path, full_csv: Path, pq_dir: Path) -> dict:
    """Same text-search query straight over CSV vs over parquet (fresh in-memory connection, best of 3)."""
    q = "SELECT count(*) FROM {src} WHERE regexp_matches(lower(coalesce(description, '')), 'сортир|стрел')"
    srcs = {
        "apps_full_csv": f"read_csv('{_p(full_csv)}', header=true, all_varchar=true)",
        "app_text_parquet": f"read_parquet('{_p(pq_dir / 'app_text.parquet')}')",
    }
    out = {}
    con = duckdb.connect()
    for name, src in srcs.items():
        runs = []
        for _ in range(3):
            t = time.perf_counter()
            con.sql(q.format(src=src)).fetchall()
            runs.append(time.perf_counter() - t)
        out[name + "_ms"] = round(min(runs) * 1000, 1)
    return out
