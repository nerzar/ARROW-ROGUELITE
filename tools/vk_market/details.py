"""Stage 2: apps.get metadata for every unique app_id from discovery.

Batching was checked first (probe.py: app_ids=3 returned the same keys, values and groups as three
single calls). The API rejects more than 20 ids per call (VK error 100: "app_ids should not contain
more than 20 elements", observed in the first full run). A VK error on a batch is fatal; ids missing
from a successful batch response are re-requested one by one. Checkpoint = one raw file per batch /
single request; re-running resumes. Batch files whose request no longer matches the current chunking
are ignored (not reused).
"""

import os

from .client import FatalVKError, error_code, read_json, write_json_atomic
from .discover import iter_genre_pages, iter_pages

BATCH_SIZE = 20


def discovered_ids(run_dir):
    ids = set()
    for _, _, env in [*iter_pages(run_dir), *iter_genre_pages(run_dir)]:
        for it in env["body"]["response"].get("items", []):
            ids.add(it["id"])
    return sorted(ids)


def ids_path(run_dir):
    return os.path.join(run_dir, "details-ids.json")


def batch_path(run_dir, i):
    return os.path.join(run_dir, "raw", "apps", f"batch-{i:04d}.json")


def single_path(run_dir, app_id):
    return os.path.join(run_dir, "raw", "apps", f"single-{app_id}.json")


def _items(env):
    resp = env["body"].get("response") if isinstance(env["body"], dict) else None
    return resp.get("items", []) if isinstance(resp, dict) else []


def run(client, run_dir, max_batches=None):
    # Freeze the id list on first run so batch numbering is stable across resumes; ids discovered
    # later (genre pass) are appended at the end, so existing batches keep their numbers.
    ids = read_json(ids_path(run_dir))["ids"] if os.path.exists(ids_path(run_dir)) else []
    known = set(ids)
    new = [i for i in discovered_ids(run_dir) if i not in known]
    if new or not os.path.exists(ids_path(run_dir)):
        ids = ids + new
        write_json_atomic(ids_path(run_dir), {"count": len(ids), "ids": ids, "appended_last": len(new)})
    batches = [ids[i:i + BATCH_SIZE] for i in range(0, len(ids), BATCH_SIZE)]
    fetched = resumed = singles = 0
    for bi, chunk in enumerate(batches):
        if max_batches is not None and bi >= max_batches:
            break
        path = batch_path(run_dir, bi)
        pending = [i for i in chunk if not os.path.exists(single_path(run_dir, i))]
        if not pending:
            resumed += 1
            continue
        env = read_json(path) if os.path.exists(path) else None
        if env is not None and env.get("batch", {}).get("requested_ids") == chunk and error_code(env["body"]) is None:
            resumed += 1
        else:
            if env is not None:  # chunk changed (ids appended): keep the old raw file, don't overwrite it
                os.replace(path, path + ".superseded")
            env = client.call("apps.get", {"app_ids": ",".join(map(str, chunk)), "extended": 1})
            env["batch"] = {"index": bi, "requested_ids": chunk}
            if error_code(env["body"]) is not None:
                write_json_atomic(path + ".error", env)
                raise FatalVKError(f"apps.get batch {bi}: VK error {error_code(env['body'])}")
            write_json_atomic(path, env)
            fetched += 1
        got = {it["id"] for it in _items(env)}
        for app_id in pending:
            if app_id in got:
                continue
            s_env = client.call("apps.get", {"app_id": app_id, "extended": 1})
            s_env["single"] = {"app_id": app_id, "reason": "missing from batch"}
            write_json_atomic(single_path(run_dir, app_id), s_env)
            singles += 1
        if (bi + 1) % 10 == 0:
            print(f"[details] batches {bi + 1}/{len(batches)}")
    print(f"[details] ids={len(ids)} batches={len(batches)} fetched={fetched} resumed={resumed} singles={singles}")
    return {"ids": len(ids), "batches": len(batches), "fetched": fetched, "resumed": resumed, "singles": singles}


def iter_details(run_dir):
    """Yields (source, envelope) for batch and single raw files."""
    d = os.path.join(run_dir, "raw", "apps")
    if not os.path.isdir(d):
        return
    for name in sorted(os.listdir(d)):
        if name.endswith(".json") and (name.startswith("batch-") or name.startswith("single-")):
            yield name, read_json(os.path.join(d, name))
