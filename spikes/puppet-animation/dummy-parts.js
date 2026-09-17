/* VIS-003 — procedural dummy part bitmaps (stand-ins for cut AI-art PNGs).
 * Shapes are intentionally primitive: the proof target is the PIPELINE
 * (manifest + pivots + hierarchy + clips), not the art.
 * Joint ends are drawn as rounded caps so rotations don't open gaps —
 * the same practice a real cut would follow.
 */
(function () {
  'use strict';

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // White silhouette copy for the hit-flash (precomputed once per part).
  function silhouette(src) {
    var c = makeCanvas(src.width, src.height);
    var g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function outline(g) {
    g.lineWidth = 4;
    g.strokeStyle = '#1b2430';
    g.stroke();
  }

  var painters = {
    cloak: function (g, w, h) {
      // Ragged violet cloak hanging from collar (top-center) down.
      g.fillStyle = '#4a235a';
      g.beginPath();
      g.moveTo(w * 0.30, 8);
      g.quadraticCurveTo(w * 0.5, 0, w * 0.70, 8);
      g.lineTo(w * 0.86, h * 0.92);
      g.lineTo(w * 0.68, h * 0.80);
      g.lineTo(w * 0.55, h * 0.97);
      g.lineTo(w * 0.42, h * 0.82);
      g.lineTo(w * 0.28, h * 0.95);
      g.lineTo(w * 0.14, h * 0.88);
      g.closePath();
      g.fill(); outline(g);
      g.fillStyle = '#5d2f73';
      g.fillRect(w * 0.40, 10, w * 0.20, h * 0.55);
    },
    legs: function (g, w, h) {
      // Robe hem + two boots planted on ground.
      g.fillStyle = '#2e3a4a';
      g.beginPath();
      g.moveTo(w * 0.22, 0);
      g.lineTo(w * 0.78, 0);
      g.lineTo(w * 0.92, h * 0.72);
      g.lineTo(w * 0.08, h * 0.72);
      g.closePath();
      g.fill(); outline(g);
      g.fillStyle = '#1a2230';
      g.beginPath(); g.arc(w * 0.34, h * 0.82, 20, 0, 7); g.fill(); outline(g);
      g.beginPath(); g.arc(w * 0.66, h * 0.82, 20, 0, 7); g.fill(); outline(g);
    },
    torso: function (g, w, h) {
      // Robe torso with belt + rounded shoulder caps tucked under arms.
      g.fillStyle = '#1f7a8c';
      g.beginPath();
      g.moveTo(w * 0.24, h * 0.06);
      g.quadraticCurveTo(w * 0.5, -6, w * 0.76, h * 0.06);
      g.lineTo(w * 0.86, h * 0.88);
      g.quadraticCurveTo(w * 0.5, h * 0.99, w * 0.14, h * 0.88);
      g.closePath();
      g.fill(); outline(g);
      g.fillStyle = '#8a6d2f'; // belt
      g.fillRect(w * 0.15, h * 0.62, w * 0.70, 16);
      g.fillStyle = '#ffd54f';
      g.fillRect(w * 0.44, h * 0.60, 20, 20);
      g.fillStyle = '#155263'; // collar shadow
      g.beginPath(); g.arc(w * 0.5, h * 0.08, 22, 0, 7); g.fill();
    },
    head: function (g, w, h) {
      // Hooded head: hood cowl + green face + glowing eyes. Rounded neck cap.
      g.fillStyle = '#5d2f73';
      g.beginPath();
      g.arc(w * 0.5, h * 0.42, 46, 0, 7);
      g.fill(); outline(g);
      g.fillStyle = '#7cb342';
      g.beginPath();
      g.arc(w * 0.5, h * 0.48, 30, 0, 7);
      g.fill(); outline(g);
      g.fillStyle = '#1b2430';
      g.beginPath(); g.arc(w * 0.5, h * 0.88, 16, 0, 7); g.fill(); // neck cap
      g.fillStyle = '#ffe082'; // glowing eyes
      g.beginPath(); g.arc(w * 0.40, h * 0.46, 6, 0, 7); g.fill();
      g.beginPath(); g.arc(w * 0.60, h * 0.46, 6, 0, 7); g.fill();
    },
    armUpperL: function (g, w, h) {
      g.fillStyle = '#7cb342';
      g.beginPath(); g.arc(w * 0.5, 14, 22, 0, 7); g.fill(); // shoulder cap
      g.fillRect(w * 0.5 - 15, 14, 30, h - 30);
      g.fill(); outline(g);
      g.beginPath(); g.arc(w * 0.5, 14, 22, 0, 7); outline(g);
      g.fillStyle = '#1b2430';
      g.beginPath(); g.arc(w * 0.5, h - 8, 15, 0, 7); g.fill(); // elbow cap
    },
    armForeL: function (g, w, h) {
      g.fillStyle = '#8fd0a0';
      g.beginPath(); g.arc(w * 0.5, 10, 15, 0, 7); g.fill(); // elbow cap
      g.fillRect(w * 0.5 - 12, 10, 24, h - 34);
      g.fill(); outline(g);
      g.beginPath(); g.arc(w * 0.5, 10, 15, 0, 7); outline(g);
      g.fillStyle = '#8fd0a0'; // claw hand
      g.beginPath(); g.arc(w * 0.5, h - 14, 14, 0, 7); g.fill(); outline(g);
    },
    armR: function (g, w, h) {
      // Near arm: sleeve + green hand gripping (staff overlaps separately).
      g.fillStyle = '#1f7a8c';
      g.beginPath(); g.arc(w * 0.5, 16, 23, 0, 7); g.fill();
      g.fillRect(w * 0.5 - 16, 16, 32, h * 0.55);
      g.fill(); outline(g);
      g.beginPath(); g.arc(w * 0.5, 16, 23, 0, 7); outline(g);
      g.fillStyle = '#7cb342';
      g.fillRect(w * 0.5 - 14, h * 0.55, 28, h * 0.30);
      g.strokeRect(w * 0.5 - 14, h * 0.55, 28, h * 0.30);
      g.beginPath(); g.arc(w * 0.5, h - 12, 15, 0, 7); g.fill(); outline(g);
    },
    staff: function (g, w, h) {
      // Gnarled staff: shaft + amethyst skull crystal on top.
      g.fillStyle = '#5d4037';
      g.fillRect(w * 0.30, h * 0.06, 18, h * 0.90);
      outline(g);
      g.fillStyle = '#ab47bc';
      g.beginPath();
      g.moveTo(w * 0.39, 6);
      g.lineTo(w * 0.62, h * 0.10);
      g.lineTo(w * 0.39, h * 0.16);
      g.lineTo(w * 0.16, h * 0.10);
      g.closePath();
      g.fill(); outline(g);
      g.fillStyle = '#e1bee7';
      g.beginPath(); g.arc(w * 0.39, h * 0.09, 6, 0, 7); g.fill();
    }
  };

  function buildParts(manifest) {
    var out = {};
    manifest.parts.forEach(function (p) {
      var c = makeCanvas(p.size[0], p.size[1]);
      var g = c.getContext('2d');
      painters[p.id](g, p.size[0], p.size[1]);
      out[p.id] = { img: c, white: silhouette(c), w: p.size[0], h: p.size[1] };
    });
    return out;
  }

  window.DummyParts = { buildParts: buildParts };
})();
