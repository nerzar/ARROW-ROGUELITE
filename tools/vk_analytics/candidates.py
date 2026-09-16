"""Recall-oriented candidate retrieval over title + description + genre (EXP-002).

Not a classifier. A row means "worth sending to LLM labelling for this bucket", with the reason.
match_strength:
  strong - title hit or a specific description pattern (or a strong genre signal where noted);
  weak   - generic word or genre-only signal; expected precision is low, kept for recall.
"""

from __future__ import annotations

import csv
import random
import re
from dataclasses import dataclass, field
from pathlib import Path

from .build import connect

# Puzzle genres that carry a puzzle signal on their own.
PUZZLE_GENRES = {"Puzzle", "Three in a row"}
HOT_RANK = 300  # ranks deeper than a few hundred are unstable for popular/popular_today

# Sentences that describe controls ("стрелки на клавиатуре") produce false arrow/merge hits.
CONTROL_SENTENCE = re.compile(
    r"[^.!?\n]*(управлени|клавиатур|клавиш|wasd|\bпк\b|компьютер|мыш[ьикою]|пробел|свайп|часовой стрел|"
    r"джойстик|геймпад|[⬆⬇←→↑↓])[^.!?\n]*")


def norm(s: str | None) -> str:
    return (s or "").lower().replace("ё", "е")


@dataclass
class Rule:
    bucket: str
    kind: str  # mechanic | extra_mechanic
    title_strong: str | None = None
    desc_strong: list[str] = field(default_factory=list)
    desc_weak: list[str] = field(default_factory=list)
    title_weak: str | None = None
    strong_genres: set[str] = field(default_factory=set)
    weak_genres: set[str] = field(default_factory=set)
    weak_needs_puzzle_genre: bool = False
    strip_controls: bool = False


W = r"[^.!?\n]{0,%d}"  # same-sentence gap

MECHANIC_RULES: list[Rule] = [
    Rule(
        "arrow_tapaway", "mechanic",
        title_strong=r"(?<!пере)стрелк|стрелоч|\barrows?\b|tap.?away|распута|unpuzzle|\bстрел(ы|ам|ами|ах)\b|туда.?сюда",
        title_weak=r"\bстрелок\b|лабиринт",
        desc_strong=[
            r"(стрелк|стрелочк)\w*" + W % 80 + r"(улета|вылета|уезжа|уедет|едет|сдвига|двига|убира|за пределы|с поля|очист)",
            r"(убира|убери|убрать|освобод|очисти|убирайте)\w*" + W % 60 + r"(стрелк|стрелочк)",
            r"tap.?away|unpuzzle|arrow puzzle|arrows puzzle",
            r"(в ту сторону|в направлении)" + W % 20 + r"(куда|указанн|стрелк)",
            r"головолом\w*" + W % 30 + r"(со|с) стрел",
        ],
        desc_weak=[
            r"(?<!пере)стрелк|стрелочк",
            r"(блок|кубик|фигур|змей|змейк|машинк|деталь|детали)\w*" + W % 60 + r"(улета|вылета|уезжа|за пределы пол)",
            r"распута|распутыва",
        ],
        weak_needs_puzzle_genre=True,
        strip_controls=True,
    ),
    Rule(
        "sort", "mechanic",
        title_strong=r"сортир|сортиров|\bsort\b|по полочкам|по полкам|полки|полочк|перелей|переливай",
        desc_strong=[
            r"сортир|сортиров|\bsort\b|water sort|перелива|перелей|переливай|по полочкам|по полкам",
        ],
        desc_weak=[
            r"(расставля|разлож|расклад|упорядоч|распредел|раздел)\w*" + W % 40 + r"(полк|полочк|предмет|товар|цвет|бутыл|колб|пробирк)",
            r"\bполк[аиеу]\b|полках|полочк|стеллаж|пробирк|колб[аыу]",
        ],
        weak_needs_puzzle_genre=True,
    ),
    Rule(
        "screw", "mechanic",
        title_strong=r"\bвинт(ы|ик|ики|иков|ов|ами|а)?\b|\bболт(ы|ик|ики|иков|ов|ами|а)?\b|гайк|шуруп|\bscrews?\b|\bbolts?\b|\bnuts\b|открути|выкрути|болтомани",
        desc_strong=[
            r"\bвинт(ы|ик|ики|иков|ов|ами|а)?\b|\bболт(ы|ик|ики|иков|ов|ами|а)?\b|гайк|шуруп|\bscrews?\b|\bbolts?\b|\bnuts\b",
            r"откручива|выкручива|открути|выкрути|закручива",
        ],
    ),
    Rule(
        "bubble", "mechanic",
        title_strong=r"пузыр|bubble|\bбабл|\bзум[аеуы]\b|zuma|зумаленд|марбл|шарик\w* шутер",
        desc_strong=[
            r"bubble|бабл.?шутер|пузырьков\w* шутер|\bзум[аеуы]\b|zuma",
            r"(стреля|выстрел|запуска|бросай|кидай)\w*" + W % 40 + r"(шарик|пузыр)",
            r"(шарик|пузыр)\w*" + W % 40 + r"(одного|того же|такого же) цвета",
        ],
        desc_weak=[
            r"пузыр",
            r"(шарик|шары)\w*" + W % 30 + r"(лопа|взрыва|сбива)",
        ],
        weak_needs_puzzle_genre=True,
    ),
    Rule(
        "merge", "mechanic",
        title_strong=r"слия|слиян|сливай|\bmerge|мердж|мерж|2048|суйк|suika|арбуз|объединяй",
        desc_strong=[
            r"слия|слиян|сливай|\bmerge|мердж|мерж|2048|суйк|suika",
            r"соединя\w* предмет|игр\w* на (соединени|объединени)|merge.?2|мерж.?2",
            r"(объедин|соедин|совмещ|скрещ|сталкива)\w*" + W % 40 + r"(одинаков|два одинак|две одинак)\w*" + W % 40
            + r"(получ|созда|нов|больш|следующ|улучш)",
        ],
        desc_weak=[
            r"(объедин|соедин|скрещ)\w*" + W % 30 + r"(одинаков|два|две)",
            r"арбуз",
        ],
        weak_needs_puzzle_genre=True,
    ),
    Rule(
        "match3", "mechanic",
        title_strong=r"(три|3|тр[её]х)[ -]?в[ -]?ряд|match[ -]?3|матч[ -]?3|\bматч\b",
        desc_strong=[
            r"(три|3|тр[её]х)[ -]?в[ -]?ряд|match[ -]?3|матч[ -]?3",
            r"(собира|соединя|составля|выстраива|меня|переставля)\w*" + W % 40
            + r"(три|3|тр[её]х)( и более| или более)? (одинаков|кристалл|камн|фишк|элемент|конфет|фрукт)",
        ],
        weak_genres={"Three in a row"},
    ),
    # Extra buckets: not required by EXP-002, used to explain non-candidates in the recall audit.
    Rule(
        "extra_tile_mahjong", "extra_mechanic",
        title_strong=r"маджонг|mahjong|тайл|\btile|плитк|пасьянс.?маджонг",
        desc_strong=[r"маджонг|mahjong|\btile|тайл|(найди|собери|убери)" + W % 20 + r"(пар|три|3) (одинаков\w* )?плит"],
        desc_weak=[r"плитк|пары одинаков"],
        weak_needs_puzzle_genre=True,
    ),
    Rule(
        "extra_block_hexa", "extra_mechanic",
        title_strong=r"\bблок|\bblock|гекс|hexa|шестиуг|тетрис|tetris|\b1010\b|судоку.?блок|кубики",
        desc_strong=[r"тетрис|tetris|block puzzle|блок.?пазл|гекс|hexa|шестиугольн",
                     r"(заполн|собира)\w*" + W % 40 + r"(линии|ряды|строк)\w*" + W % 40 + r"(блок|фигур)"],
        desc_weak=[r"\bблок(и|ов|ами)?\b|фигур\w*" + W % 30 + r"(поле|сетк)"],
        weak_needs_puzzle_genre=True,
    ),
    Rule(
        "extra_picture_jigsaw", "extra_mechanic",
        title_strong=r"пазл|jigsaw|картин|раскрас|рисунок|рисуй|nonogram|японск\w* кроссв|pixel art|по номерам|tap gallery",
        desc_strong=[r"jigsaw|собери (картинку|пазл|изображ)|кусочк\w*" + W % 30 + r"(картин|изображ)|раскрас|по номерам",
                     r"(откро|открыва|раскро|проявл)\w*" + W % 30 + r"(скрыт\w* )?(картин|изображ|рисун)"],
        desc_weak=[r"пазл|картинк"],
        weak_needs_puzzle_genre=True,
    ),
    Rule(
        "extra_hidden_object_differences", "extra_mechanic",
        title_strong=r"отлич|поиск предмет|найди|скрыт\w* предмет|hidden object|где .*\?",
        desc_strong=[r"(найди|найти|ищи|искать|отыщ)\w*" + W % 30 + r"(отлич|предмет|спрятан|скрыт)", r"hidden object"],
    ),
]

PUZZLE_KEYWORD = re.compile(r"головолом|пазл|puzzle|логическ\w* игр|три в ряд|3 в ряд|уровн\w* сложност")

# Theme-combo buckets: (bucket, strong regex [title or desc], weak title regex, weak desc regex).
# All require a puzzle signal. Generic marketing words ("стратегия", "приключение", "сказка", "сердца" as lives)
# are only weak and mostly title-only: in descriptions they match almost every casual game.
THEME_RULES: list[tuple[str, str, str, str]] = [
    (
        "puzzle_combat_roguelite",
        r"рогалик|roguel|rogue.?like|подземель|dungeon|\bбосс|\bурон|сражени|сражай|сражат|битв[аеуыо]|\bpvp\b|\brpg\b|\bрпг\b"
        r"|враг[аиоу]?\b|врагов|монстр|\bорд[аыу]\b|полчищ|tower defen|защит\w* башн|башенн\w* защит",
        r"\bгеро(и|ев|ям|ями|й|я)\b|воин|рыцар|зомби|демон|арми[яи]|оборон|защитник|боец|бойц|войн[аы]\b",
        r"\bгеро(и|ев|ям|ями)\b" + W % 40 + r"(сраж|бо[йяе]|атак|враг|побед)|\bатак\w*" + W % 40 + r"(враг|монстр|противник)"
        r"|оружи|прокачк\w*" + W % 30 + r"(геро|персонаж|оруж|навык)|волн\w* (враг|монстр|зомби)|зомби|демон",
    ),
    (
        "magic_fantasy_puzzle",
        r"маги[яиюей]\b|магическ|\bмаг(а|у|ом|и|ов)?\b|волшеб|колдун|колдовств|ведьм|чароде|заклина|зель[яеи]\b|зелье|алхими"
        r"|фэнтез|фентез|дракон|эльф|\bфе[яиюей]\b|единорог|fantasy|\bmagic|wizard|witch|баба яга|\bяг[аи]\b|кощ",
        r"сказ|мистик|мистич|\bрун|гном|тролл|гоблин|миф|легенд|чуд[оеа]\b|чудес",
        r"мистическ|\bрун(ы|а|ами)?\b|гном|тролл|гоблин|мифическ\w* (сущест|мир)|заколдован|сказочн\w* (мир|королев|лес|сущест)",
    ),
    (
        "romance_love_puzzle",
        r"любов|романт|свидани|влюбл|амур|купидон|валентин|\blove\b|cupid|поцелу|свадьб|невест|жених|флирт",
        r"сердечк|сердц|сердце|пара\b|парочк|принцесс|лавстори|kiss",
        r"возлюблен|отношени\w* (межд|пар|геро)|разбит\w* сердц|семейн\w* драм|найти (свою )?любов|вернуть (\w+ )?(муж|жен|девушк|парн)",
    ),
    (
        "treasure_adventure_puzzle",
        r"сокровищ|\bклад(ы|а|ов)?\b|кладоиск|пират|экспедиц|археолог|артефакт|затерян|гробниц|пирамид|treasure|сундук|джунгл|индиана",
        r"приключени|adventure|остров|золот|древн|путешеств|тайн|секрет|загадк|квест|quest|поиск|карта",
        r"древн\w* (храм|город|цивилиз|тайн|руин)|руин|карт[аеуы] сокров|тайн\w* (остров|храм|древн)|золот\w* (монет|слитк|жил)",
    ),
]


def _search(pattern: str | None, text: str) -> str | None:
    if not pattern:
        return None
    m = re.search(pattern, text)
    return m.group(0) if m else None


def match_mechanic(rule: Rule, title: str, desc: str, genre: str) -> tuple[str, list[str]] | None:
    reasons, strong = [], False
    d = CONTROL_SENTENCE.sub(" ", desc) if rule.strip_controls else desc
    if (hit := _search(rule.title_strong, title)):
        reasons.append(f"title:{hit}")
        strong = True
    for p in rule.desc_strong:
        if (hit := _search(p, d)):
            reasons.append(f"desc:{hit[:40]}")
            strong = True
            break
    if genre in rule.strong_genres:
        reasons.append(f"genre:{genre}")
        strong = True
    if not strong:
        allowed = not rule.weak_needs_puzzle_genre or genre in PUZZLE_GENRES or PUZZLE_KEYWORD.search(title + " " + d)
        if allowed:
            if (hit := _search(rule.title_weak, title)):
                reasons.append(f"title_weak:{hit}")
            for p in rule.desc_weak:
                if (hit := _search(p, d)):
                    reasons.append(f"desc_weak:{hit[:40]}")
                    break
        if genre in rule.weak_genres:
            reasons.append(f"genre_weak:{genre}")
    if not reasons:
        return None
    return ("strong" if strong else "weak"), reasons


def puzzle_signal(title: str, desc: str, genre: str, mech_hits: dict) -> tuple[str, str] | None:
    strong_mech = [b for b, (s, _) in mech_hits.items() if s == "strong"]
    if genre in PUZZLE_GENRES:
        return "strong", f"genre:{genre}"
    if strong_mech:
        return "strong", f"mechanic:{strong_mech[0]}"
    if (m := PUZZLE_KEYWORD.search(title)):
        return "strong", f"title:{m.group(0)}"
    if (m := PUZZLE_KEYWORD.search(desc)):
        return "weak", f"desc_weak:{m.group(0)}"
    if mech_hits:
        return "weak", f"mechanic_weak:{next(iter(mech_hits))}"
    return None


def match_theme(strong_re: str, weak_title_re: str, weak_desc_re: str, title: str, desc: str) -> tuple[str, str] | None:
    if (h := _search(strong_re, title)):
        return "strong", f"title:{h}"
    if (h := _search(strong_re, desc)):
        return "strong", f"desc:{h}"
    if (h := _search(weak_title_re, title)):
        return "weak", f"title_weak:{h}"
    if (h := _search(weak_desc_re, desc)):
        return "weak", f"desc_weak:{h[:40]}"
    return None


COLUMNS = ["bucket", "bucket_kind", "app_id", "title", "genre", "match_strength", "reasons", "members_count",
           "published", "age_days", "rank_growth_rate", "rank_popular_week", "rank_popular_today", "hot_top300"]


def load_apps():
    con = connect()
    rel = con.sql("""
        SELECT app_id, title, genre, description, members_count, CAST(CAST(published_at AS DATE) AS VARCHAR) AS published,
               age_days, rank_growth_rate, rank_popular_week, rank_popular_today
        FROM apps_x ORDER BY app_id
    """)
    cols = rel.columns
    return [dict(zip(cols, r)) for r in rel.fetchall()]


def retrieve(apps) -> list[dict]:
    out = []
    for a in apps:
        title, desc, genre = norm(a["title"]), norm(a["description"]), a["genre"]
        mech_hits = {}
        for rule in MECHANIC_RULES:
            if (res := match_mechanic(rule, title, desc, genre)):
                mech_hits[rule.bucket] = res
                out.append(_row(a, rule.bucket, rule.kind, res[0], res[1]))
        ps = puzzle_signal(title, desc, genre, {k: v for k, v in mech_hits.items()})
        if not ps:
            # RPG/Strategy etc. with puzzle words are covered by PUZZLE_KEYWORD; nothing else qualifies.
            continue
        for bucket, strong_re, weak_title_re, weak_desc_re in THEME_RULES:
            if (th := match_theme(strong_re, weak_title_re, weak_desc_re, title, desc)):
                strength = "strong" if ps[0] == th[0] == "strong" else "weak"
                out.append(_row(a, bucket, "theme_combo", strength, [f"puzzle<{ps[1]}>", f"theme<{th[1]}>"]))
    return out


def _row(a, bucket, kind, strength, reasons) -> dict:
    ranks = [a["rank_growth_rate"], a["rank_popular_week"], a["rank_popular_today"]]
    return {
        "bucket": bucket, "bucket_kind": kind, "app_id": a["app_id"], "title": a["title"], "genre": a["genre"],
        "match_strength": strength, "reasons": "; ".join(reasons), "members_count": a["members_count"],
        "published": a["published"], "age_days": a["age_days"],
        "rank_growth_rate": a["rank_growth_rate"], "rank_popular_week": a["rank_popular_week"],
        "rank_popular_today": a["rank_popular_today"],
        "hot_top300": int(any(r is not None and r <= HOT_RANK for r in ranks)),
    }


REQUIRED_BUCKETS = ["arrow_tapaway", "sort", "screw", "bubble", "merge", "match3", "puzzle_combat_roguelite",
                    "magic_fantasy_puzzle", "romance_love_puzzle", "treasure_adventure_puzzle"]


def run(out: Path) -> int:
    apps = load_apps()
    rows = retrieve(apps)
    order = {b: i for i, b in enumerate(REQUIRED_BUCKETS + [r.bucket for r in MECHANIC_RULES if r.kind != "mechanic"])}
    rows.sort(key=lambda r: (order[r["bucket"]], r["match_strength"] != "strong", -(r["members_count"] or 0), r["app_id"]))
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    ids = {a["app_id"] for a in apps}
    keys = [(r["bucket"], r["app_id"]) for r in rows]
    print(f"wrote {out}: {len(rows)} rows, {len({r['app_id'] for r in rows})} unique apps")
    print(f"duplicate (bucket, app_id): {len(keys) - len(set(keys))}; app_id not in snapshot: "
          f"{sum(r['app_id'] not in ids for r in rows)}")
    required_ids = {r["app_id"] for r in rows if r["bucket"] in REQUIRED_BUCKETS}
    print(f"unique apps in required buckets: {len(required_ids)}")
    print(f"{'bucket':34} {'total':>6} {'strong':>6} {'weak':>6} {'hot':>5} {'new365':>6}")
    for b in order:
        br = [r for r in rows if r["bucket"] == b]
        print(f"{b:34} {len(br):6} {sum(r['match_strength'] == 'strong' for r in br):6} "
              f"{sum(r['match_strength'] == 'weak' for r in br):6} {sum(r['hot_top300'] for r in br):5} "
              f"{sum((r['age_days'] or 10**6) <= 365 for r in br):6}")
    return 0


def audit(seed: int, n_neg: int, pos_per_bucket: int, out: Path | None) -> int:
    """Seeded samples for the manual audit. Negatives = apps outside every required mechanic bucket."""
    apps = load_apps()
    rows = retrieve(apps)
    by_id = {a["app_id"]: a for a in apps}
    mech_ids = {r["app_id"] for r in rows if r["bucket_kind"] == "mechanic"}
    rng = random.Random(seed)
    neg_pool_puzzle = sorted(a["app_id"] for a in apps if a["app_id"] not in mech_ids and a["genre"] in
                             PUZZLE_GENRES | {"Hyper-casual"})
    neg_pool_other = sorted(a["app_id"] for a in apps if a["app_id"] not in mech_ids and a["genre"] not in
                            PUZZLE_GENRES | {"Hyper-casual"})
    k_p = round(n_neg * 2 / 3)
    sample = [("negative_puzzleish", "", i) for i in rng.sample(neg_pool_puzzle, k_p)]
    sample += [("negative_other", "", i) for i in rng.sample(neg_pool_other, n_neg - k_p)]
    theme_ids = {r["app_id"] for r in rows if r["bucket_kind"] == "theme_combo"}
    neg_pool_theme = sorted(a["app_id"] for a in apps if a["app_id"] not in theme_ids and (
        a["genre"] in PUZZLE_GENRES or a["app_id"] in mech_ids))
    sample += [("negative_theme", "", i) for i in rng.sample(neg_pool_theme, n_neg // 2)]
    for b in REQUIRED_BUCKETS:
        for strength in ("strong", "weak"):
            pool = sorted(r["app_id"] for r in rows if r["bucket"] == b and r["match_strength"] == strength)
            k = min(len(pool), pos_per_bucket if strength == "strong" else max(1, pos_per_bucket // 2))
            sample += [(f"positive_{strength}", b, i) for i in rng.sample(pool, k)]
    reasons = {(r["bucket"], r["app_id"]): r["reasons"] for r in rows}
    other = {}
    for r in rows:
        other.setdefault(r["app_id"], []).append(r["bucket"])
    records = []
    for kind, bucket, i in sample:
        a = by_id[i]
        d = re.sub(r"\s+", " ", a["description"] or "")[:240]
        records.append({"sample": kind, "bucket": bucket, "app_id": i, "title": a["title"], "genre": a["genre"],
                        "reasons": reasons.get((bucket, i), ""), "all_buckets": "|".join(other.get(i, [])),
                        "description_head": d})
    for r in records:
        print(f"[{r['sample']}|{r['bucket']}] {r['app_id']} {r['title']} ({r['genre']}) {{{r['all_buckets']}}} "
              f"<{r['reasons']}> :: {r['description_head']}")
    if out:
        with out.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(records[0]), lineterminator="\n")
            w.writeheader()
            w.writerows(records)
    return 0
