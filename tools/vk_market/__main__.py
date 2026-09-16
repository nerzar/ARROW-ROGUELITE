import argparse
import datetime as dt
import os
import sys

from .client import REPO_ROOT, FatalVKError, api_version, load_env, now_iso, read_json, write_json_atomic

COLLECTOR_VERSION = "0.1.0"


def new_run_dir(prefix=""):
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return os.path.join(REPO_ROOT, "artifacts", "vk-market", prefix + stamp)


def _manifest(run_dir, client, args):
    path = os.path.join(run_dir, "manifest.json")
    m = read_json(path) if os.path.exists(path) else {
        "created_at": now_iso(), "api_version": api_version(), "collector_version": COLLECTOR_VERSION,
        "rate_limit": "min 1.05 s between request starts (<1 req/s)", "tls_source": client.tls_source,
        "invocations": []}
    m["invocations"].append({"started_at": now_iso(), "argv": sys.argv[1:], "api_version": api_version()})
    write_json_atomic(path, m)
    return m


def _finish(run_dir, status, client):
    path = os.path.join(run_dir, "manifest.json")
    m = read_json(path)
    m["invocations"][-1].update({"finished_at": now_iso(), "status": status, "requests_made": client.requests_made})
    write_json_atomic(path, m)


def _genre_pass(client, run_dir, sorts):
    from . import details, discover
    seen = sorted({it["genre_id"] for _, env in details.iter_details(run_dir)
                   for it in (env["body"].get("response") or {}).get("items", []) if "genre_id" in it})
    if not seen:
        raise FatalVKError("genre pass needs apps.get details first (no genre_id observed)")
    catalog_count = max(v["max_count_seen"] for v in sorts.values())
    # First a count=1 probe per genre: paginate only genres where the filter actually narrows the catalog.
    probes = discover.genre_pass(client, run_dir, seen, probe_only=True)
    effective = [g for g, v in probes.items() if v["error_code"] is None and v["count"] is not None
                 and 0 < v["count"] < catalog_count]
    report = {"catalog_count": catalog_count, "observed_genre_ids": seen,
              "probes": {str(k): v for k, v in probes.items()},
              "genre_id_filter_effective": bool(effective)}
    print(f"[genre] observed genres={len(seen)} filter narrows count for {len(effective)} of them")
    if effective:
        result = discover.genre_pass(client, run_dir, effective)
        report["genres"] = {str(k): v for k, v in result.items()}
    write_json_atomic(os.path.join(run_dir, "genre-pass.json"), report)


def main(argv=None):
    p = argparse.ArgumentParser(prog="python -m tools.vk_market")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("probe", help="small safe probes: page size, pagination tail, apps.get batch vs single")

    c = sub.add_parser("collect", help="stage 1 discovery + stage 2 details, resumable")
    c.add_argument("--run-dir", help="existing run dir to resume; a new one is created if omitted")
    c.add_argument("--max-pages", type=int, help="pages per sort (small run; sorts stay incomplete)")
    c.add_argument("--skip-details", action="store_true")
    c.add_argument("--max-requests", type=int, help="stop after N API requests (simulated interruption)")
    c.add_argument("--genre-pass", action="store_true",
                   help="coverage supplement: probe each genre_id seen in apps.get with count=1 and paginate "
                        "(sort=create_date) only genres whose count is below the catalog count")

    s = sub.add_parser("snapshot", help="build research/vk-market/snapshots/<date>/ from a run dir")
    s.add_argument("--run-dir", required=True)
    s.add_argument("--date", help="override UTC snapshot date")
    s.add_argument("--out-dir", help="write snapshot files here instead of research/vk-market/snapshots/<date>")

    v = sub.add_parser("verify", help="consistency checks of a built snapshot")
    v.add_argument("--run-dir", required=True)
    v.add_argument("--snapshot-dir", required=True)

    k = sub.add_parser("calibrate", help="members_count vs UI 'players' sample -> metric-calibration.csv")
    k.add_argument("--run-dir", required=True)

    sc = sub.add_parser("scan", help="secret scan of paths + git diff/status")
    sc.add_argument("paths", nargs="+")

    args = p.parse_args(argv)
    try:
        if args.cmd == "probe":
            from . import probe
            probe.run(new_run_dir("probe-"))
        elif args.cmd == "collect":
            from . import details, discover
            from .client import VKClient
            run_dir = os.path.abspath(args.run_dir) if args.run_dir else new_run_dir()
            client = VKClient(run_dir, max_requests=args.max_requests)
            _manifest(run_dir, client, args)
            print(f"[collect] run_dir={run_dir}")
            try:
                sorts = discover.run(client, run_dir, max_pages=args.max_pages)
                if args.genre_pass:
                    _genre_pass(client, run_dir, sorts)
                if not args.skip_details and args.max_pages is None:
                    details.run(client, run_dir)
            except KeyboardInterrupt as e:
                _finish(run_dir, f"interrupted: {e}", client)
                print(f"[collect] INTERRUPTED after {client.requests_made} requests; resume with --run-dir {run_dir}")
                return 3
            except FatalVKError as e:
                _finish(run_dir, f"fatal: {e}", client)
                raise
            _finish(run_dir, "ok", client)
            print(f"[collect] done, requests={client.requests_made}")
        elif args.cmd == "snapshot":
            from . import snapshot
            snapshot.build(os.path.abspath(args.run_dir), args.date, args.out_dir and os.path.abspath(args.out_dir))
        elif args.cmd == "verify":
            from . import verify
            return verify.run(os.path.abspath(args.run_dir), os.path.abspath(args.snapshot_dir))
        elif args.cmd == "calibrate":
            from . import calibrate
            calibrate.run(os.path.abspath(args.run_dir))
        elif args.cmd == "scan":
            from . import scan
            return scan.run(args.paths)
    except FatalVKError as e:
        print("FATAL:", e, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
