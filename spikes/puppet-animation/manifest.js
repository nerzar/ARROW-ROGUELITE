/* VIS-003 — declarative layer manifest for the dummy caster.
 * This is the exact shape a real AI-art import would use (JSON-serializable).
 * Bitmaps for the proof are painted procedurally by dummy-parts.js (same ids/sizes).
 *
 * Coordinate notes:
 *  - pos: where this node's PIVOT sits in parent space (px, y grows DOWN on screen,
 *    so "up the body" is negative y). Root origin = ground contact center.
 *  - pivot: normalized [0..1] within the part image; stays fixed under rotation.
 *  - anchors: FX attachment points as normalized coords within the named node image.
 */
var MANIFEST = {
  name: 'dummy-caster',
  compositeSize: [260, 380],
  groundY: 0,
  parts: [
    { id: 'cloak',    src: 'cloak.png',    size: [150, 230], pivot: [0.50, 0.05], parent: 'torso',   pos: [0, -150], z: 0 },
    { id: 'legs',     src: 'legs.png',     size: [140, 100], pivot: [0.50, 1.00], parent: 'root',    pos: [0, 0],    z: 1 },
    { id: 'torso',    src: 'torso.png',    size: [150, 180], pivot: [0.50, 0.90], parent: 'root',    pos: [0, -95],  z: 2 },
    { id: 'head',     src: 'head.png',     size: [120, 120], pivot: [0.50, 0.85], parent: 'torso',   pos: [0, -160], z: 3 },
    { id: 'armUpperL',src: 'armUpperL.png',size: [60, 110],  pivot: [0.50, 0.12], parent: 'torso',   pos: [-55, -130], z: 4 },
    { id: 'armForeL', src: 'armForeL.png', size: [55, 100],  pivot: [0.50, 0.10], parent: 'armUpperL', pos: [0, 95],  z: 5 },
    { id: 'armR',     src: 'armR.png',     size: [60, 150],  pivot: [0.50, 0.12], parent: 'torso',   pos: [55, -130],  z: 6 },
    { id: 'staff',    src: 'staff.png',    size: [70, 260],  pivot: [0.35, 0.62], parent: 'armR',    pos: [0, 128],  z: 7 }
  ],
  anchors: {
    handL:      { node: 'armForeL', p: [0.50, 0.95] },
    weaponTip:  { node: 'staff',    p: [0.50, 0.03] },
    staffGrip:  { node: 'staff',    p: [0.35, 0.62] },
    bodyCenter: { node: 'torso',    p: [0.50, 0.50] },
    headTop:    { node: 'head',     p: [0.50, 0.05] }
  }
};
