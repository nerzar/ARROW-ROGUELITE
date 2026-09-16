"""Stage 1: paginate apps.getCatalog for every confirmed sort.

Checkpoint = one raw page file per (sort, offset), written atomically; a sort is finished when
raw/catalog/<sort>/_complete.json exists. Re-running with the same run dir resumes.
"""

import math
import os

from .client import error_code, read_json, write_json_atomic, FatalVKError

SORTS = ["popular_today", "popular_week", "visitors", "growth_rate", "create_date", "popular"]
PAGE_SIZE = 100


def page_path(run_dir, sort, offset):
    return os.path.join(run_dir, "raw", "catalog", sort, f"offset-{offset:06d}.json")


def complete_path(run_dir, sort):
    return os.path.join(run_dir, "raw", "catalog", sort, "_complete.json")


def run(client, run_dir, sorts=SORTS, max_pages=None):
    """max_pages limits pages per sort (small run); such a sort is not marked complete."""
    summary = {}
    for sort in sorts:
        if os.path.exists(complete_path(run_dir, sort)):
            summary[sort] = read_json(complete_path(run_dir, sort))
            print(f"[discover] {sort}: already complete ({summary[sort]['pages']} pages)")
            continue
        offset, pages, fetched, resumed = 0, 0, 0, 0
        max_count_seen = 0
        while True:
            path = page_path(run_dir, sort, offset)
            if os.path.exists(path):
                env = read_json(path)
                resumed += 1
            else:
                env = client.call("apps.getCatalog", {"sort": sort, "count": PAGE_SIZE, "offset": offset, "extended": 1})
                if error_code(env["body"]) is not None:
                    raise FatalVKError(f"apps.getCatalog sort={sort} offset={offset}: VK error {error_code(env['body'])}")
                env["page"] = {"sort": sort, "offset": offset, "page_index": offset // PAGE_SIZE}
                write_json_atomic(path, env)
                fetched += 1
            resp = env["body"]["response"]
            items = resp.get("items", [])
            max_count_seen = max(max_count_seen, resp.get("count", 0))
            pages += 1
            offset += PAGE_SIZE
            if not items or offset >= resp.get("count", 0):
                done = True
                break
            if pages > math.ceil(max_count_seen / PAGE_SIZE) + 5:
                raise FatalVKError(f"apps.getCatalog sort={sort}: pagination did not terminate")
            if max_pages is not None and pages >= max_pages:
                done = False
                break
        info = {"sort": sort, "pages": pages, "last_offset": offset - PAGE_SIZE, "max_count_seen": max_count_seen,
                "fetched_this_run": fetched, "resumed_from_disk": resumed}
        if done:
            write_json_atomic(complete_path(run_dir, sort), info)
        summary[sort] = info
        print(f"[discover] {sort}: pages={pages} fetched={fetched} resumed={resumed} count={max_count_seen} complete={done}")
    return summary


GENRE_PASS_SORT = "create_date"


def genre_page_path(run_dir, genre_id, offset):
    return os.path.join(run_dir, "raw", "catalog-genre", str(genre_id), f"offset-{offset:06d}.json")


def genre_complete_path(run_dir, genre_id):
    return os.path.join(run_dir, "raw", "catalog-genre", str(genre_id), "_complete.json")


def genre_pass(client, run_dir, genre_ids, probe_only=False):
    """Coverage supplement with the documented genre_id filter (sort=create_date).

    probe_only: one count=1 request per genre id, only to read response.count (used for genre ids
    not seen in apps.get data). Returns {genre_id: info}.
    """
    out = {}
    for gid in genre_ids:
        if os.path.exists(genre_complete_path(run_dir, gid)):
            out[gid] = read_json(genre_complete_path(run_dir, gid))
            continue
        if probe_only:
            path = os.path.join(run_dir, "raw", "catalog-genre-probe", f"{gid}.json")
            env = read_json(path) if os.path.exists(path) else None
            if env is None:
                env = client.call("apps.getCatalog", {"sort": GENRE_PASS_SORT, "count": 1, "offset": 0,
                                                      "extended": 0, "genre_id": gid})
                write_json_atomic(path, env)
            code = error_code(env["body"])
            out[gid] = {"genre_id": gid, "probe": True, "error_code": code,
                        "count": None if code is not None else env["body"]["response"].get("count")}
            print(f"[genre-probe] genre_id={gid} count={out[gid]['count']} error={code}")
            continue
        offset, pages, count = 0, 0, 0
        while True:
            path = genre_page_path(run_dir, gid, offset)
            if os.path.exists(path):
                env = read_json(path)
            else:
                env = client.call("apps.getCatalog", {"sort": GENRE_PASS_SORT, "count": PAGE_SIZE, "offset": offset,
                                                      "extended": 1, "genre_id": gid})
                if error_code(env["body"]) is not None:
                    raise FatalVKError(f"apps.getCatalog genre_id={gid} offset={offset}: VK error {error_code(env['body'])}")
                env["page"] = {"sort": GENRE_PASS_SORT, "genre_id": gid, "offset": offset}
                write_json_atomic(path, env)
            resp = env["body"]["response"]
            count = max(count, resp.get("count", 0))
            pages += 1
            offset += PAGE_SIZE
            if not resp.get("items") or offset >= resp.get("count", 0):
                break
            if pages > math.ceil(count / PAGE_SIZE) + 5:
                raise FatalVKError(f"apps.getCatalog genre_id={gid}: pagination did not terminate")
        out[gid] = {"genre_id": gid, "pages": pages, "count": count}
        write_json_atomic(genre_complete_path(run_dir, gid), out[gid])
        print(f"[genre] genre_id={gid} pages={pages} count={count}")
    return out


def iter_genre_pages(run_dir, subdir="catalog-genre"):
    """Yields (genre_id, offset, envelope) for saved genre-pass pages."""
    base = os.path.join(run_dir, "raw", subdir)
    if not os.path.isdir(base):
        return
    for gid in sorted(os.listdir(base), key=int):
        for name in sorted(os.listdir(os.path.join(base, gid))):
            if name.startswith("offset-") and name.endswith(".json"):
                yield int(gid), int(name[7:13]), read_json(os.path.join(base, gid, name))


def iter_pages(run_dir):
    """Yields (sort, offset, envelope) for every saved page, in sort/offset order."""
    for sort in SORTS:
        d = os.path.join(run_dir, "raw", "catalog", sort)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            if name.startswith("offset-") and name.endswith(".json"):
                yield sort, int(name[7:13]), read_json(os.path.join(d, name))
