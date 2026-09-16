# VK market snapshot — schema

Collector: `tools/vk_market/` (`python -m tools.vk_market --help`). API version is recorded per run in `manifest.json` and in `summary.json`.

## Commands

```text
python -m tools.vk_market probe                                 # small safe probes (page size, tail, batch vs single)
python -m tools.vk_market collect [--run-dir DIR]               # discovery (6 sorts) + apps.get details, resumable
        [--max-pages N] [--skip-details] [--max-requests N]     # small run / simulated interruption (exit code 3)
        [--genre-pass]                                          # count=1 probe per genre_id; paginate only if it filters
python -m tools.vk_market snapshot --run-dir DIR [--date D] [--out-dir O]
python -m tools.vk_market verify   --run-dir DIR --snapshot-dir O
python -m tools.vk_market calibrate --run-dir DIR               # -> research/vk-market/metric-calibration.csv
python -m tools.vk_market scan PATH...                          # secret scan + git diff/status
```

Exit codes: `0` ok, `1` fatal (auth, captcha, repeated rate limit, network/5xx after retries, non-terminating pagination) or failed check, `3` interrupted (resume with the same `--run-dir`).

## Collector guarantees

- Token only from `VK_SERVICE_TOKEN` (the repo-root `.env` is loaded into the environment if the variable is unset); sent only as `Authorization: Bearer`; every envelope/log line is redacted before writing.
- TLS verified via the OS trust store (`truststore`), `certifi` as fallback.
- Rate limiter: at least 1.05 s between request starts, retries included.
- Network errors / HTTP 5xx: up to 2 retries with back-off. VK errors 6/29/32 or HTTP 429: one retry after 30 s, then fatal. VK errors 3/5/8/14/17/28: fatal.
- Checkpoint = one raw file per API response, written atomically (`.tmp` + rename). A sort is finished only when `_complete.json` exists. The `apps.get` id list is frozen in `details-ids.json` so batch numbering is stable across resumes.

## Local artifacts (ignored by Git)

```text
artifacts/vk-market/<UTC_TIMESTAMP>/
  manifest.json                      created_at, api_version, collector_version, rate limit, tls source, invocations[]
  requests.jsonl                     one line per HTTP attempt: captured_at, method, params, http_status, elapsed_ms, error_code
  raw/catalog/<sort>/offset-NNNNNN.json   full apps.getCatalog envelope (count=100, extended=1)
  raw/catalog/<sort>/_complete.json
  details-ids.json                   sorted unique app ids requested from apps.get
  raw/apps/batch-NNNN.json           apps.get app_ids=<≤20 ids>, extended=1 (API limit: >20 ids -> VK error 100)
  raw/apps/single-<app_id>.json      apps.get app_id=<id> for ids missing from a batch response
                                     (in run 20260916T163154Z also 202 singles from the first attempt, see REPORT.md)
  raw/apps-rejected-batch100/        the three rejected 100-id batch responses of that first attempt (kept, not used)
  raw/catalog-genre-probe/<genre_id>.json      apps.getCatalog genre_id=<id> count=1 (reads response.count)
  raw/catalog-genre/<genre_id>/offset-*.json   genre pass pages (only for genres where the filter narrows count)
  raw/catalog-genre-unfiltered-run/            in run 20260916T163154Z: aborted first genre pass (genre_id ignored),
                                               kept as extra create_date passes for coverage evidence only
  genre-pass.json                    probe counts per genre and whether the filter was effective
  export/apps_full.csv               every flattened apps.get field, incl. full description and image URLs
```

Envelope: `captured_at, api_version, method, request.params (incl. v), http_status, elapsed_ms, body` (+ `page` / `batch` / `single` context).

## research/vk-market/snapshots/<UTC_DATE>/rankings.csv

One row per catalog position as returned, per sort. Not deduplicated.

| column | meaning |
|---|---|
| `sort` | `popular_today`, `popular_week`, `visitors`, `growth_rate`, `create_date`, `popular` |
| `rank` | `offset + index + 1` within that sort's pagination |
| `page_index`, `offset` | page number (0-based) and API offset, page size 100 |
| `app_id` | `items[].id` |
| `catalog_position` | `items[].catalog_position` from the same catalog response (`extended=1`); empty if absent |
| `count_reported` | `response.count` of that page |
| `captured_at` | UTC time of the page request |

Pages of one sort are requested ~1 s apart, so a live-changing order can shift between pages: an app can appear twice or be skipped inside one sort. `summary.json` reports this per sort.

## research/vk-market/snapshots/<UTC_DATE>/apps.csv

One row per unique `app_id` found in any sort. Booleans are `1`/`0`; empty = field absent in the response.

| column | source |
|---|---|
| `app_id, title, type, section, genre, genre_id` | `apps.get` item |
| `published_date` | `apps.get` unix time; `published_date_iso` — same in UTC ISO |
| `members_count` | `apps.get`; meaning vs the UI "игроков" label: see `metric-calibration.csv` / `REPORT.md` |
| `catalog_position` | `apps.get` value |
| `international, is_in_catalog` | `apps.get` |
| `author_owner_id, author_url` | `apps.get`; negative owner id = community, positive = user account of the author |
| `official_group_id, official_group_screen_name, official_group_is_closed, official_group_type` | `apps.get groups[]` entry whose `id == -author_owner_id`; empty if there is no such entry |
| `support_url, webview_url, screen_name` | `apps.get` |
| `screen_orientation, mobile_view_support_type, mobile_controls_type, leaderboard_type` | `apps.get` (integer codes as returned, not decoded) |
| `has_vk_connect, hide_tabbar, need_policy_confirmation, mini_apps_web_call_api_form_data, is_new, is_calls_available, is_plugin, is_splash_screen_enabled, is_vkui_internal, is_installed` | `apps.get` flags (`is_new` is present only for part of the apps) |
| `description_len` | length of `apps.get description` (characters) |
| `screenshots_count` | number of `apps.get screenshots[]` |
| `has_icon_576, has_banner_1120` | presence of the image URL (catalog item / `apps.get`) |
| `sorts_seen, sorts_seen_count` | sorts in which the app appeared |
| `rank_<sort>` | best (lowest) rank of the app in that sort; empty if not seen |
| `discovered_via` | `sorts`, `genre_pass_only` or `sorts+genre_pass` (genre pass runs only for genres where `genre_id` narrows the catalog count; in snapshot 2026-09-16 it did not, so every row is `sorts`) |
| `details_status` | `ok` or `missing` (no item in any `apps.get` response) |
| `details_captured_at` | UTC time of the `apps.get` request |

### apps.csv size limit

Full description text and image URLs (icons, banners, one URL per screenshot) would make `apps.csv` several times larger than the 5 MB commit limit of BUILD-001. They are kept only in the local `export/apps_full.csv` and the raw JSON; the committed file carries `description_len`, `screenshots_count` and presence flags instead. See `REPORT.md` → limitations.

## research/vk-market/snapshots/<UTC_DATE>/summary.json

- `discovery.sorts.<sort>`: `complete, pages, rows, unique_app_ids, duplicate_rows, duplicated_app_ids, count_reported_values, short_non_final_pages, rows_with_catalog_position, first/last_captured_at`
- `discovery`: union size, per-sort unique counts, ids only in one sort, ids in all sorts, max reported count, `genre_id_probe`, `repeat_pages_unfiltered_genre_param` (coverage evidence)
- `details`: requested/returned/missing ids, batch vs single sources, VK errors, field presence counts, MAU-like fields found, official group resolution, `members_count` and `catalog_position` distributions, published date range, type/section/genre counts

## research/vk-market/metric-calibration.csv

| column | meaning |
|---|---|
| `app_id, title` | app; `mapping` = `card_link_app_id` or `exact_unique_title` |
| `ui_block, ui_label` | block on https://vk.ru/games and the label as displayed (`750K`, `18M`) |
| `ui_value, ui_lower, ui_upper` | parsed label and accepted interval `[v − unit/2, v + unit)` (covers floor and round-half) |
| `members_count` | `apps.get` value from the snapshot run |
| `ratio_members_to_ui` | `members_count / ui_value` |
| `members_within_ui_rounding` | `1` if `ui_lower ≤ members_count < ui_upper` |
| `ui_captured_at, api_captured_at` | UTC times of the two observations |

No user-level data (member lists, names, demographics) is collected in BUILD-001.
