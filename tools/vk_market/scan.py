"""Secret scan (same rules as tools/vk_api_smoke.py scan, validated there with a fake-token control).

Fails on: exact token, any 12+ char token fragment, Bearer/access_token/VK_SERVICE_TOKEN with a
token-like value (20+ chars), tracked .env, secret files or raw artifacts visible in git status.
"""

import os
import re
import subprocess

from .client import REPO_ROOT, load_env, token

VALUE = r"[A-Za-z0-9._\-]{20,}"
PATTERNS = [
    re.compile(r"Authorization[\"']?\s*[:=]\s*[\"']?Bearer\s+" + VALUE, re.I),
    re.compile(r"access_token[\"']?\s*[:=]\s*[\"']?" + VALUE, re.I),
    re.compile(r"VK_SERVICE_TOKEN[\"']?\s*[:=]\s*[\"']?" + VALUE, re.I),
]


def run(paths):
    load_env()
    tok = token()
    if not tok:
        print("SECRET SCAN: FAIL (token not available to compare)")
        return 1
    windows = {tok[i:i + 12] for i in range(len(tok) - 11)}
    findings = []

    def check(label, text):
        if tok in text:
            findings.append(f"{label}: exact token value")
        elif any(w in text for w in windows):
            findings.append(f"{label}: token fragment (12+ chars)")
        for p in PATTERNS:
            if p.search(text):
                findings.append(f"{label}: token-like pattern")

    files = []
    for p in paths:
        if os.path.isdir(p):
            for root, _, names in os.walk(p):
                files += [os.path.join(root, n) for n in names if not n.endswith(".pyc")]
        elif os.path.isfile(p):
            files.append(p)
    for f in files:
        with open(f, encoding="utf-8", errors="replace") as fh:
            check(os.path.relpath(f, REPO_ROOT), fh.read())

    def git(*a):
        return subprocess.run(["git", "-C", REPO_ROOT, *a], capture_output=True, text=True,
                              encoding="utf-8", errors="replace").stdout

    check("git diff HEAD", git("diff", "HEAD"))
    check("git diff --cached", git("diff", "--cached"))
    if git("ls-files", ".env").strip():
        findings.append(".env is tracked by git")
    if git("ls-files", "artifacts").strip():
        findings.append("artifacts/ has tracked files")
    for line in git("status", "--porcelain", "--untracked-files=all").splitlines():
        name = line[3:]
        if re.search(r"(^|/)\.env($|\.)", name) and not name.endswith(".env.example"):
            findings.append(f"git status shows secret file: {name}")
        if name.startswith("artifacts/"):
            findings.append(f"git status shows raw artifact: {name}")

    print(f"scanned files: {len(files)} + git diff/status")
    for x in findings:
        print(" -", x)
    print("SECRET SCAN:", "FAIL" if findings else "PASS")
    return 1 if findings else 0
