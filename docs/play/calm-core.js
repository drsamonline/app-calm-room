/* calm-core — the engine behind Calm Room.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * ONE JOB: a place you return to that asks nothing of you. Three specs, one rule — nothing
 * here scores you, grades you or ends.
 *
 *   ember      a fire that burns down on its own. Its size is a pure function of the days
 *              since you last tended it: monotonic, never rising by itself, never locked,
 *              never punished. Coming back is the only thing that makes it bigger.
 *   horizon    a landscape generated from a seed, so the same seed is the same place. No
 *              goal, no score, no ending — it is a view.
 *   garden     sand you can rake and stones you can place. It settles. Nothing is counted.
 *
 * Pure functions: no DOM, no network, no storage. The page draws what these return.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CalmCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var DAY = 86400000;

  /* --------------------------------------------------------------- ember */

  var EMBER = {
    floor: 0.14,        /* a fire never goes fully out: a cold hearth is not a punishment */
    tau: 2.6,           /* days for the fire to lose about a third of its height */
    lowBelow: 0.34,
    outBelow: 0.2
  };

  /* Size is a function of TIME ALONE. It cannot rise on its own, because nothing but a tend
   * changes lastTended. */
  function emberSize(daysSince) {
    var d = Math.max(0, Number(daysSince) || 0);
    var size = EMBER.floor + (1 - EMBER.floor) * Math.exp(-d / EMBER.tau);
    return Math.round(size * 1000) / 1000;
  }

  function newFire(now) {
    return { lastTended: now || 0, tendedTimes: 0, createdAt: now || 0, lit: true };
  }

  /* A tend with no interaction is NOT counted, and the app says so rather than crediting a
   * tap that did not happen. */
  function tend(fire, now, opts) {
    if (!opts || opts.interacted !== true) {
      return { ok: false, reason: "the fire was not tended: there was no interaction to count" };
    }
    var next = {
      lastTended: now || 0,
      tendedTimes: ((fire && fire.tendedTimes) || 0) + 1,
      createdAt: (fire && fire.createdAt) || now || 0,
      lit: true
    };
    return { ok: true, fire: next, size: emberSize(0), says: "The fire is full again. That is all a tend does." };
  }

  /* What the room shows. There is no lock, no penalty and no lost state — only size. */
  function fireView(fire, now) {
    var f = fire || newFire(now);
    var days = Math.max(0, ((now || 0) - (f.lastTended || 0)) / DAY);
    var size = emberSize(days);
    return {
      size: size,
      daysSince: Math.round(days * 100) / 100,
      state: size < EMBER.outBelow ? "out" : size < EMBER.lowBelow ? "low" : "burning",
      tendedTimes: f.tendedTimes || 0,
      lock: false,
      penalty: false,
      lostAnything: false,
      says: size >= 0.99
        ? "Full. Nothing is being asked of you."
        : size < EMBER.outBelow
          ? "Small and cold, and still here. Tending brings it back to full — nothing was lost."
          : "Smaller than when you left it. That is all that happened."
    };
  }

  /* ------------------------------------------------------------- horizon */

  var DEFAULT_PALETTE = { id: "ash-and-ember", name: "Ash and ember", sky: "#1b2027", haze: "#3a3f47", land: "#12161b", glow: "#b4562a" };

  var PALETTES = [
    DEFAULT_PALETTE,
    { id: "monsoon", name: "Monsoon", sky: "#20272b", haze: "#465256", land: "#131a1c", glow: "#7d8f7a" },
    { id: "salt-flat", name: "Salt flat", sky: "#2a2a2c", haze: "#6f6a63", land: "#1a1a1c", glow: "#c9b48a" },
    { id: "night-hills", name: "Night hills", sky: "#141a24", haze: "#2f3a4c", land: "#0e1219", glow: "#6f86a8" }
  ];

  function paletteById(id) {
    for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i].id === id) return PALETTES[i];
    return null;
  }

  /* A palette value that does not parse is REFUSED with the value shown, and the caller
   * keeps the previous palette on screen rather than going blank. */
  function parsePalette(text) {
    var raw = String(text == null ? "" : text).trim();
    if (!raw) return { ok: false, field: "palette", shown: raw, reason: "an empty palette was refused" };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) {
      return { ok: false, field: "palette", shown: raw, reason: "this palette does not parse, and the previous one is still on screen: \u201c" + raw.slice(0, 80) + "\u201d" };
    }
    var hex = /^#[0-9a-f]{6}$/i;
    var keys = ["sky", "haze", "land", "glow"];
    for (var i = 0; i < keys.length; i++) {
      if (!data || typeof data[keys[i]] !== "string" || !hex.test(data[keys[i]])) {
        return { ok: false, field: "palette", shown: raw, reason: "the \u201c" + keys[i] + "\u201d colour is not a six-digit hex value, so the palette was refused: \u201c" + raw.slice(0, 80) + "\u201d" };
      }
    }
    return { ok: true, palette: { id: String(data.id || "custom"), name: String(data.name || "Custom"), sky: data.sky, haze: data.haze, land: data.land, glow: data.glow } };
  }

  /* Deterministic from the seed: the same seed is the same place, which is what makes it a
   * view you can return to rather than a screensaver. */
  function seededRandom(seed) {
    var s = (Number(seed) || 0) >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function landscape(seed, palette) {
    var p = palette || DEFAULT_PALETTE;
    var rnd = seededRandom(seed);
    var ridges = [];
    for (var r = 0; r < 4; r++) {
      var points = [];
      var amp = 0.16 - r * 0.03;
      var base = 0.42 + r * 0.12;
      var phase = rnd() * Math.PI * 2;
      for (var x = 0; x <= 40; x++) {
        var t = x / 40;
        var y = base + Math.sin(t * Math.PI * (1.4 + r * 0.7) + phase) * amp + (rnd() - 0.5) * 0.012;
        points.push({ x: Math.round(t * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
      }
      ridges.push({ layer: r, points: points, alpha: 1 - r * 0.18 });
    }
    return { seed: Number(seed) || 0, palette: p, ridges: ridges, stars: Math.round(rnd() * 18) + 6 };
  }

  /* -------------------------------------------------------------- garden */

  /* A rake stroke leaves a groove. Nothing is scored, counted or compared. */
  function rake(garden, stroke) {
    var g = {
      grooves: ((garden && garden.grooves) || []).slice(),
      stones: ((garden && garden.stones) || []).slice()
    };
    var pts = (stroke && stroke.points) || [];
    if (pts.length < 2) return { ok: false, reason: "a rake stroke needs at least two points; nothing was drawn" };
    g.grooves.push(pts.map(function (p) { return { x: Math.round(p.x), y: Math.round(p.y) }; }));
    return { ok: true, garden: g, says: "Raked. It will settle." };
  }

  function placeStone(garden, at) {
    var g = {
      grooves: ((garden && garden.grooves) || []).slice(),
      stones: ((garden && garden.stones) || []).slice()
    };
    if (!at || typeof at.x !== "number" || typeof at.y !== "number") {
      return { ok: false, reason: "a stone needs a place to sit; nothing was placed" };
    }
    g.stones.push({ x: Math.round(at.x), y: Math.round(at.y), r: at.r || 18 });
    return { ok: true, garden: g, says: "Placed." };
  }

  function emptyGarden() { return { grooves: [], stones: [] }; }

  /* --------------------------------------------------------------- storage */

  function serialize(state) {
    return JSON.stringify({
      version: VERSION,
      savedOn: (state && state.savedOn) || 0,
      fire: (state && state.fire) || null,
      paletteId: (state && state.paletteId) || DEFAULT_PALETTE.id,
      seed: (state && state.seed) || 1,
      garden: (state && state.garden) || emptyGarden()
    }, null, 2);
  }

  /* An unreadable fire is REPORTED and offered for export. The app does not quietly relight it
   * at full strength — that would erase the only consequence the app exists to create. */
  function parseState(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, empty: true, reason: "no fire has been lit on this device yet", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) {
      return { ok: false, reason: "The saved room cannot be read. It was not relit at full strength: the fire is unknown until you tend it again. Export it to keep it.", raw: raw };
    }
    if (!data || typeof data !== "object" || !data.fire) {
      return { ok: false, reason: "The saved file holds no fire. It was not relit at full strength; export it to keep it.", raw: raw };
    }
    var p = paletteById(data.paletteId) || DEFAULT_PALETTE;
    return {
      ok: true,
      state: {
        version: data.version || VERSION,
        savedOn: Number(data.savedOn) || 0,
        fire: {
          lastTended: Number(data.fire.lastTended) || 0,
          tendedTimes: Number(data.fire.tendedTimes) || 0,
          createdAt: Number(data.fire.createdAt) || 0,
          lit: true
        },
        paletteId: p.id,
        seed: Number(data.seed) || 1,
        garden: {
          grooves: Array.isArray(data.garden && data.garden.grooves) ? data.garden.grooves : [],
          stones: Array.isArray(data.garden && data.garden.stones) ? data.garden.stones : []
        }
      },
      raw: raw
    };
  }

  function stamp(when) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || ""));
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated";
  }

  function exportFile(what, payload, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body, mime = "application/json";
    if (what === "room") { name = "calm-room-" + stamp(meta.when) + ".json"; body = serialize(payload.state); }
    else if (what === "raw") { name = "calm-room-unreadable-" + stamp(meta.when) + ".txt"; body = String(payload.raw || ""); mime = "text/plain;charset=utf-8"; }
    else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, mime);
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return {
    version: VERSION,
    DAY: DAY,
    EMBER: EMBER,
    DEFAULT_PALETTE: DEFAULT_PALETTE,
    PALETTES: PALETTES,
    paletteById: paletteById,
    emberSize: emberSize,
    newFire: newFire,
    tend: tend,
    fireView: fireView,
    parsePalette: parsePalette,
    landscape: landscape,
    rake: rake,
    placeStone: placeStone,
    emptyGarden: emptyGarden,
    serialize: serialize,
    parseState: parseState,
    exportFile: exportFile
  };
});
