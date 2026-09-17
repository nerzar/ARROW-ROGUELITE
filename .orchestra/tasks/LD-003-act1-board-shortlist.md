# TASK: LD-003 — Act I Board Shortlist From Pattern Library

STATUS: READY
TYPE: BUILD
SIZE: M
AGENT: Gemini 3.8 Flash
BASE_BRANCH: design/LD-002-puzzle-pattern-library
BRANCH: design/LD-003-act1-board-shortlist
START_SHA: 4e010bcfe1c1073e61e5dc21d0a2f5350f478e85

## Goal

Из уже исследованной LD-002 библиотеки выбрать и проверить следующий practical shortlist досок для продолжения Акта I после существующих первых трёх encounters.

Не внедрять уровни в runtime. Не объявлять выборы финальными. Это PLAYTEST SHORTLIST.

## Read first

- `.orchestra/RULES.md`
- `.orchestra/PROJECT.md`
- `.orchestra/GIT.md`
- `.orchestra/LEVEL-DESIGNER.md`
- `docs/LD-002-PUZZLE-PATTERN-LIBRARY.md`
- существующие Act I encounter docs / `act1-e1..e3`
- `docs/COMBAT-RULES.md`

## Current canonical gameplay context

- первые три Act I encounters уже существуют на easy 6x7;
- shared Rotate доступен после пролога, общий pool, encounter не должен требовать его для базового прохождения;
- Stone Pin существует;
- multi-enemy существует;
- caster interrupt существует как gameplay pattern;
- Goblin Shaman теперь boss пролога, а не ordinary caster species;
- Goblin Taunter/King = boss Акта I;
- Dire Wolf = ordinary enemy visual archetype;
- конкретный визуальный вид generic grunt/caster не назначать без user approval.

## Main design objective

Найти 8–12 досок-кандидатов на продолжение Акта I, чтобы progression шёл не только через HP/timers, но и через реально разные puzzle patterns.

Shortlist должен включать рост размера поля:

- несколько easy 6x7;
- несколько medium 8x10;
- минимум 2 hard 10x12 как late-Act candidates.

Не переходить к 24x24.

## Diversity requirements

Не брать подряд одинаковые паттерны.

Покрыть минимум:

- Layered Gates;
- Direction Scarcity;
- False Temptation;
- Choice of Opening;
- Recovery/Punishing Board;
- Rotate Bait;
- Long-Path Reveal;
- один редкий Forced Opening, если он реально приятен в игре.

Для каждого кандидата указать:

- seed / preset / size;
- pattern;
- почему он интересен именно как бой;
- no-Rotate path;
- естественную ошибку игрока;
- как Rotate может помочь, но не быть обязательным;
- подходящие enemy/mechanic pairings (макс 2);
- expected damage floor, если это можно доказать текущим analyzer;
- visual readability / visual value;
- рекомендуемое место в кривой Act I: early / mid / late.

## Playtest requirement

Не доверять только LD-002 score/metrics.

Минимум 8 финальных кандидатов реально воспроизвести:

- intended path;
- alternative path;
- natural mistake;
- recovery possibility;
- visual readability.

Если кандидат красив по цифрам, но скучен руками — удалить из shortlist.

## Existing encounters

Не менять и не переоценивать автоматически:

- Act I #1 seed 22;
- Act I #2 seed 112;
- Act I #3 seed 25.

Но отметить, какие puzzle patterns уже покрывают эти три боя, чтобы #4+ не повторяли ту же мысль без причины.

## Boss preparation

Отдельно выбрать 2–3 board candidates для будущего Goblin King / Taunter boss.

Только board topology:

- не придумывать boss mechanics;
- искать выраженную фазность / asymmetry / meaningful mistake / Rotate temptation;
- минимум medium, предпочтительно hard для позднего Акта I.

## Output

Создать:

`docs/LD-003-ACT-I-BOARD-SHORTLIST.md`

Структура:

1. Что уже учат Act I #1–3.
2. Recommended next-board shortlist (8–12).
3. Proposed progression order — только как proposal, не approval.
4. Goblin King board candidates (2–3).
5. Rejected candidates — 5 примеров и почему скучны/неподходящи.
6. FOUND / open questions (макс 5).

## No runtime changes

Не менять:

- engine;
- renderer;
- encounter JSON;
- balance;
- visual prototype;
- generator;
- solver semantics.

Допустим только маленький research script, если существующих LD-002 artifacts недостаточно; не строить новую систему.

## Delivery

Перед DONE:

- заполнить RESULT / VERIFY / FOUND в task-card;
- commit;
- push `design/LD-003-act1-board-shortlist`;
- проверить remote SHA;
- STATUS DONE только после push.

НЕ merge main.
