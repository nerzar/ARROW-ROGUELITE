"""Consistency checks for one run + its built snapshot. Exit code 1 if any hard check fails."""

import collections
import csv
import datetime as dt
import json
import os

from .client import read_json
from .discover import SORTS, complete_path

USER_LEVEL_COLUMNS = {"first_name", "last_name", "bdate", "sex", "city", "country", "user_id", "user_ids",
                      "members", "last_seen", "photo_50", "photo_100", "photo_200"}


def _read_csv(path):
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _parse(ts):
    return dt.datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S.%fZ")


def run(run_dir, snapshot_dir):
    hard, info = [], {}
    rankings = _read_csv(os.path.join(snapshot_dir, "rankings.csv"))
    apps = _read_csv(os.path.join(snapshot_dir, "apps.csv"))

    # rankings: unique (sort, rank); rank = offset + index + 1 must stay inside its page.
    # Pages can be shorter than 100 (API), so ranks are not required to be contiguous; gaps are reported.
    by_sort = collections.defaultdict(list)
    for r in rankings:
        by_sort[r["sort"]].append(int(r["rank"]))
        if not int(r["offset"]) < int(r["rank"]) <= int(r["offset"]) + 100:
            hard.append(f"{r['sort']}: rank {r['rank']} outside page offset {r['offset']}")
    for sort in SORTS:
        ranks = sorted(by_sort.get(sort, []))
        if not os.path.exists(complete_path(run_dir, sort)):
            hard.append(f"{sort}: not complete")
        if len(ranks) != len(set(ranks)):
            hard.append(f"{sort}: duplicate ranks")
        ids = [r["app_id"] for r in rankings if r["sort"] == sort]
        info[sort] = {"rows": len(ranks), "unique_app_ids": len(set(ids)), "duplicate_rows": len(ids) - len(set(ids)),
                      "rank_gaps": (ranks[-1] - len(ranks)) if ranks else 0}

    # apps: unique ids; every ranking id is in apps; apps-only ids must come from the genre pass
    app_ids = [a["app_id"] for a in apps]
    if len(app_ids) != len(set(app_ids)):
        hard.append("apps.csv: duplicate app_id")
    ranking_ids = {r["app_id"] for r in rankings}
    if not ranking_ids <= set(app_ids):
        hard.append("rankings.csv has ids missing from apps.csv")
    bad_extra = [a["app_id"] for a in apps if a["app_id"] not in ranking_ids and a["discovered_via"] != "genre_pass_only"]
    if bad_extra:
        hard.append(f"apps.csv ids not in rankings and not from genre pass: {bad_extra[:5]}")
    info["discovered_via"] = dict(collections.Counter(a["discovered_via"] for a in apps))
    if any(not x.isdigit() for x in app_ids):
        hard.append("apps.csv: non-numeric app_id")
    missing = [a["app_id"] for a in apps if a["details_status"] != "ok"]
    info["apps"] = {"rows": len(apps), "unique": len(set(app_ids)), "details_missing": len(missing),
                    "missing_ids": missing}

    # no user-level columns in commit-ready files
    cols = set(apps[0].keys()) | set(rankings[0].keys()) if apps and rankings else set()
    bad = sorted(cols & USER_LEVEL_COLUMNS)
    if bad:
        hard.append(f"user-level columns present: {bad}")
    summary_text = open(os.path.join(snapshot_dir, "summary.json"), encoding="utf-8").read()
    for key in ("first_name", "last_name", "bdate"):
        if f'"{key}"' in summary_text:
            hard.append(f"summary.json contains {key}")

    # redaction: raw envelopes carry no auth material in request params
    for root, _, names in os.walk(os.path.join(run_dir, "raw")):
        for n in names:
            env = read_json(os.path.join(root, n))
            params = env.get("request", {}).get("params", {}) if isinstance(env, dict) else {}
            if any(k.lower() in ("access_token", "authorization", "token") for k in params):
                hard.append(f"raw {n}: auth key in request params")

    # rate: gaps between consecutive request starts in requests.jsonl, per invocation
    log = [json.loads(l) for l in open(os.path.join(run_dir, "requests.jsonl"), encoding="utf-8")]
    starts = sorted(_parse(e["captured_at"]) for e in log)
    gaps = [(b - a).total_seconds() for a, b in zip(starts, starts[1:])]
    run_gaps = [g for g in gaps if g < 60]  # larger gaps are pauses between invocations
    info["rate"] = {"requests": len(log), "min_gap_s": round(min(run_gaps), 3) if run_gaps else None,
                    "gaps_under_1s": sum(1 for g in run_gaps if g < 1.0),
                    "max_requests_in_any_1s_window": max((sum(1 for t in starts if 0 <= (t - s).total_seconds() < 1.0)
                                                          for s in starts), default=0),
                    "http_statuses": dict(collections.Counter(str(e["http_status"]) for e in log)),
                    "vk_error_codes": dict(collections.Counter(str(e["error_code"]) for e in log if e["error_code"])),
                    "network_errors": sum(1 for e in log if e.get("network_error"))}
    if info["rate"]["gaps_under_1s"]:
        hard.append(f"rate: {info['rate']['gaps_under_1s']} request gaps < 1 s")

    manifest = read_json(os.path.join(run_dir, "manifest.json"))
    info["manifest"] = {"api_version": manifest.get("api_version"), "invocations": [
        {k: i.get(k) for k in ("started_at", "finished_at", "status", "requests_made")} for i in manifest["invocations"]]}
    if not manifest.get("api_version"):
        hard.append("manifest: api_version missing")

    print(json.dumps(info, ensure_ascii=False, indent=1))
    for h in hard:
        print(" - FAIL:", h)
    print("VERIFY:", "FAIL" if hard else "PASS")
    return 1 if hard else 0
