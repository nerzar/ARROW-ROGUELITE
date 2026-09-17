#!/usr/bin/env python3
"""MKT-001 community demographic proxy collector.

Stdlib only. Reads VK_SERVICE_TOKEN from the repo-root .env (never printed,
never written, sent only as Authorization: Bearer). TLS verification is always
on (truststore / certifi / python-default). At most 1 request start per
MIN_INTERVAL_S.

Privacy: groups.getMembers pages are aggregated in memory page-by-page and
individual records are discarded immediately. No user IDs, names, birth dates
or raw user-level rows are ever written to disk. Only aggregate counters reach
the committed CSV/JSON outputs. The local rate log (artifacts/, gitignored)
holds request timestamps and params only.

Usage:
    python tools/vk_demography/collect.py
"""
import csv
import datetime as dt
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API_BASE = "https://api.vk.com/method/"
DEFAULT_API_VERSION = "5.199"
USER_AGENT = "arrow-roguelite-vk-research/0.3 (demography-proxy)"
TIMEOUT_S = 15
NETWORK_RETRIES = 2
MIN_INTERVAL_S = 1.05
RATE_LIMIT_COOLDOWN_S = 30
PAGE_SIZE = 1000
SUPPRESS_UNDER_N = 20

RATE_LIMIT_CODES = {6, 29, 32}
FATAL_CODES = {3, 5, 8, 14, 17, 28}
SECRET_KEYS = {"authorization", "access_token", "token", "vk_service_token"}

# group_id -> (app_id used as mapping evidence, mechanic lane, game label)
GROUPS = [
    ("236576213", 54380425, "sort", "Yaga: Zelya sudby"),
    ("233302675", 53448227, "match3", "Grand Tour"),
    ("240373000", 54579291, "arrow", "Strelki: Ochisti pole"),
    ("225055876", 51871737, "arrow", "Razberi Kubik"),
    ("233439912", 54255702, "sort", "Bolty i gaiki (Fabrika igr dev group)"),
    ("234333127", 54102802, "merge", "Tropikvil"),
    ("232830008", 54164742, "merge", "Mir Sliyaniya"),
    ("236123415", 54458245, "match3", "Tap Gallery"),
    ("237611414", 54539273, "sort", "Razberi Strelochki"),
    ("235802722", 54419995, "merge", "Moy Zamok"),
    ("215368653", 54613094, "match3", "GidKap dev group (Sadovody)"),
    ("240707160", 54698383, "arrow", "Tuda-Syuda"),
]

AGE_BUCKETS = ["lt18", "18_24", "25_34", "35_44", "45_54", "55plus"]


class FatalVKError(Exception):
    pass


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def load_env():
    path = os.path.join(REPO_ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
            if m and not os.environ.get(m.group(1)):
                os.environ[m.group(1)] = m.group(2).strip('"').strip("'")


def token():
    return os.environ.get("VK_SERVICE_TOKEN", "")


def api_version():
    return os.environ.get("VK_API_VERSION") or DEFAULT_API_VERSION


def redact(obj):
    tok = token()
    if isinstance(obj, dict):
        return {k: ("[REDACTED]" if str(k).lower() in SECRET_KEYS else redact(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(v) for v in obj]
    if isinstance(obj, str) and tok and tok in obj:
        return obj.replace(tok, "[REDACTED]")
    return obj


def tls_context():
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


def age_on(bdate, ref):
    """Age in full years from a VK bdate string. Returns None unless a birth year is present."""
    m = re.match(r"^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$", bdate or "")
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (1900 <= y <= ref.year and 1 <= mo <= 12 and 1 <= d <= 31):
        return None
    return ref.year - y - ((ref.month, ref.day) < (mo, d))


def bucket(age):
    if age < 18:
        return "lt18"
    if age <= 24:
        return "18_24"
    if age <= 34:
        return "25_34"
    if age <= 44:
        return "35_44"
    if age <= 54:
        return "45_54"
    return "55plus"


class VKClient:
    def __init__(self, run_dir):
        load_env()
        if not token():
            raise FatalVKError("VK_SERVICE_TOKEN is missing or empty")
        self.ctx, self.tls_source = tls_context()
        self.run_dir = run_dir
        os.makedirs(run_dir, exist_ok=True)
        self.log_path = os.path.join(run_dir, "requests.jsonl")
        self._last_start = 0.0
        self.requests_made = 0

    def _wait_slot(self):
        wait = self._last_start + MIN_INTERVAL_S - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        self._last_start = time.monotonic()

    def _log(self, entry):
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(redact(entry), ensure_ascii=False) + "\n")

    def _http(self, method, query):
        url = API_BASE + method + "?" + urllib.parse.urlencode(query)
        req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token(),
                                                   "User-Agent": USER_AGENT})
        started = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S, context=self.ctx) as resp:
                raw, status = resp.read(), resp.status
        except urllib.error.HTTPError as e:
            raw, status = e.read(), e.code
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            elapsed = round((time.perf_counter() - started) * 1000)
            return None, None, elapsed, redact(type(e).__name__ + ": " + str(e))
        elapsed = round((time.perf_counter() - started) * 1000)
        try:
            body = json.loads(raw.decode("utf-8"))
        except ValueError:
            body = {"non_json_body": raw.decode("utf-8", "replace")[:500]}
        return redact(body), status, elapsed, None

    def call(self, method, params):
        query = dict(params)
        query["v"] = api_version()
        net_tries, rate_retried = 0, False
        while True:
            self._wait_slot()
            started_wall = time.time()
            captured_at = now_iso()
            body, status, elapsed, net_err = self._http(method, query)
            self.requests_made += 1
            code = body.get("error", {}).get("error_code") if isinstance(body, dict) else None
            # Rate log holds timestamps/params/status only — never user-level data.
            self._log({"t": started_wall, "captured_at": captured_at, "method": method,
                       "params": query, "http_status": status, "elapsed_ms": elapsed,
                       "error_code": code, "network_error": net_err})
            if net_err or (status is not None and status >= 500):
                if net_tries < NETWORK_RETRIES:
                    net_tries += 1
                    time.sleep(2 * net_tries)
                    continue
                raise FatalVKError(f"{method}: network/5xx after retries: http={status}")
            if code in RATE_LIMIT_CODES or status == 429:
                if not rate_retried:
                    rate_retried = True
                    time.sleep(RATE_LIMIT_COOLDOWN_S)
                    continue
                raise FatalVKError(f"{method}: repeated rate limit code={code} http={status}")
            if code in FATAL_CODES:
                raise FatalVKError(f"{method}: fatal VK error {code}")
            if isinstance(body, dict) and "error" in body:
                raise FatalVKError(f"{method}: VK error {code}")
            return {"captured_at": captured_at, "api_version": query["v"], "method": method,
                    "http_status": status, "elapsed_ms": elapsed, "body": body}


def load_app_members():
    """Public app members_count from the EXP-003 snapshot (NOT MAU)."""
    path = os.path.join(REPO_ROOT, "research", "vk-market", "reference-audit", "shortlist.csv")
    out = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[int(row["app_id"])] = int(row["members_count"])
    # GidKap dev group maps to the GidKap match3 series; use Sadovody as the anchor app.
    gidkap_extra = {}
    gpath = os.path.join(REPO_ROOT, "research", "vk-market", "reference-audit", "games.csv")
    with open(gpath, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            gidkap_extra[int(row["app_id"])] = (row["title"], int(row["members_count"]))
    return out, gidkap_extra


def main():
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = os.path.join(REPO_ROOT, "artifacts", "vk-demography", stamp)
    out_dir = os.path.join(REPO_ROOT, "research", "vk-market", "demography")
    os.makedirs(out_dir, exist_ok=True)
    client = VKClient(run_dir)
    capture_date = dt.datetime.now(dt.timezone.utc).date()
    app_members, games_extra = load_app_members()

    # --- step 1: group metadata (one batched request) ---
    group_ids = [g for g, _, _, _ in GROUPS]
    env = client.call("groups.getById", {"group_ids": ",".join(group_ids),
                                         "fields": "members_count,description"})
    meta = {str(g["id"]): g for g in env["body"]["response"]["groups"]}

    # --- step 2: mapping evidence via apps.get (author_owner_id == -group_id) ---
    mapping = []
    for gid, app_id, mech, label in GROUPS:
        a = client.call("apps.get", {"app_id": app_id, "extended": 1})
        resp = a["body"]["response"]
        items = resp.get("items") or []
        grps = resp.get("groups") or []
        owner = items[0].get("author_owner_id") if items else None
        ag = grps[0] if grps else {}
        official = isinstance(owner, int) and owner < 0 and ag.get("id") == -owner \
            and str(ag.get("id")) == gid and ag.get("is_closed") == 0
        mapping.append({"group_id": gid, "app_id": app_id, "mechanic": mech, "label": label,
                        "app_title": items[0].get("title") if items else None,
                        "author_owner_id": owner, "official_link": bool(official),
                        "evidence": "apps.get author_owner_id == -group_id, is_closed=0" if official
                        else "name/description match only (see FOUND)"})

    # --- step 3: streaming member aggregation per group ---
    def city_top(titles):
        big = sorted(((t, n) for t, n in titles.items() if n >= SUPPRESS_UNDER_N),
                     key=lambda x: -x[1])[:10]
        if not big:
            return "suppressed (no city with n>=20)"
        return "; ".join(f"{t} {n}" for t, n in big)
    communities = []
    for gid, app_id, mech, label in GROUPS:
        m = meta.get(gid, {})
        gname = m.get("name")
        members_count = m.get("members_count")
        agg = {"group_id": gid, "group_name": gname, "game": label, "app_id": app_id,
               "mechanic": mech, "group_members": members_count,
               "app_members_count": app_members.get(app_id),
               "records_processed": 0, "sex": {"female": 0, "male": 0, "unspecified": 0},
               "age": {b: 0 for b in AGE_BUCKETS}, "age_unknown_no_year": 0,
               "city_present": 0, "city_missing": 0, "country_seen": False,
               "status": "complete", "errors": [], "captured_at_utc": now_iso()}
        city_titles = {}  # in-memory aggregate only; never written per-record
        if m.get("is_closed") != 0 or not isinstance(members_count, int):
            agg["status"] = "inaccessible"
            agg["errors"].append("group closed or members_count missing")
            communities.append(agg)
            continue
        offset = 0
        try:
            while offset < members_count:
                r = client.call("groups.getMembers",
                                {"group_id": gid, "count": min(PAGE_SIZE, members_count - offset),
                                 "offset": offset, "fields": "sex,bdate,city,country"})
                items = r["body"]["response"].get("items", [])
                if not items:
                    break
                for it in items:  # aggregate, then discard the record
                    agg["records_processed"] += 1
                    s = it.get("sex")
                    if s == 1:
                        agg["sex"]["female"] += 1
                    elif s == 2:
                        agg["sex"]["male"] += 1
                    else:
                        agg["sex"]["unspecified"] += 1
                    a = age_on(it.get("bdate", ""), capture_date)
                    if a is None:
                        agg["age_unknown_no_year"] += 1
                    else:
                        agg["age"][bucket(a)] += 1
                    if isinstance(it.get("city"), dict):
                        agg["city_present"] += 1
                        title = it["city"].get("title")
                        if isinstance(title, str) and title:
                            city_titles[title] = city_titles.get(title, 0) + 1
                    else:
                        agg["city_missing"] += 1
                    if "country" in it:
                        agg["country_seen"] = True
                del items
                offset += PAGE_SIZE
                if offset >= 10000 and offset < members_count:
                    # VK paging ceiling: do not pretend a truncated pass is complete.
                    agg["status"] = "partial"
                    agg["errors"].append("stopped at offset ceiling 10000; remainder not fetched")
                    break
        except FatalVKError as e:
            agg["status"] = "inaccessible" if agg["records_processed"] == 0 else "partial"
            agg["errors"].append(str(e))
        agg["city_top"] = city_top(city_titles)
        del city_titles
        communities.append(agg)

    # --- step 4: committed outputs (aggregates only, small cells suppressed) ---
    def sup(n):
        return "suppressed" if 0 < n < SUPPRESS_UNDER_N else n

    def share(n, d):
        return round(n / d, 4) if d else 0.0

    rows = []
    for c in communities:
        n = c["records_processed"]
        sex_known = c["sex"]["female"] + c["sex"]["male"]
        age_known = sum(c["age"].values())
        suppressed_age = sum(v for v in c["age"].values() if 0 < v < SUPPRESS_UNDER_N)
        ratio = (round(c["group_members"] / c["app_members_count"], 4)
                 if isinstance(c["group_members"], int) and c["app_members_count"] else "")
        rows.append({
            "group_id": c["group_id"], "game": c["game"], "app_id": c["app_id"],
            "mechanic": c["mechanic"], "group_members": c["group_members"],
            "app_members_count": c["app_members_count"], "group_to_app_ratio": ratio,
            "records_processed": n, "capture_status": c["status"],
            "captured_at_utc": c["captured_at_utc"],
            "sex_female_n": c["sex"]["female"], "sex_male_n": c["sex"]["male"],
            "sex_unspecified_n": c["sex"]["unspecified"],
            "sex_coverage": share(sex_known, n),
            "age_year_coverage": share(age_known, n),
            "age_lt18": sup(c["age"]["lt18"]), "age_18_24": sup(c["age"]["18_24"]),
            "age_25_34": sup(c["age"]["25_34"]), "age_35_44": sup(c["age"]["35_44"]),
            "age_45_54": sup(c["age"]["45_54"]), "age_55plus": sup(c["age"]["55plus"]),
            "age_unknown_no_year_n": c["age_unknown_no_year"],
            "age_suppressed_remainder_n": suppressed_age,
            "city_coverage": share(c["city_present"], n),
            "city_top": c["city_top"],
            "country_field_seen": "yes" if c["country_seen"] else "no",
            "errors": "; ".join(c["errors"])})

    with open(os.path.join(out_dir, "community-demography.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # mechanic pooling (pooled aggregates only; same suppression rule)
    mechs = {}
    for c in communities:
        m = mechs.setdefault(c["mechanic"], {"groups": 0, "members": 0, "records": 0,
                                             "female": 0, "male": 0, "unspecified": 0,
                                             "age": {b: 0 for b in AGE_BUCKETS},
                                             "age_unknown": 0, "city_present": 0})
        m["groups"] += 1
        m["members"] += c["group_members"] or 0
        m["records"] += c["records_processed"]
        m["female"] += c["sex"]["female"]
        m["male"] += c["sex"]["male"]
        m["unspecified"] += c["sex"]["unspecified"]
        for b in AGE_BUCKETS:
            m["age"][b] += c["age"][b]
        m["age_unknown"] += c["age_unknown_no_year"]
        m["city_present"] += c["city_present"]
    mrows = []
    for mech in ("arrow", "sort", "merge", "match3"):
        m = mechs[mech]
        n = m["records"]
        age_known = sum(m["age"].values())
        mrows.append({
            "mechanic": mech, "n_groups": m["groups"],
            "total_group_members": m["members"], "records_processed": n,
            "sex_female_n": m["female"], "sex_male_n": m["male"],
            "sex_unspecified_n": m["unspecified"],
            "sex_coverage": share(m["female"] + m["male"], n),
            "age_year_coverage": share(age_known, n),
            "age_lt18": sup(m["age"]["lt18"]), "age_18_24": sup(m["age"]["18_24"]),
            "age_25_34": sup(m["age"]["25_34"]), "age_35_44": sup(m["age"]["35_44"]),
            "age_45_54": sup(m["age"]["45_54"]), "age_55plus": sup(m["age"]["55plus"]),
            "age_unknown_no_year_n": m["age_unknown"],
            "city_coverage": share(m["city_present"], n)})
    with open(os.path.join(out_dir, "mechanic-demography.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(mrows[0].keys()))
        w.writeheader()
        w.writerows(mrows)

    method = {"stamp_utc": stamp, "capture_date": capture_date.isoformat(),
              "api_version": api_version(), "tls_source": client.tls_source,
              "min_interval_s": MIN_INTERVAL_S, "page_size": PAGE_SIZE,
              "suppress_under_n": SUPPRESS_UNDER_N,
              "rate_log": os.path.join("artifacts", "vk-demography", stamp, "requests.jsonl").replace("\\", "/"),
              "requests_made": client.requests_made,
              "mapping": mapping,
              "app_members_source": "research/vk-market/reference-audit/shortlist.csv (snapshot 2026-09-16, NOT MAU)",
              "gidkap_note": "group 215368653 mapped via app 54613094 (Sadovody) author_owner_id; "
                             "app 54263990 (Skazka 2026) belongs to group 233460848, same GidKap series"}
    with open(os.path.join(out_dir, "method.json"), "w", encoding="utf-8") as f:
        json.dump(redact(method), f, ensure_ascii=False, indent=2)

    print(f"groups={len(communities)} records={sum(c['records_processed'] for c in communities)} "
          f"requests={client.requests_made} run={run_dir}")
    for c in communities:
        print(f"{c['group_id']} members={c['group_members']} processed={c['records_processed']} "
              f"status={c['status']}")


if __name__ == "__main__":
    try:
        main()
    except FatalVKError as e:
        print(f"FATAL: {e}")
        sys.exit(1)
