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
  1. Вырезаны и очищены прозрачные PNG-скины без запечённых цифр/заливок: `enemy-hp-frame.png`, 3-part модули (`enemy-hp-frame-left.png`, `enemy-hp-frame-mid.png`, `enemy-hp-frame-right.png`), `enemy-nameplate-skin.png`, `player-hp-bar-frame.png` (и его 3-part нарезка), `player-plate-sliced.png`, `crystal-active.png`, `crystal-empty.png`, `rotate-button.png`, `item-slot-bow.png`, `item-slot-frostdarts.png`.
  2. Все динамические параметры (рубиновая заливка здоровья `0..100%`, числовые значения HP, имена мобов, бейджи таймеров `⏱ 3` / `⏱ 4`, кристаллы маны) рендерятся программно в 4-слойном сэндвиче (Track → Fill → Sliced Frame Overlay → Text).
  3. Финальный production-ready скриншот `docs/visual-refs/hud/04-hud-approved-adaptation.png` (1280×720) обновлён с использованием аутентичных скинов.
  4. Создан интерактивный стенд `spikes/arrow-core/viewer/hud-sliced-frame-demo.html` с живыми ползунками урона, сменой имён и динамическим тестом 9-slice масштабирования (от 160px до 360px) без искажения наконечников.
- VERIFY:
  1. Проверено визуально через `view_file` для `docs/visual-refs/hud/04-hud-approved-adaptation.png` и `docs/visual-refs/hud/05-hud-sliced-frame-demo.png`.
  2. Проверено в живом браузере на локальном сервере `http://localhost:5177/viewer/hud-sliced-frame-demo.html` и `http://localhost:5177/viewer/hud-approved-adaptation.html`.
  3. Рамки масштабируются без артефактов, наложение рамки поверх бара идеально маскирует край заливки под любым процентом HP.
- FOUND: Вырезка растровых рамок в PNG с прозрачным внутренним окном и наложением поверх динамического бара полностью превосходит векторную верстку на CSS/Canvas — сохраняются 100% художественных сколов камня и металлических фасок, а 3-part нарезка (левый/правый кэп + растягиваемая середина) позволяет применять один и тот же ассет для миньонов, стандартных мобов и боссов.
- STATUS: DONE

