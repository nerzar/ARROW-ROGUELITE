# VIS-003 — Layered 2D Puppet Animation Proof: REPORT

**Branch:** `exp/VIS-003-puppet-animation-proof` (from `design/visual-assets-v01` tip, combat/viewer untouched)
**Demo:** `spikes/puppet-animation/index.html` — open directly in a browser (no build, no server, no deps), or `python3 -m http.server` + open the file.
**Verdict: VIABLE for the production prototype.**

---

## 1. Architecture

```
manifest.js        declarative layer manifest (pivot/parent/pos/z + FX anchors)
dummy-parts.js     procedural stand-in bitmaps (replaced 1:1 by cut AI-art PNGs)
puppet-clips.js    declarative clips: tracks of OFFSETS from bind pose + events
anim-core.js       pure math: easing, key sampler, pose mixer, 2D matrices (node-tested)
puppet.js          hierarchy player: crossfade interrupts, hit-stop, flash, anchors
main.js            demo scene: particles, cast FX, markers, benchmark harness
```

Key decisions, all held up in practice:

- **Clips store offsets from bind pose, not absolute poses.** Final = bind + offset
  (scale is multiplicative, opacity clamped). Clips stay tiny, any clip blends into any
  other by lerping offsets — no full-pose authoring per state.
- **Child `pos` is relative to the parent PIVOT** (skeletal convention), so shoulders/elbows
  stay glued when the torso leans. (First version used parent-image origin; screenshots
  caught limbs shifted by −pivot. Fixed, covered by tests.)
- **No engine.** ~120 lines of sampling + matrix code. Nothing to learn, nothing to port.
- **Events, not timelines:** clips fire named hooks (`flash`, `hitstop`, `strikeBurst`,
  `castGlowStart/Stop`, `deathPoof`). Transient FX state is **reset on every `play()`** —
  interrupting cast mid-channel extinguishes the glow instead of leaking it (also caught
  by screenshots, now a regression test).

## 2. Chosen renderer: Canvas 2D immediate mode — why

| | DOM transforms | PixiJS | **Canvas 2D (chosen)** |
|---|---|---|---|
| Deps | 0 | +WebGL lib, loader, ticker | **0** |
| 100 puppets | 800+ nodes, style recalc per frame | fast | 800 drawImages, fine (measured) |
| Pivot control | `transform-origin` %, fiddly per part | anchor-based, good | explicit pivot math, exact |
| Hit flash | CSS filter per node | shader/filter | precomputed white silhouette, 1 extra drawImage |
| Port path to Phaser/Pixi | rewrite | native | **1:1** — same hierarchy maps to Container/pivot/angle/scale/alpha |

Canvas 2D won because the proof needs to answer "does the *model* work", not "which GPU
binding". Every concept used (parent→child matrix, pivot, alpha, additive glow) exists
identically in Phaser Containers and Pixi. No Phaser import: pulling a game framework in
for one dummy figure would prove nothing extra.

## 3. Animation model (what the demo shows)

- Transforms only: translate / rotate / scale / opacity + easing
  (`linear, sineInOut, quadOut, cubicOut, expoIn, backOut`) + squash/stretch + hit-stop
  freeze + precomputed white-silhouette flash + procedural particles/glow.
- 5 clips: `idle` (2.4 s loop: torso breathe ×2, phase-lagged head, staff/cloak sway),
  `hit` (450 ms: recoil + squash + 66 ms hit-stop + flash + auto-return),
  `attack` (700 ms: 300 ms anticipation coil → 80 ms strike + tip burst → Back.Out recovery),
  `cast` (1.4 s: arms raise, hover −12 px, rune circle + hand glow hooks),
  `death` (1.5 s terminal: stagger → 62° topple → fade, holds corpse until Revive).
- Blending: **120 ms crossfade on every interrupt**; verified transitions
  `idle→hit→idle`, `idle→attack→idle`, `idle→cast→(interrupt)hit→idle`, `idle→death`
  (button "Test: cast → hit interrupt → idle" replays the hard case).

## 4. FX hooks (for the main visual shell)

Anchors resolved through the live hierarchy every frame: `handL`, `weaponTip`,
`bodyCenter`, `headTop` (+ `staffGrip` in manifest). Toggle "FX markers" draws them.
Intended bindings: cast glow + projectile origin at `weaponTip`/`handL`, hit particles at
`bodyCenter`, speech/status marker at `headTop`. Demo spawns minimal bursts/glow itself;
the shell brings its own VFX and only needs `puppet.anchor(name)`.

## 5. Real-asset import steps (dummy → AI art)

1. Generate MASTER (1024², neutral 3/4 pose, limbs separated, flat `#808080` bg, soft light).
2. Cut into transparent layers per `manifest.js` part list; inpaint hidden zones (LaMa/Generative Fill).
3. Give every joint a **rounded cap** tucked under its parent (rotations must never open gaps).
4. Export runtime layers trimmed, ~2× display size (e.g. 380×360 composite → ≤760 px source).
5. Replace `DummyParts.buildParts()` with PNG/WebP loading into the same `{img, white, w, h}`
   shape (white silhouette = `source-in` fill, precomputed once). **Manifest format unchanged.**
6. Re-tune `pos`/pivots once per character (shoulder/neck/grip land differently per art),
   then author clips by copying the dummy timing and adjusting amplitudes.

No code changes are needed to adopt real art — only bitmaps + numbers.

## 6. Pipeline answers (§7 questions)

- **Separate PNGs vs atlas:** separate trimmed files per part during production;
  **one atlas per character (or one shared Act-1 atlas) at runtime**, packed by any packer.
  The manifest stores per-part UV rects instead of file names — the player already treats
  bitmaps opaquely, so the swap is loader-only.
- **Reasonable texture size:** per-character atlas **512²** (≈1 MB VRAM RGBA); full V01
  screen (bg + board + 3 puppets + VFX) ≈ **13–14 MB VRAM**, far under the ~150 MB
  mobile-WebView comfort zone. Matches `VISUAL-ASSET-PACK-V01.md` budgets.
- **Pivot storage:** normalized `[0..1]` floats in the manifest, next to size/parent/pos.
  Never derive pivots from filenames or folder conventions.
- **Avoiding trim jumps:** trim transparent margins freely, but **pivot/pos stay defined in
  untrimmed-master coordinates** OR re-export pivot together with the trimmed rect
  (pivot_uv = (pivot_master − trim_origin) / trim_size). Second variant is what packers emit;
  either is fine as long as pivot and rect travel together.
- **Consistent origin:** one ground-contact root per character `(0.5, 1.0)`; all layout and
  shadows use it, never part corners.
- **WebP vs PNG:** **WebP (lossless or q90+) for runtime** — ~3–5× smaller downloads than
  PNG-32 with visually identical flat-shaded art; keep PNG masters for editing. Alpha is clean
  either way; defringe once at cut time.
- **When an atlas is really needed:** when draw-call count or texture swaps matter —
  roughly ≥10 puppets sharing a sheet, or to cut HTTP requests on VK WebView.
  At our scale (1–4 large enemies) separate WebPs are *acceptable*, atlas is *nicer*;
  decide at import time, the manifest supports both.

## 7. Measured performance (headless Chromium, SwiftShader software GL — a floor, real GPUs do better)

Same looping `idle` on all puppets, 2 s measure after settle. Draw calls = 8/puppet (+flash only on hits).

| puppets | FPS | ms/frame | draw calls | DOM nodes | JS heap |
|---|---|---|---|---|---|
| 1 | 60 (vsync cap) | 16.67 | 8 | 44 | 9.5 MB |
| 10 | 60 (vsync cap) | 16.67 | 80 | 59 | 9.5 MB |
| 30 | 60 (vsync cap) | 16.67 | 240 | 66 | 9.5 MB |
| 100 | 40 | 24.1 | 800 | 73 | 9.5 MB |

1–30 puppets are vsync-capped even under software rendering; cost scales linearly with
drawImages. **Our game needs 1–4 large enemies: headroom is ~10×.** No optimization needed
before production art lands. (DOM count stays flat — one canvas; heap flat — shared bitmaps.)

## 8. Verification

- `node anim-core.test.js` — 15 assertions (easing, sampling, offsets, pivot invariance,
  parent→child composition): **pass**.
- Headless smoke (`vis003-smoke.js`, temp-only): 18 assertions over the real clip set —
  loop/hold/return behavior, events, flash decay, glow lifecycle, interrupt crossfade,
  terminal death + fade, anchor resolution, root-track recoil: **pass**.
- Headless Chromium screenshots of all 5 clips reviewed by hand; **zero console errors**.
  Screenshots caught 2 genuine bugs pre-report (pivot-frame shift, root-track drop +
  glow leak); all fixed with regression coverage.

## 9. Limitations (honest)

- Procedural dummy, not AI art: real cuts will need one pivot/pos tuning pass per character.
- No skew/shear, no mesh deform, no IK — wolf-quadruped richness from the asset pack will
  lean on lunge + jaw + VFX rather than true skeletal motion (consistent with V01 spec).
- No 90–180° turns: puppets are cardboard-theatre by construction; our staging (enemies face
  the board, never turn) makes this irrelevant, but it rules out e.g. a "turn around" gag
  without a dedicated swapped layer.
- Flash uses a precomputed silhouette (1 extra drawImage while flashing) — cheaper than
  `ctx.filter`, but a shader tint would scale better past ~50 simultaneous flashes.
- Benchmark is one machine + software GL; re-run on a mid Android device with real art
  before locking the atlas decision.

## 10. What the main visual shell (Claude) needs to consume this

- Copy nothing; depend on nothing here. The portable contract is:
  1. **Manifest shape** (`parts[]` with `size/pivot/parent/pos/z`, `anchors{}`, root = ground center).
  2. **Clip shape** (offset tracks + named events + `loop`/`terminal`).
  3. **`anchor(name)` semantics** (world-space point through live hierarchy).
- Phaser mapping: part → `Container` child with `setPivot`/`angle`/`scale`/`alpha`;
  clip player → tween sampling per frame (or port `anim-core.js` sampling verbatim —
  it is framework-free); events → existing shell VFX (projectile spawn, particles, speech).
- Suggested first integration: Shaman (6 layers) using the dummy timing as placeholder,
  swap bitmaps when the real cut lands.

## 11. Layer manifest example

```json
{
  "name": "dummy-caster",
  "parts": [
    { "id": "torso", "src": "torso.webp", "size": [150, 180],
      "pivot": [0.50, 0.90], "parent": "root", "pos": [0, -95], "z": 2 },
    { "id": "staff", "src": "staff.webp", "size": [70, 260],
      "pivot": [0.35, 0.62], "parent": "armR", "pos": [0, 128], "z": 7 }
  ],
  "anchors": {
    "weaponTip":  { "node": "staff", "p": [0.50, 0.03] },
    "bodyCenter": { "node": "torso", "p": [0.50, 0.50] },
    "headTop":    { "node": "head",  "p": [0.50, 0.05] }
  }
}
```

Full form lives in `spikes/puppet-animation/manifest.js` (8 parts, 5 anchors).

---

## 12. Files

`spikes/puppet-animation/`: `index.html`, `anim-core.js`, `anim-core.test.js`,
`manifest.js`, `puppet-clips.js`, `dummy-parts.js`, `puppet.js`, `main.js`, `REPORT.md`.
No combat, viewer, solver, encounter, or docs files touched.
