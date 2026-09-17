/* VIS-003 — minimal transform-hierarchy puppet player (Canvas 2D).
 * No external libraries. Parent transforms compose onto children via 2D matrices
 * from AnimCore (unit-tested in node, see anim-core.test.js).
 */
(function () {
  'use strict';

  var C = window.AnimCore;

  function Puppet(manifest, bitmaps, clips) {
    this.manifest = manifest;
    this.bitmaps = bitmaps;
    this.clips = clips;
    this.nodes = {};      // id -> node {id, bind, children[], world, abs}
    this.order = [];      // z-sorted part ids for drawing
    this.x = 0; this.y = 0; this.facing = 1;
    this.clipName = 'idle';
    this.clipTime = 0;
    this.fromPose = null; // snapshot for crossfade
    this.blendT = 1; this.blendDur = 0.12;
    this.firedEvents = {};
    this.flash = 0;       // 1 -> 0 white silhouette overlay
    this.hitstop = 0;     // seconds of frozen clip time
    this.glow = 0;        // cast glow 0..1 (target-driven)
    this.glowTarget = 0;
    this.dead = false;
    this.onEvent = null;  // fn(name, arg, puppet)
    this.drawCalls = 0;

    var self = this;
    var byId = {};
    manifest.parts.forEach(function (p) {
      byId[p.id] = {
        id: p.id,
        bind: { x: p.pos[0], y: p.pos[1], rot: 0, sx: 1, sy: 1, o: 1 },
        pivotPx: [p.pivot[0] * p.size[0], p.pivot[1] * p.size[1]],
        parent: p.parent === 'root' ? null : p.parent,
        children: [],
        world: [1, 0, 0, 1, 0, 0],
        abs: { x: 0, y: 0, rot: 0, sx: 1, sy: 1, o: 1 }
      };
    });
    manifest.parts.forEach(function (p) {
      if (p.parent !== 'root' && byId[p.parent]) byId[p.parent].children.push(byId[p.id]);
    });
    // Child `pos` is authored relative to the PARENT PIVOT (skeletal convention),
    // not the parent image corner. Store the parent pivot (px) for the shift.
    manifest.parts.forEach(function (p) {
      var node = byId[p.id];
      if (p.parent === 'root') {
        node.ppx = 0; node.ppy = 0;
      } else {
        var par = manifest.parts.filter(function (q) { return q.id === p.parent; })[0];
        node.ppx = par.pivot[0] * par.size[0];
        node.ppy = par.pivot[1] * par.size[1];
      }
    });
    this.nodes = byId;
    this.roots = manifest.parts
      .filter(function (p) { return p.parent === 'root'; })
      .map(function (p) { return byId[p.id]; });
    this.order = manifest.parts.slice()
      .sort(function (a, b) { return a.z - b.z; })
      .map(function (p) { return p.id; });
  }

  Puppet.prototype.play = function (name, blendSec) {
    if (!this.clips[name]) return;
    if (name === this.clipName && this.blendT >= 1) {
      // restarting same clip: just rewind unless it is terminal-dead
      if (!(name === 'death' && this.dead)) this.clipTime = 0;
      return;
    }
    this.fromPose = this.currentPose();
    this.clipName = name;
    this.clipTime = 0;
    this.blendT = 0;
    this.blendDur = (blendSec === undefined) ? 0.12 : blendSec;
    this.firedEvents = {};
    // Event-driven transient FX must not leak across interrupts
    // (e.g. killing cast mid-channel must extinguish the glow).
    this.glowTarget = 0;
    if (name !== 'death') this.dead = false;
  };

  Puppet.prototype.currentPose = function () {
    var clip = this.clips[this.clipName];
    var pose = { root: C.zeroOffset() };
    for (var id in this.nodes) pose[id] = C.zeroOffset();
    if (!clip) return pose;
    var t = this.clipTime * 1000;
    for (var track in clip.tracks) {
      if (pose[track]) pose[track] = C.sampleTrack(clip.tracks[track], t);
    }
    return pose;
  };

  Puppet.prototype.update = function (dt) {
    // dt seconds
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      if (this.hitstop > 0) { this.decayFx(dt); return; }
    }
    var clip = this.clips[this.clipName];
    this.clipTime += dt;
    if (clip) {
      var dur = clip.duration / 1000;
      // fire events
      var tms = this.clipTime * 1000;
      var self = this;
      (clip.events || []).forEach(function (ev, i) {
        if (!self.firedEvents[i] && tms >= ev.t) {
          self.firedEvents[i] = true;
          self.handleEvent(ev.fn, ev.arg);
        }
      });
      if (this.clipTime >= dur) {
        if (clip.loop) {
          this.clipTime %= dur;
          this.firedEvents = {};
        } else if (clip.terminal) {
          this.clipTime = dur; // hold final collapsed+faded pose
          this.dead = true;
        } else {
          this.play('idle', 0.15); // auto return
        }
      }
    }
    if (this.blendT < 1) {
      this.blendT = Math.min(1, this.blendT + dt / Math.max(this.blendDur, 1e-4));
    }
    this.decayFx(dt);
    this.recompute();
  };

  Puppet.prototype.decayFx = function (dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 0.12);
    var g = this.glowTarget - this.glow;
    this.glow += g * Math.min(1, dt * 8);
  };

  Puppet.prototype.poseNow = function () {
    var target = this.currentPose();
    if (this.fromPose && this.blendT < 1) {
      var w = C.ease('sineInOut', this.blendT);
      var out = {};
      for (var id in target) out[id] = C.mixOffsets(this.fromPose[id] || C.zeroOffset(), target[id], w);
      return out;
    }
    return target;
  };

  Puppet.prototype.recompute = function () {
    var pose = this.poseNow();
    var rootM = [this.facing, 0, 0, 1, this.x, this.y];
    var self = this;
    function walk(node, parentM) {
      var off = pose[node.id] || C.zeroOffset();
      node.abs = C.applyOffset(node.bind, off);
      // shift origin from parent-image corner to parent pivot:
      var shifted = {
        x: node.abs.x + node.ppx, y: node.abs.y + node.ppy,
        rot: node.abs.rot, sx: node.abs.sx, sy: node.abs.sy, o: node.abs.o
      };
      var local = C.localMatrix(shifted, node.pivotPx[0], node.pivotPx[1]);
      node.world = C.mulMatrix(parentM, local);
      node.children.forEach(function (ch) { walk(ch, node.world); });
    }
    // root node itself: bind at origin; apply root-track offset if present
    var rootOff = pose.root || C.zeroOffset();
    var rootAbs = C.applyOffset({ x: 0, y: 0, rot: 0, sx: 1, sy: 1, o: 1 }, rootOff);
    var rootLocal = C.localMatrix(rootAbs, 0, 0);
    var world = C.mulMatrix(rootM, rootLocal);
    this.rootWorld = world;
    this.roots.forEach(function (r) { walk(r, world); });
    void self;
  };

  Puppet.prototype.handleEvent = function (fn, arg) {
    if (fn === 'flash') this.flash = 1;
    else if (fn === 'hitstop') this.hitstop = (arg || 66) / 1000;
    else if (fn === 'castGlowStart') this.glowTarget = 1;
    else if (fn === 'castGlowStop') this.glowTarget = 0;
    if (this.onEvent) this.onEvent(fn, arg, this);
  };

  // World-space point of a named FX anchor (for projectiles/particles/glow).
  Puppet.prototype.anchor = function (name) {
    var a = this.manifest.anchors[name];
    if (!a) return null;
    var node = this.nodes[a.node];
    if (!node) return null;
    var bmp = this.bitmaps[a.node];
    return C.applyMatrix(node.world, a.p[0] * bmp.w, a.p[1] * bmp.h);
  };

  Puppet.prototype.render = function (ctx, prefix) {
    this.drawCalls = 0;
    for (var i = 0; i < this.order.length; i++) {
      var id = this.order[i];
      var node = this.nodes[id];
      var bmp = this.bitmaps[id];
      if (!bmp || node.abs.o <= 0.01) continue;
      var m = prefix ? C.mulMatrix(prefix, node.world) : node.world;
      ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.globalAlpha = node.abs.o;
      ctx.drawImage(bmp.img, 0, 0);
      this.drawCalls++;
      if (this.flash > 0.01) {
        ctx.globalAlpha = this.flash * node.abs.o;
        ctx.drawImage(bmp.white, 0, 0);
        this.drawCalls++;
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  };

  window.Puppet = Puppet;
})();
