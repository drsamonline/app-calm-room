#!/usr/bin/env node
/* self-tests — Calm room. No framework, no dependencies.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The Ember spec's "done means" is countable, so it is counted:
 *
 *   "A fire left untended for a simulated 7 days is smaller than one tended daily — the rendered
 *    size at day 7 is a lower value than at day 0, and the decline is monotonic across those 7
 *    days, never rising on its own. Tending on day 7 restores it to at least its day-0 size.
 *    Leaving for 1 day drops it less than leaving for 7, and a long absence shows a smaller fire
 *    with no lock, penalty or lost state beyond its size."
 *
 * Horizon and Zen Garden's rules are here too: a palette that does not parse is refused with the
 * value shown, a corrupt palette falls back to a NAMED default, and nothing has a goal, a score or
 * an ending.
 *
 *   node tests/self-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var C = require(path.join(ROOT, "docs", "play", "calm-core.js"));

var passed = 0;
var failed = [];
var group = "";
function section(n) { group = n; }
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(group + " :: " + name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

var DAY = C.DAY;
var T0 = Date.UTC(2026, 10, 25);

/* ================================================ the spec's own "done means" */

section("done means — seven days untended is smaller, and never rises");
var week = [];
for (var d = 0; d <= 7; d++) week.push(C.emberSize(d));
ok("day 7 is smaller than day 0", week[7] < week[0], week[0] + " -> " + week[7]);
ok("the decline is monotonic across the seven days",
  week.every(function (v, i) { return i === 0 || v <= week[i - 1]; }), week.join(" "));
ok("it never rises on its own", week.every(function (v, i) { return i === 0 || v <= week[i - 1] + 1e-9; }));
ok("one day drops it less than seven",
  (week[0] - week[1]) < (week[0] - week[7]), (week[0] - week[1]).toFixed(3) + " vs " + (week[0] - week[7]).toFixed(3));
ok("the size is a function of time alone",
  C.emberSize(3) === C.emberSize(3) && C.emberSize(3) === C.fireView(C.newFire(T0), T0 + 3 * DAY).size);

section("done means — tending on day 7 restores it to at least day 0");
var fire = C.newFire(T0);
var tended = C.tend(fire, T0 + 7 * DAY, { interacted: true });
eq("the tend is accepted", tended.ok, true);
ok("it comes back to at least its day-0 size", tended.size >= week[0], tended.size + " vs " + week[0]);
eq("and the view agrees at day 0", C.fireView(tended.fire, T0 + 7 * DAY).size, tended.size);

section("done means — a long absence is smaller, with no lock, penalty or lost state");
var longAway = C.fireView(fire, T0 + 400 * DAY);
ok("the fire is smaller after a long absence", longAway.size < week[0], longAway.size);
eq("there is no lock", longAway.lock, false);
eq("there is no penalty", longAway.penalty, false);
eq("nothing is lost", longAway.lostAnything, false);
ok("the app says nothing was lost", /nothing was lost|Nothing was lost|that is all/i.test(longAway.says), longAway.says);
ok("the fire never reaches zero", C.emberSize(3650) > 0, C.emberSize(3650));
ok("no streak, no score and no grade exists anywhere",
  /* "points" is a rake stroke's geometry here, so the check names the scoring words only */
  !/\b(streak|score|highScore|badge|rank|leaderboard|grade)\s*[:=]/i.test(read("docs/play/calm-core.js")) &&
  /* the page's prose promises there is no score; what must not exist is scoring MARKUP */
  !/(id|class)="[^"]*(score|streak|badge|rank|leaderboard)[^"]*"/i.test(read("docs/play/index.html")));

/* ============================================================ must-nots */

section("must-not — a tend with no interaction is not counted");
var noTouch = C.tend(fire, T0, {});
eq("the tend is refused", noTouch.ok, false);
ok("and the app says the fire was not tended", /the fire was not tended/.test(noTouch.reason), noTouch.reason);
eq("a refused tend returns no fire to save", noTouch.fire, undefined);
eq("an interaction is what counts", C.tend(fire, T0, { interacted: true }).ok, true);

section("must-not — an unreadable room is not relit at full strength");
var bad = C.parseState("{ broken room");
eq("a corrupt file is reported", bad.ok, false);
ok("it was not relit at full strength", /not relit at full strength/.test(bad.reason), bad.reason);
ok("it tells the person the fire is unknown until tended", /unknown until you tend it again/.test(bad.reason), bad.reason);
eq("the raw text is kept for export", bad.raw, "{ broken room");
eq("a file with no fire is refused", C.parseState('{"a":1}').ok, false);
eq("no room saved yet is distinguished from a broken one", C.parseState("").empty, true);

section("must-not — a palette that does not parse is refused with the value shown");
var badPal = C.parsePalette("{not json");
eq("it is refused", badPal.ok, false);
eq("the value is shown back", badPal.shown, "{not json");
ok("the reason quotes the value", /not json/.test(badPal.reason), badPal.reason);
ok("and says the previous palette is still on screen", /previous one is still on screen/.test(badPal.reason), badPal.reason);
var badHex = C.parsePalette(JSON.stringify({ sky: "red", haze: "#000000", land: "#000000", glow: "#000000" }));
eq("a non-hex colour is refused", badHex.ok, false);
ok("and names the colour that failed", /sky/.test(badHex.reason), badHex.reason);
eq("an empty palette is refused", C.parsePalette("").ok, false);
eq("a good palette is accepted", C.parsePalette(JSON.stringify({ sky: "#111111", haze: "#222222", land: "#333333", glow: "#444444" })).ok, true);

section("must-not — a corrupt palette falls back to a NAMED default");
ok("the default has a name", C.DEFAULT_PALETTE.name === "Ash and ember", C.DEFAULT_PALETTE.name);
var noPalette = C.parseState(JSON.stringify({ fire: { lastTended: T0, tendedTimes: 1 } }));
eq("a saved room with no palette parses", noPalette.ok, true);
eq("and falls back to the named default", noPalette.state.paletteId, C.DEFAULT_PALETTE.id);
ok("which is findable by id", !!C.paletteById(noPalette.state.paletteId));

section("must-not — the landscape has no goal, score or ending");
var l1 = C.landscape(7);
var l2 = C.landscape(7);
eq("the same seed is the same place", JSON.stringify(l1), JSON.stringify(l2));
ok("a different seed is a different place", JSON.stringify(C.landscape(8)) !== JSON.stringify(l1));
ok("there is no score, goal or ending in the scene", !/\b(score|goal|win|lose|end|finish|complete)\s*[:=]/i.test(JSON.stringify(l1)));
ok("the scene has ridges and stars, nothing to achieve", l1.ridges.length > 0 && l1.stars > 0);

section("must-not — the garden counts nothing");
var g = C.emptyGarden();
eq("an empty garden is empty", g.grooves.length + g.stones.length, 0);
var raked = C.rake(g, { points: [{ x: 1, y: 1 }, { x: 5, y: 6 }] });
eq("a rake stroke is kept", raked.ok, true);
eq("with no score attached", Object.keys(raked).sort().join(","), "garden,ok,says");
eq("a one-point stroke is refused", C.rake(g, { points: [{ x: 1, y: 1 }] }).ok, false);
eq("a stone is placed", C.placeStone(g, { x: 4, y: 4 }).ok, true);
eq("a stone with no place is refused", C.placeStone(g, {}).ok, false);

section("must-not — it must not grow a second job");
var core = read("docs/play/calm-core.js");
ok("no second store, no tags, no sync", !/\b(tags|labels|folders)\s*[:=]/i.test(core) && !/\bsync\s*[:(]/i.test(core));
ok("no model, key or endpoint", !/\b(apiKey|endpoint|openai|gpt)\s*[:=]/i.test(core) && !/https?:\/\//.test(core));
ok("no network call", !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(core + read("docs/play/app.js")));
ok("the page forbids connections", /connect-src 'none'/.test(read("docs/play/index.html")));

section("failure case — storage full or unavailable");
var thrown = C.exportFile("room", { state: { fire: fire } }, { when: "25/11/2026" }, function () {
  var e = new Error("quota"); e.name = "QuotaExceededError"; throw e;
});
eq("a failed write is reported as failed", thrown.ok, false);
ok("a failed write says the file was not written", /not written/.test(thrown.reason), thrown.reason);
ok("a failed write names the cause", /storage is full/.test(thrown.reason));
eq("no writer means no file", C.exportFile("room", { state: { fire: fire } }, {}, null).ok, false);
ok("the page says the history will not survive and is not shown as tended",
  /history will not survive/.test(read("docs/play/app.js")) && /not shown as tended/.test(read("docs/play/app.js")));

section("shape — every script the page loads exists beside it");
var page = read("docs/play/index.html");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (s) {
  ok("script src resolves: " + s, fs.existsSync(path.join(ROOT, "docs", "play", s.replace(/^\.\//, ""))));
});
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
if (failed.length) {
  console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
  failed.slice(0, 12).forEach(function (f) { console.error("  FAIL " + f); });
  process.exit(1);
}
console.log("self-tests: " + passed + "/" + total + " assertions passed");
