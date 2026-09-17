/* Node-only sanity tests for anim-core.js (no DOM). Run: node anim-core.test.js */
var C = require('./anim-core.js');

var failures = 0;
function ok(cond, name) {
  if (cond) { console.log('PASS ' + name); }
  else { failures++; console.log('FAIL ' + name); }
}
function approx(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }

// 1. easing endpoints
ok(C.ease('linear', 0) === 0 && C.ease('linear', 1) === 1, 'easing linear endpoints');
ok(approx(C.ease('sineInOut', 0.5), 0.5), 'easing sineInOut midpoint');
ok(approx(C.ease('backOut', 1), 1), 'easing backOut ends at 1');
ok(C.ease('nope', 0.3) === 0.3, 'unknown easing falls back to linear');

// 2. track sampling: hold before first / after last, interpolate inside
var keys = [{ t: 0, rot: 0 }, { t: 100, rot: 90, ease: 'linear' }];
ok(C.sampleTrack(keys, -10).rot === 0, 'sample holds first key before start');
ok(C.sampleTrack(keys, 250).rot === 90, 'sample holds last key after end');
ok(approx(C.sampleTrack(keys, 50).rot, 45), 'sample interpolates midpoint');
ok(C.sampleTrack([], 50).rot === 0, 'empty track is zero offset');

// 3. applyOffset: additive pos/rot, multiplicative scale, clamped opacity
var abs = C.applyOffset({ x: 10, y: 20, rot: 5, sx: 2, sy: 2, o: 1 },
  { x: 3, y: -4, rot: 10, sx: 0.5, sy: -0.25, o: -1.5 });
ok(abs.x === 13 && abs.y === 16 && abs.rot === 15, 'applyOffset additive pos/rot');
ok(approx(abs.sx, 3) && approx(abs.sy, 1.5), 'applyOffset multiplicative scale');
ok(abs.o === 0, 'applyOffset clamps opacity to 0');

// 4. pivot correctness: pivot pixel must stay fixed under rotation.
// Part 100x100, pivot center (50,50), pose rot=90 at pos (200,300).
var m = C.localMatrix({ x: 200, y: 300, rot: 90, sx: 1, sy: 1, o: 1 }, 50, 50);
var p = C.applyMatrix(m, 50, 50);
ok(approx(p[0], 200) && approx(p[1], 300), 'pivot point invariant under rotation');

// 5. parent influences child: child world = parent * local.
var parent = C.localMatrix({ x: 100, y: 0, rot: 0, sx: 1, sy: 1, o: 1 }, 0, 0);
var child = C.localMatrix({ x: 10, y: 0, rot: 0, sx: 1, sy: 1, o: 1 }, 0, 0);
var world = C.mulMatrix(parent, child);
var wp = C.applyMatrix(world, 0, 0);
ok(approx(wp[0], 110) && approx(wp[1], 0), 'child inherits parent translation');
// rotation of parent swings child offset
var parentR = C.localMatrix({ x: 0, y: 0, rot: 90, sx: 1, sy: 1, o: 1 }, 0, 0);
var worldR = C.mulMatrix(parentR, child);
var wpR = C.applyMatrix(worldR, 0, 0);
ok(approx(wpR[0], 0, 1e-4) && approx(wpR[1], 10, 1e-4), 'child offset rotated by parent');

// 6. mixOffsets blends two poses
var mixed = C.mixOffsets({ x: 0, y: 0, rot: 0, sx: 0, sy: 0, o: 0 },
  { x: 10, y: 0, rot: 20, sx: 0, sy: 0, o: 0 }, 0.5);
ok(mixed.x === 5 && mixed.rot === 10, 'mixOffsets linear blend');

if (failures > 0) { console.log(failures + ' FAILURE(S)'); process.exit(1); }
console.log('ALL TESTS PASSED');
