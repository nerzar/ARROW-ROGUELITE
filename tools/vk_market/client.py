"""VK API client for the market collector.

- token only from the VK_SERVICE_TOKEN env var (repo-root .env is loaded into env if the var is unset);
- token sent only as `Authorization: Bearer`, never logged or written;
- TLS verified through the OS trust store (truststore), certifi as fallback;
- global rate limiter: at most one request start per MIN_INTERVAL_S (< 1 req/s);
- bounded retries only for network errors / HTTP 5xx;
- VK errors 6/29/32 and HTTP 429: one cool-down retry, then fatal (no retry spam);
- auth / captcha / validation errors are fatal.
"""

import datetime as dt
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API_BASE = "https://api.vk.com/method/"
DEFAULT_API_VERSION = "5.199"
USER_AGENT = "arrow-roguelite-vk-research/0.2 (market-collector)"
TIMEOUT_S = 15
NETWORK_RETRIES = 2
MIN_INTERVAL_S = 1.05
RATE_LIMIT_COOLDOWN_S = 30

RATE_LIMIT_CODES = {6, 29, 32}
FATAL_CODES = {3, 5, 8, 14, 17, 28}  # unknown method, auth, invalid request, captcha, validation, app auth
SECRET_KEYS = {"authorization", "access_token", "token", "vk_service_token"}


class FatalVKError(Exception):
    """Collector must stop; message never contains the token."""


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


def _tls_context():
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


def write_json_atomic(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(redact(data), f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def error_code(body):
    err = body.get("error") if isinstance(body, dict) else None
    return err.get("error_code") if isinstance(err, dict) else None


class VKClient:
    def __init__(self, run_dir, max_requests=None):
        load_env()
        if not token():
            raise FatalVKError("VK_SERVICE_TOKEN is missing or empty")
        self.run_dir = run_dir
        self.ctx, self.tls_source = _tls_context()
        self.max_requests = max_requests  # used to simulate an interruption
        self.requests_made = 0
        self._last_start = 0.0
        self.log_path = os.path.join(run_dir, "requests.jsonl")
        os.makedirs(run_dir, exist_ok=True)

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
        req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token(), "User-Agent": USER_AGENT})
        self.requests_made += 1
        started = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S, context=self.ctx) as resp:
                raw, status = resp.read(), resp.status
        except urllib.error.HTTPError as e:
            raw, status = e.read(), e.code
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            return None, None, round((time.perf_counter() - started) * 1000), redact(type(e).__name__ + ": " + str(e))
        elapsed = round((time.perf_counter() - started) * 1000)
        try:
            body = json.loads(raw.decode("utf-8"))
        except ValueError:
            body = {"non_json_body": raw.decode("utf-8", "replace")[:2000]}
        return redact(body), status, elapsed, None

    def call(self, method, params):
        """Returns an envelope dict: captured_at, api_version, method, request, http_status, elapsed_ms, body."""
        if self.max_requests is not None and self.requests_made >= self.max_requests:
            raise KeyboardInterrupt("simulated interruption: --max-requests reached")
        query = dict(params)
        query["v"] = api_version()
        network_attempts = 0
        rate_retried = False
        while True:
            self._wait_slot()
            captured_at = now_iso()
            body, status, elapsed, net_err = self._http(method, query)
            code = error_code(body)
            self._log({"captured_at": captured_at, "method": method, "params": query, "http_status": status,
                       "elapsed_ms": elapsed, "error_code": code, "network_error": net_err})
            if net_err or (status is not None and status >= 500):
                if network_attempts < NETWORK_RETRIES:
                    network_attempts += 1
                    time.sleep(2 * network_attempts)
                    continue
                raise FatalVKError(f"{method}: network/5xx after {NETWORK_RETRIES} retries: http={status} {net_err or ''}")
            if code in RATE_LIMIT_CODES or status == 429:
                if not rate_retried:
                    rate_retried = True
                    time.sleep(RATE_LIMIT_COOLDOWN_S)
                    continue
                raise FatalVKError(f"{method}: repeated rate limit: code={code} http={status}")
            if code in FATAL_CODES:
                msg = body["error"].get("error_msg", "") if isinstance(body.get("error"), dict) else ""
                raise FatalVKError(f"{method}: fatal VK error {code}: {msg}")
            return {
                "captured_at": captured_at,
                "api_version": query["v"],
                "method": method,
                "request": {"params": query},
                "http_status": status,
                "elapsed_ms": elapsed,
                "body": body,
            }
