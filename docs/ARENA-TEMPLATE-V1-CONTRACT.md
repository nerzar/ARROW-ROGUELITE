# Arena Template v1 -- Canonical Scene Geometry Contract

STATUS: **DESIGN DRAFT**
STAGE: **Product Design & Technical Spike**
COMPATIBILITY: spikes/arrow-core/viewer/visual-proto/ (board-plane.js, arena-layout.js, arena-calibration.js), tool/CAL-001
DATE: 2026-09-17

---

## 1. Executive Summary & Production Policy

Prior to FIX-023, arenas were generated with a baked stone grid (5x5 / 6x6). This led to fragile manual per-image recalibration, tightly coupled each background to a single board size (e.g. impossible to run 7x7 on a 5x5 arena), and caused frequent image rejection due to minor perspective distortions from AI generators.

**Production Policy for Arena Template v1:**
1. **Clean Stone Board Surface:** The board platform (dais / stone slab) is generated as a clean, uniform, flat stone surface **without baked grid lines, cells, or numbers**.
2. **Gameplay Grid NOT baked:** Runtime renderer draws the logical grid (dots / boundary lines), arrows, selection highlights, glow, and impact FX on top of the stone quad using projective homography (computeHomography).
3. **Fixed Scene Camera & Gameplay Geometry:** Camera tilt angle, focal length, board plane perspective, and actor standing zones remain strictly fixed across standard scenes.
4. **Variable Theme & Background:** Environment theme, architectural style (catacomb, ruined temple, gothic castle, forest altar), lighting, and color palette can freely vary between runs and acts while conforming to the template geometry.
5. **DEFAULT_ARENA_GEOMETRY:** All standard combat encounters use one canonical geometry configuration (DEFAULT_ARENA_GEOMETRY). Any newly generated arena conforming to Arena Template v1 works immediately without code edits.
6. **Special Arenas Override:** Unique campaign boss arenas or cinematic encounters may override geometry, but this is an explicit exception rather than the default.

> [!NOTE]
> Final canonical coordinates for DEFAULT_ARENA_GEOMETRY are NOT guessed or hardcoded in this document. They will be captured and exported by the user using tool CAL-001 (Arena Calibration Editor) from the accepted canonical reference scene (e.g., building on prologue-5x5-good).

---

## 2. Canvas & Coordinate System (16:9 Contract)

All spatial positions are expressed in **normalized stage coordinates** [0.0 .. 1.0]:
- x = 0.0 is screen left, x = 1.0 is screen right.
- y = 0.0 is screen top, y = 1.0 is screen bottom.
- Canonical aspect ratio: strictly **16:9** (e.g. 1920x1080, 1366x768, 960x540).

### 16:9 Canvas Behavior & Asset Ingestion
- Background assets must be exported by the generator in strict **16:9** aspect ratio (1920x1080 canonical, or 1672x941).
- In CSS background-size: cover; background-position: center, any aspect deviation (such as the 1619x971 image in FIX-023) silently crops top/bottom or left/right pixels in stage space, shifting calibration landmarks by dozens of pixels.
- **Rule:** Non-16:9 generated assets must be cropped/padded to 16:9 before ingestion and calibration.

---

## 3. Normalized Geometry Points & Diagram

The scene contains three primary geometric anchor layers:
1. **Board Plane Quad (tl, tr, br, bl):** Four corners of the flat top surface of the stone dais into which the logical grid is mapped.
2. **Actor Anchors (top, left, right):** Foot contact baseline points where enemy sprites stand.
3. **Effect Anchors (top, left, right):** Independent centers for ground spells, target circles, and telegraph glow (pulled inward onto the platforms so VFX do not bleed over stairs).
4. **HUD Safe Zones:** Clear screen margins guaranteed free from critical background occlusions.

### Layout Diagram (ASCII)

```text
(0,0) +-------------------------------------------------------+ (1,0)
      | [ TOPBAR / ENEMY HP / RESOURCE SAFE ZONE ]            |
      |                                                       |
      |                  [ TOP EFFECT ]                       |
      |                 [ TOP ACTOR FOOT ]                    |
      |                     (Boss Slot)                       |
      |                                                       |
      |               TL .-----------------. TR               |
      |                 /                   \\                 |
      | [LEFT ACTOR]   /                     \\  [RIGHT ACTOR] |
      |   (Minion)    /                       \\   (Minion)    |
      |              /       BOARD PLANE       \\              |
      |             /       (Homography)        \\             |
      |    LEFT    /                             \\    RIGHT   |
      |   EFFECT  /                               \\  EFFECT   |
      |          BL '---------------------------' BR          |
      |                                                       |
      | [ BOTTOM HUD / CONTROL / ROTATE / LOG SAFE ZONE ]     |
(0,1) +-------------------------------------------------------+ (1,1)
```

### Geometry Points Specification

| Element | Runtime Property | Data Type | Description |
|---|---|---|---|
| Board Top-Left | boardPlaneFrac.tl | [u, v] | Top-left corner of the flat stone board surface |
| Board Top-Right | boardPlaneFrac.tr | [u, v] | Top-right corner of the flat stone board surface |
| Board Bottom-Right | boardPlaneFrac.br | [u, v] | Bottom-right corner of the flat stone board surface |
| Board Bottom-Left | boardPlaneFrac.bl | [u, v] | Bottom-left corner of the flat stone board surface |
| Boss / Top Foot | anchors.top | { x, y } | Foot-ground contact point for top boss / frontal actor |
| Left Mob Foot | anchors.left | { x, y } | Foot-ground contact point for left side minion |
| Right Mob Foot | anchors.right | { x, y } | Foot-ground contact point for right side minion |
| Top VFX Ground | effectAnchors.top | { x, y } | Center of ground telegraph / magic ring on top platform |
| Left VFX Ground | effectAnchors.left | { x, y } | Center of ground telegraph / magic ring on left podium |
| Right VFX Ground | effectAnchors.right | { x, y } | Center of ground telegraph / magic ring on right podium |

---

## 4. UI & HUD Safe Zones

To prevent overlap between dynamic UI elements and detailed arena artwork:

1. **Top Header Safe Zone (y: 0.00 .. 0.12):**
   - Reserved for boss nameplate, HP bar, encounter timers, and pause button.
   - Background art in this region should be atmospheric and low-contrast (ceiling arch, dark sky, cave shadows), avoiding bright focal lights.
2. **Side Actor Clearance Zones (x: 0.05 .. 0.28 & x: 0.72 .. 0.95, y: 0.35 .. 0.85):**
   - Dedicated corridors for side minions (wolf, goblin, skeleton) and their floating status plates.
   - As observed in FIX-023, large side sprites (~6 grid cells wide, ~300px) clip off-screen if podium anchors hug the outer edge (x < 0.12 or x > 0.88). Podium foot anchors must stay centered near x: 0.17 and x: 0.83.
3. **Bottom Controls Safe Zone (y: 0.88 .. 1.00):**
   - Reserved for action controls, rotate charges, and log messages.
   - The front baseline of the board (BL-BR) must not extend below y = 0.86.

---

## 5. Drift Tolerance & Rejection Criteria (Reject vs. Recalibrate)

When new arena images are generated, evaluate whether the image conforms to DEFAULT_ARENA_GEOMETRY, qualifies for minor recalibration, or must be **REJECTED**.

### Acceptable Drift (Within Default Tolerance)
An image is accepted as valid without re-tuning if:
- **Board Corner Drift:** All 4 corners of the stone surface align with DEFAULT_ARENA_GEOMETRY within **+-1.5%** of stage width/height (~ +-15px at 1080p).
- **Keystone / Horizontal Level:** Top edge TL-TR and bottom edge BL-BR are horizontal within **+-0.5 degrees** (no camera banking).
- **Podium Positions:** Standing platform centers deviate by no more than **+-2.0%** from canonical actor anchors.

### Rejection Criteria (REJECT -- Discard Immediately)
An image must be **rejected and re-prompted** (never saved or manually recalibrated) if:

1. **Baked Grid Lines on Stone:** The image contains visible 5x5/6x6 tile seams, carved grid squares, or baked numeric markings that collide with runtime arrows.
2. **Camera Perspective Mismatch:**
   - Perspective is too flat (orthographic / top-down) or too extreme (board foreshortening distorted, vanishing point too close).
   - Roll angle / tilted camera: the board plane or background horizon is visibly slanted.
3. **Missing or Misplaced Side Podiums:**
   - Side platforms are pushed too close to canvas edges (x < 0.12 or x > 0.88), making sprite clipping inevitable.
   - Platforms are positioned at asymmetric elevations or obstructed by foreground walls.
4. **Foreground Occlusion on Board:**
   - Heavy 3D decorations (boulders, tree roots, pillars, urns, hanging chains) overlap the board quad area. The stone dais must be clear.
5. **Aspect Ratio Deviation:** Image generated in square, 4:3, or 9:16 aspect ratio.

---

## 6. Recommended Metadata Shape

The metadata schema formalizes ArenaCalibration from spikes/arrow-core/viewer/visual-proto/arena-calibration.d.ts and provides full backwards compatibility with board-plane.js and arena-layout.js:

```typescript
export interface FracPt {
  x: number;
  y: number;
}

export interface FracCorners {
  tl: [number, number];
  tr: [number, number];
  br: [number, number];
  bl: [number, number];
}

export interface ArenaGeometryTemplate {
  /** Template identifier, e.g. 'arena-template-v1' */
  templateId: string;
  /** Canvas aspect ratio */
  aspectRatio: '16:9';
  /** Normalized coordinates of the 4 board plane corners */
  boardPlaneFrac: FracCorners;
  /** Inset from stone edge to active grid boundaries (0 for flush-edge) */
  margin: {
    u: number;
    v: number;
  };
  /** Foot-ground contact points for standing actors */
  anchors: {
    top: FracPt;
    left: FracPt;
    right: FracPt;
  };
  /** Ground centers for target circles, telegraphs, and cast VFX */
  effectAnchors: {
    top: FracPt;
    left: FracPt;
    right: FracPt;
  };
  /** UI clearance regions */
  hudSafeZones?: {
    topHeaderMaxY: number;
    bottomControlsMinY: number;
  };
}

export interface ArenaAssetEntry {
  id: string;
  name: string;
  backgroundFile: string;
  /** When true, uses DEFAULT_ARENA_GEOMETRY */
  useDefaultGeometry: boolean;
  /** Set only for special/boss encounters with unique perspective */
  geometryOverride?: Partial<ArenaGeometryTemplate>;
}
```

### CAL-001 Export Format

CAL-001 exports canonical definitions matching runtime structure:
```javascript
export const DEFAULT_ARENA_GEOMETRY = {
  templateId: 'arena-template-v1',
  aspectRatio: '16:9',
  boardPlaneFrac: {
    tl: [0.370, 0.450],
    tr: [0.630, 0.450],
    br: [0.655, 0.818],
    bl: [0.348, 0.820],
  },
  margin: { u: 0.0, v: 0.0 },
  anchors: {
    top: { x: 0.500, y: 0.155 },
    left: { x: 0.170, y: 0.620 },
    right: { x: 0.830, y: 0.620 },
  },
  effectAnchors: {
    top: { x: 0.500, y: 0.120 },
    left: { x: 0.170, y: 0.580 },
    right: { x: 0.830, y: 0.580 },
  },
};
```

---

## 7. Quality Checklists

### 7.1. Image Generator Checklist (Prompting & Art Generation)
- [ ] **Camera Angle:** Fixed three-quarters perspective with ~35-40 degree downward tilt.
- [ ] **Central Dais:** Exactly one raised trapezoidal stone slab in the middle of the arena.
- [ ] **Surface:** Uniform natural stone texture (granite, slate, marble) **WITHOUT grid lines, tiles, or runes**.
- [ ] **Flanking Platforms:** Distinct stone stairs / pedestals on the left and right, spaced with ample clearance from canvas borders.
- [ ] **Back Platform:** Clear elevated terrace for the top boss.
- [ ] **Clear Lines of Sight:** No hanging lanterns, banners, or foreground props blocking the board surface or flight paths to enemies.
- [ ] **Dimensions:** Clean 16:9 aspect ratio (1920x1080).

### 7.2. Acceptance Checklist for Ingested Arenas
1. [ ] **Aspect Ratio Verification:** Image is verified 16:9 (no cover-fit cropping distortion).
2. [ ] **Surface Cleanness:** Stone dais has no baked tile seams or numerical indicators.
3. [ ] **Default Geometry Fit:** When viewed with DEFAULT_ARENA_GEOMETRY overlay in CAL-001 or runtime viewer, projected grid corners lie within +-15px of stone borders across multiple grid sizes (5x5, 6x6, 7x7).
4. [ ] **Boss Stance & Clearance:** Top boss feet rest naturally on the rear platform; top HP bar and HUD stay clear of the boss head.
5. [ ] **Side Actor Footing:** Left and right minions stand firmly on their pedestals; 6-cell wide sprites are completely visible on-screen without clipping.
6. [ ] **Effect Anchor Alignment:** Telegraph circles drawn at effectAnchors sit stably on platform tops without spilling down vertical risers.
7. [ ] **Foreground Occlusion:** Board surface and arrow tap targets are 100% unobscured.

---

## 8. Conclusion

Arena Template v1 cleanly decouples visual theme from puzzle math:
- Generative art pipelines can produce diverse environments (catacombs, enchanted woods, icy citadels) without breaking gameplay.
- Runtime dynamically scales and projects any square puzzle size (5x5, 6x6, 7x7, 8x8) onto the same physical stone dais.
- Production eliminates the bottleneck of manual per-arena coordinate calibration.
