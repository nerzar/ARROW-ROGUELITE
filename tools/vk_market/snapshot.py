"""Build snapshot files from the raw artifacts of one run (no API calls).

Commit-ready (research/vk-market/snapshots/<UTC_DATE>/):
  rankings.csv  one row per (sort, rank) as returned by apps.getCatalog
  apps.csv      one row per unique app_id: apps.get metadata + discovery aggregates
  summary.json  coverage, counts, duplicates, missing ids, field presence, errors

Local only (artifacts/vk-market/<run>/export/):
  apps_full.csv every flattened apps.get field incl. full description and all image URLs
"""

import collections
import csv
import datetime as dt
import json
import os
import statistics

from .client import REPO_ROOT, read_json, write_json_atomic
from .details import iter_details, ids_path
from .discover import SORTS, complete_path, iter_genre_pages, iter_pages

# Columns of the commit-ready apps.csv. Long text and image URL lists stay in the local export
# (see research/vk-market/schema.md, "apps.csv size limit").
APPS_COLUMNS = [
    "app_id", "title", "type", "section", "genre", "genre_id", "published_date", "published_date_iso",
    "members_count", "catalog_position", "international", "is_in_catalog",
    "author_owner_id", "author_url", "official_group_id", "official_group_screen_name", "official_group_is_closed",
    "official_group_type", "support_url", "webview_url", "screen_name",
    "screen_orientation", "mobile_view_support_type", "mobile_controls_type", "leaderboard_type",
    "has_vk_connect", "hide_tabbar", "need_policy_confirmation", "mini_apps_web_call_api_form_data",
    "is_new", "is_calls_available", "is_plugin", "is_splash_screen_enabled", "is_vkui_internal", "is_installed",
    "description_len", "screenshots_count", "has_icon_576", "has_banner_1120",
    "sorts_seen", "sorts_seen_count",
] + [f"rank_{s}" for s in SORTS] + ["discovered_via", "details_status", "details_captured_at"]

RANKING_COLUMNS = ["sort", "rank", "page_index", "offset", "app_id", "catalog_position", "count_reported", "captured_at"]


def _iso(ts):
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if isinstance(ts, int) and ts > 0 else ""


def _largest_url(sizes):
    sizes = [s for s in sizes or [] if s.get("url")]
    return max(sizes, key=lambda s: (s.get("width") or 0) * (s.get("height") or 0))["url"] if sizes else ""


def official_group(item, groups_by_id):
    owner = item.get("author_owner_id")
    if isinstance(owner, int) and owner < 0 and -owner in groups_by_id:
        return groups_by_id[-owner]
    return None


def _cell(v):
    if isinstance(v, bool):
        return int(v)
    if v is None:
        return ""
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return v


def _write_csv(path, columns, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({c: _cell(r.get(c)) for c in columns})


def _stats(values):
    values = sorted(v for v in values if isinstance(v, (int, float)) and not isinstance(v, bool))
    if not values:
        return None
    q = lambda p: values[min(len(values) - 1, int(round(p * (len(values) - 1))))]
    return {"n": len(values), "min": values[0], "p25": q(0.25), "median": statistics.median(values),
            "p75": q(0.75), "p90": q(0.9), "max": values[-1], "zeros": sum(1 for v in values if v == 0)}


def _unfiltered_coverage(run_dir, sort_ids):
    """Pages of the first genre pass attempt (raw/catalog-genre-unfiltered-run): genre_id did not filter,
    so they are extra create_date passes. Used only as coverage evidence, not in rankings/apps."""
    per, ids, captured = collections.defaultdict(lambda: {"pages": 0, "rows": 0, "counts": set(), "item_genres": set()}), set(), []
    for gid, _, env in iter_genre_pages(run_dir, "catalog-genre-unfiltered-run"):
        resp = env["body"]["response"]
        p = per[gid]
        p["pages"] += 1
        p["rows"] += len(resp.get("items", []))
        p["counts"].add(resp.get("count"))
        captured.append(env["captured_at"])
        for it in resp.get("items", []):
            ids.add(it["id"])
            p["item_genres"].add(it.get("genre_id"))
    if not per:
        return None
    return {
        "sort": "create_date",
        "captured_from": min(captured), "captured_to": max(captured),
        "by_genre_id_param": {str(g): {"pages": v["pages"], "rows": v["rows"], "count_reported": sorted(v["counts"]),
                                       "distinct_item_genre_ids": len(v["item_genres"])} for g, v in sorted(per.items())},
        "unique_app_ids": len(ids),
        "app_ids_not_in_six_sorts": len(ids - sort_ids),
    }


def build(run_dir, snapshot_date=None, out_dir=None):
    manifest = read_json(os.path.join(run_dir, "manifest.json"))
    # ---------------- rankings
    rankings, per_sort = [], {}
    catalog_items = {}  # app_id -> first catalog item seen (for icon_576/banner presence)
    captured = []
    for sort, offset, env in iter_pages(run_dir):
        resp = env["body"]["response"]
        items = resp.get("items", [])
        captured.append(env["captured_at"])
        s = per_sort.setdefault(sort, {"pages": 0, "rows": 0, "ids": [], "counts_reported": set(),
                                       "short_pages": [], "catalog_position_present": 0,
                                       "first_captured_at": env["captured_at"], "last_captured_at": env["captured_at"]})
        s["pages"] += 1
        s["rows"] += len(items)
        s["counts_reported"].add(resp.get("count"))
        s["last_captured_at"] = max(s["last_captured_at"], env["captured_at"])
        s["first_captured_at"] = min(s["first_captured_at"], env["captured_at"])
        is_last = offset + 100 >= resp.get("count", 0)
        if len(items) < 100 and not is_last:
            s["short_pages"].append({"offset": offset, "items": len(items)})
        for i, it in enumerate(items):
            s["ids"].append(it["id"])
            if "catalog_position" in it:
                s["catalog_position_present"] += 1
            catalog_items.setdefault(it["id"], it)
            rankings.append({"sort": sort, "rank": offset + i + 1, "page_index": offset // 100, "offset": offset,
                             "app_id": it["id"], "catalog_position": it.get("catalog_position"),
                             "count_reported": resp.get("count"), "captured_at": env["captured_at"]})
    best_rank = collections.defaultdict(dict)
    for r in rankings:
        prev = best_rank[r["app_id"]].get(r["sort"])
        best_rank[r["app_id"]][r["sort"]] = r["rank"] if prev is None else min(prev, r["rank"])
    sort_ids = set(best_rank)

    # ---------------- genre pass (coverage supplement, not part of rankings.csv)
    genre_rank, genre_rows = {}, collections.Counter()
    for gid, offset, env in iter_genre_pages(run_dir):
        for i, it in enumerate(env["body"]["response"].get("items", [])):
            genre_rows[gid] += 1
            catalog_items.setdefault(it["id"], it)
            if it["id"] not in genre_rank or offset + i + 1 < genre_rank[it["id"]][1]:
                genre_rank[it["id"]] = (gid, offset + i + 1)
    union_ids = sorted(sort_ids | set(genre_rank))

    # ---------------- details
    details, groups_by_id, detail_errors, sources = {}, {}, [], collections.Counter()
    for name, env in iter_details(run_dir):
        body = env["body"]
        if "error" in body:
            detail_errors.append({"file": name, "error_code": body["error"].get("error_code"),
                                  "error_msg": body["error"].get("error_msg")})
            continue
        resp = body.get("response", {})
        for g in resp.get("groups") or []:
            groups_by_id[g["id"]] = g
        for it in resp.get("items", []):
            if it["id"] not in details:
                details[it["id"]] = (it, env["captured_at"])
                sources["batch" if name.startswith("batch-") else "single"] += 1
    requested = read_json(ids_path(run_dir))["ids"] if os.path.exists(ids_path(run_dir)) else union_ids

    # ---------------- apps rows
    field_presence = collections.Counter()
    full_rows, rows = [], []
    for app_id in union_ids:
        row = {"app_id": app_id}
        cat = catalog_items.get(app_id, {})
        if app_id in details:
            it, cap = details[app_id]
            field_presence.update(it.keys())
            g = official_group(it, groups_by_id)
            row.update({k: v for k, v in it.items() if k not in ("id", "screenshots")})
            shots = it.get("screenshots") or []
            row.update({
                "published_date_iso": _iso(it.get("published_date")),
                "official_group_id": g["id"] if g else None,
                "official_group_screen_name": g.get("screen_name") if g else None,
                "official_group_name": g.get("name") if g else None,
                "official_group_is_closed": g.get("is_closed") if g else None,
                "official_group_type": g.get("type") if g else None,
                "description_len": len(it.get("description") or ""),
                "screenshots_count": len(shots),
                "screenshot_urls": " ".join(_largest_url(s.get("sizes")) for s in shots),
                "details_status": "ok",
                "details_captured_at": cap,
            })
        else:
            row["details_status"] = "missing"
            row["title"] = cat.get("title")
        row["icon_576"] = cat.get("icon_576")
        row["icon_16"] = cat.get("icon_16")
        row["has_icon_576"] = bool(cat.get("icon_576"))
        row["has_banner_1120"] = bool(row.get("banner_1120") or cat.get("banner_1120"))
        seen = [s for s in SORTS if s in best_rank[app_id]]
        row["sorts_seen"] = ",".join(seen)
        row["sorts_seen_count"] = len(seen)
        for s in SORTS:
            row[f"rank_{s}"] = best_rank[app_id].get(s)
        in_sorts, in_genre = app_id in sort_ids, app_id in genre_rank
        row["discovered_via"] = "sorts+genre_pass" if in_sorts and in_genre else ("sorts" if in_sorts else "genre_pass_only")
        row["genre_pass_rank"] = genre_rank[app_id][1] if in_genre else None
        full_rows.append(row)
        rows.append(row)

    # ---------------- write
    if snapshot_date is None:
        snapshot_date = min(captured)[:10] if captured else dt.date.today().isoformat()
    out_dir = out_dir or os.path.join(REPO_ROOT, "research", "vk-market", "snapshots", snapshot_date)
    _write_csv(os.path.join(out_dir, "rankings.csv"), RANKING_COLUMNS, rankings)
    _write_csv(os.path.join(out_dir, "apps.csv"), APPS_COLUMNS, rows)
    full_cols = sorted({k for r in full_rows for k in r}, key=lambda c: (c != "app_id", c))
    _write_csv(os.path.join(run_dir, "export", "apps_full.csv"), full_cols, full_rows)

    # ---------------- summary
    sorts_summary = {}
    for sort in SORTS:
        s = per_sort.get(sort)
        if not s:
            sorts_summary[sort] = {"status": "not_collected"}
            continue
        c = collections.Counter(s["ids"])
        sorts_summary[sort] = {
            "complete": os.path.exists(complete_path(run_dir, sort)),
            "pages": s["pages"], "rows": s["rows"], "unique_app_ids": len(c),
            "duplicate_rows": s["rows"] - len(c),
            "duplicated_app_ids": sum(1 for v in c.values() if v > 1),
            "count_reported_values": sorted(x for x in s["counts_reported"] if x is not None),
            "short_non_final_pages": s["short_pages"],
            "rows_with_catalog_position": s["catalog_position_present"],
            "first_captured_at": s["first_captured_at"], "last_captured_at": s["last_captured_at"],
        }
    sort_sets = {s: set(per_sort[s]["ids"]) for s in per_sort}
    missing_details = [i for i in union_ids if i not in details]
    extra_details = sorted(set(details) - set(union_ids))
    apps_with_details = [details[i][0] for i in union_ids if i in details]
    summary = {
        "snapshot_date": snapshot_date,
        "run_id": os.path.basename(run_dir),
        "api_version": manifest.get("api_version"),
        "collector_version": manifest.get("collector_version"),
        "captured_from": min(captured) if captured else None,
        "captured_to": max([*captured, *[c for _, c in details.values()]]) if captured else None,
        "discovery": {
            "sorts": sorts_summary,
            "unique_app_ids_all_sorts": len(sort_ids),
            "unique_app_ids_total_incl_genre_pass": len(union_ids),
            "genre_pass": None if not genre_rank else {
                "sort": "create_date",
                "report": read_json(os.path.join(run_dir, "genre-pass.json"))
                if os.path.exists(os.path.join(run_dir, "genre-pass.json")) else None,
                "rows_per_genre": {str(k): v for k, v in sorted(genre_rows.items())},
                "unique_app_ids": len(genre_rank),
                "app_ids_not_in_any_sort": len(set(genre_rank) - sort_ids),
                "sort_app_ids_not_in_genre_pass": len(sort_ids - set(genre_rank)),
            },
            "genre_id_probe": read_json(os.path.join(run_dir, "genre-pass.json"))
            if os.path.exists(os.path.join(run_dir, "genre-pass.json")) else None,
            "repeat_pages_unfiltered_genre_param": _unfiltered_coverage(run_dir, sort_ids),
            "unique_app_ids_per_sort": {s: len(v) for s, v in sort_sets.items()},
            "app_ids_only_in_one_sort": {s: len(v - set().union(*[o for k, o in sort_sets.items() if k != s]))
                                         for s, v in sort_sets.items()},
            "app_ids_in_all_sorts": len(set.intersection(*sort_sets.values())) if sort_sets else 0,
            "max_count_reported": max((max(v["count_reported_values"] or [0]) for v in sorts_summary.values()
                                       if "count_reported_values" in v), default=None),
        },
        "details": {
            "requested_ids": len(requested),
            "apps_with_details": len(apps_with_details),
            "missing_details": len(missing_details),
            "missing_detail_app_ids": missing_details,
            "details_not_in_discovery": extra_details,
            "source_counts": dict(sources),
            "errors": detail_errors,
            "field_presence": dict(sorted(field_presence.items())),
            "mau_like_fields_present": sorted(k for k in field_presence if "mau" in k.lower()),
            "official_group_resolved": sum(1 for r in rows if r.get("official_group_id")),
            "author_owner_id_negative": sum(1 for a in apps_with_details if isinstance(a.get("author_owner_id"), int)
                                            and a["author_owner_id"] < 0),
            "author_owner_id_positive": sum(1 for a in apps_with_details if isinstance(a.get("author_owner_id"), int)
                                            and a["author_owner_id"] > 0),
            "members_count": _stats([a.get("members_count") for a in apps_with_details]),
            "published_date_range": [
                _iso(min((a["published_date"] for a in apps_with_details if a.get("published_date")), default=0)),
                _iso(max((a["published_date"] for a in apps_with_details if a.get("published_date")), default=0))],
            "type_counts": dict(collections.Counter(a.get("type") for a in apps_with_details).most_common()),
            "section_counts": dict(collections.Counter(a.get("section") for a in apps_with_details).most_common()),
            "genre_counts": dict(collections.Counter(f"{a.get('genre_id')}:{a.get('genre')}" for a in apps_with_details).most_common()),
            "international_true": sum(1 for a in apps_with_details if a.get("international") is True),
            "catalog_position": _stats([a.get("catalog_position") for a in apps_with_details]),
        },
    }
    write_json_atomic(os.path.join(out_dir, "summary.json"), summary)
    sizes = {n: os.path.getsize(os.path.join(out_dir, n)) for n in ("apps.csv", "rankings.csv", "summary.json")}
    print(f"[snapshot] {out_dir}")
    print(json.dumps({"sizes_bytes": sizes, "unique_apps": len(union_ids), "rankings_rows": len(rankings),
                      "apps_with_details": len(apps_with_details), "missing_details": len(missing_details)}, indent=1))
    return out_dir, summary, sizes
