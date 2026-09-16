"""python -m tools.vk_labeling {build-corpus,make-chunks,validate,quality,analytics}"""
from __future__ import annotations

import argparse


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m tools.vk_labeling")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build-corpus")
    p = sub.add_parser("make-chunks")
    p.add_argument("--chunk-size", type=int, default=25)
    p.add_argument("--labels", default=None)
    sub.add_parser("validate")
    p = sub.add_parser("quality")
    p.add_argument("--repeat", default=None)
    p.add_argument("--out", default=None)
    sub.add_parser("analytics")
    args = ap.parse_args(argv)

    if args.cmd == "build-corpus":
        from .build_corpus import main as run
        return run()
    if args.cmd == "make-chunks":
        from pathlib import Path
        from .make_chunks import main as run
        kw = {"argv": ["--chunk-size", str(args.chunk_size)]}
        if args.labels:
            kw["argv"] += ["--labels", args.labels]
        return run(kw["argv"])
    if args.cmd == "validate":
        from .validate import main as run
        return run()
    if args.cmd == "quality":
        from pathlib import Path
        from .quality import ROOT, main as run
        argv2: list[str] = []
        if args.repeat:
            argv2 += ["--repeat", args.repeat]
        if args.out:
            argv2 += ["--out", args.out]
        return run(argv2)
    if args.cmd == "analytics":
        from .analytics import main as run
        return run()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
