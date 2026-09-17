# Magic Arrow (Arrow-Roguelite) — Visual & UI Specification V01

**Document Version:** 1.0.0  
**Status:** DESIGN PROPOSAL  
**Target Milestone:** Web Prototype V01 (HTML5 / WebGL / Canvas 1920×1080)  
**Author:** Art & UI Design  

---

## 1. Executive Visual Vision & Synthesis

### 1.1 The Core Challenge
Arrow-Roguelite combines two opposing design vectors:
1. **The Tactical Roguelite Combat Layer:** High-stakes fantasy battle with bosses, side-enemies, deadlines, elemental projectiles, and atmospheric immersion.
2. **The Logic Puzzle Core (Tap Away / Arrow):** Millisecond-level pattern recognition where player mistakes directly drain run HP. Any decorative ambiguity, low-contrast element, or visual noise immediately destroys fair play.

### 1.2 Synthesis of Concepts 1 and 2
- **From Concept 1 (Atmosphere, Materials & Lighting):**
  - **Material Weight:** Rich ancient chiseled granite, moss-lined stone masonry, embossed brass/gold filigree, and warm torchlight.
  - **Dual-Tone Dramatic Lighting:** Contrast between cool ambient nocturnal twilight (indigo, moonlight, misty waterfalls) and blazing warm torch/brazier fire (golden amber, embers).
  - **Relief & Depth:** The board is not a flat sticker; it is an elevated ancient stone sacrificial altar/dais with visible side bevels, carved grooves, and ambient occlusion shadows.
- **From Concept 2 (Compositional & Cognitive Clarity):**
  - **16:9 Widescreen Spatial Hierarchy:** Clear division between the top boss dais, left/right flank enemies, central puzzle board, and bottom control HUD.
  - **Geometric Arrow Readability:** Arrows use crisp, unambiguous orthogonal runic paths with sharply defined arrowheads. No confusing serpentine tangles on the board; full serpent/elemental manifestations occur *only after exit*.
  - **Telegraph Glanceability:** Enemy countdown timers (`ATTACK IN N`), cast gauges, and target rings are instantly distinguishable from 2 meters away.

---

## 2. 16:9 Screen Layout & Spatial Architecture

The baseline reference canvas is **1920 × 1080 px** (16:9 aspect ratio). All coordinates and proportions scale proportionally.

```
+-----------------------------------------------------------------------------+
| [Magic Arrow] [Lvl/Hearts] [Resources]   [BOSS NAME & HP BAR]     [Settings]| Top Bar (0-80px)
+-----------------------------------------------------------------------------+
|                |                                            |               |
|                |            [BOSS ZONE]                     |               |
|                |         (Goblin Taunter)                   |               |
|                |           Y: 90 - 350px                    |               |
|                |         Speech Bubble Anchor               |               |
|  [LEFT FLANK]  |                                            | [RIGHT FLANK] |
| (Goblin Shaman)|<---------- [NORTH CORRIDOR] -------------->|  (Dire Wolf)  |
|  X: 60-440px   |                                            | X: 1480-1860px|
|  Y: 340-780px  |            +------------------+            |  Y: 340-780px |
|                |            |                  |            |               |
|  Telegraph Ring|<-- [WEST]  |   PUZZLE BOARD   |  [EAST]--> | Telegraph Ring|
|  & Timer Badge |            |     6x6 / 7x6    |            | & Timer Badge |
|                |            |  X: 520 - 1400px |            |               |
|                |            |  Y: 360 - 890px  |            |               |
|                |            +------------------+            |               |
|                |             [SOUTH CORRIDOR]               |               |
+----------------+--------------------------------------------+---------------+
| [PLAYER HUD]   |             [ROTATE BUTTON]                | [ITEMS / RUN] | Bottom Console
| Portrait + HP  |           X: 860 - 1060px, Y: 910px        | Skill 1, 2, 3 | (900-1080px)
| Mana Crystals  |             [Instruction Banner]           | Consumables   |
+----------------+--------------------------------------------+---------------+
```

### 2.1 Zone Proportions & Screen Real Estate
- **Puzzle Board (Central Anchor):**
  - **Footprint:** ~880 × 530 px (~46% screen width, ~49% screen height).
  - **Center Offset:** Horizontally centered ($X = 960$), vertically positioned at $Y = 625$ (board center).
  - **Dominance:** The board is the largest single visual entity on screen, commanding immediate visual priority.
- **Boss Arena (Top Center):**
  - **Footprint:** ~600 × 280 px.
  - **Location:** Centered horizontally ($X = 960$), elevated on an ancient stone terrace behind the board ($Y = 90$ to $350$).
  - **Visual Hierarchy:** Boss silhouette is ~1.6× larger than side enemies, framed by stone columns, red battle banners, and torches.
- **Side Enemy Flanks (Left & Right Platforms):**
  - **Left Platform:** $X = 60$ to $440$ px, $Y = 340$ to $780$ px. Hosts ranged/caster units (Goblin Shaman).
  - **Right Platform:** $X = 1480$ to $1860$ px, $Y = 340$ to $780$ px. Hosts melee/brute units (Dire Wolf).
  - **Grounding:** Each side enemy stands upon a dedicated stone battlement with an active floor rune circle.
- **HUD & Margins:**
  - **Top Bar:** Height 80 px (Y: 0 to 80).
  - **Bottom Console:** Height 180 px (Y: 900 to 1080).
  - **Safe Zones:** 40 px padding on all exterior edges for mobile/tablet letterboxing, browser address bar clearance, and VK iframe frames.

### 2.2 Projectile Flight Corridors (Zero-Occlusion Lanes)
Projectiles must travel through clean, unobstructed space:
- **North Corridor ($Y = 360 \to 280$):** 80 px vertical air gap between top of board frame and boss platform.
- **West Corridor ($X = 520 \to 400$):** 120 px horizontal air gap between left board edge and left enemy hitbox.
- **East Corridor ($X = 1400 \to 1520$):** 120 px horizontal air gap between right board edge and right enemy hitbox.
- **South Corridor ($Y = 890 \to 980$):** Dissipates into bottom stone dais or strikes ambient targets/chests without clipping the Rotate button.

---

## 3. The Board & Puzzle Architecture

### 3.1 Board Construction & Materiality
- **Base Structure:** An ancient megalithic altar carved from dark basalt and weathered granite slabs.
- **Relief & Depth (Pseudo-2.5D):**
  - The board has a subtle perspective tilt (~15° top-down pitch).
  - Individual grid tiles are flat on their top surfaces (ensuring 100% distortion-free orthogonal puzzle reading), but their carved stone bevels have baked ambient occlusion shadows (4–6 px depth) and edge highlights.
  - Deep chiseled grooves (8 px wide, dark charcoal `#11161B`) separate all tiles.
- **Frame & Trim:**
  - Heavy carved stone border with etched golden Nordic/arcane glyphs.
  - Ornate brass corner plates with embedded cabochon gems that softly pulse.
  - Overgrown ivy, climbing moss, and subtle stone cracks anchor the board into the environment without covering active tile areas.

### 3.2 Arrow Appearance on Board (The "Ribbon of Power")
Following `docs/ARROW-VISUAL-PROGRESSION.md`: on the board, an arrow is an **enchanted runic power-ribbon flush with the stone grooves**, terminating in a chiseled crystalline arrowhead.

- **Silhouette & Geometry:**
  - Ribbon thickness: 24 px uniform width along grid lines.
  - Arrowhead: 44 px wide equilateral chevron/triangle with a sharp tip and notched tail.
  - Tail/Origin: Circular rune node (radius 20 px) stamped into the stone tile, displaying the arrow's elemental sigil.
- **Color Palette & Element Coding:**
  - **Arcane / Pure (Base):** Luminous Azure Cyan (`#00E5FF` core, `#0077C2` outer rim glow, `#E0F7FA` specular tip).
  - **Poison / Nature:** Toxic Emerald (`#00E676` core, `#1B5E20` outer rim, `#B9F6CA` tip).
  - **Fire / Explosive:** Solar Amber-Crimson (`#FF6D00` core, `#B71C1C` outer rim, `#FFE082` tip).
  - **Ricochet / Lightning:** Electric Topaz (`#FFD600` core, `#E65100` outer rim, `#FFF9C4` tip).
- **Accessibility & Non-Color Redundancy:**
  - Every arrow type has a unique geometric origin rune (Diamond for Arcane, Skull/Sprout for Poison, Flame burst for Fire, Double-Chevron for Ricochet).
  - Arrows are distinguishable even in grayscale.

### 3.3 The Four Critical Arrow States

| State | Visual Treatment | Contrast Ratio | Audio Feedback |
|---|---|---|---|
| **1. Free (Unblocked)** | Vibrant emissive core glow, subtle breathing luminescence (1.5s sine pulse, intensity 85%–100%), crisp white specular tip, clear line-of-sight to border. | **High (4.5:1 vs stone)** | Soft magical hum on hover |
| **2. Blocked** | Desaturated core (35% saturation), dimmed luminosity (30% brightness), matte stone/slate texture, no breathing pulse. Obvious obstacle ahead. | **Low (1.8:1 vs stone)** | Dull stone click on hover |
| **3. Selected / Exit (Tap)** | Instant frame-1 whiteout flash (`#FFFFFF`, 40ms), followed by rapid sequential groove illumination flowing from root to tip. Forward lunge (6 px) as it detaches from stone. | **Maximum (10:1)** | Crisp crystalline release chime |
| **4. Blocked Mis-Tap (Error)** | Sharp lateral shudder/shake (amplitude 6 px, frequency 25 Hz, duration 120ms). Dark red flare (`#FF1744`) along the arrow contour. Crack particle burst. Float text "-X HP" near player portrait. | **Warning Flash (7:1)** | Heavy dull stone clack + warning buzzer |

*Rule adherence:* As established in `docs/COMBAT-RULES.md`, tapping a blocked arrow damages player HP, but **enemy attack timers do NOT advance**.

---

## 4. Enemy Architecture, Timers & Telegraphs

### 4.1 Boss: Goblin Taunter (Top Stage)
- **Visual Staging:** Perched atop a stone dais between two flaming braziers, wearing a spiked iron crown, ragged royal red cloak, and leather harness.
- **Signature Stance (The Visual Gag):** Turn-around provocative pose, wagging his rump towards the player with a mocking crown tattoo on his butt cheek.
- **HUD Anchor (Top Center):**
  - Ornate winged stone nameplate: `GOBLIN TAUNTER`.
  - Boss HP Bar: 600 px wide, segmented in 50 HP blocks. Deep ruby health fill (`#D32F2F`) over textured slate, with an animated damage-ghost bar (yellow `#FFC107` easing out over 400ms).
  - Speech Bubble: Dynamic comic-style parchment bubble popping above his head with cheeky taunts (`"Ha! Ha! Ha!"`, `"Can't hit this!"`, `"Over here, clumsy!"`).

### 4.2 Side Enemy Left: Goblin Shaman (Ranged / Caster)
- **Visual Staging:** Hunched green goblin in a crimson cowl, gripping a crooked gnarled staff topped with a pulsating amethyst crystal skull.
- **HUD Anchor:** Floating bar 40 px above head. Width 160 px, height 18 px. Displays current/max HP (`120 / 120`).

### 4.3 Side Enemy Right: Dire Wolf (Melee / Brute)
- **Visual Staging:** Muscular scarred shadow wolf with spiked iron collar, glowing crimson eyes, bared fangs, low aggressive predator crouch.
- **HUD Anchor:** Floating bar 40 px above head. Width 160 px, height 18 px. Displays current/max HP (`150 / 150`).

### 4.4 The Enemy Timer Badge (`ATTACK IN N`)
The timer badge is the primary tactical pressure element in the game.
- **Location:** Anchored directly beside each enemy's health bar.
- **Design:** Circular iron-rimmed wax seal / demonic badge (diameter 48 px) with a high-contrast central numeral.
- **States:**
  - **Safe ($N \ge 3$):** Dark bronze badge (`#3E2723`), pale silver numeral, calm border.
  - **Warning ($N = 2$):** Amber-orange glowing seal (`#E65100`), yellow numeral, slow pulse (1 Hz).
  - **CRITICAL DEADLINE ($N = 1$):** Blazing crimson seal (`#D50000`), white bold numeral. The badge pulses violently (4 Hz). Ground rune circle beneath the enemy flares into intense red fire. Enemy transitions to high-tension pre-attack trembling pose.
  - **Trigger ($N = 0$):** The enemy executes its attack animation, launching an attack projectile/slash at the Player HUD. Timer immediately resets to the enemy's maximum cooldown.
- **Turn Advance Rule:** The badge counter decrements by 1 **only upon a successful board arrow release**. Normal hits damage the enemy but do **not** reset or delay the timer.

### 4.5 Cast & Ability Telegraphs
- **Cast Telegraph (Channeling Spells):**
  - When the Shaman channels a major curse or summon, a secondary purple progress bar appears under his HP bar: `CASTING: CURSE [||||||....]`.
  - A column of violet light cascades down onto the Shaman, and purple runic particles gather toward his staff.
- **Board Ability Telegraph (Stone Throw / Mud / Blockers):**
  - If an enemy ability targets the puzzle board (e.g. throwing a mud boulder to block a tile as detailed in `docs/ENEMY-BOARD-ABILITIES.md`):
  - **Target Marker:** A red cracked-stone targeting reticle projects onto the specific board tile 1 turn in advance.
  - The targeted tile flickers with warning sparks, giving the player 1 turn to clear that arrow before it is disabled.

---

## 5. Combat Dynamics & Game Feel (The "Juice")

### 5.1 The Rotate Mechanic
- **Control Element:** Large ornate circular sunstone wheel (diameter 96 px) at bottom center ($X = 960, Y = 965$).
- **Visual Design:** Heavy circular stone bezel with embossed golden dual-arrows (`⟳`). Flanked by blue mana power crystals and stone masonry wings.
- **Activation Sequence:**
  1. **Press (0–50ms):** Button depresses 4 px with a heavy mechanical latch click.
  2. **Board Spin (50–350ms):** The entire board rotates 90° clockwise with smooth easing (`cubic-bezier(0.25, 1, 0.5, 1)`). A deep stone-grinding rumble plays.
  3. **Runic Shockwave (200ms):** A concentric golden rune circle expands outward from the board's edge across the floor.
  4. **State Awakening (350–450ms):** As tiles settle into their new orientations, newly freed arrows instantly flash with a golden gleam, visually rewarding the player's tactical rotation.

### 5.2 Projectile Phase (Board Release to Target)
1. **Detachment:** The moment an unblocked arrow is tapped, the glowing ribbon lifts vertically out of the stone channel.
2. **Coalescence (30ms):** The angular ribbon condenses into an aerodynamic magical bolt:
   - Length: 70 px.
   - Core: Blinding white/cyan energy needle.
   - Corona: Elemental shroud matching the arrow's type.
   - Trail: 120 px tapering ribbon particle trail with motion blur.
3. **Flight Trajectory:**
   - Moves in a perfectly straight vector matching the exit direction (North $\to$ Boss, West $\to$ Shaman, East $\to$ Wolf).
   - Flight Duration: Snappy **140–180ms** (fast enough to feel responsive, long enough for the eye to track).

### 5.3 Hit Feedback Pipeline (The Impact)
When the projectile reaches the target hitbox:
1. **Hit-Stop (Micro-Freeze):** Game rendering pauses for **2 frames (33ms)** on normal hits, **4 frames (66ms)** on critical/boss hits. This delivers immense weight.
2. **Impact Flash:** The enemy sprite renders as a 100% solid white silhouette for 1 frame (16ms), then rapidly fades back to texture over 60ms.
3. **Squash & Stretch Reaction:**
   - Frame 1–3: Horizontal expansion + vertical compression (Scale: $X = 1.15, Y = 0.85$).
   - Frame 4–7: Recoil snap back in direction of shot (Scale: $X = 0.95, Y = 1.05$, offset 12 px backward).
   - Frame 8–12: Settle back to idle with spring damping.
4. **Particle Burst:** 12–18 sharp directional sparks and elemental droplets burst out behind the enemy along the impact vector.
5. **Floating Damage Text:** Bold golden numeral spawns at point of impact, hops upward 30 px with randomized $\pm 10$ px lateral drift, then fades out over 500ms.

### 5.4 Death Sequences
- **Minion Death (Shaman / Wolf):**
  - Sudden violent stagger backward.
  - Sprite fractures into luminous polygonal shards / dissolving shadow embers.
  - Teleport/poof dust cloud (`#8D6E63`) collapses inward.
  - Timer badge and health bar shatter and vanish.
- **Boss Defeat (Goblin Taunter):**
  - **Hit-Stop:** Heavy 200ms freeze frame.
  - **The Gag Finale:** Taunter clutches his behind with both hands in comedic agony, eyes bulging, crown spinning off his head.
  - He stumbles, falls face-down on the dais, and waves a tiny white surrender flag.
  - Massive golden coin & gem geyser erupts around him.
  - Victorious fanfare and golden banner: `VICTORY! DAIS CLEARED`.

---

## 6. Atmosphere, Lighting, Palette & Typography

### 6.1 Environment Staging
- **Setting:** Abandoned Sunken Temple of Eldoria at twilight.
- **Background Elements (Layered Depth):**
  - **Skybox (Deep Background):** Dark midnight blue canopy (`#0A1118`) with a massive pale silver full moon casting a soft vertical specular sheen over cascading distant waterfalls.
  - **Midground Architecture:** Crumbling Gothic/Elven aqueducts and moss-draped ruined arches. Distant castle spires perched on misty mountain ridges.
  - **Foreground Stage:** Carved ancient flagstones, stone fire braziers with active flames casting flickering warm light, creeping ivy, stone skull relics, and tribal victory banners.

### 6.2 Dual-Lighting Model
- **Primary Cool Key Light (Moonlight & Waterfalls):** Soft ambient cyan-blue wash (`#1A3045`, intensity 40%) descending from top-right ($45^\circ$).
- **Secondary Warm Fill Light (Braziers & Torches):** Vibrant point-light sources positioned at left ($X = 180, Y = 460$) and right ($X = 1740, Y = 460$). Warm amber glow (`#FFA000`, radius 450 px, intensity 75%) illuminating enemy rims and board side bevels.
- **Board Self-Illumination:** The puzzle board emits its own localized upward glow from active arrows, illuminating the surrounding stone dais with magical radiance.

### 6.3 Color Palette Specifications

```
[UI Background & Stone]
  #0B0E14 - Deep Basalt (Screen Clear / Darkest Shadow)
  #1E252F - Weathered Slate (Tile Top Faces)
  #2C3645 - Chiseled Granite (Tile Bevels & Board Border)
  #D4AF37 - Imperial Antique Gold (Frame Trim, Filigree, Runes)

[Player & HUD]
  #43A047 - Player Health Green
  #E53935 - Enemy Health Red / Danger
  #00E5FF - Mana Crystal Cyan
  #FFD54F - Gold Coin Specular

[Arrow Elements]
  #00E5FF - Arcane Bolt (Cyan)
  #00E676 - Poison Serpent (Emerald)
  #FF6D00 - Fire Strike (Solar Orange)
  #FFD600 - Ricochet Spark (Electric Gold)

[Telegraphs & Warnings]
  #FF1744 - Immediate Threat / Critical Timer N=1
  #AB47BC - Shaman Dark Magic Cast
  #FF9100 - Pending Ability / Target Warning
```

### 6.4 Typography Hierarchy
- **Header & Boss Titles:**
  - *Font Family:* **Cinzel Decorative** / **Marcellus SC** (or Google Fonts *Cinzel*).
  - *Style:* Semi-bold, all-caps, gold embossed gradient fill (`#FFE082` to `#FFB300`), 2 px dark shadow (`#000000 80%`), 1 px outer glow.
- **Combat Numbers & Countdown Timers:**
  - *Font Family:* **Rajdhani** / **Montserrat Bold**.
  - *Style:* Ultra-bold, geometric, high-x-height. Crisp 2 px black border stroke (`-webkit-text-stroke: 2px #000`). Designed for instantaneous numeric recognition at small scale.
- **Speech Bubbles & Tactical Advice:**
  - *Font Family:* **Caveat Brush** / **Alegreya Sans Bold**.
  - *Style:* Expressive, organic, slightly comic-fantasy hand-inked lettering. Dark charcoal (`#212121`) on aged parchment (`#FFF8E1`).

---

## 7. Animation Pipeline Comparison & Technical Recommendation

For a high-performance web prototype running in browser/mobile canvas, we evaluate the three standard 2D animation methodologies:

| Evaluation Metric | Option A: Static Sprite + Procedural Tweens | Option B: Layered 2D Puppet (Spine / Container Hierarchy) | Option C: Frame-by-Frame Spritesheet |
|---|---|---|---|
| **Visual Quality & Art Polish** | Moderate. Limited to scale, squash, rotation, and translation of whole body or 2–3 parts. | **Very High.** Smooth, organic skeletal curves, dynamic cloth/hair swaying, expressive secondary motion. | **Highest.** Hand-crafted classic Disney/anime appeal; perfect unique silhouettes in every frame. |
| **Asset Download Weight (KB/MB)** | **Lowest.** Single PNG per character (~150–250 KB). Instant load times in web browsers. | **Low.** Single texture atlas (~400–700 KB) + lightweight JSON animation data (~50 KB). | **Disastrously High.** 6 states × 12–24 frames = 100+ frames per enemy $\to$ 15–35 MB per character. |
| **GPU Texture Memory** | Minimal (1–2 MB VRAM). | Very low (3–5 MB VRAM). | Extreme (50–120 MB VRAM), risk of crash on mobile web browsers. |
| **Production Speed & AI Gen Fit** | **Fastest.** Single high-res AI generation + quick layer separation in Photoshop. | **Fast & Modular.** Generate character in neutral pose $\to$ split into 6–10 limbs $\to$ rig once in Spine/Phaser. | Slow & Painful. AI image generators struggle with frame-to-frame consistency and silhouette drift. |
| **Hit Feedback & Reactivity** | Good. Direct code control over squash/stretch and hit-stop offsets. | **Excellent.** Procedural blend trees: can take a hit flinch while simultaneously finishing a taunt. | Rigid. Cannot easily blend states; must interrupt or restart frame sequences. |

### 7.1 Rational Verdict for Prototype V01

1. **Goblin Taunter (Boss): $\to$ LAYERED 2D PUPPET (Container / Spine-style hierarchy)**
   - *Rationale:* The boss is the centerpiece of the encounter. His visual identity relies on expressive comedic motion (wagging his hips, patting his rump, ducking, laughing). A static sprite cannot sell the butt-taunt gag, while a spritesheet is prohibitively heavy. A 7-layer puppet provides rich, fluid 60 FPS animation with a tiny ~500 KB footprint.
2. **Goblin Shaman (Side Caster): $\to$ HYBRID LAYERED PUPPET (3–4 Layers)**
   - *Rationale:* Needs only a breathing body, an articulating staff arm (raised for casting, lowered for idle), and blinking eyes. Very cheap to assemble, highly expressive.
3. **Dire Wolf (Side Brute): $\to$ STATIC SPRITE WITH PROCEDURAL DEFORM / TWEENING**
   - *Rationale:* Quadruped skeleton rigging can be finicky. For Prototype V01, a master high-detail illustration broken into Body + Head/Jaw with procedural breathe, lunge, and hit squashing delivers 90% of the visual payoff at 10% of the production time.
4. **VFX & UI Elements: $\to$ PROCEDURAL SHADERS / TWEENS + COMPACT SPRITESHEETS**
   - *Rationale:* Arrow glows, rotate spins, and timer pulses are 100% procedural code tweens. Impact bursts and smoke puffs use small 4×4 particle sheets (128×128 px per frame).

---

## 8. Character Animation Plans (The 6 Core States)

To eliminate asset bloat, all three characters strictly implement **exactly 6 functional states**:

```
+-----------------------------------------------------------------------------------+
| State        | Goblin Taunter (Boss)      | Goblin Shaman (Left)  | Dire Wolf (Right)     |
+-----------------------------------------------------------------------------------+
| 1. IDLE      | Weight shift, hip sway,    | Mystic float/breathe, | Low predatory pant,   |
|              | mocking grin over shoulder | staff bob, crystal hum| tail flick, eye glow  |
+--------------+----------------------------+-----------------------+-----------------------+
| 2. ATTACK    | Throws rotten fruit/bomb;  | Thrusts staff forward;| Explosive forward     |
|              | snaps hips forward         | bolt shot from skull  | lunge/bite at board   |
+--------------+----------------------------+-----------------------+-----------------------+
| 3. CAST      | Pours jug of goblin ale    | Raises staff two-hand;| Bristles fur, throws  |
|              | over board (tile curse)    | runic ground circle   | head back in howl     |
+--------------+----------------------------+-----------------------+-----------------------+
| 4. HIT       | Dramatic rump grab, eyes   | Head snaps back, cowl | Whimper flinch, ears  |
|              | pop, comedic jolt          | flies, staff drops    | pin back, body recoils|
+--------------+----------------------------+-----------------------+-----------------------+
| 5. DEATH     | Slaps face-down on dais;   | Dissolves into violet | Collapses to side,    |
|              | waves white flag; defeat   | smoke and bone pile   | shadow dissolves      |
+--------------+----------------------------+-----------------------+-----------------------+
| 6. TAUNT     | Butt slap + wiggle +       | Cackles, spins staff, | Roars/barks, scrapes  |
|              | tongue poke ("Ha! Ha!")    | points & mocks player | paws kicking sparks   |
+-----------------------------------------------------------------------------------+
```

---

## 9. Comprehensive Asset List V01

### 9.1 Character Assets

| Asset ID | Dimensions | Format | Layers Needed for Animation | Pivot Point | Animation Method |
|---|---|---|---|---|---|
| `char_taunter_torso` | 380 × 340 px | PNG (Transp) | Base torso, leather harness, cape root | Center-Bottom (0.5, 0.9) | Layered Puppet / Spine |
| `char_taunter_head` | 180 × 160 px | PNG (Transp) | Head with crown, goofy ears, open mouth | Neck Base (0.5, 0.85) | Puppet Layer (Rotates/Laughs) |
| `char_taunter_hips` | 260 × 220 px | PNG (Transp) | Exposed green rump with crown tattoo | Hip Center (0.5, 0.4) | Puppet Layer (Oscillates side-to-side) |
| `char_taunter_arm_l` | 120 × 160 px | PNG (Transp) | Left arm resting on knee/hip | Shoulder (0.2, 0.2) | Puppet Layer |
| `char_taunter_arm_r` | 140 × 180 px | PNG (Transp) | Right arm slapping rump / pointing | Shoulder (0.8, 0.2) | Puppet Layer (Taunt slap pose) |
| `char_taunter_legs` | 320 × 180 px | PNG (Transp) | Bow-legged goblin stance, leather boots | Ground Center (0.5, 1.0) | Static Puppet Base |
| `char_taunter_defeat` | 420 × 260 px | PNG (Transp) | Single generated defeat pose (face-down + flag) | Center-Bottom (0.5, 0.9) | Unique Generated Pose (Death) |
| `char_shaman_body` | 240 × 360 px | PNG (Transp) | Hunched robed body, cowl, legs | Ground Center (0.5, 0.95)| Layered Puppet (Breathe deform) |
| `char_shaman_head` | 140 × 140 px | PNG (Transp) | Goblin face inside hood, yellow eyes | Neck (0.5, 0.8) | Puppet Layer (Nods/Cackles) |
| `char_shaman_staff`| 160 × 420 px | PNG (Transp) | Gnarled wooden staff + amethyst skull | Hand Grip (0.4, 0.6) | Puppet Layer (Articulating cast) |
| `char_shaman_fx` | 180 × 180 px | PNG (Transp) | Glow sprite for skull eye sockets | Center (0.5, 0.5) | Procedural Additive Pulse |
| `char_wolf_body` | 440 × 320 px | PNG (Transp) | Complete snarling wolf body, legs, tail | Ground Center (0.5, 0.9) | Static Sprite + Mesh Deform |
| `char_wolf_head` | 200 × 180 px | PNG (Transp) | Separate head with spiked collar & jaws | Neck Base (0.7, 0.7) | Puppet Layer (Bites/Snarls) |

### 9.2 Board & Puzzle Assets

| Asset ID | Dimensions | Format | Description / Breakdown | Pivot Point | Usage |
|---|---|---|---|---|---|
| `board_stone_base` | 940 × 600 px | PNG (Transp) | Carved stone foundation, perimeter bevels, moss | Center (0.5, 0.5) | Background board frame |
| `board_tile_blank` | 80 × 80 px | PNG (Transp) | Weathered granite tile with beveled grooves | Center (0.5, 0.5) | Base puzzle grid unit |
| `arrow_ribbon_straight` | 80 × 24 px | PNG (Transp) | Straight glowing runic energy channel | Center (0.5, 0.5) | Modular path segment |
| `arrow_ribbon_corner` | 52 × 52 px | PNG (Transp) | 90° smooth curved energy turn | Center (0.5, 0.5) | Modular path corner |
| `arrow_head_chevron` | 44 × 44 px | PNG (Transp) | Crystalline triangular arrowhead | Tip Base (0.5, 0.8) | Exit pointer (rotates 0/90/180/270°) |
| `arrow_tail_node` | 40 × 40 px | PNG (Transp) | Circular stone-carved origin rune seal | Center (0.5, 0.5) | Path start terminal |
| `board_corner_plate` | 96 × 96 px | PNG (Transp) | Heavy embossed brass corner fitting with ruby | Corner (0.0, 0.0) | 4 board corners |
| `board_rune_glyph` | 32 × 32 px | PNG (Transp) | Exit runes (North, South, East, West) | Center (0.5, 0.5) | Outer perimeter glow indicators |

### 9.3 UI & HUD Assets

| Asset ID | Dimensions | Format | Description / Breakdown | Pivot Point | Usage |
|---|---|---|---|---|---|
| `ui_topbar_frame` | 1920 × 80 px | PNG (Transp) | Dark stone & gold filigree banner strip | Top-Left (0.0, 0.0) | Top status header |
| `ui_bossbar_frame` | 640 × 48 px | PNG (Transp) | Winged demonic stone frame for boss health | Center (0.5, 0.5) | Frames boss health |
| `ui_bar_fill_red` | 8 × 32 px | PNG (Transp) | 9-sliceable health bar red gradient fill | Left-Center (0.0, 0.5)| Enemy & boss health meter |
| `ui_timer_badge` | 56 × 56 px | PNG (Transp) | Iron-rimmed wax seal with embossed border | Center (0.5, 0.5) | Anchors `ATTACK IN N` text |
| `ui_player_frame` | 110 × 110 px | PNG (Transp) | Circular gold and runic stone portrait bezel | Center (0.5, 0.5) | Frames archer heroine avatar |
| `ui_player_avatar` | 96 × 96 px | PNG (Transp) | Hooded elven archer portrait | Center (0.5, 0.5) | Heroine portrait sprite |
| `btn_rotate_base` | 110 × 110 px | PNG (Transp) | Sunstone circular button with `⟳` runes | Center (0.5, 0.5) | Main rotate interaction |
| `btn_rotate_glow` | 140 × 140 px | PNG (Transp) | Additive gold halo for hover/activation | Center (0.5, 0.5) | Procedural rotate pulse |
| `ui_speech_bubble` | 240 × 120 px | PNG (Transp) | Parchment speech bubble with pointer tail | Tail Tip (0.2, 1.0) | Boss dialogue anchor |
| `ui_target_ring` | 220 × 90 px | PNG (Transp) | Elliptical floor telegraph circle (red/purple) | Center (0.5, 0.5) | Placed under active enemies |

### 9.4 VFX & Particle Assets

| Asset ID | Dimensions | Format | Description / Breakdown | Pivot Point | Usage |
|---|---|---|---|---|---|
| `vfx_proj_arcane` | 70 × 24 px | PNG (Transp) | Sleek magical energy needle | Tip (0.8, 0.5) | Flying projectile (Normal) |
| `vfx_proj_serpent`| 96 × 36 px | PNG (Transp) | Ethereal spectral serpent head + body coil | Mouth (0.8, 0.5) | Flying projectile (Serpent Form) |
| `vfx_trail_ribbon` | 128 × 24 px | PNG (Transp) | Additive fading motion-blur ribbon | Head (1.0, 0.5) | Projectile trailing smoke/light |
| `vfx_hit_flash_sheet`| 512 × 128 px | PNG (Transp) | 4-frame radial energy explosion (128×128/frame) | Center (0.5, 0.5) | Impact splash on enemy |
| `vfx_spark_particle` | 16 × 16 px | PNG (Transp) | Sharp diamond spark (recolorable via shader) | Center (0.5, 0.5) | Spark bursts, ricochet bounces |
| `vfx_smoke_puff` | 64 × 64 px | PNG (Transp) | Soft volumetric dust cloud for death/stomp | Center (0.5, 0.5) | Death dissolve & blocked misclick |

### 9.5 Environment & Background Assets

| Asset ID | Dimensions | Format | Description / Breakdown | Pivot Point | Usage |
|---|---|---|---|---|---|
| `bg_sky_waterfalls` | 1920 × 1080 px | JPG/WebP (Opaque)| Moonlit sky, distant mountains, waterfalls | Top-Left (0.0, 0.0) | Static deep background layer |
| `bg_mid_ruins` | 1920 × 720 px | PNG (Transp) | Crumbling stone arches, aqueducts, ivy towers | Bottom-Left (0.0, 1.0)| Midground parallax layer |
| `env_brazier_fire` | 120 × 220 px | PNG (Transp) | Stone pedestal with iron bowl & fire flames | Ground Center (0.5, 0.9)| Flanking torch props (Left/Right)|
| `env_banner_left` | 140 × 460 px | PNG (Transp) | Weathered crimson war banner hanging on column| Top-Center (0.5, 0.0) | Flanking stage dressing |
| `env_banner_right`| 140 × 460 px | PNG (Transp) | Weathered crimson war banner hanging on column| Top-Center (0.5, 0.0) | Flanking stage dressing |

---

## 10. Summary Verification & Delivery Checklist

- [x] **16:9 Master Layout:** Detailed pixel coordinates, zones, and margins mapped out for 1920×1080 canvas.
- [x] **Relative Sizes:** Central board (~46% width) dominates; Boss is 1.6× larger than side enemies.
- [x] **Safe Zones & Flight Lanes:** Clear corridors between board edges and enemy hitboxes defined.
- [x] **Board & Arrow Readability:** Stone altar with orthogonal channels; 4 unambiguous arrow states specified.
- [x] **Combat Telegraphs:** `ATTACK IN N` badges, $N=1$ danger state, Cast bars, and Board Mutation indicators defined.
- [x] **Rotate & Feedback:** Full sequence for 90° board spin, runic shockwave, hit-stop, and death sequences.
- [x] **Atmosphere & Lighting:** Concept 1 stone depth and dual-light model (moonlight vs torch fire) preserved.
- [x] **Animation Pipeline Verdict:** Rational breakdown: Layered Puppet for Boss, Hybrid for Shaman, Procedural Deform for Wolf.
- [x] **6 Core Animation States:** Strictly `idle`, `attack`, `cast`, `hit`, `death`, and `taunt` for all 3 characters.
- [x] **Comprehensive Asset List V01:** Complete dimensional, layer, pivot, and procedural specifications provided.

---
*End of Specification — Arrow-Roguelite Visual Prototype V01*
