// BUILD-033: material pack — 10 painters on the SAME filled-arrow geometry.
// Blizzard-inspired palettes/moods, all original procedural canvas work (no assets).
// Each entry: { id, name, vibe, animated, paint(ctx, path, bb, geo, now, seed) }.
// bb = screen-space bbox {x0,y0,x1,y1}; geo = {cell}; seed = arrow id (stable sparks).

function srand(s) {
  let v = (s >>> 0) || 1
  return () => (v = (v * 1664525 + 1013904223) >>> 0) / 2 ** 32
}

function vgrad(ctx, bb, stops) {
  const g = ctx.createLinearGradient(0, bb.y0, 0, bb.y1)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}

function edge(ctx, path, w, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.lineJoin = 'round'
  ctx.stroke(path)
}

function clipped(ctx, path, fn) {
  ctx.save()
  ctx.clip(path)
  fn()
  ctx.restore()
}

/** Moving sheen band, clipped to the shape. */
function sheen(ctx, bb, cell, t, speed, stops) {
  const x = bb.x0 + ((t * speed) % 1.4 - 0.2) * (bb.x1 - bb.x0)
  const g = ctx.createLinearGradient(x - cell, 0, x + cell, 0)
  for (const [o, c] of stops) g.addColorStop(o, c)
  ctx.fillStyle = g
  ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0)
}

/** Stable twinkling dots inside the shape. */
function sparks(ctx, bb, seed, n, now, color, size, rise = 0) {
  const rnd = srand(seed * 7919 + 13)
  const pts = []
  for (let i = 0; i < n; i++) pts.push([rnd(), rnd(), rnd()])
  const t = now / 1000
  ctx.fillStyle = color
  for (const [fx, fy, ph] of pts) {
    const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + ph * 6.28))
    ctx.globalAlpha = a
    const y = bb.y0 + ((fy - (rise ? (t * rise + ph) % 1 : 0) + 1) % 1) * (bb.y1 - bb.y0)
    ctx.beginPath()
    ctx.arc(bb.x0 + fx * (bb.x1 - bb.x0), y, size, 0, 6.29)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function glowBody(ctx, path, color, blurColor, blur) {
  ctx.save()
  ctx.shadowColor = blurColor
  ctx.shadowBlur = blur
  ctx.fillStyle = color
  ctx.fill(path)
  ctx.restore()
}

export const MATERIALS = [
  {
    id: 'fel', name: 'Скверна', vibe: 'warlock · зелёное пламя',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      const t = now / 1000
      glowBody(ctx, path, '#1d7a2e', 'rgba(64,255,110,0.85)', geo.cell * (0.6 + 0.25 * Math.sin(t * 5 + seed)))
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#7dff6a'], [0.5, '#2fae3f'], [1, '#0d4d1a']])
      ctx.fill(path)
      clipped(ctx, path, () => {
        sheen(ctx, bb, geo.cell, t + seed, 0.5, [[0, 'rgba(180,255,170,0)'], [0.5, 'rgba(200,255,190,0.6)'], [1, 'rgba(180,255,170,0)']])
        sparks(ctx, bb, seed, 7, now, '#d6ffb0', Math.max(1, geo.cell * 0.05), 0.25)
      })
      edge(ctx, path, Math.max(1.5, geo.cell * 0.05), 'rgba(150,255,150,0.9)')
    },
  },
  {
    id: 'frost', name: 'Ледяной трон', vibe: 'death knight · лёд',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      glowBody(ctx, path, '#9fd4ff', 'rgba(150,210,255,0.9)', geo.cell * 0.7)
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#f4fbff'], [0.5, '#a8d4f5'], [1, '#4f83c2']])
      ctx.fill(path)
      clipped(ctx, path, () => {
        // frost cracks: pale diagonal lines
        const rnd = srand(seed * 331 + 7)
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'
        ctx.lineWidth = Math.max(1, geo.cell * 0.03)
        for (let i = 0; i < 3; i++) {
          const y = bb.y0 + rnd() * (bb.y1 - bb.y0)
          ctx.beginPath()
          ctx.moveTo(bb.x0, y)
          ctx.lineTo(bb.x1, y + (rnd() - 0.5) * geo.cell)
          ctx.stroke()
        }
        sparks(ctx, bb, seed, 8, now, '#ffffff', Math.max(1, geo.cell * 0.045), -0.12)
      })
      edge(ctx, path, Math.max(1.5, geo.cell * 0.05), 'rgba(240,250,255,0.95)')
    },
  },
  {
    id: 'holy', name: 'Свет', vibe: 'paladin · святое сияние',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      const t = now / 1000
      glowBody(ctx, path, '#ffe9b0', 'rgba(255,225,150,0.95)', geo.cell * (1.0 + 0.2 * Math.sin(t * 2 + seed)))
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#fffdf4'], [0.55, '#ffdf94'], [1, '#d9a742']])
      ctx.fill(path)
      clipped(ctx, path, () => sparks(ctx, bb, seed, 6, now, '#fff6d8', Math.max(1, geo.cell * 0.05), 0.2))
      edge(ctx, path, Math.max(1.5, geo.cell * 0.05), 'rgba(255,250,230,0.95)')
    },
  },
  {
    id: 'shadow', name: 'Тьма', vibe: 'rogue · тень',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      const t = now / 1000
      // violet mist underlay
      ctx.save()
      ctx.shadowColor = 'rgba(150,80,255,0.9)'
      ctx.shadowBlur = geo.cell * 0.9
      edge(ctx, path, Math.max(3, geo.cell * 0.12), 'rgba(90,30,160,0.85)')
      ctx.restore()
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#3b2064'], [0.55, '#1d1038'], [1, '#0b0618']])
      ctx.fill(path)
      clipped(ctx, path, () => {
        sheen(ctx, bb, geo.cell, t * 0.7 + seed, 0.3, [[0, 'rgba(170,110,255,0)'], [0.5, 'rgba(170,110,255,0.35)'], [1, 'rgba(170,110,255,0)']])
        sparks(ctx, bb, seed, 7, now, '#c79bff', Math.max(1, geo.cell * 0.05), 0)
      })
      edge(ctx, path, Math.max(1.5, geo.cell * 0.045), 'rgba(190,140,255,0.85)')
    },
  },
  {
    id: 'arcane', name: 'Тайная магия', vibe: 'mage · аркана',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      const t = now / 1000
      glowBody(ctx, path, '#7a3fd1', 'rgba(200,120,255,0.9)', geo.cell * (0.6 + 0.3 * Math.sin(t * 4 + seed)))
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#e08fff'], [0.5, '#8a48d8'], [1, '#3d1a72']])
      ctx.fill(path)
      clipped(ctx, path, () => {
        // rune bands: two sliding magenta stripes
        for (const off of [0, 0.5]) {
          const x = bb.x0 + (((t * 0.25 + off + seed * 0.13) % 1)) * (bb.x1 - bb.x0)
          ctx.fillStyle = 'rgba(255,170,240,0.4)'
          ctx.fillRect(x - geo.cell * 0.12, bb.y0, geo.cell * 0.24, bb.y1 - bb.y0)
        }
        sparks(ctx, bb, seed + 5, 9, now, '#ffd7fb', Math.max(1, geo.cell * 0.05), 0)
      })
      edge(ctx, path, Math.max(1.5, geo.cell * 0.05), 'rgba(250,200,255,0.9)')
    },
  },
  {
    id: 'nature', name: 'Дикая природа', vibe: 'druid · листва',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      glowBody(ctx, path, '#3f9e3a', 'rgba(120,220,110,0.7)', geo.cell * 0.5)
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#a8e063'], [0.5, '#4da33d'], [1, '#1e5c22']])
      ctx.fill(path)
      clipped(ctx, path, () => {
        // leaf vein: bright center wash
        sheen(ctx, bb, geo.cell, 0.55, 0.001, [[0, 'rgba(230,255,200,0)'], [0.5, 'rgba(230,255,200,0.5)'], [1, 'rgba(230,255,200,0)']])
        sparks(ctx, bb, seed, 6, now, '#eaffb0', Math.max(1.2, geo.cell * 0.055), 0.08)
      })
      edge(ctx, path, Math.max(2, geo.cell * 0.07), '#274d1d')
      edge(ctx, path, Math.max(1, geo.cell * 0.03), 'rgba(220,255,190,0.8)')
    },
  },
  {
    id: 'storm', name: 'Буря', vibe: 'shaman · молния',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      glowBody(ctx, path, '#2a4fd1', 'rgba(120,180,255,0.9)', geo.cell * 0.7)
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#9dc2ff'], [0.5, '#3a63d8'], [1, '#16265e']])
      ctx.fill(path)
      clipped(ctx, path, () => {
        // crackling lightning, re-rolled a few times per second
        const rnd = srand(seed * 101 + Math.floor(now / 130))
        ctx.strokeStyle = 'rgba(240,248,255,0.9)'
        ctx.lineWidth = Math.max(1, geo.cell * 0.035)
        for (let k = 0; k < 2; k++) {
          let x = bb.x0 + rnd() * (bb.x1 - bb.x0) * 0.4
          let y = bb.y0
          ctx.beginPath()
          ctx.moveTo(x, y)
          while (y < bb.y1) {
            x += (rnd() - 0.5) * geo.cell * 0.9
            y += geo.cell * 0.35
            ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
      })
      edge(ctx, path, Math.max(1.5, geo.cell * 0.05), 'rgba(220,235,255,0.9)')
    },
  },
  {
    id: 'dragonfire', name: 'Драконье пламя', vibe: 'dragon · огонь',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      const t = now / 1000
      const fl = 0.5 + 0.5 * Math.sin(t * 9 + seed * 2)
      glowBody(ctx, path, '#c22e12', `rgba(255,${90 + Math.floor(fl * 60)},20,0.9)`, geo.cell * (0.7 + 0.3 * fl))
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#ffd76a'], [0.45, '#ff7b21'], [1, '#7a1408']])
      ctx.fill(path)
      clipped(ctx, path, () => sparks(ctx, bb, seed, 8, now, '#ffe9a8', Math.max(1, geo.cell * 0.05), 0.35))
      edge(ctx, path, Math.max(2, geo.cell * 0.07), '#5c0e04')
    },
  },
  {
    id: 'moon', name: 'Луна', vibe: 'night elf · лунный свет',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      glowBody(ctx, path, '#b9c8e8', 'rgba(200,215,255,0.8)', geo.cell * 0.8)
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#f2f5ff'], [0.5, '#a9bde0'], [1, '#4c5f8a']])
      ctx.fill(path)
      clipped(ctx, path, () => sparks(ctx, bb, seed + 11, 5, now, '#ffffff', Math.max(1.2, geo.cell * 0.06), 0.05))
      edge(ctx, path, Math.max(1.5, geo.cell * 0.05), 'rgba(245,248,255,0.95)')
    },
  },
  {
    id: 'horde', name: 'Железная Орда', vibe: 'horde · калёное железо',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      const t = now / 1000
      const heat = 0.5 + 0.5 * Math.sin(t * 3 + seed)
      glowBody(ctx, path, '#3a3a40', `rgba(255,80,20,${0.35 + heat * 0.4})`, geo.cell * (0.4 + heat * 0.4))
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#8b8b94'], [0.5, '#43434b'], [1, '#17171b']])
      ctx.fill(path)
      // red-hot edge
      edge(ctx, path, Math.max(2.5, geo.cell * 0.09), `rgba(255,${70 + Math.floor(heat * 50)},20,0.9)`)
      clipped(ctx, path, () => sparks(ctx, bb, seed, 5, now, '#ffb37a', Math.max(1, geo.cell * 0.045), 0.3))
    },
  },
  {
    id: 'carved-gold', name: 'Резное золото', vibe: 'референс 1 · золото по камню',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      const t = now / 1000
      // thin dark-bronze outline like the carved inlay edge
      edge(ctx, path, Math.max(2, geo.cell * 0.07), '#5a3a0c')
      // metallic gold body: champagne top → deep bronze bottom
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#fff3c4'], [0.4, '#f7c948'], [0.75, '#c88f1e'], [1, '#8a5f10']])
      ctx.fill(path)
      clipped(ctx, path, () => {
        // top light wash (static, like sun on metal)
        const g = ctx.createLinearGradient(0, bb.y0, 0, bb.y1)
        g.addColorStop(0, 'rgba(255,252,240,0.55)')
        g.addColorStop(0.4, 'rgba(255,252,240,0)')
        ctx.fillStyle = g
        ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0)
        // rare slow sheen so the metal feels alive
        sheen(ctx, bb, geo.cell, t * 0.4 + seed, 0.15, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']])
      })
      // crisp light inner edge
      edge(ctx, path, Math.max(1, geo.cell * 0.03), 'rgba(255,244,205,0.85)')
    },
  },
  {
    id: 'neon-green', name: 'Руническое свечение', vibe: 'референс 2 · неон по камню',
    animated: true,
    paint(ctx, path, bb, geo, now, seed) {
      const t = now / 1000
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + seed)
      // wide halo on the dark stone
      edge(ctx, path, Math.max(4, geo.cell * 0.22), `rgba(110,255,110,${0.22 + pulse * 0.12})`)
      glowBody(ctx, path, '#8fe83f', 'rgba(140,255,90,0.9)', geo.cell * (0.7 + 0.25 * pulse))
      // neon core: near-white heart → saturated green edge
      ctx.fillStyle = vgrad(ctx, bb, [[0, '#f4ffd6'], [0.45, '#b6ff6a'], [1, '#37c237']])
      ctx.fill(path)
      clipped(ctx, path, () => {
        sheen(ctx, bb, geo.cell, 0.5, 0.001, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']])
        sparks(ctx, bb, seed, 5, now, '#eaffe0', Math.max(1, geo.cell * 0.045), 0.15)
      })
      edge(ctx, path, Math.max(1.5, geo.cell * 0.045), 'rgba(235,255,220,0.95)')
    },
  },
]

export const MATERIAL_IDS = MATERIALS.map((m) => m.id)
export function findMaterial(id) {
  return MATERIALS.find((m) => m.id === id)
}
