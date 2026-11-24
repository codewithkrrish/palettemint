// palettemint — a small, dependency-free color toolkit.
//
// I kept reaching for the same handful of color helpers in every project —
// parse a hex, lighten it a touch, check the contrast, spit out a palette —
// and every time I either hand-rolled them slightly wrong or pulled in a
// library ten times bigger than the job. So I wrote the one I wanted: one
// file, no dependencies, works in Node and straight in the browser, with
// the WCAG math done properly instead of guessed.
//
// The whole module is pure functions plus a small Color class. No DOM in
// here, so the same file is tested with plain node and used straight from
// the playground page.

(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.Palettemint = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // --- constants -----------------------------------------------------------

  // WCAG 2.1 thresholds, so the numbers in the code say what they mean.
  var AA_NORMAL = 4.5;
  var AA_LARGE = 3;
  var AAA_NORMAL = 7;
  var AAA_LARGE = 4.5;

  // Channel weights for relative luminance (WCAG 2.1).
  var LUM_R = 0.2126;
  var LUM_G = 0.7152;
  var LUM_B = 0.0722;

  var MAX_CHANNEL = 255;
  var MAX_HUE = 360;
  var MAX_PERCENT = 100;

  // --- errors --------------------------------------------------------------

  // Thrown for anything that isn't a color I can understand. The message
  // always says what was wrong and shows an example of what works, because
  // "Invalid color" on its own has wasted enough of my evenings.
  function ColorError(message) {
    this.name = "ColorError";
    this.message = message;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ColorError);
  }
  ColorError.prototype = Object.create(Error.prototype);
  ColorError.prototype.constructor = ColorError;

  // --- small helpers --------------------------------------------------------

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function roundChannel(value) {
    return Math.round(clamp(value, 0, MAX_CHANNEL));
  }

  function wrapHue(degrees) {
    var h = degrees % MAX_HUE;
    return h < 0 ? h + MAX_HUE : h;
  }

  // --- the 148 CSS named colors -------------------------------------------
  // Full list, because parse("rebeccapurple") should just work and because
  // a partial list is the kind of thing that bites you at 1am.

  var NAMED_COLORS = {
    aliceblue: "#f0f8ff", antiquewhite: "#faebd7", aqua: "#00ffff",
    aquamarine: "#7fffd4", azure: "#f0ffff", beige: "#f5f5dc",
    bisque: "#ffe4c4", black: "#000000", blanchedalmond: "#ffebcd",
    blue: "#0000ff", blueviolet: "#8a2be2", brown: "#a52a2a",
    burlywood: "#deb887", cadetblue: "#5f9ea0", chartreuse: "#7fff00",
    chocolate: "#d2691e", coral: "#ff7f50", cornflowerblue: "#6495ed",
    cornsilk: "#fff8dc", crimson: "#dc143c", cyan: "#00ffff",
    darkblue: "#00008b", darkcyan: "#008b8b", darkgoldenrod: "#b8860b",
    darkgray: "#a9a9a9", darkgreen: "#006400", darkgrey: "#a9a9a9",
    darkkhaki: "#bdb76b", darkmagenta: "#8b008b", darkolivegreen: "#556b2f",
    darkorange: "#ff8c00", darkorchid: "#9932cc", darkred: "#8b0000",
    darksalmon: "#e9967a", darkseagreen: "#8fbc8f", darkslateblue: "#483d8b",
    darkslategray: "#2f4f4f", darkslategrey: "#2f4f4f", darkturquoise: "#00ced1",
    darkviolet: "#9400d3", deeppink: "#ff1493", deepskyblue: "#00bfff",
    dimgray: "#696969", dimgrey: "#696969", dodgerblue: "#1e90ff",
    firebrick: "#b22222", floralwhite: "#fffaf0", forestgreen: "#228b22",
    fuchsia: "#ff00ff", gainsboro: "#dcdcdc", ghostwhite: "#f8f8ff",
    gold: "#ffd700", goldenrod: "#daa520", gray: "#808080",
    green: "#008000", greenyellow: "#adff2f", grey: "#808080",
    honeydew: "#f0fff0", hotpink: "#ff69b4", indianred: "#cd5c5c",
    indigo: "#4b0082", ivory: "#fffff0", khaki: "#f0e68c",
    lavender: "#e6e6fa", lavenderblush: "#fff0f5", lawngreen: "#7cfc00",
    lemonchiffon: "#fffacd", lightblue: "#add8e6", lightcoral: "#f08080",
    lightcyan: "#e0ffff", lightgoldenrodyellow: "#fafad2", lightgray: "#d3d3d3",
    lightgreen: "#90ee90", lightgrey: "#d3d3d3", lightpink: "#ffb6c1",
    lightsalmon: "#ffa07a", lightseagreen: "#20b2aa", lightskyblue: "#87cefa",
    lightslategray: "#778899", lightslategrey: "#778899", lightsteelblue: "#b0c4de",
    lightyellow: "#ffffe0", lime: "#00ff00", limegreen: "#32cd32",
    linen: "#faf0e6", magenta: "#ff00ff", maroon: "#800000",
    mediumaquamarine: "#66cdaa", mediumblue: "#0000cd", mediumorchid: "#ba55d3",
    mediumpurple: "#9370db", mediumseagreen: "#3cb371", mediumslateblue: "#7b68ee",
    mediumspringgreen: "#00fa9a", mediumturquoise: "#48d1cc", mediumvioletred: "#c71585",
    midnightblue: "#191970", mintcream: "#f5fffa", mistyrose: "#ffe4e1",
    moccasin: "#ffe4b5", navajowhite: "#ffdead", navy: "#000080",
    oldlace: "#fdf5e6", olive: "#808000", olivedrab: "#6b8e23",
    orange: "#ffa500", orangered: "#ff4500", orchid: "#da70d6",
    palegoldenrod: "#eee8aa", palegreen: "#98fb98", paleturquoise: "#afeeee",
    palevioletred: "#db7093", papayawhip: "#ffefd5", peachpuff: "#ffdab9",
    peru: "#cd853f", pink: "#ffc0cb", plum: "#dda0dd",
    powderblue: "#b0e0e6", purple: "#800080", rebeccapurple: "#663399",
    red: "#ff0000", rosybrown: "#bc8f8f", royalblue: "#4169e1",
    saddlebrown: "#8b4513", salmon: "#fa8072", sandybrown: "#f4a460",
    seagreen: "#2e8b57", seashell: "#fff5ee", sienna: "#a0522d",
    silver: "#c0c0c0", skyblue: "#87ceeb", slateblue: "#6a5acd",
    slategray: "#708090", slategrey: "#708090", snow: "#fffafa",
    springgreen: "#00ff7f", steelblue: "#4682b4", tan: "#d2b48c",
    teal: "#008080", thistle: "#d8bfd8", tomato: "#ff6347",
    turquoise: "#40e0d0", violet: "#ee82ee", wheat: "#f5deb3",
    white: "#ffffff", whitesmoke: "#f5f5f5", yellow: "#ffff00",
    yellowgreen: "#9acd32"
  };

  // --- conversions ---------------------------------------------------------

  // Standard sRGB -> HSL. Returns { h: 0-360, s: 0-100, l: 0-100 }.
  function rgbToHsl(r, g, b) {
    var rn = r / MAX_CHANNEL;
    var gn = g / MAX_CHANNEL;
    var bn = b / MAX_CHANNEL;
    var max = Math.max(rn, gn, bn);
    var min = Math.min(rn, gn, bn);
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;

    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) {
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
      } else if (max === gn) {
        h = (bn - rn) / d + 2;
      } else {
        h = (rn - gn) / d + 4;
      }
      h *= 60;
    }
    return { h: h, s: s * MAX_PERCENT, l: l * MAX_PERCENT };
  }

  function hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  // Standard HSL -> sRGB. h in 0-360, s/l in 0-100.
  function hslToRgb(h, s, l) {
    var hn = wrapHue(h) / MAX_HUE;
    var sn = clamp(s, 0, MAX_PERCENT) / MAX_PERCENT;
    var ln = clamp(l, 0, MAX_PERCENT) / MAX_PERCENT;
    var r;
    var g;
    var b;

    if (sn === 0) {
      r = g = b = ln; // achromatic, hue is meaningless here
    } else {
      var q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
      var p = 2 * ln - q;
      r = hueToRgb(p, q, hn + 1 / 3);
      g = hueToRgb(p, q, hn);
      b = hueToRgb(p, q, hn - 1 / 3);
    }
    return {
      r: roundChannel(r * MAX_CHANNEL),
      g: roundChannel(g * MAX_CHANNEL),
      b: roundChannel(b * MAX_CHANNEL)
    };
  }

  // sRGB -> HSV, for pickers that want it. { h: 0-360, s: 0-100, v: 0-100 }.
  function rgbToHsv(r, g, b) {
    var rn = r / MAX_CHANNEL;
    var gn = g / MAX_CHANNEL;
    var bn = b / MAX_CHANNEL;
    var max = Math.max(rn, gn, bn);
    var min = Math.min(rn, gn, bn);
    var d = max - min;
    var h = 0;
    var s = max === 0 ? 0 : d / max;

    if (d !== 0) {
      if (max === rn) {
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
      } else if (max === gn) {
        h = (bn - rn) / d + 2;
      } else {
        h = (rn - gn) / d + 4;
      }
      h *= 60;
    }
    return { h: h, s: s * MAX_PERCENT, v: max * MAX_PERCENT };
  }

  // --- parsing -------------------------------------------------------------

  function parseHex(input) {
    var hex = input.slice(1);
    if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split("").map(function (c) { return c + c; }).join("");
    }
    if (hex.length !== 6 && hex.length !== 8) return null;
    var r = parseInt(hex.slice(0, 2), 16);
    var g = parseInt(hex.slice(2, 4), 16);
    var b = parseInt(hex.slice(4, 6), 16);
    var a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / MAX_CHANNEL : 1;
    return { r: r, g: g, b: b, a: a };
  }

  // Matches rgb(255, 87, 51), rgb(100%, 34%, 20%), rgba(..., 0.5).
  // Values outside range are clamped rather than rejected — CSS does the
  // same, and a clamp is friendlier than an error for a pasted value.
  var RGB_RE = /^rgba?\(\s*([^)]+)\)$/i;

  function parseNumberOrPercent(token) {
    token = token.trim();
    if (token.endsWith("%")) {
      var pct = parseFloat(token.slice(0, -1));
      if (isNaN(pct)) return null;
      return roundChannel(pct / MAX_PERCENT * MAX_CHANNEL);
    }
    var n = parseFloat(token);
    if (isNaN(n)) return null;
    return roundChannel(n);
  }

  function parseAlpha(token) {
    token = token.trim();
    var a = token.endsWith("%") ? parseFloat(token.slice(0, -1)) / MAX_PERCENT : parseFloat(token);
    if (isNaN(a)) return null;
    return clamp(a, 0, 1);
  }

  function parseRgbFunction(input) {
    var m = RGB_RE.exec(input);
    if (!m) return null;
    var parts = m[1].split(/[\s,\/]+/).filter(function (p) { return p !== ""; });
    if (parts.length !== 3 && parts.length !== 4) return null;
    var r = parseNumberOrPercent(parts[0]);
    var g = parseNumberOrPercent(parts[1]);
    var b = parseNumberOrPercent(parts[2]);
    if (r === null || g === null || b === null) return null;
    var a = 1;
    if (parts.length === 4) {
      a = parseAlpha(parts[3]);
      if (a === null) return null;
    }
    return { r: r, g: g, b: b, a: a };
  }

  // Matches hsl(210, 80%, 55%) and hsla(210, 80%, 55%, 0.5). Hue wraps,
  // so hsl(420, ...) is just hsl(60, ...).
  var HSL_RE = /^hsla?\(\s*([^)]+)\)$/i;

  function parseHslFunction(input) {
    var m = HSL_RE.exec(input);
    if (!m) return null;
    var parts = m[1].split(/[\s,\/]+/).filter(function (p) { return p !== ""; });
    if (parts.length !== 3 && parts.length !== 4) return null;
    var h = parseFloat(parts[0]);
    var s = parseFloat(parts[1]);
    var l = parseFloat(parts[2]);
    if (isNaN(h) || isNaN(s) || isNaN(l)) return null;
    var rgb = hslToRgb(h, s, l);
    var a = 1;
    if (parts.length === 4) {
      a = parseAlpha(parts[3]);
      if (a === null) return null;
    }
    return { r: rgb.r, g: rgb.g, b: rgb.b, a: a };
  }

  function parseColor(input) {
    if (input instanceof Color) return input.clone();
    if (typeof input === "object" && input !== null &&
        typeof input.r === "number" && typeof input.g === "number" &&
        typeof input.b === "number") {
      return new Color(input.r, input.g, input.b, input.a === undefined ? 1 : input.a);
    }
    if (typeof input !== "string") {
      throw new ColorError(
        "Expected a color string like \"#ff5733\" or \"rgb(255, 87, 51)\", got " +
        (input === null ? "null" : typeof input) + "."
      );
    }
    var text = input.trim();
    if (text === "") {
      throw new ColorError("Empty color string. Try \"#ff5733\" or \"tomato\".");
    }
    if (text.charAt(0) === "#") {
      var hex = parseHex(text);
      if (hex) return new Color(hex.r, hex.g, hex.b, hex.a);
    } else if (RGB_RE.test(text)) {
      var rgb = parseRgbFunction(text);
      if (rgb) return new Color(rgb.r, rgb.g, rgb.b, rgb.a);
    } else if (HSL_RE.test(text)) {
      var hsl = parseHslFunction(text);
      if (hsl) return new Color(hsl.r, hsl.g, hsl.b, hsl.a);
    } else {
      var named = NAMED_COLORS[text.toLowerCase()];
      if (named) {
        var parsed = parseHex(named);
        return new Color(parsed.r, parsed.g, parsed.b, 1);
      }
    }
    throw new ColorError(
      "I can't read \"" + input + "\" as a color. " +
      "Try a hex like #ff5733, rgb(255, 87, 51), hsl(14, 100%, 60%), or a CSS name like tomato."
    );
  }

  function isValid(input) {
    try {
      parseColor(input);
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- Color ---------------------------------------------------------------

  function Color(r, g, b, a) {
    if (a === undefined) a = 1;
    this.r = roundChannel(r);
    this.g = roundChannel(g);
    this.b = roundChannel(b);
    this.a = clamp(a, 0, 1);
  }

  Color.prototype.clone = function () {
    return new Color(this.r, this.g, this.b, this.a);
  };

  Color.prototype.equals = function (other) {
    var c = parseColor(other);
    return this.r === c.r && this.g === c.g && this.b === c.b &&
      Math.abs(this.a - c.a) < 0.001;
  };

  Color.prototype.toHex = function (withAlpha) {
    function pad(n) {
      var s = n.toString(16);
      return s.length === 1 ? "0" + s : s;
    }
    var hex = "#" + pad(this.r) + pad(this.g) + pad(this.b);
    if (withAlpha && this.a < 1) {
      hex += pad(Math.round(this.a * MAX_CHANNEL));
    }
    return hex;
  };

  Color.prototype.toRgbString = function () {
    if (this.a >= 1) {
      return "rgb(" + this.r + ", " + this.g + ", " + this.b + ")";
    }
    return "rgba(" + this.r + ", " + this.g + ", " + this.b + ", " +
      Number(this.a.toFixed(3)) + ")";
  };

  Color.prototype.toHsl = function () {
    return rgbToHsl(this.r, this.g, this.b);
  };

  Color.prototype.toHslString = function () {
    var hsl = this.toHsl();
    var base = "hsl(" + Math.round(hsl.h) + ", " +
      Math.round(hsl.s) + "%, " + Math.round(hsl.l) + "%)";
    if (this.a >= 1) return base;
    return "hsla(" + Math.round(hsl.h) + ", " + Math.round(hsl.s) + "%, " +
      Math.round(hsl.l) + "%, " + Number(this.a.toFixed(3)) + ")";
  };

  Color.prototype.toHsv = function () {
    return rgbToHsv(this.r, this.g, this.b);
  };

  Color.prototype.toObject = function () {
    return { r: this.r, g: this.g, b: this.b, a: this.a };
  };

  // amount is in percentage points of lightness (0-100). Negative amounts
  // just go the other way, so lighten(-10) === darken(10).
  Color.prototype.lighten = function (amount) {
    var hsl = this.toHsl();
    var rgb = hslToRgb(hsl.h, hsl.s, hsl.l + amount);
    return new Color(rgb.r, rgb.g, rgb.b, this.a);
  };

  Color.prototype.darken = function (amount) {
    return this.lighten(-amount);
  };

  Color.prototype.saturate = function (amount) {
    var hsl = this.toHsl();
    var rgb = hslToRgb(hsl.h, hsl.s + amount, hsl.l);
    return new Color(rgb.r, rgb.g, rgb.b, this.a);
  };

  Color.prototype.desaturate = function (amount) {
    return this.saturate(-amount);
  };

  Color.prototype.rotate = function (degrees) {
    var hsl = this.toHsl();
    var rgb = hslToRgb(hsl.h + degrees, hsl.s, hsl.l);
    return new Color(rgb.r, rgb.g, rgb.b, this.a);
  };

  // Mix this color toward `other` by t (0 = this color, 1 = other color).
  // mode "rgb" lerps channels; "hsl" lerps hue along the shortest arc,
  // which keeps mid-tones from going grey on wide mixes.
  Color.prototype.mix = function (other, t, mode) {
    var c = parseColor(other);
    t = clamp(t, 0, 1);
    if (mode === "hsl") {
      var a = this.toHsl();
      var b = c.toHsl();
      var dh = b.h - a.h;
      if (dh > 180) dh -= 360;
      if (dh < -180) dh += 360;
      var rgb = hslToRgb(
        a.h + dh * t,
        a.s + (b.s - a.s) * t,
        a.l + (b.l - a.l) * t
      );
      return new Color(rgb.r, rgb.g, rgb.b, this.a + (c.a - this.a) * t);
    }
    return new Color(
      this.r + (c.r - this.r) * t,
      this.g + (c.g - this.g) * t,
      this.b + (c.b - this.b) * t,
      this.a + (c.a - this.a) * t
    );
  };

  // tint(0.5) is halfway to white; shade(0.5) is halfway to black.
  Color.prototype.tint = function (t) {
    return this.mix("#ffffff", t);
  };

  Color.prototype.shade = function (t) {
    return this.mix("#000000", t);
  };

  // --- WCAG contrast -------------------------------------------------------

  function linearize(channel) {
    var c = channel / MAX_CHANNEL;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  Color.prototype.luminance = function () {
    return LUM_R * linearize(this.r) +
      LUM_G * linearize(this.g) +
      LUM_B * linearize(this.b);
  };

  Color.prototype.contrast = function (other) {
    var c = parseColor(other);
    var l1 = this.luminance();
    var l2 = c.luminance();
    var light = Math.max(l1, l2);
    var dark = Math.min(l1, l2);
    return (light + 0.05) / (dark + 0.05);
  };

  // WCAG 2.1 level for a contrast ratio. `large` means large text
  // (18pt+, or 14pt bold+), which gets the easier thresholds.
  function wcagLevel(ratio, large) {
    if (large) {
      if (ratio >= AAA_LARGE) return "AAA";
      if (ratio >= AA_LARGE) return "AA";
      return "Fail";
    }
    if (ratio >= AAA_NORMAL) return "AAA";
    if (ratio >= AA_NORMAL) return "AA";
    if (ratio >= AA_LARGE) return "AA Large";
    return "Fail";
  }

  Color.prototype.isLight = function () {
    return this.luminance() > 0.179; // the WCAG midpoint, roughly
  };

  Color.prototype.isDark = function () {
    return !this.isLight();
  };

  // The readable text color for a background of this color: pure black or
  // pure white, whichever contrasts better. Good enough for buttons and
  // badges; for body text, check the ratio yourself.
  Color.prototype.bestText = function () {
    var black = this.contrast("#000000");
    var white = this.contrast("#ffffff");
    return white > black ? new Color(255, 255, 255) : new Color(0, 0, 0);
  };

  // --- palettes ------------------------------------------------------------

  // steps tints toward white and shades toward black. steps must be >= 2
  // (a palette of one color is just the color). Returns Color[].
  function tints(base, steps) {
    var c = parseColor(base);
    if (steps < 2) {
      throw new ColorError("tints() needs at least 2 steps, got " + steps + ".");
    }
    var out = [];
    for (var i = 0; i < steps; i++) {
      out.push(c.tint(i / (steps - 1)));
    }
    return out;
  }

  function shades(base, steps) {
    var c = parseColor(base);
    if (steps < 2) {
      throw new ColorError("shades() needs at least 2 steps, got " + steps + ".");
    }
    var out = [];
    for (var i = 0; i < steps; i++) {
      out.push(c.shade(i / (steps - 1)));
    }
    return out;
  }

  // Tailwind-style 50-950 scale. The stops are how far toward white (below
  // 500) or black (above 500) each step sits; 500 is the base color itself.
  var SCALE_STOPS = [
    { stop: 50, t: 0.95 }, { stop: 100, t: 0.88 }, { stop: 200, t: 0.75 },
    { stop: 300, t: 0.6 }, { stop: 400, t: 0.4 }, { stop: 500, t: 0 },
    { stop: 600, t: 0.2 }, { stop: 700, t: 0.4 }, { stop: 800, t: 0.6 },
    { stop: 900, t: 0.75 }, { stop: 950, t: 0.88 }
  ];

  function tailwindScale(base) {
    var c = parseColor(base);
    var scale = {};
    SCALE_STOPS.forEach(function (entry) {
      if (entry.stop < 500) {
        scale[entry.stop] = c.tint(entry.t);
      } else if (entry.stop > 500) {
        scale[entry.stop] = c.shade(entry.t);
      } else {
        scale[entry.stop] = c.clone();
      }
    });
    return scale;
  }

  // Classic harmony schemes, all derived by rotating the hue.
  function harmonies(base) {
    var c = parseColor(base);
    return {
      complementary: [c.clone(), c.rotate(180)],
      analogous: [c.rotate(-30), c.clone(), c.rotate(30)],
      triadic: [c.clone(), c.rotate(120), c.rotate(240)],
      split: [c.clone(), c.rotate(150), c.rotate(210)],
      square: [c.clone(), c.rotate(90), c.rotate(180), c.rotate(270)]
    };
  }

  // --- color blindness simulation ------------------------------------------
  // Machado et al. (2009) matrices, the ones most tools use. These are
  // approximations, not diagnoses — but they catch the "my red/green
  // distinction is invisible to 8% of men" mistakes early.

  var SIMULATION_MATRICES = {
    protanopia: [
      [0.567, 0.433, 0],
      [0.558, 0.442, 0],
      [0, 0.242, 0.758]
    ],
    deuteranopia: [
      [0.625, 0.375, 0],
      [0.7, 0.3, 0],
      [0, 0.3, 0.7]
    ],
    tritanopia: [
      [0.95, 0.05, 0],
      [0, 0.433, 0.567],
      [0, 0.475, 0.525]
    ]
  };

  function simulate(base, type) {
    var c = parseColor(base);
    if (type === "achromatopsia") {
      var grey = Math.round(c.luminance() * MAX_CHANNEL);
      return new Color(grey, grey, grey, c.a);
    }
    var matrix = SIMULATION_MATRICES[type];
    if (!matrix) {
      throw new ColorError(
        "Unknown simulation \"" + type + "\". " +
        "Use protanopia, deuteranopia, tritanopia, or achromatopsia."
      );
    }
    function apply(row) {
      return row[0] * c.r + row[1] * c.g + row[2] * c.b;
    }
    return new Color(apply(matrix[0]), apply(matrix[1]), apply(matrix[2]), c.a);
  }

  // --- random + deterministic ----------------------------------------------

  function randomColor() {
    return new Color(
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256)
    );
  }

  // Same string always gives the same color — handy for avatar backgrounds
  // and anything keyed off a username. FNV-1a hash, hue from the hash.
  function colorFromString(text) {
    if (typeof text !== "string" || text === "") {
      throw new ColorError("colorFromString() needs a non-empty string.");
    }
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    var hue = ((hash >>> 0) % MAX_HUE + MAX_HUE) % MAX_HUE;
    var rgb = hslToRgb(hue, 65, 55);
    return new Color(rgb.r, rgb.g, rgb.b);
  }

  // --- CSS variables -------------------------------------------------------

  // Turns a scale object (like tailwindScale returns) into copy-ready CSS.
  // Prefix defaults to "color" so --color-500 reads naturally.
  function cssVars(scale, prefix) {
    if (prefix === undefined) prefix = "color";
    var lines = [":root {"];
    Object.keys(scale).sort(function (a, b) { return a - b; }).forEach(function (stop) {
      lines.push("  --" + prefix + "-" + stop + ": " + scale[stop].toHex() + ";");
    });
    lines.push("}");
    return lines.join("\n");
  }

  // --- public API ----------------------------------------------------------

  return {
    Color: Color,
    ColorError: ColorError,
    parse: parseColor,
    isValid: isValid,
    tints: tints,
    shades: shades,
    tailwindScale: tailwindScale,
    harmonies: harmonies,
    simulate: simulate,
    randomColor: randomColor,
    colorFromString: colorFromString,
    wcagLevel: wcagLevel,
    cssVars: cssVars,
    namedColors: NAMED_COLORS,
    thresholds: { AA: AA_NORMAL, AA_LARGE: AA_LARGE, AAA: AAA_NORMAL, AAA_LARGE: AAA_LARGE }
  };
});
