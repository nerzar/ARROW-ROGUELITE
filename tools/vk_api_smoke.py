#!/usr/bin/env python3
"""VK API safe smoke test (see docs/VK-API-SAFE-TEST.md).

Stdlib only. The token is read from the VK_SERVICE_TOKEN environment variable
(loaded from the repo-root .env if not already set), sent only as an
Authorization: Bearer header, and never printed or written anywhere.

Usage:
    python tools/vk_api_smoke.py run
    python tools/vk_api_smoke.py resume-groups <artifacts_dir>
    python tools/vk_api_smoke.py scan <artifacts_dir> [extra files...]
"""

import datetime as dt
import json
import os
import re
import ssl
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_BASE = "https://api.vk.com/method/"
USER_AGENT = "arrow-roguelite-vk-research/0.1"
TIMEOUT_S = 15
MAX_RETRIES = 2

RATE_LIMIT_CODES = {6, 29, 32}
STOP_CODES = {14, 17}  # captcha, validation required
DENIED_CODES = {3, 5, 7, 8, 15, 17, 18, 20, 21, 23, 24, 27, 28, 30, 200, 203, 260}
INVALID_PARAMS_CODES = {100, 101, 113, 125}
SECRET_KEYS = {"authorization", "access_token", "token", "vk_service_token"}


def tls_context():
    """Verified TLS context: OS trust store via truststore, else certifi, else Python default."""
    try:
        import truststore
        return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT), "truststore"
    except ImportError:
        pass
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where()), "certifi"
    except ImportError:
        return ssl.create_default_context(), "python-default"


TLS_CONTEXT, TLS_SOURCE = tls_context()


# ---------------------------------------------------------------- env / secrets

def load_env():
    path = os.path.join(REPO_ROOT, ".env")
    if os.path.exists(path):
        with open(path, encoding="utf-8-sig") as f:
            for line in f:
                m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
                if m and not os.environ.get(m.group(1)):
                    os.environ[m.group(1)] = m.group(2).strip('"').strip("'")


def token():
    return os.environ.get("VK_SERVICE_TOKEN", "")


def redact(obj):
    """Drop secret keys and any occurrence of the token value, recursively."""
    tok = token()
    if isinstance(obj, dict):
        return {k: ("[REDACTED]" if str(k).lower() in SECRET_KEYS else redact(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(v) for v in obj]
    if isinstance(obj, str) and tok and tok in obj:
        return obj.replace(tok, "[REDACTED]")
    return obj


# ---------------------------------------------------------------- http

def vk_call(method, params):
    """Returns (parsed_json, http_status, elapsed_ms, sanitized_request)."""
    version = os.environ.get("VK_API_VERSION") or "5.199"
    query = dict(params)
    query["v"] = version
    url = API_BASE + method + "?" + urllib.parse.urlencode(query)
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token(),
        "User-Agent": USER_AGENT,
    })
    sanitized = redact({"method": method, "params": query})
    attempt = 0
    while True:
        started = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S, context=TLS_CONTEXT) as resp:
                raw = resp.read()
                status = resp.status
        except urllib.error.HTTPError as e:
            raw, status = e.read(), e.code
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            elapsed = round((time.perf_counter() - started) * 1000)
            if attempt < MAX_RETRIES:
                attempt += 1
                time.sleep(1.0)
                continue
            body = {"network_error": redact(type(e).__name__ + ": " + str(e))}
            return body, None, elapsed, sanitized
        elapsed = round((time.perf_counter() - started) * 1000)
        if status >= 500 and attempt < MAX_RETRIES:
            attempt += 1
            time.sleep(1.0)
            continue
        try:
            body = json.loads(raw.decode("utf-8"))
        except ValueError:
            body = {"non_json_body": raw.decode("utf-8", "replace")[:2000]}
        return redact(body), status, elapsed, sanitized


def vk_error_code(body):
    err = body.get("error") if isinstance(body, dict) else None
    return err.get("error_code") if isinstance(err, dict) else None


def classify(body):
    if isinstance(body, dict) and "response" in body and "error" not in body:
        return "PASS"
    code = vk_error_code(body)
    if code in DENIED_CODES:
        return "DENIED"
    if code in INVALID_PARAMS_CODES:
        return "INVALID_PARAMS"
    return "ERROR"


# ---------------------------------------------------------------- artifacts

def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(redact(data), f, ensure_ascii=False, indent=2)


def envelope(method, request, status, elapsed, body):
    return {
        "captured_at": now_iso(),
        "method": method,
        "request": {"params": request["params"]},
        "http_status": status,
        "elapsed_ms": elapsed,
        "body": body,
    }


def type_name(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "integer"
    if isinstance(v, float):
        return "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        if not v:
            return "array<empty>"
        return "array<" + type_name(v[0]) + ">"
    return "object"


def inventory(value, depth=4, prefix=""):
    """Flat {dotted.path: type} map; arrays expose fields of the first element as path[]."""
    out = {}
    if depth <= 0:
        return out
    if isinstance(value, dict):
        for k, v in value.items():
            p = prefix + "." + k if prefix else k
            out[p] = type_name(v)
            out.update(inventory(v, depth - 1, p))
    elif isinstance(value, list) and value and isinstance(value[0], (dict, list)):
        out.update(inventory(value[0], depth, prefix + "[]"))
    return out


def merged_item_inventory(items, depth=4):
    """Union of fields across all items; types joined with | when they differ."""
    merged = {}
    for it in items:
        for k, t in inventory(it, depth).items():
            merged.setdefault(k, set()).add(t)
    return {k: "|".join(sorted(v)) for k, v in sorted(merged.items())}


# ---------------------------------------------------------------- tests

class Stop(Exception):
    pass


def official_group_id(apps_get_response):
    """Group id only when apps.get is unambiguous: author_owner_id < 0, exactly one entry in
    groups[] with the matching id, and that community is open (is_closed == 0)."""
    if not isinstance(apps_get_response, dict):
        return None
    items = apps_get_response.get("items") or []
    groups = apps_get_response.get("groups") or []
    owner = items[0].get("author_owner_id") if len(items) == 1 else None
    if not isinstance(owner, int) or owner >= 0 or len(groups) != 1:
        return None
    g = groups[0]
    return g["id"] if g.get("id") == -owner and g.get("is_closed") == 0 else None


def test_groups(call, mark, facts, field_inv, matrix, out_dir):
    group_id = os.environ.get("VK_TEST_GROUP_ID") or None
    group_source = "VK_TEST_GROUP_ID" if group_id else None
    if not group_id and facts.get("apps_get", {}).get("official_group_id"):
        group_id = facts["apps_get"]["official_group_id"]
        group_source = "apps.get author_owner_id == groups[0].id, is_closed=0"
    facts["groups"] = {"group_id": group_id, "source": group_source}
    if not group_id:
        matrix["groups.getMembers"]["notes"] = "No VK_TEST_GROUP_ID and no unambiguous group id from apps.get"
        return
    time.sleep(0.5)
    f_body, _, f_env = call("groups.getMembers", {"group_id": group_id, "count": 5, "offset": 0})
    mark("groups.getMembers", f_body, f"group_id source: {group_source}")
    facts["groups"]["minimal_status"] = classify(f_body)
    result = {"minimal": f_env}
    if classify(f_body) == "PASS":
        resp = f_body["response"]
        field_inv["groups.getMembers.response"] = inventory(resp, 1)
        facts["groups"]["minimal_items_len"] = len(resp.get("items", []))
        facts["groups"]["minimal_item_type"] = type_name(resp.get("items"))
        time.sleep(0.5)
        fx_body, _, fx_env = call("groups.getMembers", {"group_id": group_id, "count": 5, "offset": 0,
                                                          "fields": "sex,bdate,city,country"})
        result["extended"] = fx_env
        facts["groups"]["extended_status"] = classify(fx_body)
        facts["groups"]["extended_error_code"] = vk_error_code(fx_body)
        if classify(fx_body) == "PASS":
            fx_items = fx_body["response"].get("items", [])
            field_inv["groups.getMembers.extended.item"] = merged_item_inventory(fx_items)
            facts["groups"]["extended_field_counts"] = {k: sum(1 for it in fx_items if k in it)
                                                        for k in sorted({k for it in fx_items for k in it})}
    write_json(os.path.join(out_dir, "06-groups-members.json"), result)


def resume_groups(out_dir):
    """Run only Test F against an existing artifacts dir (reuses its 04-app-details.json)."""
    load_env()
    if not token():
        print("VK_SERVICE_TOKEN is missing or empty; aborting.")
        return 2

    def read(name):
        with open(os.path.join(out_dir, name), encoding="utf-8") as f:
            return json.load(f)

    facts, field_inv, matrix = read("_facts.json"), read("field-inventory.json"), read("method-matrix.json")
    d_body = read("04-app-details.json")["body"]
    facts.setdefault("apps_get", {})["official_group_id"] = official_group_id(d_body.get("response"))
    facts["apps_get"].pop("author_group", None)

    def call(method, params):
        body, status, elapsed, req = vk_call(method, params)
        code = vk_error_code(body)
        print(f"{method} {json.dumps(params, ensure_ascii=False)} -> http={status} "
              f"{classify(body)} error_code={code} {elapsed}ms")
        if code in RATE_LIMIT_CODES or code in STOP_CODES or status == 429:
            raise Stop(f"stop on {method}: code={code} http={status}")
        return body, status, envelope(method, req, status, elapsed, body)

    def mark(method, body, notes=""):
        matrix[method]["service_token"] = classify(body)
        matrix[method]["error_code"] = vk_error_code(body)
        if isinstance(body, dict) and isinstance(body.get("error"), dict):
            notes = (notes + " " if notes else "") + "error_msg: " + body["error"].get("error_msg", "")
        matrix[method]["notes"] = notes

    try:
        test_groups(call, mark, facts, field_inv, matrix, out_dir)
    except Stop as e:
        facts["stopped"] = str(e)
        print("STOP:", e)
    write_json(os.path.join(out_dir, "field-inventory.json"), field_inv)
    write_json(os.path.join(out_dir, "method-matrix.json"), matrix)
    write_json(os.path.join(out_dir, "_facts.json"), facts)
    return 0


def run():
    load_env()
    if not token():
        print("VK_SERVICE_TOKEN is missing or empty; aborting.")
        return 2
    os.environ.setdefault("VK_API_VERSION", "5.199")
    if not os.environ["VK_API_VERSION"]:
        os.environ["VK_API_VERSION"] = "5.199"

    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = os.path.join(REPO_ROOT, "artifacts", "vk-api-smoke", stamp)
    os.makedirs(out_dir, exist_ok=True)

    matrix = {m: {"service_token": "NOT_TESTED", "error_code": None, "notes": ""}
              for m in ("utils.getServerTime", "apps.getCatalog", "apps.get", "users.get", "groups.getMembers")}
    facts = {"stamp": stamp, "api_version": os.environ["VK_API_VERSION"], "stopped": None}
    field_inv = {}

    write_json(os.path.join(out_dir, "00-env.json"), {
        "captured_at": now_iso(),
        "VK_SERVICE_TOKEN_present": True,
        "VK_API_VERSION": os.environ["VK_API_VERSION"],
        "VK_TEST_GROUP_ID_present": bool(os.environ.get("VK_TEST_GROUP_ID")),
        "env_gitignored": subprocess.run(["git", "-C", REPO_ROOT, "check-ignore", "-q", ".env"]).returncode == 0,
        "artifacts_gitignored": subprocess.run(["git", "-C", REPO_ROOT, "check-ignore", "-q", "artifacts/x"]).returncode == 0,
        "python": sys.version.split()[0],
        "tls_trust_source": TLS_SOURCE,
    })

    def call(method, params, filename=None):
        body, status, elapsed, req = vk_call(method, params)
        env = envelope(method, req, status, elapsed, body)
        if filename:
            write_json(os.path.join(out_dir, filename), env)
        code = vk_error_code(body)
        print(f"{method} {json.dumps(params, ensure_ascii=False)} -> http={status} "
              f"{classify(body)} error_code={code} {elapsed}ms")
        if code in RATE_LIMIT_CODES or status == 429:
            raise Stop(f"rate limit on {method}: code={code} http={status}")
        if code in STOP_CODES:
            raise Stop(f"captcha/validation required on {method}: code={code}")
        return body, status, env

    def mark(method, body, notes=""):
        matrix[method]["service_token"] = classify(body)
        matrix[method]["error_code"] = vk_error_code(body)
        if isinstance(body, dict) and isinstance(body.get("error"), dict):
            msg = body["error"].get("error_msg", "")
            notes = (notes + " " if notes else "") + f"error_msg: {msg}"
        matrix[method]["notes"] = notes

    try:
        # Test A
        body, _, _ = call("utils.getServerTime", {}, "01-server-time.json")
        mark("utils.getServerTime", body)
        facts["server_time_type"] = type_name(body.get("response"))
        if classify(body) != "PASS":
            raise Stop("utils.getServerTime failed; token/app type/permissions unsuitable")

        # Test B
        basic_params = {"sort": "popular_today", "count": 5, "offset": 0, "extended": 0}
        b_body, _, _ = call("apps.getCatalog", basic_params, "02-apps-catalog-basic.json")
        if classify(b_body) != "PASS":
            mark("apps.getCatalog", b_body)
            raise Stop("apps.getCatalog basic not accessible with service token")
        b_resp = b_body["response"]
        b_items = b_resp.get("items", []) if isinstance(b_resp, dict) else []
        facts["basic"] = {
            "top_level_keys": sorted(b_body.keys()),
            "response_type": type_name(b_resp),
            "response_keys": sorted(b_resp.keys()) if isinstance(b_resp, dict) else None,
            "count": b_resp.get("count") if isinstance(b_resp, dict) else None,
            "items_len": len(b_items),
            "app_ids": [it.get("id") for it in b_items],
        }
        field_inv["apps.getCatalog.basic.response"] = inventory(b_resp, 1)
        field_inv["apps.getCatalog.basic.item"] = merged_item_inventory(b_items)

        # Test C
        ext_params = {"sort": "popular_today", "count": 5, "offset": 0, "extended": 1}
        c_body, _, _ = call("apps.getCatalog", ext_params, "03-apps-catalog-extended.json")
        mark("apps.getCatalog", c_body)
        if classify(c_body) != "PASS":
            raise Stop("apps.getCatalog extended failed")
        c_resp = c_body["response"]
        c_items = c_resp.get("items", [])
        field_inv["apps.getCatalog.extended.response"] = inventory(c_resp, 1)
        field_inv["apps.getCatalog.extended.item"] = merged_item_inventory(c_items)
        for k, v in c_resp.items():
            if k not in ("items", "count") and isinstance(v, list) and v and isinstance(v[0], dict):
                field_inv[f"apps.getCatalog.extended.{k}[]"] = merged_item_inventory(v)
        b_keys = set(field_inv["apps.getCatalog.basic.item"])
        c_keys = set(field_inv["apps.getCatalog.extended.item"])
        all_keys = {k.lower(): k for k in b_keys | c_keys}
        facts["extended"] = {
            "response_keys": sorted(c_resp.keys()),
            "count": c_resp.get("count"),
            "app_ids": [it.get("id") for it in c_items],
            "same_ids_as_basic": [it.get("id") for it in c_items] == facts["basic"]["app_ids"],
            "only_in_extended": sorted(c_keys - b_keys),
            "only_in_basic": sorted(b_keys - c_keys),
            "response_keys_only_in_extended": sorted(set(c_resp) - set(b_resp)),
            "type_changes": {k: [field_inv["apps.getCatalog.basic.item"][k], field_inv["apps.getCatalog.extended.item"][k]]
                             for k in sorted(b_keys & c_keys)
                             if field_inv["apps.getCatalog.basic.item"][k] != field_inv["apps.getCatalog.extended.item"][k]},
            "expected_field_check": {
                "screenshots": [all_keys[k] for k in all_keys if k.split(".")[0].rstrip("[]") == "screenshots" and "." not in k] or None,
                "mau_like": sorted({all_keys[k] for k in all_keys if "mau" in k.split(".")[-1]}) or None,
                "catalog_position": [all_keys[k] for k in all_keys if k == "catalog_position"] or None,
                "international": [all_keys[k] for k in all_keys if k == "international"] or None,
            },
            "items_with_field_counts": {k: sum(1 for it in c_items if k in it)
                                        for k in sorted({k for it in c_items for k in it})},
        }
        field_inv["_diff.apps.getCatalog.extended_vs_basic"] = {
            "only_in_extended": facts["extended"]["only_in_extended"],
            "only_in_basic": facts["extended"]["only_in_basic"],
            "type_changes": facts["extended"]["type_changes"],
        }
        field_inv["_expected_but_missing.apps.getCatalog"] = [
            name for name, found in facts["extended"]["expected_field_check"].items() if not found]

        # Sorts: one request each, count=5
        sorts = {}
        for i, sort in enumerate(["popular_week", "visitors", "growth_rate", "create_date", "popular"]):
            time.sleep(0.5)
            s_body, s_status, _ = call("apps.getCatalog", {"sort": sort, "count": 5, "offset": 0, "extended": 0},
                                       f"03{chr(ord('a') + i)}-apps-catalog-sort-{sort}.json")
            ids = [it.get("id") for it in s_body["response"].get("items", [])] if classify(s_body) == "PASS" else None
            sorts[sort] = {
                "status": classify(s_body),
                "http_status": s_status,
                "error_code": vk_error_code(s_body),
                "app_ids": ids,
                "differs_from_popular_today": None if ids is None else ids != facts["basic"]["app_ids"],
            }
        facts["sorts"] = sorts

        # Test D
        if not c_items:
            raise Stop("no app ids from apps.getCatalog extended")
        app_id = c_items[0].get("id")
        d_body, _, _ = call("apps.get", {"app_id": app_id, "extended": 1}, "04-app-details.json")
        mark("apps.get", d_body)
        facts["apps_get"] = {"app_id": app_id, "status": classify(d_body)}
        if classify(d_body) == "PASS":
            d_resp = d_body["response"]
            d_items = d_resp.get("items", []) if isinstance(d_resp, dict) else []
            field_inv["apps.get.response"] = inventory(d_resp, 1)
            field_inv["apps.get.item"] = merged_item_inventory(d_items)
            for k, v in (d_resp.items() if isinstance(d_resp, dict) else []):
                if k not in ("items", "count") and isinstance(v, list) and v and isinstance(v[0], dict):
                    field_inv[f"apps.get.{k}[]"] = merged_item_inventory(v)
            d_keys = set(field_inv["apps.get.item"])
            facts["apps_get"].update({
                "response_keys": sorted(d_resp.keys()) if isinstance(d_resp, dict) else None,
                "only_in_apps_get": sorted(d_keys - c_keys),
                "only_in_catalog_extended": sorted(c_keys - d_keys),
            })
            field_inv["_diff.apps.get_vs_catalog_extended"] = {
                "only_in_apps_get": facts["apps_get"]["only_in_apps_get"],
                "only_in_catalog_extended": facts["apps_get"]["only_in_catalog_extended"],
            }
            item = d_items[0] if d_items else {}
            facts["apps_get"]["author_owner_id"] = item.get("author_owner_id")
            facts["apps_get"]["official_group_id"] = official_group_id(d_resp)

        # Test E
        time.sleep(0.5)
        e_body, _, _ = call("users.get", {"user_ids": 1, "fields": "sex,bdate,city,country"}, "05-users-get.json")
        mark("users.get", e_body)
        if classify(e_body) == "PASS":
            users = e_body["response"]
            field_inv["users.get.item"] = merged_item_inventory(users)
            facts["users_get"] = {"returned_fields": sorted({k for u in users for k in u})}

        # Test F
        test_groups(call, mark, facts, field_inv, matrix, out_dir)

        # Rate test: utils.getServerTime only
        facts["rate"] = {}
        for idx, rps in enumerate((1, 2, 3)):
            time.sleep(5)
            stage = {"requested_rps": rps, "start": now_iso(), "results": []}
            t0 = time.perf_counter()
            stop_reason = None
            for i in range(10):
                wait = t0 + i / rps - time.perf_counter()
                if wait > 0:
                    time.sleep(wait)
                body, status, elapsed, _ = vk_call("utils.getServerTime", {})
                code = vk_error_code(body)
                stage["results"].append({"i": i, "sent_at_s": round(time.perf_counter() - t0 - elapsed / 1000, 3),
                                         "http_status": status, "error_code": code, "elapsed_ms": elapsed})
                if code in RATE_LIMIT_CODES or status == 429 or code in STOP_CODES:
                    stop_reason = f"code={code} http={status}"
                    break
            res = stage["results"]
            lat = sorted(r["elapsed_ms"] for r in res)
            stage.update({
                "end": now_iso(),
                "actual_duration_s": round(time.perf_counter() - t0, 2),
                "total_requests": len(res),
                "success_count": sum(1 for r in res if r["error_code"] is None and r["http_status"] == 200),
                "error_count": sum(1 for r in res if not (r["error_code"] is None and r["http_status"] == 200)),
                "http_statuses": sorted({r["http_status"] for r in res}, key=str),
                "vk_error_codes": sorted({r["error_code"] for r in res if r["error_code"] is not None}),
                "latency_ms": {"min": lat[0], "median": statistics.median(lat),
                               "p95": lat[min(len(lat) - 1, int(round(0.95 * (len(lat) - 1))))], "max": lat[-1]},
                "stopped": stop_reason,
            })
            write_json(os.path.join(out_dir, f"0{7 + idx}-rate-limit-{rps}rps.json"), stage)
            facts["rate"][f"{rps}rps"] = {k: v for k, v in stage.items() if k != "results"}
            print(f"rate {rps}rps: {stage['success_count']}/{stage['total_requests']} ok, "
                  f"errors={stage['vk_error_codes']} median={stage['latency_ms']['median']}ms")
            if stop_reason or stage["error_count"]:
                raise Stop(f"rate stage {rps}rps had errors: {stop_reason}")
    except Stop as e:
        facts["stopped"] = str(e)
        print("STOP:", e)

    clean = [int(k[:-3]) for k, v in facts.get("rate", {}).items() if v["error_count"] == 0]
    max_clean = max(clean) if clean else None
    facts["recommended_rps"] = min(1.0, max_clean * 0.5) if max_clean else None
    if max_clean == 3:
        facts["recommended_rps"] = 1.0

    write_json(os.path.join(out_dir, "field-inventory.json"), field_inv)
    write_json(os.path.join(out_dir, "method-matrix.json"), matrix)
    write_json(os.path.join(out_dir, "_facts.json"), facts)
    print("artifacts:", out_dir)
    return 0


# ---------------------------------------------------------------- secret scan

def scan(paths):
    load_env()
    tok = token()
    if not tok:
        print("SECRET SCAN: FAIL (token not available to compare)")
        return 1
    windows = {tok[i:i + 12] for i in range(0, len(tok) - 11)}
    # Token-like value: 20+ chars of [A-Za-z0-9._-], so prose and this source don't self-match.
    value = r"[A-Za-z0-9._\-]{20,}"
    patterns = [
        re.compile(r"Authorization[\"']?\s*[:=]\s*[\"']?Bearer\s+" + value, re.I),
        re.compile(r"access_token[\"']?\s*[:=]\s*[\"']?" + value, re.I),
        re.compile(r"VK_SERVICE_TOKEN[\"']?\s*[:=]\s*[\"']?" + value, re.I),
    ]
    findings = []

    def check(label, text):
        if tok in text:
            findings.append(f"{label}: exact token value")
        elif any(w in text for w in windows):
            findings.append(f"{label}: token fragment (12+ chars)")
        for p in patterns:
            if p.search(text):
                findings.append(f"{label}: pattern {p.pattern[:30]}")

    files = []
    for p in paths:
        if os.path.isdir(p):
            for root, _, names in os.walk(p):
                files += [os.path.join(root, n) for n in names]
        elif os.path.isfile(p):
            files.append(p)
    for f in files:
        with open(f, encoding="utf-8", errors="replace") as fh:
            check(os.path.relpath(f, REPO_ROOT), fh.read())

    git = lambda *a: subprocess.run(["git", "-C", REPO_ROOT, *a], capture_output=True, text=True,
                                    encoding="utf-8", errors="replace").stdout
    check("git diff", git("diff", "HEAD"))
    check("git diff --cached", git("diff", "--cached"))
    if git("ls-files", ".env").strip():
        findings.append(".env is tracked by git")
    for line in git("status", "--porcelain", "--untracked-files=all").splitlines():
        name = line[3:]
        if re.search(r"(^|/)\.env($|\.)", name) and not name.endswith(".env.example"):
            findings.append(f"git status shows secret file: {name}")
        if name.startswith("artifacts/"):
            findings.append(f"git status shows raw artifact: {name}")

    print(f"scanned files: {len(files)} + git diff/status")
    if findings:
        for x in findings:
            print(" -", x)
        print("SECRET SCAN: FAIL")
        return 1
    print("SECRET SCAN: PASS")
    return 0


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "run":
        sys.exit(run())
    if len(sys.argv) == 3 and sys.argv[1] == "resume-groups":
        sys.exit(resume_groups(sys.argv[2]))
    if len(sys.argv) >= 3 and sys.argv[1] == "scan":
        sys.exit(scan(sys.argv[2:]))
    print(__doc__)
    sys.exit(2)
