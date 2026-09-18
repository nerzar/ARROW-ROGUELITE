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
