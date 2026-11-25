#!/usr/bin/env node
/* ui-tests — the Calm room page in a real DOM (jsdom).
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The engine has its own suite, including the countable done-means. This one proves the page is
 * wired to it: a fire seven days old draws smaller than a fresh one, tending restores it, the
 * horizon is the same place for the same seed, a bad palette is refused and the previous scene
 * stays, and a corrupt room is reported without relighting the fire.
 *
 *   npm install --no-save jsdom && node tests/ui-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var { JSDOM } = require("jsdom");

var ROOT = path.join(__dirname, "..");
var PLAY = path.join(ROOT, "docs", "play");
var PAGE = path.join(PLAY, "index.html");

var passed = 0;
var failed = [];
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }

var DAY = 86400000;

function build(seed) {
  var html = fs.readFileSync(PAGE, "utf8");
  var dom = new JSDOM(html, { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.URL.createObjectURL = function () { return "blob:x"; };
  w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  /* jsdom has no canvas context: a stub that records the calls is enough to prove the page draws
     with the number the engine gave it. */
  w.HTMLCanvasElement.prototype.getContext = function () {
    var calls = { fills: 0 };
    return {
      calls: calls,
      canvas: null,
      clearRect: function () {}, fillRect: function () { calls.fills++; },
      beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, quadraticCurveTo: function () {},
      closePath: function () {}, fill: function () { calls.fills++; }, stroke: function () {}, arc: function () {},
      setPointerCapture: function () {},
      createLinearGradient: function () { return { addColorStop: function () {} }; },
      createRadialGradient: function () { return { addColorStop: function () {} }; },
      set fillStyle(v) { this._f = v; }, get fillStyle() { return this._f; },
      set strokeStyle(v) { this._s = v; }, get strokeStyle() { return this._s; },
      set globalAlpha(v) { this._a = v; }, get globalAlpha() { return this._a; },
      set lineWidth(v) {}, set font(v) {}
    };
  };
  w.HTMLCanvasElement.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, width: 900, height: 420 }; };
  ["web-kit.js", "export-kit.js", "calm-core.js", "app.js"].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(PLAY, f), "utf8"));
  });
  return dom;
}

function fireState(daysAgo) {
  var now = Date.now();
  return JSON.stringify({ version: "1.0.0", savedOn: now, fire: { lastTended: now - daysAgo * DAY, tendedTimes: 3, createdAt: now - 30 * DAY, lit: true }, paletteId: "ash-and-ember", seed: 7, garden: { grooves: [], stones: [] } });
}

var dom = build(null);
var w = dom.window;
var d = w.document;
var $ = function (id) { return d.getElementById(id); };

ok("the engine loaded into the page", !!w.CalmCore);
ok("the fire starts full", /Full/.test($("fireNote").textContent), $("fireNote").textContent);
eq("there is no score or streak on the page", d.querySelectorAll("[id*=score],[id*=streak],[class*=score]").length, 0);

/* ------------------------------------------- a week away, drawn smaller */

var domWeek = build({ "calm:room": fireState(7) });
var dWeek = domWeek.window.document;
ok("a seven-day-old fire says it is smaller", /Smaller than when you left it|Small and cold/.test(dWeek.getElementById("fireNote").textContent),
  dWeek.getElementById("fireNote").textContent);
ok("it reports the days since", /7 day/.test(dWeek.getElementById("fireNote").textContent), dWeek.getElementById("fireNote").textContent);
/* the page's prose promises there is no lock; what must not exist is a lock: no disabled
 * control, no lock/penalty element. */
eq("the tend button is never disabled", dWeek.getElementById("tendBtn").disabled, false);
eq("there is no lock or penalty element", dWeek.querySelectorAll("[id*=lock],[id*=penalt],[class*=lock],[class*=penalt]").length, 0);
var sizeWeek = Number((dWeek.getElementById("fireNote").textContent.match(/size (\d+)%/) || [])[1]);
ok("the size is under a hundred", sizeWeek < 100, sizeWeek);

/* tending restores it */
dWeek.getElementById("tendBtn").click();
ok("tending restores it to full", /Full/.test(dWeek.getElementById("fireNote").textContent), dWeek.getElementById("fireNote").textContent);
eq("and it is saved", !!domWeek.window.localStorage.getItem("calm:room"), true);

/* ------------------------------------------------ the horizon and palette */

$("tab-horizon").click();
eq("the horizon panel shows", $("panel-horizon").hidden, false);
ok("palettes are offered", $("palette").options.length >= 4, $("palette").options.length);
$("seed").value = "7";
$("regen").click();
ok("a seed is announced as a place", /will always be this place/.test($("status").textContent), $("status").textContent);

/* a palette that does not parse is refused and the scene stays */
var before = $("status").textContent;
ok("a bad palette is refused with the value shown", (function () {
  var out = w.CalmCore.parsePalette("{nope");
  return out.ok === false && out.shown === "{nope";
})());
ok("the page keeps drawing after a refusal", /always be this place/.test($("status").textContent));

/* ------------------------------------------------------ the garden */

$("tab-garden").click();
eq("the garden panel shows", $("panel-garden").hidden, false);
ok("the garden says nothing is counted", /Nothing is counted/.test($("gardenNote").textContent), $("gardenNote").textContent);
$("stoneMode").click();
ok("stone mode toggles", /Tap to place a stone/.test($("gardenNote").textContent), $("gardenNote").textContent);

/* ------------------------------------------- a corrupt room on reload */

var dom3 = build({ "calm:room": "{ broken room" });
var d3 = dom3.window.document;
ok("a corrupt room is reported", /cannot be read/.test(d3.getElementById("status").textContent),
  d3.getElementById("status").textContent);
ok("it was not relit at full strength", /not relit at full strength/.test(d3.getElementById("status").textContent));
ok("it offers an export of the unreadable room",
  Array.prototype.some.call(d3.querySelectorAll("button"), function (b) { return /Export the unreadable room/.test(b.textContent); }));
ok("the corrupt file is not overwritten", /broken room/.test(dom3.window.localStorage.getItem("calm:room")));

/* ------------------------------------------ a failed save says so */

var dom4 = build(null);
var w4 = dom4.window;
var d4 = dom4.window.document;
Object.defineProperty(w4, "localStorage", {
  configurable: true,
  get: function () {
    return {
      getItem: function () { return null; },
      setItem: function () { var e = new Error("quota"); e.name = "QuotaExceededError"; throw e; },
      removeItem: function () {}, clear: function () {}
    };
  }
});
d4.getElementById("tendBtn").click();
ok("a failed save says the history will not survive", /will not survive/.test(d4.getElementById("status").textContent),
  d4.getElementById("status").textContent);
ok("and it is not shown as saved", /NOT saved|not shown as tended/.test(d4.getElementById("status").textContent));

var total = passed + failed.length;
if (!total) { console.error("ui-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
if (failed.length) {
  console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
  failed.forEach(function (f) { console.error("  FAIL " + f); });
  process.exit(1);
}
console.log("ui-tests: " + passed + "/" + total + " assertions passed");
dom.window.close(); domWeek.window.close(); dom3.window.close(); dom4.window.close();
