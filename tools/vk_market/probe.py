"""Small safe probes that decide collector parameters before any bulk run (~9 requests).

1. apps.getCatalog count=100 extended=1: is a 100-item page accepted?
2. the last page (offset = count - 50): does pagination reach the end of the catalog?
3. apps.get batch (app_ids=3 ids) vs the same 3 ids requested one by one: identical items/groups?
"""

import json
import os

from .client import VKClient, error_code, write_json_atomic

VOLATILE_KEYS = {"members_count", "catalog_position", "leaderboard_type"}


def _items(env):
    resp = env["body"].get("response") if isinstance(env["body"], dict) else None
    return resp.get("items", []) if isinstance(resp, dict) else []


def _strip_volatile(item):
    return {k: v for k, v in item.items() if k not in VOLATILE_KEYS}


def run(run_dir):
    client = VKClient(run_dir)
    out = {"tls_source": client.tls_source}

    page = client.call("apps.getCatalog", {"sort": "popular_today", "count": 100, "offset": 0, "extended": 1})
    write_json_atomic(os.path.join(run_dir, "probe-01-catalog-count100.json"), page)
    total = page["body"].get("response", {}).get("count") if error_code(page["body"]) is None else None
    out["page100"] = {"error_code": error_code(page["body"]), "count": total, "items_len": len(_items(page))}

    if total:
        tail_offset = max(0, total - 50)
        tail = client.call("apps.getCatalog", {"sort": "popular_today", "count": 100, "offset": tail_offset, "extended": 1})
        write_json_atomic(os.path.join(run_dir, "probe-02-catalog-tail.json"), tail)
        out["tail"] = {"offset": tail_offset, "error_code": error_code(tail["body"]),
                       "count": tail["body"].get("response", {}).get("count"), "items_len": len(_items(tail))}

    ids = [it["id"] for it in _items(page)[:3]]
    batch = client.call("apps.get", {"app_ids": ",".join(map(str, ids)), "extended": 1})
    write_json_atomic(os.path.join(run_dir, "probe-03-apps-get-batch3.json"), batch)
    singles = []
    for i, app_id in enumerate(ids):
        env = client.call("apps.get", {"app_id": app_id, "extended": 1})
        write_json_atomic(os.path.join(run_dir, f"probe-04-apps-get-single-{i}.json"), env)
        singles.append(env)

    b_items = {it["id"]: it for it in _items(batch)}
    b_groups = {g["id"]: g for g in (batch["body"].get("response", {}).get("groups") or [])}
    compare = []
    for app_id, env in zip(ids, singles):
        s_items = _items(env)
        s = s_items[0] if s_items else {}
        b = b_items.get(app_id, {})
        s_groups = {g["id"]: g for g in (env["body"].get("response", {}).get("groups") or [])}
        compare.append({
            "app_id": app_id,
            "in_batch": app_id in b_items,
            "same_keys": sorted(s) == sorted(b),
            "keys_only_single": sorted(set(s) - set(b)),
            "keys_only_batch": sorted(set(b) - set(s)),
            "same_values_excl_volatile": _strip_volatile(s) == _strip_volatile(b),
            "diff_values": sorted(k for k in set(s) & set(b) if s[k] != b[k]),
            "single_groups_in_batch": all(gid in b_groups and b_groups[gid] == g for gid, g in s_groups.items()),
        })
    out["batch_vs_single"] = {
        "batch_error_code": error_code(batch["body"]),
        "batch_items": len(b_items),
        "batch_response_keys": sorted(batch["body"].get("response", {}).keys()) if error_code(batch["body"]) is None else None,
        "per_app": compare,
    }
    out["requests_made"] = client.requests_made
    write_json_atomic(os.path.join(run_dir, "probe-summary.json"), out)
    print(json.dumps(out, ensure_ascii=False, indent=1))
    return out
