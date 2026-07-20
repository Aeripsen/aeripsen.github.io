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

  /* ---- draw ---------------------------------------------------------- */

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* Render at the box's real size so the grid is never downscaled. A
     downscaled tile grid moires badly, which reads as a rendering bug rather
     than as data. */
  var cell = 10, gap = 1, w = COLS * cell, h = ROWS * cell;
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var boxW = canvas.clientWidth || canvas.parentNode.clientWidth || 640;
    cell = boxW / COLS;
    gap = cell > 7 ? 1 : 0.6;
    w = boxW;
    h = ROWS * cell;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(stop) {
    var covered = coveredAt[stop];
    var bg = css("--surface"), sig = css("--signal"),
        bad = css("--warn"), off = css("--abstain");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    for (var idx = 0; idx < N; idx++) {
      var rank = rankOfCell[idx];
      var x = (idx % COLS) * cell, y = Math.floor(idx / COLS) * cell;
      if (rank > covered) {
        ctx.fillStyle = off;
        ctx.globalAlpha = 0.85;
      } else {
        ctx.fillStyle = isWrong[rank] ? bad : sig;
        ctx.globalAlpha = 1;
      }
      ctx.fillRect(x, y, cell - gap, cell - gap);
    }
    ctx.globalAlpha = 1;
  }

  /* ---- readout ------------------------------------------------------- */

  function pct(x) { return (x * 100).toFixed(1) + "%"; }

  var outThr = document.getElementById("out-threshold");
  var outCov = document.getElementById("out-coverage");
  var outRel = document.getElementById("out-reliability");
  var outN = document.getElementById("out-n");
  var outAbs = document.getElementById("out-abstained");

  function update() {
    var stop = parseInt(slider.value, 10);
    var p = CURVE[stop];
    if (outThr) outThr.textContent = p.t.toFixed(2);
    if (outCov) outCov.textContent = pct(p.coverage);
    if (outRel) outRel.textContent = pct(p.reliability);
    if (outN) outN.textContent = p.n_covered.toLocaleString("en-CA");
    if (outAbs) outAbs.textContent = (N_TEST - p.n_covered).toLocaleString("en-CA");
    slider.setAttribute("aria-valuetext",
      "Reject threshold " + p.t.toFixed(2) + ". Answers " + pct(p.coverage) +
      " of flows at " + pct(p.reliability) + " reliability.");
    draw(stop);
  }

  slider.addEventListener("input", update);
  window.addEventListener("resize", function () { resize(); update(); });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onScheme = function () { update(); };
    if (mq.addEventListener) mq.addEventListener("change", onScheme);
    else if (mq.addListener) mq.addListener(onScheme);
  }

  resize();
  update();
})();
