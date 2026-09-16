"""Split labeling-corpus.csv into local chunks (20-30 apps) for sequential labeling.

Reads text (title/genre/description<=1500 chars) from DuckDB artifacts.
Chunks go to artifacts/vk-labeling/chunks/ (LOCAL ONLY, never commit:
they contain full descriptions).

Resume: already labeled app_ids (from --labels CSV, if present) are skipped
when building chunk worklists; chunk files themselves are stable by seed.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "research/vk-market/labeling/labeling-corpus.csv"
DB = ROOT / "artifacts/vk-analytics/magic-arrow.duckdb"
CHUNK_DIR = ROOT / "artifacts/vk-labeling/chunks"
PROGRESS = ROOT / "artifacts/vk-labeling/progress.json"

CHUNK_SIZE = 25
DESC_LIMIT = 1500


def load_labeled(labels_path: Path | None) -> set[str]:
    done: set[str] = set()
    if labels_path and labels_path.exists():
        with labels_path.open(encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                if row.get("app_id"):
                    done.add(row["app_id"])
    return done


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chunk-size", type=int, default=CHUNK_SIZE)
    ap.add_argument("--labels", type=Path, default=None,
                    help="existing muse-labels.csv to skip finished app_ids")
    args = ap.parse_args(argv)

    with CORPUS.open(encoding="utf-8", newline="") as f:
        corpus = [r["app_id"] for r in csv.DictReader(f)]
    done = load_labeled(args.labels)
    todo = [i for i in corpus if i not in done]

    con = duckdb.connect(str(DB), read_only=True)
    con.execute("SET TimeZone = 'UTC'")
    text_of = {}
    for app_id, title, genre, desc in con.sql(
        "SELECT app_id, title, genre, description FROM apps_x"
    ).fetchall():
        d = (desc or "").replace("\r", " ").replace("\n", " ")
        d = " ".join(d.split())
        text_of[str(app_id)] = (title or "", genre or "", d[:DESC_LIMIT])
    con.close()

    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    # stable chunking over the FULL corpus order (not filtered), so chunk ids persist
    chunks: list[list[str]] = []
    for k in range(0, len(corpus), args.chunk_size):
        chunks.append(corpus[k:k + args.chunk_size])

    manifest = []
    for idx, ids in enumerate(chunks):
        pending = [i for i in ids if i in set(todo)]
        items = [
            {"app_id": i, "title": text_of[i][0], "genre": text_of[i][1],
             "description": text_of[i][2]}
            for i in ids if i in text_of
        ]
        path = CHUNK_DIR / f"chunk_{idx:03d}.json"
        with path.open("w", encoding="utf-8") as f:
            json.dump({"chunk": idx, "size": len(ids), "items": items},
                      f, ensure_ascii=False)
        manifest.append({"chunk": idx, "size": len(ids),
                         "pending": len(pending), "file": path.name})

    PROGRESS.parent.mkdir(parents=True, exist_ok=True)
    with PROGRESS.open("w", encoding="utf-8") as f:
        json.dump({"corpus": len(corpus), "labeled": len(done),
                   "pending": len(todo), "chunks": len(chunks),
                   "chunk_size": args.chunk_size}, f, ensure_ascii=False, indent=2)

    pend_chunks = sum(1 for m in manifest if m["pending"])
    print(f"corpus={len(corpus)} labeled={len(done)} pending={len(todo)} "
          f"chunks={len(chunks)} with_pending={pend_chunks}")
    for m in manifest:
        if m["pending"]:
            print(f"  chunk_{m['chunk']:03d}: size={m['size']} pending={m['pending']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
