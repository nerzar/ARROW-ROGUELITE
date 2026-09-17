/* VIS-003 demo wiring: scene, particles, FX hooks, UI, benchmark. */
(function () {
  'use strict';

  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 960, H = 600, GROUND = 505;

  function fitCanvas() {
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.aspectRatio = W + ' / ' + H;
  }
  fitCanvas();

  var bitmaps = window.DummyParts.buildParts(window.MANIFEST);
  var puppets = [];
  var particles = [];
  var showMarkers = true;

  function layout(count) {
    puppets = [];
    var spacing = count === 1 ? 0 : Math.min(200, 820 / Math.max(count - 1, 1));
    var x0 = count === 1 ? W / 2 : (W - spacing * (count - 1)) / 2;
    var scale = count > 30 ? 0.55 : (count > 10 ? 0.75 : 1);
    for (var i = 0; i < count; i++) {
      var p = new window.Puppet(window.MANIFEST, bitmaps, window.CLIPS);
      p.x = x0 + i * spacing;
      p.y = GROUND;
      p.baseScale = scale;
      p.onEvent = onPuppetEvent;
      p.update(0);
      puppets.push(p);
    }
  }

  // Wrap render to include per-puppet base scale: fold scale about (p.x, p.y)
  // into a prefix matrix (screen = DPR * (p + s * (q - p)))).
  function renderPuppet(p) {
    var s = p.baseScale || 1;
    var prefix = [DPR * s, 0, 0, DPR * s, DPR * (p.x - s * p.x), DPR * (p.y - s * p.y)];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    p.render(ctx, prefix);
  }

  function worldOf(p, name) {
    var a = p.anchor(name);
    if (!a) return null;
    var s = p.baseScale || 1;
    return [p.x + (a[0] - p.x) * s, p.y + (a[1] - p.y) * s];
  }

  function burst(x, y, n, color, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = (speed || 160) * (0.4 + Math.random() * 0.8);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        life: 0.5 + Math.random() * 0.3, age: 0,
        color: color, size: 2 + Math.random() * 3
      });
    }
  }

  function onPuppetEvent(fn, arg, p) {
    var at;
    if (fn === 'strikeBurst') {
      at = worldOf(p, 'weaponTip');
      if (at) burst(at[0], at[1], 14, '#ffd54f', 220);
    } else if (fn === 'deathPoof') {
      at = worldOf(p, 'bodyCenter');
      if (at) burst(at[0], at[1], 18, '#8d6e63', 120);
    }
  }

  // ---- main loop ----
  var last = performance.now();
  var fpsAcc = 0, fpsN = 0, fpsShown = 0, msAcc = 0;
  var bench = null;

  function frame(now) {
    requestAnimationFrame(frame);
    var dtms = now - last;
    last = now;
    var dt = Math.min(dtms / 1000, 0.05);
    fpsAcc += dtms; fpsN++; msAcc += dtms;
    if (fpsAcc >= 500) {
      fpsShown = Math.round(1000 / (fpsAcc / fpsN));
      window.__avgMs = msAcc / fpsN;
      fpsAcc = 0; fpsN = 0; msAcc = 0;
      document.getElementById('fps').textContent =
        fpsShown + ' FPS · ' + window.__avgMs.toFixed(2) + ' ms/frame';
    }

    for (var i = 0; i < puppets.length; i++) puppets[i].update(dt);
    updateParticles(dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // ground line + shadows
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.moveTo(20, GROUND + 2); ctx.lineTo(W - 20, GROUND + 2); ctx.stroke();
    for (var s = 0; s < puppets.length; s++) {
      var p = puppets[s];
      var sc = p.baseScale || 1;
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.ellipse(p.x, GROUND + 8, 70 * sc, 12 * sc, 0, 0, 7);
      ctx.fill();
    }

    var calls = 0;
    for (var j = 0; j < puppets.length; j++) {
      renderPuppet(puppets[j]);
      calls += puppets[j].drawCalls;
      drawCastFx(puppets[j]);
    }
    window.__drawCalls = calls + particles.length;
    drawParticles();
    if (showMarkers) drawMarkers();
    if (bench) benchTick(now);
  }

  function drawCastFx(p) {
    if (p.glow < 0.03) return;
    var sc = p.baseScale || 1;
    // ground rune circle
    ctx.save();
    ctx.globalAlpha = 0.55 * p.glow;
    ctx.strokeStyle = '#ab47bc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, GROUND + 6, (46 + 6 * Math.sin(performance.now() / 90)) * sc, 12 * sc, 0, 0, 7);
    ctx.stroke();
    // glow at raised hand
    var at = worldOf(p, 'handL');
    if (at) {
      var r = 26 * sc * (0.8 + 0.2 * Math.sin(performance.now() / 70));
      var g = ctx.createRadialGradient(at[0], at[1], 2, at[0], at[1], r);
      g.addColorStop(0, 'rgba(225,190,231,' + (0.9 * p.glow) + ')');
      g.addColorStop(1, 'rgba(171,71,188,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(at[0], at[1], r, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var q = particles[i];
      q.age += dt;
      if (q.age >= q.life) { particles.splice(i, 1); continue; }
      q.vy += 500 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
  }

  function drawParticles() {
    ctx.save();
    for (var i = 0; i < particles.length; i++) {
      var q = particles[i];
      ctx.globalAlpha = 1 - q.age / q.life;
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.restore();
  }

  var ANCHOR_LIST = ['handL', 'weaponTip', 'bodyCenter', 'headTop'];
  function drawMarkers() {
    var n = Math.min(puppets.length, 4);
    ctx.save();
    ctx.font = '11px monospace';
    for (var i = 0; i < n; i++) {
      var p = puppets[i];
      for (var k = 0; k < ANCHOR_LIST.length; k++) {
        var at = worldOf(p, ANCHOR_LIST[k]);
        if (!at) continue;
        ctx.strokeStyle = '#00e5ff';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(at[0] - 6, at[1]); ctx.lineTo(at[0] + 6, at[1]);
        ctx.moveTo(at[0], at[1] - 6); ctx.lineTo(at[0], at[1] + 6);
        ctx.stroke();
        ctx.fillStyle = '#00e5ff';
        ctx.fillText(ANCHOR_LIST[k], at[0] + 8, at[1] - 6);
      }
    }
    ctx.restore();
  }

  // ---- UI ----
  function playAll(name) {
    for (var i = 0; i < puppets.length; i++) puppets[i].play(name);
    setStatus('clip: ' + name);
  }
  function setStatus(s) { document.getElementById('status').textContent = s; }

  document.getElementById('btn-idle').onclick = function () { playAll('idle'); };
  document.getElementById('btn-hit').onclick = function () { playAll('hit'); };
  document.getElementById('btn-attack').onclick = function () { playAll('attack'); };
  document.getElementById('btn-cast').onclick = function () { playAll('cast'); };
  document.getElementById('btn-death').onclick = function () { playAll('death'); };
  document.getElementById('btn-revive').onclick = function () {
    for (var i = 0; i < puppets.length; i++) {
      puppets[i].dead = false;
      puppets[i].play('idle', 0.3);
    }
    setStatus('revived -> idle');
  };
  // scripted interruption proof: cast, then hit mid-cast, then back to idle
  document.getElementById('btn-interrupt').onclick = function () {
    playAll('cast');
    setStatus('cast... (hit lands at 700ms)');
    setTimeout(function () {
      playAll('hit');
      setStatus('cast INTERRUPTED by hit -> idle (auto)');
    }, 700);
  };
  document.getElementById('btn-markers').onclick = function (e) {
    showMarkers = !showMarkers;
    e.target.textContent = 'FX markers: ' + (showMarkers ? 'ON' : 'OFF');
  };

  var counts = [1, 10, 30, 100];
  counts.forEach(function (n) {
    document.getElementById('btn-n' + n).onclick = function () {
      bench = null;
      layout(n);
      particles = [];
      setStatus(n + ' puppet(s), idle loop');
      setActiveCount(n);
    };
  });
  function setActiveCount(n) {
    counts.forEach(function (m) {
      document.getElementById('btn-n' + m).classList.toggle('active', m === n);
    });
  }

  // ---- benchmark ----
  function heapMB() {
    if (window.performance && performance.memory && performance.memory.usedJSHeapSize) {
      return (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
    }
    return 'n/a';
  }
  function domCount() { return document.getElementsByTagName('*').length; }

  document.getElementById('btn-bench').onclick = function () {
    document.getElementById('results').innerHTML = '';
    bench = { queue: counts.slice(), phase: 'settle', until: performance.now() + 400, rows: [] };
    nextBenchStep();
  };

  function nextBenchStep() {
    var n = bench.queue[0];
    layout(n);
    particles = [];
    setActiveCount(n);
    bench.phase = 'settle';
    bench.until = performance.now() + 600; // let FPS stabilize
    setStatus('benchmark: ' + n + ' puppets...');
  }

  function benchTick(now) {
    if (!bench) return;
    if (now < bench.until) {
      if (bench.phase === 'measure') {
        bench.acc += window.__avgMs || 0; bench.n++;
        bench.calls = window.__drawCalls || 0;
      }
      return;
    }
    if (bench.phase === 'settle') {
      bench.phase = 'measure';
      bench.until = now + 2000;
      bench.acc = 0; bench.n = 0; bench.calls = 0;
      return;
    }
    if (bench.phase === 'measure') {
      var n = bench.queue.shift();
      bench.rows.push({
        puppets: n,
        fps: Math.round(1000 / (bench.acc / Math.max(bench.n, 1))),
        ms: (bench.acc / Math.max(bench.n, 1)).toFixed(2),
        drawCalls: bench.calls,
        dom: domCount(),
        heap: heapMB()
      });
      renderRows(bench.rows);
      if (bench.queue.length === 0) {
        setStatus('benchmark done: 1/10/30/100 idle puppets');
        console.table(bench.rows);
        bench = null;
      } else {
        nextBenchStep();
      }
    }
  }

  function renderRows(rows) {
    var html = '<tr><th>puppets</th><th>FPS</th><th>ms/frame</th>' +
      '<th>draw calls</th><th>DOM nodes</th><th>JS heap MB</th></tr>';
    rows.forEach(function (r) {
      html += '<tr><td>' + r.puppets + '</td><td>' + r.fps + '</td><td>' + r.ms +
        '</td><td>' + r.drawCalls + '</td><td>' + r.dom + '</td><td>' + r.heap + '</td></tr>';
    });
    document.getElementById('results').innerHTML = html;
  }

  layout(1);
  setActiveCount(1);
  setStatus('idle loop — pick a clip');
  requestAnimationFrame(frame);
})();
