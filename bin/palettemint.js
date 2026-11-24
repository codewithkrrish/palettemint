#!/usr/bin/env node
// palettemint CLI — a thin shell over palettemint.js.
// Usage: palettemint <command> [args] [--flag value]
//
//   parse <color>            print hex / rgb / hsl for a color
//   contrast <a> <b>         WCAG contrast ratio + AA/AAA verdict
//   palette <color>          tint/shade palette as hex list
//   vars <color> [--prefix]  :root CSS custom properties (Tailwind scale)
//   random                   a random color
//
// Errors go to stderr in plain language with exit code 2. No stack traces.

const pm = require("../palettemint.js");

const USAGE = [
  "palettemint — a small color toolkit",
  "",
  "Usage: palettemint <command> [args] [options]",
  "",
  "Commands:",
  "  parse <color>              hex, rgb and hsl for a color",
  "  contrast <color> <color>   WCAG contrast ratio and AA/AAA verdict",
  "  palette <color> [--steps n]  tints and shades, one hex per line",
  "  vars <color> [--prefix name]  :root CSS variables for a 50-950 scale",
  "  harmonies <color>          complementary / analogous / triadic / square",
  "  random                     a random color as hex",
  "",
  "Options:",
  "  --steps n     palette steps (default 5, min 2)",
  "  --prefix str  CSS variable prefix (default: color)",
  "  --help        show this text",
  "",
  "Examples:",
  "  palettemint parse \"#3b82f6\"",
  "  palettemint contrast \"#111111\" \"#ffffff\"",
  "  palettemint vars \"#3b82f6\" --prefix brand"
].join("\n");

function fail(message) {
  process.stderr.write("palettemint: " + message + "\n");
  process.exit(2);
}

function parseFlags(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        fail("Flag --" + key + " needs a value. Try: palettemint --help");
      }
      flags[key] = value;
      i++;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function needArgs(positional, count, usage) {
  if (positional.length < count) {
    fail("Missing argument. Usage: " + usage);
  }
}

function stepsFlag(flags) {
  if (flags.steps === undefined) return 5;
  const n = Number(flags.steps);
  if (!Number.isInteger(n) || n < 2 || n > 20) {
    fail("--steps must be a whole number between 2 and 20, got \"" + flags.steps + "\".");
  }
  return n;
}

function main() {
  const { positional, flags } = parseFlags(process.argv.slice(2));

  if (flags.help || positional.length === 0) {
    process.stdout.write(USAGE + "\n");
    process.exit(0);
  }

  const command = positional[0];

  try {
    switch (command) {
      case "parse": {
        needArgs(positional, 2, "palettemint parse <color>");
        const c = pm.parse(positional[1]);
        process.stdout.write(
          c.toHex() + "\n" + c.toRgbString() + "\n" + c.toHslString() + "\n"
        );
        break;
      }
      case "contrast": {
        needArgs(positional, 3, "palettemint contrast <color> <color>");
        const a = pm.parse(positional[1]);
        const b = pm.parse(positional[2]);
        const ratio = a.contrast(b);
        process.stdout.write(
          "Contrast ratio: " + ratio.toFixed(2) + ":1\n" +
          "Normal text: " + pm.wcagLevel(ratio) + "\n" +
          "Large text:  " + pm.wcagLevel(ratio, true) + "\n"
        );
        break;
      }
      case "palette": {
        needArgs(positional, 2, "palettemint palette <color> [--steps n]");
        const c = pm.parse(positional[1]);
        const steps = stepsFlag(flags);
        process.stdout.write("Tints (toward white):\n");
        pm.tints(c, steps).forEach((t) => process.stdout.write("  " + t.toHex() + "\n"));
        process.stdout.write("Shades (toward black):\n");
        pm.shades(c, steps).forEach((s) => process.stdout.write("  " + s.toHex() + "\n"));
        break;
      }
      case "vars": {
        needArgs(positional, 2, "palettemint vars <color> [--prefix name]");
        const c = pm.parse(positional[1]);
        const prefix = flags.prefix === undefined ? "color" : flags.prefix;
        if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(prefix)) {
          fail("--prefix must start with a letter and contain only letters, digits and dashes.");
        }
        process.stdout.write(pm.cssVars(pm.tailwindScale(c), prefix) + "\n");
        break;
      }
      case "harmonies": {
        needArgs(positional, 2, "palettemint harmonies <color>");
        const h = pm.harmonies(positional[1]);
        Object.keys(h).forEach((name) => {
          process.stdout.write(
            name + ": " + h[name].map((c) => c.toHex()).join("  ") + "\n"
          );
        });
        break;
      }
      case "random": {
        process.stdout.write(pm.randomColor().toHex() + "\n");
        break;
      }
      default:
        fail(
          "Unknown command \"" + command + "\". " +
          "Run `palettemint --help` for the list."
        );
    }
  } catch (err) {
    if (err instanceof pm.ColorError) {
      fail(err.message);
    }
    throw err; // a real bug — let it surface, don't dress it up
  }
}

main();
