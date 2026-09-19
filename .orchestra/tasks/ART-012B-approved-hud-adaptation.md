# TASK: ART-012B — Approved HUD Adaptation

STATUS: DONE
TYPE: ART
SIZE: S
BASE_BRANCH: art/ART-012-player-hud
BRANCH: art/ART-012B-approved-hud-adaptation

## Цель

Канонический перенос утверждённого визуального языка HUD (`docs/visual-refs/approved-ui/approved-hud-reference.png`) на неизменяемую композицию текущего live screenshot (`docs/visual-refs/current-game/04-scene-composition.png`, Moonlit Fortress 1280×720).

## Правила и ограничения

1. Источник стиля: `docs/visual-refs/approved-ui/approved-hud-reference.png` (он же `C:\Users\nerza\Projects\magicarrowassets\gameplay-reference\hud-approved.png`).
2. Источник композиции: `docs/visual-refs/current-game/04-scene-composition.png` — каноническая база.
3. Состав адаптированного HUD:
   - Компактный Player HP HUD слева снизу: круглая плакетка-портрет героини в золотом/зелёном обрамлении, тёмно-сланцевая фасочная подложка, рубиновое сердце, скошенный рубиновый HP-бар `10 / 10`, 3 слота кристаллов маны/зарядов (2 заряженных лазурных + 1 пустой).
   - Rotate справа снизу: золотой светящийся круглый диск с круговыми стрелками и подписью «Rotate».
   - 1–2 item slots рядом с Rotate: лук с зарядом `1`, морозные дротики с зарядом `2` в круглых резных безелях на сланцевом цоколе.
   - Enemy HUD plates: сохранены на подиумах над волками в утверждённом сланцево-рубиновом стиле (иконка черепа/зверя, Dire Wolf, таймер `⏱ 3` / `⏱ 4`, рубиновые HP-бары `3 / 3` и `2 / 2`).
4. Не менять: арену, каменный puzzle-board, стрелки, врагов, расположение сцены, геймплей.
5. Не добавлять: top RPG bar, валюты, level, End Turn, sidebar, новые controls, тяжёлые центральные панели.
6. Выдать ровно один сильный вариант, выглядящий как следующая версия ТЕКУЩЕЙ игры.

## RESULT / VERIFY / FOUND / STATUS

- RESULT: Реализован канонический индустриальный пайплайн вырезанных рамок (Sliced Frame Overlay + Dynamic Health Fill):
  1. Интегрированы чистые мастер-вырезки пользователя: `media_1789831410746.png` (Player Plate), `media_1789831409128.png` (Standard Enemy Plate), `media_1789831407628.png` (Boss Plate), `media_1789831974914.jpg` (1024×1024 Master Rotate Medallion).
  2. Подготовлены прозрачные полые PNG-скины без запечённых цифр/заливок: `player-plate-hollow.png` (чистый портрет, сердце, пустые ромбы, полое окно HP), `enemy-plate-standard-hollow.png`, `enemy-plate-boss-hollow.png`, `crystal-active.png`, `rotate-button.png`, `item-slot-bow.png`, `item-slot-frostdarts.png`.
  3. Очищена база арены `clean_arena_bg.png` от черновых прототипных артефактов (старые белые карточки, зеленые полосы, кружки вращения, шестерёнка, верхние кнопки браузера) с полным сохранением ночного замка, водопадов, факелов, каменной доски со стрелками и волков.
  4. Все динамические параметры (рубиновая заливка здоровья `0..100%`, числовые значения HP, имена мобов, бейджи таймеров `⏱ 3` / `⏱ 4`, лазурные кристаллы маны) рендерятся программно в 4-слойном сэндвиче (Track → Fill → Sliced Frame Overlay → Text).
  5. Финальный production-ready скриншот `docs/visual-refs/hud/04-hud-approved-adaptation.png` (1280×720) обновлён с идеальным позиционированием элементов.
  6. Создан интерактивный стенд `spikes/arrow-core/viewer/hud-sliced-frame-demo.html` с живыми ползунками урона, переключением между стандартным мобом и боссом, кристаллами маны и динамическим тестом 9-slice масштабирования (от 160px до 360px) без искажения наконечников.
- VERIFY:
  1. Проверено визуально через `view_file` для `docs/visual-refs/hud/04-hud-approved-adaptation.png` и `docs/visual-refs/hud/05-hud-sliced-frame-demo.png`.
  2. Проверено в живом браузере Microsoft Edge (headless capture с чистым профилем) на локальном сервере `http://localhost:5177/viewer/hud-sliced-frame-demo.html` и `http://localhost:5177/viewer/hud-approved-adaptation.html`.
  3. Рамки масштабируются без артефактов, наложение рамки поверх бара идеально маскирует край заливки под любым процентом HP.
- FOUND: Использование качественных растровых рамок-скинов (PNG с прозрачным окном) и наложение поверх динамического бара полностью превосходит векторную верстку на CSS/Canvas — сохраняются 100% художественных сколов камня, фасок и текстур референса, а нулевые вычисления геометрии обеспечивают максимальную производительность на мобильных устройствах.
- STATUS: DONE

