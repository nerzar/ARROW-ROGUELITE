# Arrow-Roguelite — Visual Asset Production Pack V01

**Document Version:** 1.0.0  
**Status:** PRODUCTION READY SPECIFICATION  
**Target Milestone:** Playable Visual Prototype V01 (16:9 Widescreen / 1920x1080)  
**Author:** Art Production Designer  
**Source Specifications:** `docs/VISUAL-PROTOTYPE-V01.md`, `docs/VISUAL-DIRECTION.md`, `docs/ARROW-VISUAL-PROGRESSION.md`

---

## 1. Executive Summary & Art Direction Lock

This document establishes the **concrete, production-ready asset specification** for today's playable visual prototype of **Arrow-Roguelite**.

### 1.1 Art Direction Principles (Locked)
- **Layout & Readability:** Strictly aligned with **Concept 2 (Widescreen Spatial Hierarchy)**. Clear zoning: top boss dais, left/right flanking platforms, clean center board anchor, and bottom player/utility console.
- **Lighting, Materials & Atmosphere:** Strictly aligned with **Concept 1 (Relief & Dual-Tone Lighting)**. Heavy chiseled granite, mossy masonry, warm brazier fires (`#FFA000`) contrasted against cool nocturnal ambient twilight (`#1A3045`).
- **Style:** Premium Stylized Dark Fantasy (Dark Fantasy Lite). Rich tactile materials, chiseled bevels, readable silhouettes; no grimdark gore, no flat corporate minimalism.
- **Board Primacy:** The puzzle board is the master interactive element. The environment, lighting, and stage layout leave unobstructed flight corridors directly connecting board exits to enemy hitboxes.

---

## 2. Master Minimal Asset Roster (10 Assets)

Strictly limited to the essential 10 items required for a complete, responsive, visually polished combat screen:

1. **Goblin Taunter** — Top Stage Boss (Layered Puppet)
2. **Goblin Shaman** — Left Flank Ranged Caster (Layered Puppet)
3. **Dire Wolf** — Right Flank Melee Brute (Hybrid Puppet / Procedural Deform)
4. **Fantasy Arena Background** — 16:9 Stage Environment (NO characters, NO board, NO UI)
5. **Stone Puzzle-Board Frame** — Ancient Altar Foundation (NO arrows, transparent playable interior)
6. **Player Portrait** — Hooded Arcane Ranger / Archer Heroine
7. **Rock Projectile** — Physical Ranged Munition (Enemy stone throw / Taunter projectile)
8. **Generic Magic Projectile** — Arcane Bolt / Released Arrow projectile (Arrow-to-target flight)
9. **Cast-Circle / Magic Glow Texture** — Additive Ground Sigil & Telegraph Aura
10. **Hit / Explosion FX Texture** — 4-Frame Radial Impact Burst Sheet

---

## 3. Character Asset Production Specifications

All characters follow the unified pipeline established in `docs/2D-ASSET-PIPELINE-ANALYSIS.md`:
- **Source Resolution:** 1024x1024 px Master Render (high-precision detail capture).
- **Runtime Atlas Size:** Packed into a single shared Act-1 biome atlas (1024x1024 WebP) or individual trimmed sprites (300x300 to 450x400 px effective).
- **Camera Perspective:** Consistent 3/4 front-facing isometric / mild low-angle heroic perspective, oriented facing inward toward the central board.
- **Lighting Alignment:** Primary key light cool cyan-white from top-right (45 deg), secondary warm amber rim light (`#FFA000`) from arena braziers.

---

### 3.1 Goblin Taunter (Top Stage Boss)

#### A. Master Render Prompt
> **Prompt:**  
> `2D video game character sprite, Goblin Taunter boss, devious comedic male goblin king, wearing a crooked dented iron crown with rusted spikes and a tattered royal crimson velvet cape over rough leather harness, greenish-olive skin, long pointed ears, wide mockingly grinning mouth with sharp yellow teeth, bow-legged athletic stance. Facing away from camera looking back over his shoulder with a smug taunting grin, slapping his backside in a cheeky comedic challenge, clean silhouette, neutral semi-rear 3/4 pose with arms clearly separated from torso. Premium stylized dark fantasy digital illustration, hand-painted texture, rich chisel details, studio lighting with cool rim from top-right and warm amber lantern glow from bottom-left. Isolated on solid flat neutral grey background #808080, full body, zero ground shadows, no background, no text, no UI overlay --no perspective blur, cropped limbs, photographic noise, realistic anatomy`

#### B. Puppet Cut Plan (7 Layers)
To support the signature comedy butt-slap gag without spritesheet bloat:
1. `taunter_cape` (Z-Index 0): Back half of tattered crimson cape hanging from shoulders.
2. `taunter_legs` (Z-Index 1): Bow-legged squatting stance, heavy buckled boots and leather knee-wraps.
3. `taunter_hips` (Z-Index 2): Rounded green rump in ragged breeches with visible comedic crown tattoo on buttock.
4. `taunter_torso` (Z-Index 3): Lean muscular goblin torso, leather cross-belts, iron buckle plate.
5. `taunter_arm_left` (Z-Index 4): Far arm resting cockily on bent left knee.
6. `taunter_head` (Z-Index 5): Head with spiked iron crown, large bat ears, smug side-eye grin over shoulder.
7. `taunter_arm_right` (Z-Index 6): Near arm bent backward in hand-slap position over the hip.

#### C. Animation Plan (5 States)
- **Idle:** Procedural rhythmic breathing (`scaleY: 1.0 -> 1.03`, 1200ms sine wave). Hips sway horizontally (`x: +-4px`). Head bobs with 120ms lag.
- **Hit:** Instant frame-1 freeze (66ms hit-stop) + white silhouette shader flash. Sharp jolt forward toward board (`y: +12px, scaleX: 1.15, scaleY: 0.85`, 70ms), hands clutch backside in exaggerated comedic agony (`arm_right` rotates +30 deg).
- **Attack (Rock / Dung Throw):** 
  - *Telegraph:* Torso coils backward (`angle: -10 deg`, duration 300ms).
  - *Strike:* Torso whips forward (`angle: +15 deg`, 80ms), `arm_right` flings projectile down toward board, cape flutters.
  - *Recovery:* Snaps back to smirk (`ease: Back.Out`, 250ms).
- **Cast / Taunt (Rotate Challenge):** Rapid pelvic waggle (`x: +-8px`, 6 Hz frequency) while `arm_right` slaps buttock (`angle: -20 deg <-> +15 deg`). Speech bubble triggers above crown.
- **Death:** Face-down comical collapse onto dais (`y: +40px, angle: 90 deg` or swap to dedicated knockout sprite), drops crown which spins on floor, small white surrender flag waves from hand (`angle: +-15 deg` loop).

#### D. Dimension & Pivot Specifications
- **Master Source:** 1024x1024 px master render.
- **Runtime Composite Size:** 380x360 px (effective canvas bounds).
- **Pivots (X, Y normalized 0.0 to 1.0):**
  - Root: (0.50, 1.00) — Floor contact center.
  - `taunter_legs`: (0.50, 1.00) — Ground base.
  - `taunter_hips`: (0.50, 0.40) — Center of pelvis.
  - `taunter_torso`: (0.50, 0.85) — Lumbar spine joint.
  - `taunter_head`: (0.45, 0.85) — Base of neck.
  - `taunter_arm_left`: (0.20, 0.20) — Shoulder socket.
  - `taunter_arm_right`: (0.75, 0.25) — Shoulder socket.
  - `taunter_cape`: (0.50, 0.10) — Collar hook.

---

### 3.2 Goblin Shaman (Left Flank Ranged Caster)

#### A. Master Render Prompt
> **Prompt:**  
> `2D video game character sprite, Goblin Shaman caster, frail hunched goblin warlock wearing a deep violet and crimson hooded cowl adorned with small animal bones and bone trinkets, glowing mystical amber-yellow eyes peering from shadowed hood, wrinkled green skin. Gripping a tall gnarled crooked dark wooden staff topped with a glowing purple amethyst crystal skull in his right hand, left hand raised with clawed fingers channeling arcane energy. Facing 3/4 toward the right, oriented toward center stage. Premium stylized dark fantasy digital art, sharp silhouette, crisp contours, glowing magical rim-light, atmospheric purple staff aura, soft amber lantern fill light. Isolated on solid flat neutral grey background #808080, full body, zero ground shadows, no background, no text, no UI --no motion blur, extra limbs, photographic noise`

#### B. Puppet Cut Plan (6 Layers)
1. `shaman_cowl_back` (Z-Index 0): Back cloth of deep violet cowl and ragged robe hem.
2. `shaman_body` (Z-Index 1): Hunched torso, ragged belt with potion vials and skull charms, stationary robed feet.
3. `shaman_arm_left` (Z-Index 2): Off-hand claw raised in spellcasting gesture.
4. `shaman_head` (Z-Index 3): Hooded head with glowing yellow eyes, jutting chin, bone earrings.
5. `shaman_arm_right` (Z-Index 4): Forearm gripping the gnarled staff.
6. `shaman_staff` (Z-Index 5): Crooked wooden staff with amethyst crystal skull crowning the tip.

#### C. Animation Plan (5 States)
- **Idle:** Mystical levitating float / breathing oscillation (`y: +-5px`, 1800ms sine cycle). Amethyst skull pulses with additive violet glow shader (`intensity: 70% -> 100%`).
- **Hit:** Sudden backward flinch (`x: -14px, angle: -8 deg`, 60ms). Hood snaps backward, staff tips forward. 1-frame solid white hit flash.
- **Attack (Dark Bolt Release):** Staff thrusts horizontally toward right board edge (`x: +20px`, 90ms). Magic projectile spawns from crystal skull tip. Staff recoil eases back (`duration: 200ms`).
- **Cast (Curse / Mud Blocker Channeling):** Both hands raise high (`arm_left angle: -35 deg, arm_right angle: -30 deg`), body rises `12px` off ground. Ground runic circle rotates beneath feet. Staff crystal emits dense purple sparks.
- **Death:** Shaman shudders violently, cowl collapses into an empty pile of cloth and bone trinkets on the stone floor, body dissolves via noise-dissolve shader into violet smoke embers.

#### D. Dimension & Pivot Specifications
- **Master Source:** 1024x1024 px master render.
- **Runtime Composite Size:** 260x380 px.
- **Pivots (X, Y normalized 0.0 to 1.0):**
  - Root: (0.50, 0.95) — Platform contact point.
  - `shaman_body`: (0.50, 0.90) — Robe base.
  - `shaman_head`: (0.50, 0.80) — Neck pivot inside hood.
  - `shaman_arm_left`: (0.70, 0.30) — Left shoulder.
  - `shaman_arm_right`: (0.35, 0.35) — Right shoulder.
  - `shaman_staff`: (0.45, 0.60) — Hand grip anchor.
  - `shaman_cowl_back`: (0.50, 0.20) — Nape anchor.

---

### 3.3 Dire Wolf / Brute (Right Flank Melee Enemy)

#### A. Master Render Prompt
> **Prompt:**  
> `2D video game character sprite, Dire Wolf beast monster, hulking muscular predatory shadow wolf with scarred dark charcoal and steel-grey fur, spiked iron combat collar around heavy neck, glowing blood-red ferocious eyes, bared jagged fangs dripping saliva, aggressive low predatory prowl stance facing 3/4 toward the left, oriented toward center stage. Spiked fur ridges along back spine, powerful clawed paws gripping stone ground. Premium stylized dark fantasy digital illustration, sharp edges, readable predator silhouette, chiseled fur planes, dramatic cold blue rim-light on spine fur, warm amber fill light from left torch. Isolated on solid flat neutral grey background #808080, full body, zero ground shadows, no background, no text, no UI --no motion blur, extra heads, cartoon smooth fur`

#### B. Puppet Cut Plan (5 Layers)
Optimized for high-impact quadruped motion without complex skeletal mesh overhead:
1. `wolf_tail` (Z-Index 0): Fluffy spiky wolf tail curling behind hindquarters.
2. `wolf_hindquarters` (Z-Index 1): Muscular rear legs, paws planted firmly on stone.
3. `wolf_torso_forelegs` (Z-Index 2): Broad chest, spiked iron collar, front paws digging into ground.
4. `wolf_head_jaw` (Z-Index 3): Heavy snarling wolf head, spiked brow, red eyes, upper fangs.
5. `wolf_lower_jaw` (Z-Index 4): Articulated lower jaw for snarl and bite cycles.

#### C. Animation Plan (5 States)
- **Idle:** Heavy predatory panting. Chest expands (`scaleX: 1.03, scaleY: 0.98`, 800ms sine cycle). Tail slowly swishes (`angle: +-6 deg`). Head subtly tracks up and down.
- **Hit:** Heavy flinch recoiling to the right (`x: +16px, scaleX: 0.90, scaleY: 1.10`, 60ms). Head dips, ears flatten back, white hit flash.
- **Attack (Pounce / Melee Bite Lunge):**
  - *Telegraph:* Crouches low to ground (`scaleY: 0.85, x: +10px`, 250ms), jaws snap open wide (`lower_jaw angle: +25 deg`).
  - *Lunge:* Explosive forward spring toward left board border (`x: -45px, y: -15px`, 80ms, `ease: Expo.In`). Jaws snap shut with teeth crunch SFX.
  - *Recovery:* Spring rebound back to right platform (`duration: 220ms, ease: Back.Out`).
- **Cast / Howl (Rage Buff / Call to Pack):** Throws head completely back (`head angle: -30 deg`), jaw opens wide in piercing howl. Red circular pulse emanates from spiked collar.
- **Death:** Front paws buckle, wolf collapses heavily onto side with ground dust burst, eyes fade from glowing red to dull grey, body dissolves into dark smoke wisps.

#### D. Dimension & Pivot Specifications
- **Master Source:** 1024x1024 px master render.
- **Runtime Composite Size:** 420x300 px.
- **Pivots (X, Y normalized 0.0 to 1.0):**
  - Root: (0.50, 0.95) — Platform contact center.
  - `wolf_torso_forelegs`: (0.60, 0.80) — Foreleg ground plant.
  - `wolf_hindquarters`: (0.25, 0.85) — Rear hip joint.
  - `wolf_head_jaw`: (0.75, 0.60) — Base of skull/neck.
  - `wolf_lower_jaw`: (0.40, 0.20) — Jaw hinge.
  - `wolf_tail`: (0.15, 0.50) — Tail root at base of spine.

---

## 4. Environment Background (16:9 Master Screen)

### 4.1 Compositional & Zoning Mandate
The background is an atmospheric stage canvas designed specifically around the interactive game objects.  
**STRICT NEGATIVE CONSTRAINTS:**  
- **NO puzzle board** (no grids, no stone altar slabs, no carved arrow grooves).
- **NO characters or enemies** (no goblins, no wolves, no statues of units).
- **NO UI, text, health bars, or fake buttons**.
- **NO foreground clutter** inside projectile flight corridors.

### 4.2 Environmental Zone Allocation (1920x1080)
1. **Top Center Stage (X: 660 -> 1260, Y: 100 -> 360):** Raised ancient sacrificial stone dais framed by cracked Elven columns and twin iron braziers. Provides the pedestal for **Goblin Taunter**.
2. **Left Flank Platform (X: 60 -> 440, Y: 340 -> 780):** Ruined battlement balcony overlooking a foggy chasm, marked with worn rune floor tiles. Hosts **Goblin Shaman**.
3. **Right Flank Platform (X: 1480 -> 1860, Y: 340 -> 780):** Jagged granite ledge with iron spikes and torch stakes. Hosts **Dire Wolf**.
4. **Center Clear Zone (X: 480 -> 1440, Y: 330 -> 920):** Clean sunken stone courtyard floor. Completely free of high-contrast debris to host the **Stone Puzzle Board**.
5. **Projectile Corridors (North, West, East, South):** 80-120 px clean air space between center zone and side/top stages.
6. **Bottom Console Safe Zone (Y: 900 -> 1080):** Dark moody flagstone step to receive the player HUD, mana crystals, and Rotate wheel.

### 4.3 Background Master Prompt
> **Prompt:**  
> `Wide-angle 16:9 fantasy arena background, abandoned ancient sunken stone temple ruins at nocturnal twilight. Top-center features an elevated ruined stone terrace flanked by two heavy carved stone pillars with burning iron braziers casting warm golden-amber firelight. Left side features a weathered stone battlement platform overlooking misty mountain chasms. Right side features a jagged dark granite ledge with an iron wall sconce torch. The entire central area is a clean sunken ancient stone courtyard with flat dark slate flagstones, completely clear and unobstructed for game elements. Deep background reveals towering Elven aqueduct arches, cascading distant moonlit waterfalls, and a majestic pale silver moon in a midnight indigo sky. High visual contrast between cool atmospheric blue-violet background depth and warm foreground torchlight. Premium stylized dark fantasy matte painting, epic game environment art, razor-sharp textures, zero characters, zero monsters, zero game boards, zero grids, zero UI, zero text, clean open composition --ar 16:9 --no characters, people, monsters, board, tiles, arrows, buttons, health bars, text, watermarks`

---

## 5. Stone Puzzle-Board Frame

### 5.1 Design & Functional Mandate
The board frame is an **elevated ancient megalithic altar** housing the puzzle grid:
- **Perspective:** 15 deg subtle top-down pitch (pseudo-2.5D relief) with chiseled 3D side bevels.
- **Center Area (X: 80 -> 860, Y: 80 -> 520 relative):** 100% transparent or flat dark basalt texture (`#11161B`) ready to receive dynamic runtime puzzle tiles. **NO arrows or static runes on the playable surface**.
- **Perimeter Trim:** Heavy weathered granite border with ancient chiseled runic grooves and moss-filled fissures.
- **Corners:** Embossed antique brass corner caps with embedded glowing ruby cabochons.
- **Exterior Relief:** Casts a baked soft ambient occlusion drop shadow (16 px blur, `#000000 70%`) onto the arena floor beneath it.

### 5.2 Board Frame Master Prompt
> **Prompt:**  
> `2D video game asset, ancient fantasy stone altar puzzle board frame, top-down isometric view with subtle 15-degree perspective angle, rectangular 7 by 6 proportion stone frame. Exterior border made of heavy weathered dark granite slabs, chiseled stone bevels, fine gold arcane glyphs etched along the stone border, ornate embossed antique brass corner brackets adorned with small polished ruby gems, subtle green climbing moss clinging to stone crevices. The entire interior center of the frame is completely empty, clean, and flat with a solid neutral grey #808080 fill intended for transparency cutout. No arrows, no puzzle pieces, no icons, no grid lines inside center, isolated asset on solid background, clean outer edges with realistic ambient occlusion drop shadow --no arrows, icons, interior markings, characters, perspective distortion`

### 5.3 Dimension & Atlas Specifications
- **Master Source:** 1920x1200 px render (centered frame).
- **Runtime Frame Asset Size:** 940x600 px (PNG-32 with transparent center window).
- **Playable Window:** 800x480 px centered cut-out for 6x6 / 7x6 grid cells (80x80 px per cell).
- **Pivot:** (0.50, 0.50) — Perfectly centered for 90 deg rotation animations.

---

## 6. HUD, Projectiles & Visual Effects (VFX)

### 6.1 Player Portrait (`ui_player_portrait`)
- **Visual Description:** Hooded Elven Arcane Ranger / Archer Heroine. Slender, focused, intense emerald-green eyes, silver hair peeking from forest-green hooded cowl with gold embroidery. Framed in a circular embossed gold and dark granite bezel with small mana crystal accents.
- **Master Prompt:**  
  `2D video game avatar icon, fantasy elven female archer ranger portrait inside an ornate circular frame, wearing a deep forest-green hooded cowl with gold embroidered trim, sharp determined emerald-green eyes, faint glowing arcane tattoo on cheekbone, silver hair, circular antique gold and runic stone medallion border with small glowing cyan mana crystals set into the rim. Premium stylized dark fantasy character art, painterly digital illustration, high contrast, isolated on black background --no text, modern clothing, extra frames`
- **Master Source:** 512x512 px.
- **Runtime Size:** 110x110 px (PNG-32 with alpha).
- **Pivot:** (0.50, 0.50).

---

### 6.2 Rock Projectile (`vfx_proj_rock`)
- **Visual Description:** Jagged dark basalt stone chunk wrapped in glowing orange friction sparks and dust wisps. Used for Taunter's stone throw and side enemy rock attacks.
- **Master Prompt:**  
  `2D game sprite asset, jagged flying stone boulder projectile, rough dark basalt rock chunk with sharp angular fracture planes, glowing orange fiery friction embers and dust streak trailing behind, directional motion from left to right, isolated on solid black background #000000, game VFX sprite --no blurry photorealism, round cartoon pebble`
- **Master Source:** 256x256 px.
- **Runtime Size:** 48x48 px (PNG-32 / WebP).
- **Pivot:** (0.50, 0.50) with runtime continuous rotation (`angle += 8 deg/frame`).

---

### 6.3 Generic Magic Projectile (`vfx_proj_magic`)
- **Visual Description:** The pure Arcane Bolt spawned when an unblocked arrow releases from the puzzle board. Aerodynamic energy spear with a blinding cyan core (`#E0F7FA`), outer azure glow (`#00E5FF`), and trailing magical energy ripples.
- **Master Prompt:**  
  `2D video game projectile sprite, magical arcane energy bolt, razor-sharp crystalline energy needle core glowing pure bright cyan-white, surrounded by vibrant electric azure aura, directional horizontal flight from left to right with tapering luminous energy tail, clean particle wisps, isolated on pure black background #000000 for additive blending, mobile game VFX --no complex background, smoke clouds`
- **Master Source:** 512x256 px.
- **Runtime Size:** 72x24 px (horizontal orientation).
- **Pivot:** (0.80, 0.50) — Anchored at the forward piercing tip for precise collision detection.

---

### 6.4 Cast-Circle / Magic Glow Texture (`vfx_cast_circle`)
- **Visual Description:** Concentric arcane summoning circle for enemy telegraphs, Shaman spell channeling, and board rotation shockwaves. Intricate runic rings, celestial geometry, and glowing ancient script glowing in high-contrast monochrome white (tinted at runtime to cyan `#00E5FF`, violet `#AB47BC`, or danger red `#FF1744`).
- **Master Prompt:**  
  `2D game VFX asset, top-down circular magical summoning rune circle, intricate concentric geometric rings, celestial astrology symbols, ancient runic alphabet inscribed along rims, glowing bright white on pure black background #000000, perfect circular symmetry, high contrast, clean vector-like transparency mask ready for additive blend recoloring --no perspective distortion, colored gradients, cutoff borders`
- **Master Source:** 512x512 px.
- **Runtime Size:** 256x256 px (Additive blend mode).
- **Pivot:** (0.50, 0.50) — Rotates slowly in runtime (`angle += 0.5 deg/frame`).

---

### 6.5 Hit / Explosion FX Texture (`vfx_hit_burst`)
- **Visual Description:** 4-frame linear horizontal particle burst sheet (512x128 px total, 128x128 px per cell). Sharp diamond energy spikes, radial spark shards, and fading plasma dissipation on a solid black background.
- **Master Prompt:**  
  `2D video game VFX sprite sheet, 4 frames horizontal sequence of an energetic magic hit impact explosion, frame 1 small bright white central flash with sharp spark points, frame 2 expanding radial energy starburst with glowing crystal shards, frame 3 dispersing fragments and spark particles expanding outward, frame 4 fading tiny glimmering embers dissolving to nothing. Clean linear 4-step sequence on pure solid black background #000000, high contrast for additive blend mode --no smoke clouds, cartoon clouds, blurry artifacts`
- **Master Source:** 1024x256 px (4 frames x 256x256).
- **Runtime Size:** 512x128 px (4 frames x 128x128).
- **Pivot:** (0.50, 0.50) per frame.
- **Playback Timing:** 40ms per frame (total impact lifespan: 160ms).

---

## 7. Generation Order (Top-5 Quick Playable Milestones)

To stand up a striking, fully playable visual prototype in the shortest possible iteration loop, execute generation in this strict sequence:

```
+-----------------------------------------------------------------------------------+
| PRIORITY 1: Stone Puzzle-Board Frame                                              |
| -> Instantly anchors the central 6x6/7x6 puzzle grid.                             |
| -> Proves screen layout, tile contrast, and 90 deg Rotate feel immediately.       |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
| PRIORITY 2: Fantasy Arena Background (16:9)                                       |
| -> Fills the viewport with atmosphere, depth, and dual-tone lighting.             |
| -> Validates clear flight corridors and platform anchors for units.               |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
| PRIORITY 3: Goblin Taunter (Boss Master Render)                                   |
| -> Establishes the main antagonist on the top dais.                              |
| -> Enables the signature butt-slap comedic gag and primary combat objective.      |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
| PRIORITY 4: Generic Magic Projectile                                              |
| -> Closes the core game loop: tap unblocked arrow -> bolt flies across screen.    |
| -> Gives immediate tactile juice to puzzle release.                               |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
| PRIORITY 5: Hit / Explosion FX Texture                                            |
| -> Completes the combat feedback loop: projectile collides with boss -> impact!  |
| -> Delivers screen punch, hit-stop, and satisfying damage resolution.             |
+-----------------------------------------------------------------------------------+
```

### Result After Top-5:
With just these **5 assets generated and loaded**, the team has a 100% playable, broadcast-quality game loop:  
*A glowing stone board floating over an atmospheric moonlit temple; tapping an arrow launches a radiant cyan projectile into the mocking Goblin Taunter on his dais, producing a cinematic screen shake and explosive spark burst.*

---

## 8. Summary Asset Matrix & Runtime Budgets

| Asset ID | File Name | Type | Source Res | Runtime Res | Target Memory (RGBA8888) | Blend Mode |
|---|---|---|---|---|---|---|
| `bg_arena_v01` | `bg_arena_v01.webp` | Environment | 1920x1080 | 1920x1080 | ~8.0 MB | Normal |
| `board_frame_v01` | `board_frame_v01.png` | Frame / Altar | 1920x1200 | 940x600 | ~2.2 MB | Normal (Masked) |
| `boss_taunter_pack` | `boss_taunter.png` | 7-Part Puppet | 1024x1024 | Atlas (512x512) | ~1.0 MB | Normal |
| `enemy_shaman_pack`| `enemy_shaman.png` | 6-Part Puppet | 1024x1024 | Atlas (512x512) | ~1.0 MB | Normal |
| `enemy_wolf_pack` | `enemy_wolf.png` | 5-Part Puppet | 1024x1024 | Atlas (512x512) | ~1.0 MB | Normal |
| `ui_player_portrait`| `ui_player.png` | UI Portrait | 512x512 | 110x110 | ~0.05 MB | Normal |
| `vfx_proj_rock` | `vfx_rock.png` | Projectile | 256x256 | 48x48 | ~0.01 MB | Normal |
| `vfx_proj_magic` | `vfx_magic.png` | Projectile | 512x256 | 72x24 | ~0.01 MB | Additive |
| `vfx_cast_circle` | `vfx_circle.png` | Runic VFX | 512x512 | 256x256 | ~0.26 MB | Additive |
| `vfx_hit_burst` | `vfx_hit.png` | 4-Frame Sheet | 1024x256 | 512x128 | ~0.26 MB | Additive |
| **TOTALS** | **10 Assets** | — | — | — | **~13.8 MB VRAM** | — |

**Performance Compliance:** Total GPU memory footprint is under **15 MB VRAM**, vastly below the 150 MB safe threshold for VK Mobile WebView and iOS Safari, ensuring a stutter-free 60 FPS gameplay experience.

---
*End of Specification — Arrow-Roguelite Visual Asset Production Pack V01*
