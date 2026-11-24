// Tests for palettemint. Run with: node --test tests/
// (or `npm test`). No dependencies — just node's built-in test runner.

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const pm = require("../palettemint.js");
const { parse, Color, ColorError } = pm;

// --- parsing ---------------------------------------------------------------

test("parse: 6-digit hex", () => {
  const c = parse("#ff5733");
  assert.equal(c.r, 255);
  assert.equal(c.g, 87);
  assert.equal(c.b, 51);
  assert.equal(c.a, 1);
});

test("parse: 3-digit hex expands", () => {
  assert.deepEqual(parse("#f53").toObject(), { r: 255, g: 85, b: 51, a: 1 });
});

test("parse: 8-digit hex carries alpha", () => {
  const c = parse("#ff573380");
  assert.equal(c.a.toFixed(2), "0.50");
});

test("parse: rgb() and rgba() with spaces and commas", () => {
  assert.deepEqual(parse("rgb(255, 87, 51)").toObject(), { r: 255, g: 87, b: 51, a: 1 });
  assert.equal(parse("rgba(255, 87, 51, 0.5)").a, 0.5);
  // modern space-separated syntax
  assert.deepEqual(parse("rgb(255 87 51)").toObject(), { r: 255, g: 87, b: 51, a: 1 });
});

test("parse: rgb() percentages", () => {
  assert.deepEqual(parse("rgb(100%, 0%, 0%)").toObject(), { r: 255, g: 0, b: 0, a: 1 });
});

test("parse: hsl() and hsla()", () => {
  assert.equal(parse("hsl(0, 100%, 50%)").toHex(), "#ff0000");
  assert.equal(parse("hsl(120, 100%, 50%)").toHex(), "#00ff00");
  assert.equal(parse("hsl(240, 100%, 50%)").toHex(), "#0000ff");
  assert.equal(parse("hsla(0, 100%, 50%, 0.25)").a, 0.25);
});

test("parse: hue wraps past 360", () => {
  assert.equal(parse("hsl(420, 100%, 50%)").toHex(), "#ffff00");
});

test("parse: named colors, case-insensitive", () => {
  assert.equal(parse("tomato").toHex(), "#ff6347");
  assert.equal(parse("RebeccaPurple").toHex(), "#663399");
  assert.equal(parse("WHITE").toHex(), "#ffffff");
});

test("parse: plain {r,g,b} object and Color instance", () => {
  assert.equal(parse({ r: 10, g: 20, b: 30 }).toHex(), "#0a141e");
  const c = parse("#123456");
  assert.ok(parse(c).equals(c));
  assert.notEqual(parse(c), c); // a fresh copy, not the same object
});

test("parse: rejects garbage with a human message, not a crash", () => {
  for (const bad of ["", "notacolor", "#12", "#gggggg", "rgb(1,2)", "hsl(1,2)", 42, null, undefined]) {
    assert.throws(() => parse(bad), ColorError, JSON.stringify(bad));
    assert.equal(pm.isValid(bad), false);
  }
  assert.equal(pm.isValid("#ff5733"), true);
  assert.equal(pm.isValid("tomato"), true);
});

test("parse: out-of-range rgb values clamp instead of throwing", () => {
  assert.deepEqual(parse("rgb(300, -20, 128)").toObject(), { r: 255, g: 0, b: 128, a: 1 });
});

// --- output formats ----------------------------------------------------------

test("toHex / toRgbString / toHslString round-trip", () => {
  const c = parse("#3b82f6");
  assert.equal(c.toHex(), "#3b82f6");
  assert.equal(c.toRgbString(), "rgb(59, 130, 246)");
  assert.equal(c.toHslString(), "hsl(217, 91%, 60%)");
  assert.equal(parse(c.toRgbString()).toHex(), "#3b82f6");
  // HSL strings round to whole numbers, so the round-trip lands within 1
  // per channel rather than exactly — that's display rounding, not a bug.
  const back = parse(c.toHslString());
  assert.ok(Math.abs(back.r - c.r) <= 1);
  assert.ok(Math.abs(back.g - c.g) <= 1);
  assert.ok(Math.abs(back.b - c.b) <= 1);
});

test("toHex with alpha only appends when transparent", () => {
  assert.equal(parse("#ff5733").toHex(true), "#ff5733");
  assert.equal(parse("#ff573380").toHex(true), "#ff573380");
});

test("hsl/hsv conversions agree on known colors", () => {
  const hsl = parse("#ff0000").toHsl();
  assert.equal(Math.round(hsl.h), 0);
  assert.equal(Math.round(hsl.s), 100);
  assert.equal(Math.round(hsl.l), 50);
  const hsv = parse("#808080").toHsv();
  assert.equal(Math.round(hsv.s), 0);
  assert.equal(Math.round(hsv.v), 50);
});

// --- transforms --------------------------------------------------------------

test("lighten / darken move lightness by points", () => {
  const base = parse("#808080"); // 50% lightness grey
  assert.equal(base.lighten(20).toHsl().l | 0, 70);
  assert.equal(base.darken(20).toHsl().l | 0, 30);
  assert.equal(base.lighten(0).toHex(), "#808080");
});

test("saturate / desaturate move saturation", () => {
  const grey = parse("#808080");
  assert.ok(grey.saturate(50).toHsl().s > 40);
  const red = parse("#ff0000");
  assert.equal(red.desaturate(100).toHex(), "#808080");
});

test("rotate moves the hue", () => {
  assert.equal(parse("#ff0000").rotate(120).toHex(), "#00ff00");
  assert.equal(parse("#ff0000").rotate(360).toHex(), "#ff0000");
});

test("mix: t=0 keeps base, t=1 gives the other color", () => {
  const a = parse("#ff0000");
  assert.equal(a.mix("#0000ff", 0).toHex(), "#ff0000");
  assert.equal(a.mix("#0000ff", 1).toHex(), "#0000ff");
  assert.equal(a.mix("#0000ff", 0.5).toHex(), "#800080");
});

test("mix in hsl mode keeps mid-tones vivid", () => {
  const mid = parse("#ff0000").mix("#00ff00", 0.5, "hsl");
  assert.equal(mid.toHex(), "#ffff00"); // through yellow, not grey
});

test("tint / shade head toward white / black", () => {
  assert.equal(parse("#ff0000").tint(1).toHex(), "#ffffff");
  assert.equal(parse("#ff0000").shade(1).toHex(), "#000000");
  assert.equal(parse("#ff0000").tint(0).toHex(), "#ff0000");
});

// --- WCAG contrast -----------------------------------------------------------

test("contrast: black on white is exactly 21", () => {
  assert.equal(parse("#000000").contrast("#ffffff"), 21);
  assert.equal(parse("#ffffff").contrast("#000000"), 21);
});

test("contrast: same color is 1", () => {
  assert.equal(parse("#3b82f6").contrast("#3b82f6"), 1);
});

test("contrast: known pair lands where WCAG says it should", () => {
  // #767676 on white is the classic 4.54:1 AA example.
  const ratio = parse("#767676").contrast("#ffffff");
  assert.ok(ratio > 4.5 && ratio < 4.6, "got " + ratio);
});

test("wcagLevel: thresholds for normal and large text", () => {
  assert.equal(pm.wcagLevel(21), "AAA");
  assert.equal(pm.wcagLevel(7), "AAA");
  assert.equal(pm.wcagLevel(4.5), "AA");
  assert.equal(pm.wcagLevel(3.5), "AA Large");
  assert.equal(pm.wcagLevel(2), "Fail");
  assert.equal(pm.wcagLevel(3, true), "AA"); // large text, easier bar
  assert.equal(pm.wcagLevel(2.5, true), "Fail");
});

test("bestText picks the readable side", () => {
  assert.equal(parse("#000000").bestText().toHex(), "#ffffff");
  assert.equal(parse("#ffffff").bestText().toHex(), "#000000");
  assert.equal(parse("#f5f5f5").bestText().toHex(), "#000000");
  assert.equal(parse("#111111").bestText().toHex(), "#ffffff");
});

test("isLight / isDark agree with luminance", () => {
  assert.ok(parse("#ffffff").isLight());
  assert.ok(parse("#000000").isDark());
  assert.ok(parse("#ffff00").isLight()); // yellow is surprisingly light
  assert.ok(parse("#000080").isDark());
});

// --- palettes ------------------------------------------------------------------

test("tints / shades: endpoints and length", () => {
  const ts = pm.tints("#ff0000", 5);
  assert.equal(ts.length, 5);
  assert.equal(ts[0].toHex(), "#ff0000");
  assert.equal(ts[4].toHex(), "#ffffff");
  const ss = pm.shades("#ff0000", 3);
  assert.equal(ss[2].toHex(), "#000000");
  assert.throws(() => pm.tints("#ff0000", 1), ColorError);
});

test("tailwindScale: 11 stops, 500 is the base", () => {
  const scale = pm.tailwindScale("#3b82f6");
  assert.equal(Object.keys(scale).length, 11);
  assert.equal(scale[500].toHex(), "#3b82f6");
  assert.ok(scale[50].toHsl().l > scale[500].toHsl().l);
  assert.ok(scale[950].toHsl().l < scale[500].toHsl().l);
});

test("harmonies: complementary is 180 degrees away", () => {
  const h = pm.harmonies("#ff0000");
  assert.equal(h.complementary[1].toHex(), "#00ffff");
  assert.equal(h.triadic.length, 3);
  assert.equal(h.analogous.length, 3);
  assert.equal(h.square.length, 4);
});

// --- simulation ------------------------------------------------------------------

test("simulate: each type changes the color, achromatopsia greys it", () => {
  const red = parse("#ff0000");
  for (const type of ["protanopia", "deuteranopia", "tritanopia"]) {
    const sim = pm.simulate(red, type);
    assert.notEqual(sim.toHex(), "#ff0000", type);
  }
  const grey = pm.simulate("#ff8800", "achromatopsia");
  assert.equal(grey.r, grey.g);
  assert.equal(grey.g, grey.b);
  assert.throws(() => pm.simulate("#ff0000", "nope"), ColorError);
});

// --- random + deterministic ------------------------------------------------------

test("randomColor returns a valid opaque color", () => {
  const c = pm.randomColor();
  assert.ok(c.r >= 0 && c.r <= 255);
  assert.equal(c.a, 1);
});

test("colorFromString is deterministic and rejects empty input", () => {
  assert.equal(pm.colorFromString("krrish").toHex(), pm.colorFromString("krrish").toHex());
  assert.notEqual(pm.colorFromString("krrish").toHex(), pm.colorFromString("ehty").toHex());
  assert.throws(() => pm.colorFromString(""), ColorError);
});

// --- CSS variables -----------------------------------------------------------------

test("cssVars emits sorted stops with the given prefix", () => {
  const vars = pm.cssVars(pm.tailwindScale("#3b82f6"), "brand");
  assert.ok(vars.startsWith(":root {"));
  assert.ok(vars.includes("--brand-50:"));
  assert.ok(vars.includes("--brand-500: #3b82f6;"));
  assert.ok(vars.includes("--brand-950:"));
  assert.ok(vars.endsWith("}"));
});

// --- CLI -------------------------------------------------------------------------------

test("CLI: parse prints hex/rgb/hsl; bad input exits 2 with a human message", () => {
  const cli = path.join(__dirname, "..", "bin", "palettemint.js");
  const ok = spawnSync(process.execPath, [cli, "parse", "#ff5733"], { encoding: "utf8" });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /#ff5733/);
  assert.match(ok.stdout, /rgb\(255, 87, 51\)/);

  const bad = spawnSync(process.execPath, [cli, "parse", "nope"], { encoding: "utf8" });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /can't read/);
  assert.doesNotMatch(bad.stderr, /Traceback|at .*\.js:/);
});

test("CLI: contrast prints ratio and verdict; unknown command exits 2", () => {
  const cli = path.join(__dirname, "..", "bin", "palettemint.js");
  const out = spawnSync(process.execPath, [cli, "contrast", "#000000", "#ffffff"], { encoding: "utf8" });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /21\.00/);
  assert.match(out.stdout, /AAA/);

  const bad = spawnSync(process.execPath, [cli, "frobnicate"], { encoding: "utf8" });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Unknown command/);
});
