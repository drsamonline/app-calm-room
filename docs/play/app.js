/* app — the Calm room page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * Wiring only: the decay curve, the seeded landscape, the palette rules and the garden live in
 * calm-core.js, which the tests exercise directly. This file draws what those return.
 */
(function () {
  "use strict";

  var C = window.CalmCore;
  var $ = function (id) { return document.getElementById(id); };

  var K_STATE = "calm:room";

  var els = {
    status: $("status"),
    fireCanvas: $("fireCanvas"), tendBtn: $("tendBtn"), fireNote: $("fireNote"),
    horizonCanvas: $("horizonCanvas"), seed: $("seed"), palette: $("palette"), regen: $("regen"),
    gardenCanvas: $("gardenCanvas"), stoneMode: $("stoneMode"), clearGarden: $("clearGarden"), gardenNote: $("gardenNote"),
    exportBtn: $("exportBtn"), exportNote: $("exportNote")
  };

  var state = { fire: null, seed: 7, paletteId: C.DEFAULT_PALETTE.id, garden: C.emptyGarden(), unreadable: null };
  var gardenMode = "rake";
  var drawing = null;

  /* ------------------------------------------------------------- helpers */

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function setStatus(kind, msg) {
    els.status.className = "status show " + kind;
    els.status.textContent = msg;
  }
  function clearStatus() { els.status.className = "status"; els.status.textContent = ""; }

  function persist() {
    try {
      window.localStorage.setItem(K_STATE, C.serialize({ savedOn: Date.now(), fire: state.fire, paletteId: state.paletteId, seed: state.seed, garden: state.garden }));
      return true;
    } catch (e) {
      setStatus("bad", "This was not saved (" + (e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable") +
        "). The fire's history will not survive this session, and it is not shown as tended.");
      return false;
    }
  }

  /* --------------------------------------------------------------- ember */

  function drawFire() {
    var cv = els.fireCanvas;
    var ctx = cv.getContext("2d");
    if (!ctx) return;
    var v = C.fireView(state.fire, Date.now());
    var w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);

    /* the hearth */
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0a0d10");
    grad.addColorStop(1, "#141a20");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    var baseY = h * 0.82;
    var height = h * 0.62 * v.size;
    var width = w * 0.16 * (0.55 + v.size * 0.75);

    /* the glow, scaled by the same number */
    var glow = ctx.createRadialGradient(w / 2, baseY - height * 0.4, 4, w / 2, baseY - height * 0.4, width * 2.6);
    glow.addColorStop(0, "rgba(214,124,58," + (0.42 * v.size + 0.06) + ")");
    glow.addColorStop(1, "rgba(214,124,58,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    /* the flame: three tongues, each scaled by size */
    ["#8f3a12", "#c2672a", "#e8a34a"].forEach(function (colour, i) {
      var s = 1 - i * 0.22;
      ctx.beginPath();
      ctx.moveTo(w / 2 - width * s, baseY);
      ctx.quadraticCurveTo(w / 2 - width * s * 0.5, baseY - height * s * 0.6, w / 2, baseY - height * s);
      ctx.quadraticCurveTo(w / 2 + width * s * 0.5, baseY - height * s * 0.6, w / 2 + width * s, baseY);
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.globalAlpha = 0.55 + 0.45 * v.size;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    /* embers: fewer as it burns down */
    var embers = Math.round(18 * v.size);
    ctx.fillStyle = "rgba(232,163,74,0.75)";
    for (var i = 0; i < embers; i++) {
      var a = (i * 37 + v.size * 100) % 360;
      var r = (i * 13) % 60 + 20;
      ctx.fillRect(w / 2 + Math.cos(a) * r, baseY - height * 0.8 + Math.sin(a) * r * 0.4, 2, 2);
    }

    els.fireNote.textContent = v.says + " (size " + Math.round(v.size * 100) + "%" + (v.daysSince >= 1 ? ", " + v.daysSince + " day(s) since you last tended it" : "") + ")";
  }

  function tend() {
    var out = C.tend(state.fire, Date.now(), { interacted: true });
    if (!out.ok) { setStatus("warn", out.reason); return; }
    state.fire = out.fire;
    var saved = persist();
    drawFire();
    setStatus(saved ? "ok" : "bad", saved ? out.says : "Tended on screen, but NOT saved: the fire's history will not survive this session.");
  }

  /* ------------------------------------------------------------- horizon */

  function fillPalettes() {
    els.palette.textContent = "";
    C.PALETTES.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name;
      els.palette.appendChild(o);
    });
    els.palette.value = state.paletteId;
  }

  function drawHorizon() {
    var cv = els.horizonCanvas;
    var ctx = cv.getContext("2d");
    if (!ctx) return;
    var p = C.paletteById(state.paletteId) || C.DEFAULT_PALETTE;
    var scene = C.landscape(state.seed, p);
    var w = cv.width, h = cv.height;

    var sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    sky.addColorStop(0, p.sky);
    sky.addColorStop(1, p.haze);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = p.glow;
    for (var s = 0; s < scene.stars; s++) {
      var sx = ((s * 97) % w);
      var sy = ((s * 53) % Math.round(h * 0.35)) + 8;
      ctx.globalAlpha = 0.35 + ((s % 5) / 10);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    scene.ridges.forEach(function (ridge, i) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      ridge.points.forEach(function (pt) { ctx.lineTo(pt.x * w, pt.y * h); });
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.globalAlpha = ridge.alpha;
      ctx.fillStyle = i === scene.ridges.length - 1 ? p.land : p.haze;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function regenerate() {
    var seed = Number(els.seed.value);
    if (isNaN(seed)) { setStatus("warn", "A seed has to be a number; the previous place is still on screen."); return; }
    state.seed = seed;
    state.paletteId = els.palette.value;
    var saved = persist();
    drawHorizon();if (saved) 
    setStatus("ok", "Seed " + seed + ", palette \u201c" + (C.paletteById(state.paletteId) || C.DEFAULT_PALETTE).name + "\u201d. The same seed will always be this place.");
  }

  /* A palette that does not parse is refused with the value shown, and the previous palette
   * stays on screen rather than the scene going blank. */
  function applyCustomPalette(text) {
    var out = C.parsePalette(text);
    if (!out.ok) {
      setStatus("bad", out.reason);
      drawHorizon();
      return false;
    }
    state.paletteId = out.palette.id;
    persist();
    drawHorizon();
    return true;
  }

  /* -------------------------------------------------------------- garden */

  function drawGarden() {
    var cv = els.gardenCanvas;
    var ctx = cv.getContext("2d");
    if (!ctx) return;
    var w = cv.width, h = cv.height;
    var sand = ctx.createLinearGradient(0, 0, 0, h);
    sand.addColorStop(0, "#2a2721");
    sand.addColorStop(1, "#201d18");
    ctx.fillStyle = sand;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(232,230,225,0.16)";
    ctx.lineWidth = 2;
    state.garden.grooves.forEach(function (stroke) {
      ctx.beginPath();
      stroke.forEach(function (pt, i) { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
      ctx.stroke();
    });

    state.garden.stones.forEach(function (stone) {
      ctx.beginPath();
      ctx.arc(stone.x, stone.y, stone.r, 0, Math.PI * 2);
      ctx.fillStyle = "#3b3a36";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.stroke();
    });
  }

  function canvasPoint(cv, ev) {
    var rect = cv.getBoundingClientRect();
    var x = (ev.clientX - rect.left) * (cv.width / rect.width);
    var y = (ev.clientY - rect.top) * (cv.height / rect.height);
    return { x: Math.round(x), y: Math.round(y) };
  }

  /* ------------------------------------------------------------- export */

  function writer(name, text, mime) {
    if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
    window.Export.save(name, text, mime);
    return true;
  }

  function doExport() {
    var out = C.exportFile("room", { state: { fire: state.fire, paletteId: state.paletteId, seed: state.seed, garden: state.garden } }, { when: today() }, writer);
    if (out.ok) {
      els.exportNote.textContent = "Wrote " + out.filename + ".";
      setStatus("ok", "Exported.");
    } else {
      setStatus("bad", out.reason + ".");
    }
  }

  /* ---------------------------------------------------------------- tabs */

  ["ember", "horizon", "garden"].forEach(function (name) {
    $("tab-" + name).addEventListener("click", function () {
      ["ember", "horizon", "garden"].forEach(function (other) {
        var on = other === name;
        $("tab-" + other).setAttribute("aria-selected", on ? "true" : "false");
        $("panel-" + other).hidden = !on;
      });
      if (name === "ember") drawFire();
      if (name === "horizon") drawHorizon();
      if (name === "garden") drawGarden();
    });
  });

  /* ---------------------------------------------------------------- wire */

  els.tendBtn.addEventListener("click", tend);
  els.regen.addEventListener("click", regenerate);
  els.exportBtn.addEventListener("click", doExport);

  els.stoneMode.addEventListener("click", function () {
    gardenMode = gardenMode === "rake" ? "stone" : "rake";
    els.stoneMode.textContent = gardenMode === "rake" ? "Place stones instead of raking" : "Rake instead of placing stones";
    els.gardenNote.textContent = gardenMode === "rake" ? "Drag to rake. Nothing is counted." : "Tap to place a stone. Nothing is counted.";
  });

  els.clearGarden.addEventListener("click", function () {
    state.garden = C.emptyGarden();
    var saved = persist();
    drawGarden();if (saved) 
    setStatus("ok", "The sand is smooth again.");
  });

  els.gardenCanvas.addEventListener("pointerdown", function (ev) {
    var pt = canvasPoint(els.gardenCanvas, ev);
    if (gardenMode === "stone") {
      var out = C.placeStone(state.garden, pt);
      if (!out.ok) { setStatus("warn", out.reason); return; }
      state.garden = out.garden;
      persist();
      drawGarden();
      return;
    }
    drawing = [pt];
    els.gardenCanvas.setPointerCapture(ev.pointerId);
  });
  els.gardenCanvas.addEventListener("pointermove", function (ev) {
    if (!drawing) return;
    drawing.push(canvasPoint(els.gardenCanvas, ev));
  });
  els.gardenCanvas.addEventListener("pointerup", function () {
    if (!drawing) return;
    var out = C.rake(state.garden, { points: drawing });
    drawing = null;
    if (!out.ok) { setStatus("warn", out.reason); return; }
    state.garden = out.garden;
    persist();
    drawGarden();
  });

  /* ------------------------------------------------------------ start up */

  fillPalettes();

  var raw = null;
  try { raw = window.localStorage.getItem(K_STATE); } catch (e) { raw = null; }
  if (raw) {
    var parsed = C.parseState(raw);
    if (parsed.ok) {
      state.fire = parsed.state.fire;
      state.seed = parsed.state.seed;
      state.paletteId = parsed.state.paletteId;
      state.garden = parsed.state.garden;
      els.seed.value = state.seed;
      els.palette.value = state.paletteId;
    } else {
      /* Reported, offered for export, and NOT relit at full strength. */
      state.unreadable = parsed;
      state.fire = null;
      setStatus("bad", parsed.reason);
      var keep = document.createElement("button");
      keep.className = "small";
      keep.textContent = "Export the unreadable room";
      keep.addEventListener("click", function () {
        var out = C.exportFile("raw", parsed, { when: today() }, writer);
        setStatus(out.ok ? "ok" : "bad", out.ok ? "Wrote " + out.filename + "." : out.reason);
      });
      els.exportNote.parentNode.insertBefore(keep, els.exportNote);
    }
  }

  if (!state.fire) state.fire = C.newFire(Date.now());

  drawFire();
  drawHorizon();
  drawGarden();
  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
