// ITEM-001: item bar + reward draft screen. Placeholder presentation (plain DOM, the current
// panel look) — ART-011/012/014/015 replace the visuals; this file only owns "what the player can
// click". No combat rule lives here: every decision goes through RunState/EncounterState.
import { DIR_NAMES, ITEMS } from '../../dist/src/index.js'

const SIDE_RU = { 0: 'сверху', 1: 'справа', 2: 'снизу', 3: 'слева' }

/** Player-facing name of a reward card. */
export function describeOffer(o) {
  if (o.kind === 'gold') return { title: `${o.amount} золота`, text: 'Обычная добыча. Пригодится у торговца.' }
  if (o.kind === 'item') return { title: ITEMS[o.id].label, text: `Редкий предмет. ${ITEMS[o.id].text}` }
  if (o.kind === 'heal') return { title: `+${o.hp} HP`, text: 'Восстановить здоровье.' }
  return { title: `+${o.charges} Rotate`, text: 'Ещё один поворот доски в общий запас.' }
}

/**
 * Item bar under the player card. `host` is the `.hud-left` element; `onUse(id, target)` runs the
 * gameplay action. A targeted item (Bow) opens a small side picker built from the live targets.
 */
export function createItemBar(host, { onUse, targetLabel }) {
  const bar = document.createElement('div')
  bar.className = 'item-bar'
  bar.id = 'itemBar'
  host.appendChild(bar)
  let picker = null

  function closePicker() {
    if (picker) picker.remove()
    picker = null
  }

  function render(run) {
    closePicker()
    bar.innerHTML = ''
    if (!run) return
    const enc = run.encounter
    const items = enc.items
    for (let slot = 0; slot < 3; slot++) {
      const it = items[slot]
      const el = document.createElement('button')
      el.className = 'item-slot'
      if (!it) {
        el.classList.add('empty')
        el.textContent = '—'
        el.disabled = true
        bar.appendChild(el)
        continue
      }
      const def = ITEMS[it.id]
      const usable = enc.canUseItem(it.id)
      el.classList.toggle('spent', it.charges <= 0)
      el.title = `${def.label}: ${def.text}`
      el.innerHTML = `<span class="item-name">${def.label}</span><span class="item-pips">${'●'.repeat(it.charges)}${'○'.repeat(Math.max(0, def.charges - it.charges))}</span>`
      el.disabled = !usable
      el.onclick = () => {
        if (def.effect.kind !== 'damage' && def.effect.kind !== 'spawn_arrow') {
          onUse(it.id)
          return
        }
        // Bow: live targets. Arrow: every direction where a placement exists (targets first).
        const sides = def.effect.kind === 'spawn_arrow'
          ? [...enc.liveTargetSides(), ...[0, 1, 3, 2].filter((d) => !enc.liveTargetSides().includes(d))].filter((d) => enc.canUseItem(it.id, d))
          : enc.liveTargetSides()
        if (sides.length === 1) {
          onUse(it.id, sides[0])
          return
        }
        closePicker()
        picker = document.createElement('div')
        picker.className = 'item-picker'
        const head = document.createElement('div')
        head.className = 'item-picker-title'
        head.textContent = def.effect.kind === 'spawn_arrow' ? `${def.label}: в какую сторону?` : `${def.label}: в кого?`
        picker.appendChild(head)
        for (const side of sides) {
          const b = document.createElement('button')
          const who = targetLabel(side)
          b.textContent = who ? `${who} (${SIDE_RU[side] ?? DIR_NAMES[side]})` : `${SIDE_RU[side] ?? DIR_NAMES[side]} (пусто)`
          b.onclick = () => {
            closePicker()
            onUse(it.id, side)
          }
          picker.appendChild(b)
        }
        const cancel = document.createElement('button')
        cancel.className = 'secondary-btn'
        cancel.textContent = 'Отмена'
        cancel.onclick = closePicker
        picker.appendChild(cancel)
        bar.appendChild(picker)
      }
      bar.appendChild(el)
    }
    const g = document.createElement('div')
    g.className = 'item-gold'
    g.textContent = `Золото: ${run.gold}`
    bar.appendChild(g)
    if (enc.wardHp > 0) {
      const w = document.createElement('div')
      w.className = 'item-ward'
      w.textContent = `Щит: ${enc.wardHp}`
      bar.appendChild(w)
    }
  }
  return { render, closePicker }
}

/**
 * Reward draft inside the existing win overlay card. `cardEl` is `.overlay .card`; the caller hides
 * its usual title/body/next button while the draft is up and gets `onDone()` once a choice (or
 * skip) went through RunState.
 */
export function showRewardDraft(cardEl, run, { onDone }) {
  const offers = run.rewardOffers()
  const box = document.createElement('div')
  box.className = 'reward-draft'
  const title = document.createElement('h2')
  title.textContent = 'Награда: выбери одну'
  box.appendChild(title)
  const row = document.createElement('div')
  row.className = 'reward-row'
  box.appendChild(row)
  const note = document.createElement('div')
  note.className = 'reward-note'
  box.appendChild(note)

  function finish() {
    box.remove()
    onDone()
  }

  offers.forEach((o, index) => {
    const d = describeOffer(o)
    const card = document.createElement('button')
    card.className = `reward-card reward-${o.kind}`
    card.innerHTML = `<div class="reward-title">${d.title}</div><div class="reward-text">${d.text}</div>`
    card.onclick = () => {
      if (o.kind === 'item' && run.inventoryFull) {
        // Ask which slot to replace.
        note.innerHTML = ''
        const q = document.createElement('div')
        q.textContent = `Инвентарь полон. Заменить:`
        note.appendChild(q)
        run.inventory.forEach((it, slot) => {
          const b = document.createElement('button')
          b.className = 'secondary-btn'
          b.textContent = ITEMS[it.id].label
          b.onclick = () => {
            if (run.chooseReward(index, slot)) finish()
          }
          note.appendChild(b)
        })
        return
      }
      if (run.chooseReward(index)) finish()
    }
    row.appendChild(card)
  })
  const skip = document.createElement('button')
  skip.className = 'secondary-btn'
  skip.textContent = 'Пропустить'
  skip.onclick = () => {
    run.skipReward()
    finish()
  }
  box.appendChild(skip)
  cardEl.appendChild(box)
}
