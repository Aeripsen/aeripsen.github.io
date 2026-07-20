/* The reject knob.
 *
 * Every number in here was read out of artifacts/metrics.json in
 * github.com/Aeripsen/flowsentry. Nothing is modelled, fitted or invented.
 *
 * The slider does not sweep a continuous range, because the artifact does not
 * contain one. It steps through the seven thresholds that were actually
 * measured on the held-out test split, and the readout prints those measured
 * values verbatim.
 *
 * The tile grid is a faithful rendering of those same values, not a per-flow
 * score dump: 2,190 tiles, 3 of the 6,570 held-out flows each. At every stop
 * the count of answered tiles and the count of wrong tiles reproduce the
 * measured coverage and reliability to within one tile. That is stated on the
 * page too, because a picture that implies more resolution than the data has
 * is the same sin as rounding a number up.
 *
 * Motion, one primitive only: a wavefront that walks the confidence ranking
 * (rank 1 = the flow the model is most sure about) and can never travel past
 * the covered count of the current threshold. Page load resolves the grid in
 * that order, moving the knob sweeps the boundary between two measured stops,
 * and the ambient pulse retraces the ranking and dies where the answers stop.
 * So the animation is the thesis, not decoration on it.
 *
 * Performance is the same discipline as the imammahdi.ca sky engine: the grid
 * is pre-rendered once per state into an offscreen canvas, an animated frame
 * is one drawImage plus a small overlay window, the loop only runs while
 * something is actually moving, and it pauses when the tab is hidden or the
 * canvas is scrolled away. Under prefers-reduced-motion there is no loop at
 * all: the grid renders once per state as a static composition.
 */

(function () {
  "use strict";

  var CURVE = [
    { t: 0.00, coverage: 1.0000, reliability: 0.8317, n_covered: 6570 },
    { t: 0.50, coverage: 0.8755, reliability: 0.9362, n_covered: 5752 },
    { t: 0.70, coverage: 0.8187, reliability: 0.9745, n_covered: 5379 },
    { t: 0.80, coverage: 0.7918, reliability: 0.9812, n_covered: 5202 },
    { t: 0.90, coverage: 0.7664, reliability: 0.9859, n_covered: 5035 },
    { t: 0.95, coverage: 0.7295, reliability: 0.9900, n_covered: 4793 },
    { t: 0.99, coverage: 0.6476, reliability: 0.9932, n_covered: 4255 }
  ];

  var COLS = 73, ROWS = 30, N = COLS * ROWS;   // 2190 tiles, 3 flows each
  var N_TEST = 6570;

  var canvas = document.getElementById("flowgrid");
  var slider = document.getElementById("knob");
  if (!canvas || !slider) return;

  var ctx = canvas.getContext("2d", { alpha: false });

  /* ---- assign each tile a rank and a correctness flag ---------------- */
  /* Rank 1 is the flow the model is most sure about. A tile is answered at
     stop i when its rank is inside that stop's covered count. Wrong tiles are
     laid into the bands between consecutive stops so that every stop's error
     count comes out right. */

  var coveredAt = CURVE.map(function (p) { return Math.round(p.coverage * N); });
  var wrongAt = CURVE.map(function (p) {
    return Math.round(p.coverage * (1 - p.reliability) * N);
  });

  var isWrong = new Uint8Array(N + 1);   // indexed by rank
  var placed = 0;
  for (var i = CURVE.length - 1; i >= 0; i--) {
    var bandLo = (i === CURVE.length - 1) ? 1 : coveredAt[i + 1] + 1;
    var bandHi = coveredAt[i];
    var need = wrongAt[i] - placed;
    if (need > 0 && bandHi >= bandLo) {
      var span = bandHi - bandLo + 1;
      for (var k = 0; k < need; k++) {
        var r = bandLo + Math.floor((k + 0.5) * span / need);
        if (r > bandHi) r = bandHi;
        while (r >= bandLo && isWrong[r]) r--;      // no double placement
        if (r >= bandLo) { isWrong[r] = 1; placed++; }
      }
    }
  }

  /* ---- scatter the ranks across the grid so it reads as traffic ------ */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20260719);
  var rankOfCell = new Int32Array(N);
  for (var c = 0; c < N; c++) rankOfCell[c] = c + 1;
  for (var j = N - 1; j > 0; j--) {
    var m = Math.floor(rand() * (j + 1));
    var tmp = rankOfCell[j]; rankOfCell[j] = rankOfCell[m]; rankOfCell[m] = tmp;
  }
  var cellOfRank = new Int32Array(N + 1);      // inverse map, for the wavefront
  for (var q = 0; q < N; q++) cellOfRank[rankOfCell[q]] = q;

  /* ---- theme and geometry -------------------------------------------- */

  var col = {};
  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    col.bg = cs.getPropertyValue("--surface").trim();
    col.sig = cs.getPropertyValue("--signal").trim();
    col.bad = cs.getPropertyValue("--warn").trim();
    col.off = cs.getPropertyValue("--abstain").trim();
    col.pulse = cs.getPropertyValue("--text").trim();
  }

  /* Render at the box's real size so the grid is never downscaled. A
     downscaled tile grid moires badly, which reads as a rendering bug rather
     than as data. */
  var cell = 10, gap = 1, w = COLS * cell, h = ROWS * cell, dpr = 1;

  var base = document.createElement("canvas");   // pre-rendered current state
  var bctx = base.getContext("2d", { alpha: false });

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var boxW = canvas.clientWidth || canvas.parentNode.clientWidth || 640;
    cell = boxW / COLS;
    gap = cell > 7 ? 1 : 0.6;
    w = boxW;
    h = ROWS * cell;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + "px";
    base.width = canvas.width;
    base.height = canvas.height;
    readTheme();
  }

  /* ---- drawing -------------------------------------------------------- */

  function tilesInto(c2d, covered) {
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2d.fillStyle = col.bg;
    c2d.fillRect(0, 0, w, h);
    for (var idx = 0; idx < N; idx++) {
      var rank = rankOfCell[idx];
      var x = (idx % COLS) * cell, y = Math.floor(idx / COLS) * cell;
      if (rank > covered) {
        c2d.fillStyle = col.off;
        c2d.globalAlpha = 0.85;
      } else {
        c2d.fillStyle = isWrong[rank] ? col.bad : col.sig;
        c2d.globalAlpha = 1;
      }
      c2d.fillRect(x, y, cell - gap, cell - gap);
    }
    c2d.globalAlpha = 1;
  }

  function renderBase(covered) { tilesInto(bctx, covered); }

  function blit() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
  }

  /* the wavefront: brighten tiles whose rank trails just behind `front` */
  function pulseAt(front, limit, width, amp) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = col.pulse;
    var lo = Math.max(1, Math.ceil(front - width));
    var hi = Math.min(limit, Math.floor(front));
    for (var r = lo; r <= hi; r++) {
      var d = (front - r) / width;          // 0 at the front, 1 at the tail
      var a = amp * (1 - d) * (1 - d);
      if (a < 0.01) continue;
      var idx = cellOfRank[r];
      var x = (idx % COLS) * cell, y = Math.floor(idx / COLS) * cell;
      ctx.globalAlpha = a;
      ctx.fillRect(x, y, cell - gap, cell - gap);
    }
    ctx.globalAlpha = 1;
  }

  /* intro frame: tiles behind the front are resolved, tiles ahead are unresolved */
  function drawIntro(front) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = col.bg;
    ctx.fillRect(0, 0, w, h);
    for (var idx = 0; idx < N; idx++) {
      var rank = rankOfCell[idx];
      var x = (idx % COLS) * cell, y = Math.floor(idx / COLS) * cell;
      if (rank <= front) {
        if (rank > stateCovered) { ctx.fillStyle = col.off; ctx.globalAlpha = 0.85; }
        else { ctx.fillStyle = isWrong[rank] ? col.bad : col.sig; ctx.globalAlpha = 1; }
      } else {
        ctx.fillStyle = col.off;
        ctx.globalAlpha = 0.16;
      }
      ctx.fillRect(x, y, cell - gap, cell - gap);
    }
    ctx.globalAlpha = 1;
    pulseAt(front, N, 200, 0.32);
  }

  /* ---- readout -------------------------------------------------------- */

  function pct(x) { return (x * 100).toFixed(1) + "%"; }

  var outThr = document.getElementById("out-threshold");
  var outCov = document.getElementById("out-coverage");
  var outRel = document.getElementById("out-reliability");
  var outAbs = document.getElementById("out-abstained");

  function setReadout(stop) {
    var p = CURVE[stop];
    if (outThr) outThr.textContent = p.t.toFixed(2);
    if (outCov) outCov.textContent = pct(p.coverage);
    if (outRel) outRel.textContent = pct(p.reliability);
    if (outAbs) outAbs.textContent = (N_TEST - p.n_covered).toLocaleString("en-CA");
    slider.setAttribute("aria-valuetext",
      "Reject threshold " + p.t.toFixed(2) + ". Answers " + pct(p.coverage) +
      " of flows at " + pct(p.reliability) + " reliability.");
  }

  /* ---- animation state machine ---------------------------------------- */

  var reducedMq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(reducedMq && reducedMq.matches); }

  var stateCovered = 0;        // the committed covered count (current stop)
  var displayCovered = 0;      // what is on screen right now (float during shifts)
  var mode = "idle";           // idle | intro | shift | sweep
  var t0 = 0;                  // start timestamp of the running phase
  var shiftFrom = 0, shiftTo = 0;
  var raf = null, ambTimer = null;
  var inView = true, pageVisible = !document.hidden;

  var INTRO_MS = 1500, SHIFT_MS = 420, SWEEP_MS = 2600, REST_MS = 4600;

  function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  function canAnimate() { return !reduced() && inView && pageVisible; }

  function stopLoop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function settle() {
    mode = "idle";
    displayCovered = stateCovered;
    renderBase(stateCovered);
    blit();
    stopLoop();
    scheduleSweep(REST_MS);
  }

  function frame(now) {
    raf = null;
    if (!canAnimate()) { settle(); return; }
    var t = now - t0;

    if (mode === "intro") {
      var p = Math.min(1, t / INTRO_MS);
      drawIntro(easeInOut(p) * N);
      if (p >= 1) { settle(); return; }

    } else if (mode === "shift") {
      var ps = Math.min(1, t / SHIFT_MS);
      displayCovered = shiftFrom + (shiftTo - shiftFrom) * easeInOut(ps);
      tilesInto(ctx, Math.round(displayCovered));
      pulseAt(displayCovered, N, 70, 0.3);
      if (ps >= 1) { settle(); return; }

    } else if (mode === "sweep") {
      var pw = Math.min(1, t / SWEEP_MS);
      blit();
      pulseAt(easeInOut(pw) * stateCovered, stateCovered, 150, 0.2);
      if (pw >= 1) { settle(); return; }
    } else {
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function begin(newMode) {
    mode = newMode;
    clearTimeout(ambTimer);
    stopLoop();
    raf = requestAnimationFrame(function (now) { t0 = now; frame(now); });
  }

  function scheduleSweep(delay) {
    clearTimeout(ambTimer);
    ambTimer = setTimeout(function () {
      if (mode === "idle" && canAnimate()) begin("sweep");
    }, delay);
  }

  /* ---- wiring ---------------------------------------------------------- */

  function onKnob() {
    var stop = parseInt(slider.value, 10);
    setReadout(stop);
    var target = coveredAt[stop];
    if (target === stateCovered && mode !== "intro") return;
    stateCovered = target;
    if (!canAnimate()) {
      displayCovered = target;
      renderBase(target);
      blit();
      return;
    }
    shiftFrom = displayCovered;
    shiftTo = target;
    begin("shift");
  }

  slider.addEventListener("input", onKnob);

  /* Mobile browsers fire resize on scroll when the URL bar collapses, and
     that must not cancel a running animation. Only a real width change
     re-lays the grid. */
  var lastBoxW = 0;
  window.addEventListener("resize", function () {
    var boxW = canvas.clientWidth || 0;
    if (boxW === lastBoxW) return;
    lastBoxW = boxW;
    resize();
    renderBase(stateCovered);
    displayCovered = stateCovered;
    if (mode !== "idle") { mode = "idle"; stopLoop(); }
    blit();
    scheduleSweep(REST_MS);
  });

  function onSchemeOrMotion() {
    readTheme();
    renderBase(stateCovered);
    if (reduced()) { mode = "idle"; stopLoop(); clearTimeout(ambTimer); displayCovered = stateCovered; }
    blit();
    if (!reduced()) scheduleSweep(REST_MS);
  }
  function listenMq(mq) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener("change", onSchemeOrMotion);
    else if (mq.addListener) mq.addListener(onSchemeOrMotion);
  }
  if (window.matchMedia) listenMq(window.matchMedia("(prefers-color-scheme: dark)"));
  listenMq(reducedMq);

  document.addEventListener("visibilitychange", function () {
    pageVisible = !document.hidden;
    if (!pageVisible) { clearTimeout(ambTimer); }
    else if (mode === "idle" && canAnimate()) scheduleSweep(REST_MS);
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (!inView) { clearTimeout(ambTimer); }
      else if (mode === "idle" && canAnimate()) scheduleSweep(REST_MS);
    }).observe(canvas);
  }

  /* ---- boot ------------------------------------------------------------ */

  var stop0 = parseInt(slider.value, 10);
  if (isNaN(stop0) || stop0 < 0 || stop0 >= CURVE.length) stop0 = 0;
  stateCovered = coveredAt[stop0];
  displayCovered = stateCovered;

  resize();
  lastBoxW = canvas.clientWidth || 0;
  setReadout(stop0);
  renderBase(stateCovered);

  if (canAnimate()) {
    begin("intro");
  } else {
    blit();
  }
})();
