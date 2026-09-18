# TASK: ACT-I-001 — First Three Playtest Encounters

STATUS: DONE
TYPE: CONTENT
SIZE: M
AGENT: Gemini / Antigravity
BASE_BRANCH: feat/RUN-001-shared-rotate-resource
BRANCH: content/ACT-I-001-first-three-playtest
START_SHA: 8482cc36820e0ba54a1d372c8de6d8f2b8d9fbca
RESULT_SHA: 3eef0a9372235762d45c79effff2d74a52511036

## Зачем

Создать первые три плейтестовых encounter для Act I с поддержкой сквозного пула Rotate из RUN-001 и проверить их проходимость солвером и в визуальном шелле.

## Контент боев

1. **Act I Encounter 1 (`act1-e1.json`)**:
   - Seed 22 (levelHash `6e96e567`).
   - Концепт: Multi-enemy reinforcement (Западный и Восточный grunt'ы).
   - Враги:
     - `grunt_w`: HP 2, initial interval 3, attack interval 3, damage 2.
     - `grunt_e`: HP 3, initial interval 5, attack interval 3, damage 2.
   - Rotate: `useRunPool: true`, visible.
   - Проходимость без Rotate: Решение солвером за 5 ходов [0, 5, 6, 10, 9], 0 урона игроку.

2. **Act I Encounter 2 (`act1-e2.json`)**:
   - Seed 112 (levelHash `6a5e4f2c`).
   - Концепт: Cross-Lock (Восточный и Северный grunt'ы).
   - Враги:
     - `grunt_e`: HP 2, initial interval 3, attack interval 3, damage 2.
     - `grunt_n`: HP 2, initial interval 4, attack interval 3, damage 2.
   - Rotate: `useRunPool: true`, visible.
   - Проходимость без Rotate: Решение солвером за 4 хода [0, 3, 2, 4], 0 урона игроку.

3. **Act I Encounter 3 (`act1-e3.json`)**:
   - Seed 25 (levelHash `1d1342bc`).
   - Концепт: Caster + Grunt.
   - Враги:
     - `caster_n`: HP 3, cast interval 3, damage 4, interruptible, transition into attack interval 3, damage 2.
     - `grunt_e`: HP 2, initial interval 4, attack interval 3, damage 2.
   - Rotate: `useRunPool: true`, visible.
   - Проходимость без Rotate: Решение солвером за 5 ходов [3, 0 (interrupt), 2, 4, 5], 0 урона игроку.

## Rotate и Run Flow

- Все три боя используют общий пул `RunState` Rotate (`useRunPool: true`).
- Награда за пролог (`cp-e5.json`): `winRotateReward: 2`. При победе над боссом пролога игрок переходит в Act I с 2 зарядами Rotate.
- В визуальном шелле (`viewer/visual-proto/app.js`):
  - Добавлена последовательность `SEQUENCE_STEPS`: `cp-e5` -> `act1-e1` -> `act1-e2` -> `act1-e3`.
  - При победе появляется оверлей с переходом к следующему бою (`Далее →`) или поздравлением с победой на финальном бое.
  - Поддерживается перезапуск шага (`r` / кнопка "Заново").
  - Dropdown `ui.scenePick` содержит все сцены последовательности и стендэлон сцены; по умолчанию открывается `act1-e1`.
- Сценарий с тратой Rotate:
  - Игрок тратит 1 Rotate в `act1-e1` -> на финише остается 1 Rotate.
  - Переход в `act1-e2` с 1 зарядом -> Rotate не тратится.
  - Переход в `act1-e3` с 1 зарядом.
  - Подтверждено тестом `act1-playtest.test.ts` и эмуляцией.

## Проверка

- 160/160 тестов vitest (`npm test` в `spikes/arrow-core`) проходят успешно.
- 9 специализированных тестов в `test/act1-playtest.test.ts`:
  - Проверка валидности JSON и levelHash для всех трех боев.
  - Солвер подтверждает 0-Rotate чистую победу для всех трех боев без потери HP игрока.
  - Полный сквозной прогон цепочки от пролога до финальной победы.
  - Проверка сценария сохранения/расхода 1 заряда Rotate между боями.
