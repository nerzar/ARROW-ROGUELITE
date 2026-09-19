# TASK: PRESENT-001 — Презентация способностей врагов: переход между сторонами, stagger, heal, лут, щит

STATUS: READY
TYPE: BUILD (presentation only)
SIZE: M
AGENT: (подходит для Gemini / AI Studio — presentation-слой, движок не трогать)
BASE_BRANCH: main
BRANCH: build/PRESENT-001-ability-presentation

## Цель

Механики уже в движке и видны только текстом в HUD/логе. Игрок должен **видеть** событие раньше,
чем прочтёт его.

## Контекст

Файлы: `spikes/arrow-core/viewer/visual-proto/board-renderer.js` (арена/враги/HUD),
`enemy-visual-state.js` (состояния и тайминги поз), `hit-fx.js` (VFX-003), `projectile-flight.js`.
События приходят в `TapResult` из `EncounterState` (`src/encounter.ts`): `shifted[{id,from,to}]`,
`healed[{id,target,amount}]`, `rewards[{id,heal,rotate}]`, `expired[{id}]`, `pinnedThisTurn[]`,
`shieldRaised[]`, `shieldConsumed[]`. Стороны: 0=N (верх), 1=E (право), 3=W (лево).
Правило VFX (PROJECT.md): presentation only — не импортировать/не менять `EncounterState`, не трогать `src/`.

## Нужно

1. **Переход между сторонами** (`shifted`; разведчик — по таймеру, пьяница — по удару): спрайт за
   ~450 мс пробегает от старого подиума к новому по дуге за доской (образец — `fleeOx/fleeOy` у
   Goblin King), разворот по направлению, squash на старте, приземление с recoil; HUD-плашка едет
   вместе. Для пьяницы перед бегом — «stagger»: шаг назад, поза `hit`, звёздочки.
2. **Heal** (`healed`): от матроны к цели летит зелёно-золотая искра, у цели всплывает `+1`
   (тот же damage-number popup, зелёный), матрона на 300 мс в позе `attack`.
3. **Лут-цель** (`LEAVES IN N`, `rewards`, `expired`): пульс плашки при N ≤ 1; при убийстве —
   вспышка и `+2 HP` зелёным над игроком; при уходе — цель убегает за край (как flee).
4. **Щит** (`shieldRaised` / `shieldConsumed`): полупрозрачный бронзовый диск перед спрайтом;
   при блоке — треск, диск гаснет.
5. **Пин камнем** (`pinnedThisTurn`): проверить существующий визуал пина на плотных досках 7x7/8x8 —
   камень должен читаться на короткой стреле.

## Готово, если

- сцены «Разведчик» (4), «Пьяный дозор» (5), «Матрона» (8), «Капитан» (10), «Обоз» (11) на
  `http://localhost:5177/viewer/visual-proto/index.html` показывают события без чтения лога;
- `src/` не изменён, тесты зелёные, на 8x8 нет просадки кадров.

После сдачи STOP.
