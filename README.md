# palettemint

A small color toolkit that does the jobs I kept re-doing by hand: parse a
color in whatever format it arrived in, nudge it lighter or darker, check
whether text on it is actually readable, and turn one base color into a
whole palette I can paste into a stylesheet.

I built it because every project I start needs the same five helpers, and
the options were either a 200 KB library or me re-writing `rgbToHsl` from
memory at 1am and getting it slightly wrong. This is the version I wanted
to reach for: one file, no dependencies, works in Node and straight in the
browser.

Open `index.html` and the playground is right there — pick a base color,
get the full scale, contrast checks, harmonies, and copy-ready CSS variables.
No build step, no network calls, nothing leaves your browser.

## What it does

- **Parse anything** — hex (`#f53`, `#ff5733`, `#ff573380`), `rgb()` /
  `rgba()` (commas or spaces, numbers or percents), `hsl()` / `hsla()`,
  and all 148 CSS named colors. Bad input throws a `ColorError` that says
  what went wrong and shows an example, instead of a stack trace.
- **Transform** — `lighten`, `darken`, `saturate`, `desaturate`, `rotate`,
  and `mix` (in RGB or HSL — HSL mixing keeps mid-tones vivid instead of
  going grey). `tint` and `shade` head toward white and black.
- **Real WCAG contrast** — relative luminance and contrast ratios per
  WCAG 2.1, with AA / AAA verdicts for normal and large text. Black on
  white is 21:1, as it should be. `bestText()` picks black or white for a
  background.
- **Palettes** — `tints` / `shades`, a Tailwind-style 50–950 scale, and
  complementary / analogous / triadic / split / square harmonies.
- **Color-blindness simulation** — protanopia, deuteranopia, tritanopia,
  and achromatopsia, using the Machado et al. matrices, so you catch
  "these two colors are indistinguishable to 8% of men" before you ship.
- **Small extras** — `randomColor()`, and `colorFromString("krrish")`
  which always returns the same color for the same string (handy for
  avatar backgrounds).
- **A CLI** — `parse`, `contrast`, `palette`, `vars`, `harmonies`,
  `random`. Errors go to stderr in plain language with exit code 2.

## Try it

No install needed for the playground — just open the file:

```bash
open index.html
```

or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

To use the library in your own project, clone it and require the one file:

```bash
git clone https://github.com/codewithkrrish/palettemint.git
```

```js
const pm = require("./palettemint.js");

const brand = pm.parse("#3b82f6");
console.log(brand.toHslString());            // hsl(217, 91%, 60%)
console.log(brand.lighten(15).toHex());      // #7aa9f8
console.log(brand.contrast("#ffffff").toFixed(2)); // 3.68 — fails AA on white, use a darker stop
console.log(pm.wcagLevel(brand.contrast("#ffffff"))); // "AA Large"

const scale = pm.tailwindScale(brand);
console.log(pm.cssVars(scale, "brand"));
```

That last call prints:

```css
:root {
  --brand-50: #f5f9ff;
  --brand-100: #e7f0fe;
  --brand-200: #cee0fd;
  --brand-300: #b1cdfb;
  --brand-400: #89b4fa;
  --brand-500: #3b82f6;
  --brand-600: #2f68c5;
  --brand-700: #234e94;
  --brand-800: #183462;
  --brand-900: #0f213e;
  --brand-950: #07101e;
}
```

## CLI

```bash
node bin/palettemint.js parse "#ff5733"
# #ff5733
# rgb(255, 87, 51)
# hsl(11, 100%, 60%)

node bin/palettemint.js contrast "#111111" "#ffffff"
# Contrast ratio: 18.88:1
# Normal text: AAA
# Large text:  AAA

node bin/palettemint.js vars "#3b82f6" --prefix brand
# :root { ... }  (the scale above)

node bin/palettemint.js palette "#3b82f6" --steps 5
node bin/palettemint.js harmonies "#3b82f6"
node bin/palettemint.js random
```

Install it globally from the repo if you want the bare command:

```bash
npm install -g git+https://github.com/codewithkrrish/palettemint.git
palettemint contrast "#111111" "#ffffff"
```

## API

All of it lives in `palettemint.js` (UMD — `require` it in Node, or load it
with a `<script>` tag and use the `Palettemint` global).

| Function | What it returns |
| --- | --- |
| `parse(input)` | A `Color`. Accepts hex, `rgb()`, `hsl()`, a CSS name, an `{r,g,b}` object, or another `Color`. Throws `ColorError` otherwise. |
| `isValid(input)` | `true` / `false`, never throws. |
| `Color` methods | `toHex(withAlpha?)`, `toRgbString()`, `toHslString()`, `toHsl()`, `toHsv()`, `lighten(n)`, `darken(n)`, `saturate(n)`, `desaturate(n)`, `rotate(deg)`, `mix(other, t, mode?)`, `tint(t)`, `shade(t)`, `luminance()`, `contrast(other)`, `bestText()`, `isLight()`, `isDark()`, `equals(other)`, `clone()` |
| `tints(base, steps)` / `shades(base, steps)` | `Color[]`, from the base to white / black. |
| `tailwindScale(base)` | `{50…950: Color}` — 500 is the base. |
| `harmonies(base)` | `{complementary, analogous, triadic, split, square}` — arrays of `Color`. |
| `simulate(color, type)` | The color as seen with `protanopia`, `deuteranopia`, `tritanopia`, or `achromatopsia`. |
| `wcagLevel(ratio, large?)` | `"AAA"`, `"AA"`, `"AA Large"`, or `"Fail"`. |
| `randomColor()` | A random opaque `Color`. |
| `colorFromString(text)` | Deterministic `Color` for a string. |
| `cssVars(scale, prefix?)` | A `:root { … }` block of custom properties. |

`lighten` / `darken` / `saturate` take percentage points (0–100). `mix`
takes `t` from 0 to 1; pass `"hsl"` as the mode to blend along the hue arc
instead of straight through RGB.

## Tests

35 checks, no dependencies — just Node's built-in runner:

```bash
npm test
# 35 pass, 0 fail
```

They cover every parse format, the error cases (empty, garbage, wrong
types), conversion round-trips, the WCAG numbers against known values
(black/white = 21, `#767676` on white ≈ 4.54), palette endpoints, and the
CLI's exit codes. The playground page itself is exercised end-to-end in
jsdom (in `/tmp`, not shipped): every control clicked, every output
asserted — 24 checks, all passing.

## Project structure

```
palettemint.js          the whole library, UMD, zero dependencies
bin/palettemint.js      thin CLI over the library
index.html              the playground page
app.js                  playground wiring (no color math in here)
style.css               playground styles
tests/palettemint.test.js
package.json
```

## Limitations

Honest ones, because every color library has them:

- **HSL strings round to whole numbers**, so `parse(color.toHslString())`
  can land 1 unit off per channel. If you need exact round-trips, keep the
  `Color` object or use hex.
- **Mixing is in sRGB**, not a perceptual space like OKLCH — wide mixes
  can look uneven. The `"hsl"` mix mode helps for hues; a perceptual mode
  is on the list.
- **Simulations are approximations** (Machado et al. matrices). They catch
  real problems early, but they are not a diagnosis and not a substitute
  for testing with actual users.
- **No alpha compositing** — `contrast()` uses the raw colors, not the
  color as it looks over a background. If your text sits on a translucent
  layer, composite it first.

## License

MIT — see [LICENSE](LICENSE).

Built by [Krrish](https://github.com/codewithkrrish).
