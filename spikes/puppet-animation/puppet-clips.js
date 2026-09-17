/* VIS-003 — declarative animation clips (offsets from bind pose).
 * Channels: x, y (px), rot (deg), sx, sy (fractional scale delta), o (opacity delta).
 * Each track key may carry `ease` (segment easing INTO that key).
 */
var CLIPS = {
  idle: {
    loop: true,
    duration: 2400,
    tracks: {
      root: [
        { t: 0, y: 0 }, { t: 1200, y: -4, ease: 'sineInOut' }, { t: 2400, y: 0, ease: 'sineInOut' }
      ],
      torso: [
        { t: 0, sy: 0, y: 0 },
        { t: 600, sy: 0.03, y: -2, ease: 'sineInOut' },
        { t: 1200, sy: 0, y: 0, ease: 'sineInOut' },
        { t: 1800, sy: 0.03, y: -2, ease: 'sineInOut' },
        { t: 2400, sy: 0, y: 0, ease: 'sineInOut' }
      ],
      head: [ // lags torso by ~120ms feel via phase shift
        { t: 0, rot: 0, y: 0 },
        { t: 700, rot: 4, y: -1, ease: 'sineInOut' },
        { t: 1300, rot: 0, y: 0, ease: 'sineInOut' },
        { t: 1900, rot: -3, y: -1, ease: 'sineInOut' },
        { t: 2400, rot: 0, y: 0, ease: 'sineInOut' }
      ],
      staff: [
        { t: 0, rot: 0 }, { t: 1200, rot: 3, ease: 'sineInOut' }, { t: 2400, rot: 0, ease: 'sineInOut' }
      ],
      armR: [
        { t: 0, rot: 0 }, { t: 1200, rot: 2, ease: 'sineInOut' }, { t: 2400, rot: 0, ease: 'sineInOut' }
      ],
      cloak: [
        { t: 0, rot: -2 }, { t: 1200, rot: 3, ease: 'sineInOut' }, { t: 2400, rot: -2, ease: 'sineInOut' }
      ]
    },
    events: []
  },

  hit: {
    duration: 450,
    tracks: {
      root: [
        { t: 0, x: -14, y: 0 },
        { t: 90, x: -14, ease: 'quadOut' },
        { t: 450, x: 0, ease: 'backOut' }
      ],
      torso: [
        { t: 0, sx: 0.15, sy: -0.15, rot: -6 },
        { t: 120, sx: 0.15, sy: -0.15, rot: -6, ease: 'quadOut' },
        { t: 450, sx: 0, sy: 0, rot: 0, ease: 'backOut' }
      ],
      head: [
        { t: 0, rot: -12 },
        { t: 140, rot: -12, ease: 'quadOut' },
        { t: 450, rot: 0, ease: 'backOut' }
      ],
      armR: [
        { t: 0, rot: 30 },
        { t: 150, rot: 30, ease: 'quadOut' },
        { t: 450, rot: 0, ease: 'backOut' }
      ],
      staff: [
        { t: 0, rot: 18 },
        { t: 150, rot: 18, ease: 'quadOut' },
        { t: 450, rot: 0, ease: 'backOut' }
      ]
    },
    events: [{ t: 0, fn: 'flash' }, { t: 0, fn: 'hitstop', arg: 66 }]
  },

  attack: {
    duration: 700,
    tracks: {
      // anticipation: coil back
      torso: [
        { t: 0, rot: 0, x: 0 },
        { t: 300, rot: -10, x: 6, ease: 'sineInOut' },
        { t: 380, rot: 15, x: -4, ease: 'expoIn' },
        { t: 700, rot: 0, x: 0, ease: 'backOut' }
      ],
      armR: [
        { t: 0, rot: 0 },
        { t: 300, rot: -45, ease: 'sineInOut' },
        { t: 380, rot: 55, ease: 'expoIn' },
        { t: 700, rot: 0, ease: 'backOut' }
      ],
      staff: [
        { t: 0, rot: 0 },
        { t: 300, rot: -20, ease: 'sineInOut' },
        { t: 380, rot: 25, ease: 'expoIn' },
        { t: 700, rot: 0, ease: 'backOut' }
      ],
      root: [
        { t: 0, x: 0 },
        { t: 300, x: 8, ease: 'sineInOut' },
        { t: 380, x: -12, ease: 'expoIn' },
        { t: 700, x: 0, ease: 'backOut' }
      ],
      head: [
        { t: 0, rot: 0 },
        { t: 300, rot: -6, ease: 'sineInOut' },
        { t: 380, rot: 8, ease: 'expoIn' },
        { t: 700, rot: 0, ease: 'backOut' }
      ],
      cloak: [
        { t: 0, rot: 0 },
        { t: 300, rot: 8, ease: 'sineInOut' },
        { t: 380, rot: -10, ease: 'expoIn' },
        { t: 700, rot: 0, ease: 'backOut' }
      ]
    },
    events: [{ t: 380, fn: 'strikeBurst' }]
  },

  cast: {
    duration: 1400,
    tracks: {
      armR: [
        { t: 0, rot: 0 },
        { t: 400, rot: -120, ease: 'sineInOut' },
        { t: 1000, rot: -116, ease: 'sineInOut' },
        { t: 1400, rot: 0, ease: 'sineInOut' }
      ],
      armForeL: [
        { t: 0, rot: 0 },
        { t: 400, rot: -50, ease: 'sineInOut' },
        { t: 1000, rot: -46, ease: 'sineInOut' },
        { t: 1400, rot: 0, ease: 'sineInOut' }
      ],
      staff: [
        { t: 0, rot: 0 },
        { t: 400, rot: -25, ease: 'sineInOut' },
        { t: 1000, rot: -25, ease: 'sineInOut' },
        { t: 1400, rot: 0, ease: 'sineInOut' }
      ],
      root: [
        { t: 0, y: 0 },
        { t: 400, y: -12, ease: 'sineInOut' },
        { t: 1000, y: -12, ease: 'sineInOut' },
        { t: 1400, y: 0, ease: 'sineInOut' }
      ],
      torso: [
        { t: 0, sy: 0 },
        { t: 400, sy: 0.04, ease: 'sineInOut' },
        { t: 1000, sy: 0.04, ease: 'sineInOut' },
        { t: 1400, sy: 0, ease: 'sineInOut' }
      ],
      head: [
        { t: 0, rot: 0 },
        { t: 400, rot: -8, ease: 'sineInOut' },
        { t: 1000, rot: -8, ease: 'sineInOut' },
        { t: 1400, rot: 0, ease: 'sineInOut' }
      ]
    },
    events: [
      { t: 400, fn: 'castGlowStart' },
      { t: 1000, fn: 'castGlowStop' }
    ]
  },

  death: {
    terminal: true,
    duration: 1500,
    tracks: {
      root: [
        { t: 0, x: 0, rot: 0, y: 0 },
        { t: 250, x: -10, rot: 8, y: 0, ease: 'quadOut' },
        { t: 900, x: 6, rot: 62, y: 26, ease: 'cubicOut' },
        { t: 1500, x: 6, rot: 62, y: 26 }
      ],
      torso: [
        { t: 0, sx: 0, sy: 0, o: 0 },
        { t: 900, sx: 0.1, sy: -0.1, o: 0, ease: 'cubicOut' },
        { t: 1500, sx: 0.1, sy: -0.1, o: -1, ease: 'sineInOut' }
      ],
      head: [
        { t: 0, rot: 0, o: 0 },
        { t: 900, rot: -20, o: 0, ease: 'cubicOut' },
        { t: 1500, rot: -20, o: -1, ease: 'sineInOut' }
      ],
      armR: [
        { t: 0, rot: 0, o: 0 },
        { t: 900, rot: 40, o: 0, ease: 'cubicOut' },
        { t: 1500, rot: 40, o: -1, ease: 'sineInOut' }
      ],
      staff: [
        { t: 0, rot: 0, o: 0 },
        { t: 900, rot: 70, o: 0, ease: 'cubicOut' },
        { t: 1500, rot: 70, o: -1, ease: 'sineInOut' }
      ]
    },
    events: [{ t: 900, fn: 'deathPoof' }]
  }
};
