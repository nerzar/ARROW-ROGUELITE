"""MKT-001 verify: sums, coverage, suppression, rate log, secrets, diff scope."""
import csv
import glob
import json
import os
import re
import subprocess
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(REPO_ROOT, "research", "vk-market", "demography")
FAIL = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))
    if not ok:
        FAIL.append(name)


def read_csv(name):
    with open(os.path.join(OUT_DIR, name), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def num(v):
    return v != "suppressed" and v != "" and int(v) >= 0


def main():
    load_tok = os.environ.get("VK_SERVICE_TOKEN", "")
    if not load_tok:  # read-only access to compare; never printed
        env_path = os.path.join(REPO_ROOT, ".env")
        if os.path.exists(env_path):
            with open(env_path, encoding="utf-8-sig") as f:
                for line in f:
                    m = re.match(r"^\s*VK_SERVICE_TOKEN\s*=\s*(.*?)\s*$", line)
                    if m:
                        load_tok = m.group(1).strip('"').strip("'")

    comm = read_csv("community-demography.csv")
    mech = read_csv("mechanic-demography.csv")
    with open(os.path.join(OUT_DIR, "method.json"), encoding="utf-8") as f:
        method = json.load(f)

    # 1. coverage: all 12 groups present
    want = {"236576213", "233302675", "240373000", "225055876", "233439912", "234333127",
            "232830008", "236123415", "237611414", "235802722", "215368653", "240707160"}
    got = {r["group_id"] for r in comm}
    check("coverage-12-groups", got == want, f"got {len(got)}/12")

    # 2. sums per community row
    age_cols = ["age_lt18", "age_18_24", "age_25_34", "age_35_44", "age_45_54", "age_55plus"]
    ok_sums = True
    for r in comm:
        n = int(r["records_processed"])
        if int(r["sex_female_n"]) + int(r["sex_male_n"]) + int(r["sex_unspecified_n"]) != n:
            ok_sums = False
        visible = sum(int(r[c]) for c in age_cols if r[c] != "suppressed")
        if visible + int(r["age_unknown_no_year_n"]) + int(r["age_suppressed_remainder_n"]) != n:
            ok_sums = False
    check("sums-sex-age-reconcile", ok_sums, f"{len(comm)} rows")

    # 3. suppression: no published age/city cell in 1..19
    ok_sup, bad = True, []
    for r in comm + mech:
        for c in age_cols:
            if r[c] not in ("suppressed",) and r[c] != "" and 0 < int(r[c]) < 20:
                ok_sup = False
                bad.append(f"{r.get('group_id', r.get('mechanic'))}:{c}={r[c]}")
        ct = r.get("city_top", "")
        if ct not in ("", "suppressed (no city with n>=20)"):
            for part in ct.split(";"):
                m = re.search(r"(\d+)\s*$", part.strip())
                if not m or int(m.group(1)) < 20:
                    ok_sup = False
                    bad.append(f"city cell: {part.strip()[:40]}")
    check("suppression-small-cells", ok_sup, "; ".join(bad[:5]))

    # 4. mechanic pooling matches community sums
    ok_pool = True
    for m in mech:
        pool = [r for r in comm if r["mechanic"] == m["mechanic"]]
        if int(m["records_processed"]) != sum(int(r["records_processed"]) for r in pool):
            ok_pool = False
        if int(m["sex_female_n"]) != sum(int(r["sex_female_n"]) for r in pool):
            ok_pool = False
    check("mechanic-pool-sums", ok_pool, f"{len(mech)} lanes")

    # 5. rate log: min interval between request starts >= 1.0s
    logs = sorted(glob.glob(os.path.join(REPO_ROOT, "artifacts", "vk-demography", "*", "requests.jsonl")))
    if logs:
        ts = []
        for line in open(logs[-1], encoding="utf-8"):
            ts.append(json.loads(line)["t"])
        gaps = [b - a for a, b in zip(ts, ts[1:])]
        check("rate-min-interval", min(gaps) >= 1.0 if gaps else True,
              f"n={len(ts)} min_gap={round(min(gaps), 3) if gaps else 0}s")
    else:
        check("rate-min-interval", False, "no rate log found")

    # 6. no user-level data patterns in committed outputs
    # Exact JSON/CSV keys only: "author_owner_id" (public app->group link) must NOT match.
    banned = ['"first_name"', '"last_name"', '"bdate"', '"user_id"', '"owner_id"',
              '"items": [', "first_name,", "last_name,"]
    blob = ""
    for name in ("community-demography.csv", "mechanic-demography.csv", "method.json"):
        with open(os.path.join(OUT_DIR, name), encoding="utf-8") as f:
            blob += f.read() + "\n"
    check("no-user-level-keys", not any(b in blob for b in banned), "keys scan")
    check("no-player-demographics-wording",
          "player demographic" not in blob.lower(), "wording scan")

    # 7. secret scan over worktree diff + outputs
    findings = []
    if load_tok:
        windows = {load_tok[i:i + 12] for i in range(0, len(load_tok) - 11)}
        for label, text in (("outputs", blob),
                            ("collect.py", open(os.path.join(REPO_ROOT, "tools", "vk_demography",
                                                             "collect.py"), encoding="utf-8").read()),
                            ("verify.py", open(os.path.join(REPO_ROOT, "tools", "vk_demography",
                                                            "verify.py"), encoding="utf-8").read())):
            if load_tok in text or any(w in text for w in windows):
                findings.append(label)
    git = lambda *a: subprocess.run(["git", *a], cwd=REPO_ROOT, capture_output=True,
                                    text=True, encoding="utf-8", errors="replace").stdout
    diff = git("diff", "HEAD") + git("diff", "--cached")
    if load_tok and (load_tok in diff or any(w in diff for w in windows)):
        findings.append("git diff")
    check("secret-scan", not findings, "; ".join(findings) or "clean")

    # 8. diff scope: only allowed paths
    status = git("status", "--porcelain", "--untracked-files=all")
    allowed = ("tools/vk_demography/", "research/vk-market/demography/",
               ".orchestra/tasks/MKT-001-community-demography.md")
    bad_paths = [l for l in status.splitlines()
                 if not l[3:].strip().strip('"').startswith(allowed)]
    check("diff-scope", not bad_paths, "; ".join(bad_paths[:5]) or "allowed only")

    # 9. mapping evidence: 12/12 official links
    official = sum(1 for m in method["mapping"] if m["official_link"])
    check("mapping-official", official == 12, f"{official}/12 official")

    print("VERIFY: " + ("ALL PASS" if not FAIL else f"{len(FAIL)} FAIL: {FAIL}"))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
