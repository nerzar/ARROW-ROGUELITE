-- EXP-002 market baseline. Runs against artifacts/vk-analytics/magic-arrow.duckdb (tables apps, rankings, app_text, meta; view apps_x).
-- `python -m tools.vk_analytics baseline` executes the preamble, then every `-- name:` block, and writes JSON.
-- Can also be pasted into the duckdb CLI block by block.
-- Caveats kept in every result: members_count is NOT MAU; deep ranks of popular / popular_today are unstable (BUILD-001 REPORT).

-- preamble
CREATE OR REPLACE TEMP VIEW app_rank AS
SELECT app_id, sort, min(rank) AS best_rank
FROM rankings
GROUP BY ALL;

CREATE OR REPLACE TEMP VIEW rank_tiers AS
SELECT * FROM (VALUES (1, 'top10', 10), (2, 'top100', 100), (3, 'top500', 500), (4, 'top1000', 1000), (5, 'all', 1000000)) t(ord, tier, max_rank);

CREATE OR REPLACE TEMP VIEW age_buckets AS
SELECT app_id,
       CASE WHEN age_days <= 30 THEN '0-30d'
            WHEN age_days <= 90 THEN '31-90d'
            WHEN age_days <= 365 THEN '91-365d'
            WHEN age_days <= 365 * 3 THEN '1-3y'
            ELSE '>3y' END AS age_bucket,
       CASE WHEN age_days <= 30 THEN 1 WHEN age_days <= 90 THEN 2 WHEN age_days <= 365 THEN 3
            WHEN age_days <= 365 * 3 THEN 4 ELSE 5 END AS age_ord
FROM apps_x;

-- name: snapshot_meta
SELECT CAST((SELECT snapshot_ref_ts FROM meta) AS VARCHAR) AS snapshot_ref_ts_utc,
       (SELECT count(*) FROM apps) AS apps,
       (SELECT count(*) FROM rankings) AS ranking_rows,
       CAST((SELECT min(published_at) FROM apps) AS VARCHAR) AS published_min,
       CAST((SELECT max(published_at) FROM apps) AS VARCHAR) AS published_max;

-- name: members_overall
SELECT count(*) AS n,
       quantile_disc(members_count, 0.25) AS p25,
       quantile_disc(members_count, 0.5) AS median,
       quantile_disc(members_count, 0.75) AS p75,
       quantile_disc(members_count, 0.9) AS p90,
       quantile_disc(members_count, 0.95) AS p95,
       quantile_disc(members_count, 0.99) AS p99,
       max(members_count) AS max,
       count(*) FILTER (members_count >= 100000) AS n_ge_100k,
       count(*) FILTER (members_count >= 1000000) AS n_ge_1m
FROM apps;

-- name: genre_counts_members
-- genre label is the same for type game/html5_game; both counted together, html5 share shown.
SELECT genre, genre_id,
       count(*) AS n,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS share_pct,
       count(*) FILTER (type = 'html5_game') AS n_html5,
       quantile_disc(members_count, 0.5) AS median_members,
       quantile_disc(members_count, 0.75) AS p75_members,
       quantile_disc(members_count, 0.9) AS p90_members,
       quantile_disc(members_count, 0.95) AS p95_members,
       max(members_count) AS max_members,
       sum(members_count) AS sum_members,
       arg_max(title, members_count) AS max_members_title
FROM apps
GROUP BY ALL
ORDER BY n DESC, genre;

-- name: age_buckets
SELECT b.age_bucket,
       count(*) AS n,
       quantile_disc(a.members_count, 0.5) AS median_members,
       quantile_disc(a.members_count, 0.75) AS p75_members,
       quantile_disc(a.members_count, 0.9) AS p90_members,
       max(a.members_count) AS max_members,
       count(*) FILTER (a.rank_growth_rate <= 100) AS in_growth_top100,
       count(*) FILTER (a.rank_popular_week <= 100) AS in_popular_week_top100,
       count(*) FILTER (a.rank_popular_today <= 100) AS in_popular_today_top100,
       count(*) FILTER (a.rank_popular_week <= 500) AS in_popular_week_top500,
       quantile_disc(a.rank_growth_rate, 0.5) AS median_best_rank_growth,
       quantile_disc(a.rank_popular_week, 0.5) AS median_best_rank_popular_week
FROM apps_x a JOIN age_buckets b USING (app_id)
GROUP BY b.age_bucket, b.age_ord
ORDER BY b.age_ord;

-- name: new_games_by_genre
SELECT genre,
       count(*) FILTER (age_days <= 30) AS new_30d,
       count(*) FILTER (age_days <= 90) AS new_90d,
       count(*) FILTER (age_days <= 365) AS new_365d,
       count(*) AS total,
       round(100.0 * count(*) FILTER (age_days <= 365) / count(*), 1) AS new_365d_pct_of_genre,
       quantile_disc(members_count, 0.5) FILTER (age_days <= 365) AS median_members_new_365d,
       quantile_disc(members_count, 0.9) FILTER (age_days <= 365) AS p90_members_new_365d,
       max(members_count) FILTER (age_days <= 365) AS max_members_new_365d,
       count(*) FILTER (age_days <= 365 AND rank_growth_rate <= 500) AS new_365d_in_growth_top500,
       count(*) FILTER (age_days <= 365 AND rank_popular_week <= 500) AS new_365d_in_popular_week_top500
FROM apps_x
GROUP BY ALL
ORDER BY new_365d DESC, genre;

-- name: new_games_top_members_365d
SELECT title, genre, CAST(published_at AS DATE)::VARCHAR AS published, age_days, members_count,
       rank_growth_rate, rank_popular_week, rank_popular_today
FROM apps_x
WHERE age_days <= 365
ORDER BY members_count DESC, title
LIMIT 30;

-- name: sort_tiers
-- best rank per app per sort. Deep popular/popular_today ranks are approximate.
SELECT r.sort, t.tier,
       count(*) AS apps,
       quantile_disc(a.members_count, 0.5) AS median_members,
       quantile_disc(a.members_count, 0.9) AS p90_members,
       quantile_disc(a.age_days, 0.5) AS median_age_days,
       count(*) FILTER (a.age_days <= 90) AS new_90d,
       count(*) FILTER (a.age_days <= 365) AS new_365d,
       round(100.0 * avg(CASE WHEN a.has_official_community THEN 1 ELSE 0 END), 1) AS official_community_pct
FROM app_rank r
JOIN rank_tiers t ON r.best_rank <= t.max_rank
JOIN apps_x a USING (app_id)
GROUP BY r.sort, t.tier, t.ord
ORDER BY r.sort, t.ord;

-- name: rank_vs_members_spearman_top500
-- Spearman between best rank (1 = top) and members rank (1 = most members) inside top 500; positive = bigger apps rank higher.
WITH x AS (
  SELECT r.sort, r.best_rank, a.members_count,
         rank() OVER (PARTITION BY r.sort ORDER BY a.members_count DESC) AS members_rank
  FROM app_rank r JOIN apps a USING (app_id)
  WHERE r.best_rank <= 500
)
SELECT sort, count(*) AS n, round(corr(best_rank, members_rank), 3) AS spearman_rank_vs_members_rank
FROM x GROUP BY sort ORDER BY sort;

-- name: genre_in_top_sorts
-- lift = share of genre inside top N / share of genre in the whole snapshot.
WITH base AS (
  SELECT genre, count(*) AS n_all, count(*) / sum(count(*)) OVER () AS share_all FROM apps GROUP BY genre
), top AS (
  SELECT r.sort, n.tier, a.genre, count(*) AS n_top
  FROM app_rank r
  JOIN apps a USING (app_id)
  JOIN (VALUES ('top100', 100), ('top500', 500)) n(tier, max_rank) ON r.best_rank <= n.max_rank
  WHERE r.sort IN ('growth_rate', 'popular_week', 'popular_today')
  GROUP BY ALL
)
SELECT t.sort, t.tier, t.genre, t.n_top, b.n_all,
       round(100.0 * t.n_top / sum(t.n_top) OVER (PARTITION BY t.sort, t.tier), 1) AS share_top_pct,
       round(100.0 * b.share_all, 1) AS share_all_pct,
       round((t.n_top / sum(t.n_top) OVER (PARTITION BY t.sort, t.tier)) / b.share_all, 2) AS lift
FROM top t JOIN base b USING (genre)
ORDER BY t.sort, t.tier, t.n_top DESC, t.genre;

-- name: official_community
SELECT 'all' AS slice, count(*) AS n,
       count(*) FILTER (has_official_community) AS with_official_community,
       round(100.0 * count(*) FILTER (has_official_community) / count(*), 1) AS pct,
       count(*) FILTER (official_group_type = 'group') AS group_type_group,
       count(*) FILTER (official_group_type = 'page') AS group_type_page
FROM apps_x
UNION ALL
SELECT 'popular_week_top100', count(*), count(*) FILTER (has_official_community),
       round(100.0 * count(*) FILTER (has_official_community) / count(*), 1),
       count(*) FILTER (official_group_type = 'group'), count(*) FILTER (official_group_type = 'page')
FROM apps_x WHERE rank_popular_week <= 100
UNION ALL
SELECT 'growth_rate_top100', count(*), count(*) FILTER (has_official_community),
       round(100.0 * count(*) FILTER (has_official_community) / count(*), 1),
       count(*) FILTER (official_group_type = 'group'), count(*) FILTER (official_group_type = 'page')
FROM apps_x WHERE rank_growth_rate <= 100
UNION ALL
SELECT 'new_365d', count(*), count(*) FILTER (has_official_community),
       round(100.0 * count(*) FILTER (has_official_community) / count(*), 1),
       count(*) FILTER (official_group_type = 'group'), count(*) FILTER (official_group_type = 'page')
FROM apps_x WHERE age_days <= 365;

-- name: official_community_by_genre
SELECT genre, count(*) AS n,
       round(100.0 * count(*) FILTER (has_official_community) / count(*), 1) AS official_community_pct,
       quantile_disc(members_count, 0.5) FILTER (has_official_community) AS median_members_with,
       quantile_disc(members_count, 0.5) FILTER (NOT has_official_community) AS median_members_without
FROM apps_x GROUP BY genre ORDER BY n DESC, genre;

-- name: rank_instability_duplicates
-- duplicated app_id rows inside one sort, by rank band (evidence that deep ranks are not stable positions).
WITH d AS (
  SELECT sort, rank, app_id, count(*) OVER (PARTITION BY sort, app_id) AS times_in_sort FROM rankings
)
SELECT sort,
       count(*) FILTER (rank <= 1000 AND times_in_sort > 1) AS dup_rows_rank_1_1000,
       count(*) FILTER (rank BETWEEN 1001 AND 2000 AND times_in_sort > 1) AS dup_rows_rank_1001_2000,
       count(*) FILTER (rank > 2000 AND times_in_sort > 1) AS dup_rows_rank_2001_plus
FROM d GROUP BY sort ORDER BY sort;

-- name: top_growth_top30
SELECT rank_growth_rate AS best_rank, title, genre, members_count, CAST(published_at AS DATE)::VARCHAR AS published, age_days
FROM apps_x WHERE rank_growth_rate <= 30 ORDER BY rank_growth_rate;

-- name: top_popular_today_top30
SELECT rank_popular_today AS best_rank, title, genre, members_count, CAST(published_at AS DATE)::VARCHAR AS published, age_days
FROM apps_x WHERE rank_popular_today <= 30 ORDER BY rank_popular_today;
