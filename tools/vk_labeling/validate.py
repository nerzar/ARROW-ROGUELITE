"""Validate muse-labels.csv schema/enums/uniqueness (EXP-004 QC step 1)."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LABELS = ROOT / "research/vk-market/labeling/muse-labels.csv"
CORPUS = ROOT / "research/vk-market/labeling/labeling-corpus.csv"

MECHANICS = {"arrow_tapaway", "sort", "screw", "bubble_shooter", "merge", "match3",
             "tile_match", "block_hexa", "picture_reveal", "word", "tabletop",
             "hidden_object", "quiz_trivia", "other_puzzle", "non_puzzle", "unknown"}
THEMES = {"abstract", "magic_fantasy", "monsters_combat", "romance_love",
          "treasure_adventure", "cute_animals", "home_renovation", "food_household",
          "farm_garden", "vehicles", "space_scifi", "detective_mystery",
          "memes_pop_culture", "horror", "realistic_neutral", "unknown_mixed"}
COMBAT = {"none", "cosmetic", "core", "unknown"}
YNU = {"yes", "no", "unknown"}
CONF = {"high", "medium", "low"}
META = {"none", "renovation_story", "collection", "rpg_progression",
        "pvp_tournament", "idle_economy", "other", "unknown"}

COLUMNS = ["app_id", "primary_mechanic", "secondary_mechanics", "primary_theme",
           "secondary_themes", "combat", "roguelite", "meta_layer",
           "arrow_tapaway", "projectile_continues_outside_board", "external_targets",
           "external_mobs_or_enemies", "bosses", "direction_is_resource",
           "board_rotation_or_direction_change", "temporary_targets_or_move_windows",
           "run_upgrades", "choose_one_of_three", "projectile_modifiers", "ricochet",
           "pierce", "split_or_multishot", "chain_or_bounce", "elemental_effects",
           "confidence_mechanic", "confidence_theme",
           "confidence_magic_arrow_features", "needs_review", "evidence"]

MAGIC_ARROW_FEATURES = COLUMNS[8:24]


def check(labels_path: Path = LABELS) -> dict:
    errors: list[str] = []
    with labels_path.open(encoding="utf-8", newline="") as f:
        rdr = csv.DictReader(f)
        if (rdr.fieldnames or []) != COLUMNS:
            errors.append(f"header mismatch: {rdr.fieldnames}")
        rows = list(rdr)
    seen: set[str] = set()
    for n, r in enumerate(rows, start=2):
        aid = r.get("app_id", "")
        if not aid or not aid.isdigit():
            errors.append(f"line {n}: bad app_id {aid!r}")
        if aid in seen:
            errors.append(f"line {n}: duplicate app_id {aid}")
        seen.add(aid)
        if r.get("primary_mechanic") not in MECHANICS:
            errors.append(f"line {n} [{aid}]: bad primary_mechanic {r.get('primary_mechanic')!r}")
        for s in (r.get("secondary_mechanics") or "").split("|"):
            if s and s not in MECHANICS:
                errors.append(f"line {n} [{aid}]: bad secondary {s!r}")
        if r.get("primary_theme") not in THEMES:
            errors.append(f"line {n} [{aid}]: bad primary_theme {r.get('primary_theme')!r}")
        for s in (r.get("secondary_themes") or "").split("|"):
            if s and s not in THEMES:
                errors.append(f"line {n} [{aid}]: bad secondary theme {s!r}")
        if r.get("combat") not in COMBAT:
            errors.append(f"line {n} [{aid}]: bad combat {r.get('combat')!r}")
        if r.get("roguelite") not in YNU:
            errors.append(f"line {n} [{aid}]: bad roguelite {r.get('roguelite')!r}")
        if r.get("meta_layer") not in META:
            errors.append(f"line {n} [{aid}]: bad meta_layer {r.get('meta_layer')!r}")
        for c in MAGIC_ARROW_FEATURES:
            if r.get(c) not in YNU:
                errors.append(f"line {n} [{aid}]: bad {c} {r.get(c)!r}")
        for c in ("confidence_mechanic", "confidence_theme",
                  "confidence_magic_arrow_features"):
            if r.get(c) not in CONF:
                errors.append(f"line {n} [{aid}]: bad {c} {r.get(c)!r}")
        if r.get("needs_review") not in ("yes", "no"):
            errors.append(f"line {n} [{aid}]: bad needs_review {r.get('needs_review')!r}")
        if len(r.get("evidence") or "") > 160:
            errors.append(f"line {n} [{aid}]: evidence >160 chars")
    corpus_ids: set[str] = set()
    if CORPUS.exists():
        with CORPUS.open(encoding="utf-8", newline="") as f:
            corpus_ids = {r["app_id"] for r in csv.DictReader(f)}
    missing = sorted(corpus_ids - seen, key=int) if corpus_ids else []
    extra = sorted(seen - corpus_ids, key=int) if corpus_ids else []
    return {"rows": len(rows), "unique_ids": len(seen), "errors": errors,
            "missing_from_corpus": len(missing), "extra_vs_corpus": len(extra),
            "missing_sample": missing[:20], "extra_sample": extra[:20],
            "pass": not errors and not missing and not extra}


def main() -> int:
    res = check()
    print(json.dumps({k: v for k, v in res.items() if k != "errors"},
                     ensure_ascii=False, indent=2))
    if res["errors"]:
        print(f"ERRORS ({len(res['errors'])}), first 30:")
        for e in res["errors"][:30]:
            print("  " + e)
        return 1
    print("SCHEMA VALIDATION: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
