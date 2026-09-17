/* VIS-003 puppet-animation proof — pure animation math, no DOM dependency.
 * Usable from browser (window.AnimCore) and from node (module.exports) for tests.
 *
 * Conventions:
 *  - angles in degrees, positions in px, scale as multiplier, opacity 0..1
 *  - a clip stores OFFSETS from bind pose; final = bind + offset,
 *    except scale: final = bind * (1 + offset), opacity: final = clamp(bind + offset)
 *  - 2D matrices as [a,b,c,d,e,f] (canvas setTransform order)
 */

(function (root) {
  'use strict';

  var Easing = {
    linear: function (t) { return t; },
    sineInOut: function (t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); },
    quadOut: function (t) { return 1 - (1 - t) * (1 - t); },
    cubicOut: function (t) { return 1 - Math.pow(1 - t, 3); },
    expoIn: function (t) { return t <= 0 ? 0 : Math.pow(2, 10 * (t - 1)); },
    backOut: function (t) {
      var s = 1.70158;
      t -= 1;
      return 1 + (s + 1) * t * t * t + s * t * t;
    }
  };

  function ease(name, t) {
    var fn = Easing[name] || Easing.linear;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return fn(t);
  }

  var ZERO = { x: 0, y: 0, rot: 0, sx: 0, sy: 0, o: 0 };

  function zeroOffset() {
    return { x: 0, y: 0, rot: 0, sx: 0, sy: 0, o: 0 };
  }

  // Sample one track (sorted keyframes [{t, x,y,rot,sx,sy,o, ease}]) at time t.
  // Missing channels default to 0 offset. Before first key -> first key value
  // (no extrapolation), after last key -> last key value (pose holds).
  function sampleTrack(keys, t) {
    if (!keys || keys.length === 0) return zeroOffset();
    var out = zeroOffset();
    var chans = ['x', 'y', 'rot', 'sx', 'sy', 'o'];
    var k0 = keys[0];
    var k1 = keys[keys.length - 1];
    var i, a, b, f, e;
    if (t <= k0.t) {
      for (i = 0; i < chans.length; i++) {
        var c = chans[i];
        if (k0[c] !== undefined) out[c] = k0[c];
      }
      return out;
    }
    if (t >= k1.t) {
      for (i = 0; i < chans.length; i++) {
        var c2 = chans[i];
        if (k1[c2] !== undefined) out[c2] = k1[c2];
      }
      return out;
    }
    for (i = 0; i < keys.length - 1; i++) {
      a = keys[i];
      b = keys[i + 1];
      if (t >= a.t && t <= b.t) {
        f = (b.t - a.t) > 0 ? (t - a.t) / (b.t - a.t) : 1;
        e = ease(b.ease || a.ease, f);
        for (var j = 0; j < chans.length; j++) {
          var c3 = chans[j];
          var va = (a[c3] !== undefined) ? a[c3] : 0;
          var vb = (b[c3] !== undefined) ? b[c3] : 0;
          out[c3] = va + (vb - va) * e;
        }
        return out;
      }
    }
    return out;
  }

  // Mix two offset-poses: out = a + (b - a) * w
  function mixOffsets(a, b, w) {
    var out = zeroOffset();
    for (var k in out) {
      if (Object.prototype.hasOwnProperty.call(out, k)) {
        out[k] = a[k] + ((b[k] || 0) - (a[k] || 0)) * w;
      }
    }
    return out;
  }

  // Apply offset-pose onto a bind pose -> absolute local transform.
  function applyOffset(bind, off) {
    return {
      x: bind.x + (off.x || 0),
      y: bind.y + (off.y || 0),
      rot: bind.rot + (off.rot || 0),
      sx: bind.sx * (1 + (off.sx || 0)),
      sy: bind.sy * (1 + (off.sy || 0)),
      o: clamp01(bind.o + (off.o || 0))
    };
  }

  function clamp01(v) {
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  // Local matrix: T(pos) * R(rot) * S(scale) * T(-pivotPx)
  // pivotPx = pivot in pixels within the part image.
  function localMatrix(pose, pivotPxX, pivotPxY) {
    var r = pose.rot * Math.PI / 180;
    var cos = Math.cos(r), sin = Math.sin(r);
    var sx = pose.sx, sy = pose.sy;
    // R*S then translate by -pivot through R*S, then add pos:
    var a = cos * sx, b = sin * sx;
    var c = -sin * sy, d = cos * sy;
    var e = pose.x - (a * pivotPxX + c * pivotPxY);
    var f = pose.y - (b * pivotPxX + d * pivotPxY);
    return [a, b, c, d, e, f];
  }

  function mulMatrix(m1, m2) {
    // m1 * m2 (apply m2 first, then m1)
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  }

  function applyMatrix(m, x, y) {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }

  var api = {
    Easing: Easing,
    ease: ease,
    ZERO: ZERO,
    zeroOffset: zeroOffset,
    sampleTrack: sampleTrack,
    mixOffsets: mixOffsets,
    applyOffset: applyOffset,
    clamp01: clamp01,
    localMatrix: localMatrix,
    mulMatrix: mulMatrix,
    applyMatrix: applyMatrix
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.AnimCore = api;
  }
})(typeof self !== 'undefined' ? self : this);
