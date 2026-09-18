# TASK: REF-001 — Browser Combat UI / VFX References

STATUS: READY
TYPE: EXP/RESEARCH
SIZE: M
BASE_BRANCH: main
BRANCH: research/REF-001-browser-combat-ui-vfx-references
START_SHA: 84348adc95d4b056d221d67221b91e29d9e1565a

## Goal

Собрать конкретные визуальные референсы из браузерных игр для Arrow-Roguelite.

Цель — вдохновение и разбор удачных приёмов, НЕ копирование чужого арта, кода или UI целиком.

## Что искать

Нужны конкретные примеры:
- HP / enemy HUD animation;
- damage numbers;
- hit flash / recoil / squash;
- projectile trail;
- impact;
- cast / attack telegraph;
- interrupt / stun feedback;
- boss presentation / boss hit / phase change;
- death feedback;
- reward / victory presentation;
- game UI transitions.

Предпочитать игры, которые реально можно открыть в браузере и посмотреть руками.

## Result

Сделать короткий reference report в:
`.orchestra/research/REF-001-browser-combat-ui-vfx-references.md`

Для каждого полезного примера:
- игра + ссылка;
- что именно смотреть;
- конкретный приём;
- почему он может пригодиться Arrow-Roguelite;
- что НЕ стоит копировать/переносить.

Нужны не десятки названий ради списка, а примерно 8–15 действительно полезных игр/примеров.

Отдельно выбрать 10–20 конкретных приёмов, которые стоит попробовать в VFX Lab или game shell.

## Boundaries

- Не проектировать новую архитектуру.
- Не менять код игры.
- Не объявлять чужое решение автоматически подходящим нам.
- Не предлагать копировать защищённые ассеты/анимации один в один.
- Не превращать задачу в общий market research или monetization audit.

## Delivery

Коротко:
- RESULT
- TOP REFERENCES
- TOP TECHNIQUES
- FOUND
- REPORT PATH

Commit + push. Не merge в main.

---

## RESULT

Готов reference-отчёт: 12 браузерных игр/примеров (Vampire Survivors web demo, Realm of the Mad God, Diep.io, 20 Minutes Till Dawn web demo, Slay the Web, Kingdom Rush, Bloons TD, ZombsRoyale.io, Krunker.io/Shell Shockers, Clicker Heroes/Zombidle, Melvor Idle, SUPERHOT prototype). По каждому: что смотреть, конкретный приём, применимость к Arrow-Roguelite, что не копировать.

## TOP REFERENCES

См. отчёт: RotMG (боссовые wind-up телеграфы, различимые снаряды), Vampire Survivors (массовый тройной hit feedback), Diep.io (HP-бар по запросу), 20MTD (крит-числа, trail'ы), Slay the Web (enemy intent как ATTACK IN N + иконка), Kingdom Rush/Bloons TD (victory/reward подача, видимость tier'ов снарядов), ZombsRoyale/Krunker (direction damage indicator, edge flash), Clicker Heroes (collect-анимация лута), Melvor Idle (текстовое дублирование чисел), SUPERHOT (выделение через десатурацию).

## TOP TECHNIQUES

20 конкретных приёмов для VFX Lab / game shell — см. отчёт: тройной hit feedback, крит-числа, HP-бар по запросу, телеграф последнего хода, различимые снаряды, trail по tier, impact по типу цели, boss phase change, death feedback, collect-анимация, direction damage indicator, edge damage flash, hit-stop, kill-комбо, Rotate-выделение, victory-подача, transition, reward-карточки, текстовое дублирование, ограниченная палитра снарядов.

## FOUND

- Slay the Web — открытый MIT HTML5-код боевого UI, полезен как reference-only; копирование кода — отдельное решение пользователя.
- Hit-stop / комбо / десатурация дёшево реализуются в Phaser и чистом canvas — кандидаты на быстрый A/B в VFX Lab.
- Общий принцип: один эффект = одна функция; смешение всех слоёв сразу — источник каши на мобильных.

## VERIFY

- Research-only задача: код игры не менялся; tests/typecheck/build не применимы и не запускались.
- Отчёт создан по указанному пути, охватывает все запрошенные категории (HP HUD, damage numbers, hit flash, trail, impact, telegraph, interrupt/stun feedback через wind-up/выделение, boss presentation, death feedback, reward presentation, UI transitions), 12 примеров (норма 8–15) и 20 приёмов (норма 10–20).
- Играется в браузере: все примеры доступны в браузере (web demo, .io-игры, Flash-эра на Armor Games/Poki, открытый HTML5).

## REPORT PATH

`.orchestra/research/REF-001-browser-combat-ui-vfx-references.md`

## STATUS

STATUS: DONE

