# TASK: ART-011B — Approved Reward Reference Pass

STATUS: READY
TYPE: ART
SIZE: S
AGENT:
BASE_BRANCH: main
BRANCH: art/ART-011B-approved-reward-reference

## Цель

Перевести сырой пользовательский reward reference в канонический production visual direction для Reward Choice Screen.

## Источник

Локальный approved reference пользователя:
`C:\Users\nerza\Projects\magicarrowassets\gameplay-reference\reward-approved.png`

Нужно сначала скопировать этот файл в репозиторий в `docs/visual-refs/approved-ui/` с понятным именем и сослаться на него из `docs/visual-refs/README.md`.

## Нужно

- не придумывать новый reward screen с нуля;
- сохранить язык approved HUD и текущей игры;
- сделать один сильный cleaned-up reward mockup на реальном live screenshot;
- 3 reward cards, selected state, confirm/continue;
- учесть ITEM-001/002: gold/heal/Rotate/item/relic могут быть реальными типами наград;
- board/arena остаются узнаваемыми под overlay.

## Не делать

- production reward logic;
- новую economy;
- generic mobile/casino UI.

## Готово, если

- approved reference реально лежит в Git;
- есть один канонический reward mockup, который можно передать в implementation;
- пользователь может ACCEPT/FIX глазами.

После сдачи STOP.