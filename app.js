// palettemint playground — page wiring only. All color math lives in
// palettemint.js, so this file is just inputs in, DOM out. Every control on
// the page works; if a control ever stops working, that's a bug, not a
// placeholder.

(function () {
  "use strict";

  var pm = window.Palettemint;

  var PRESETS = [
    { name: "Ocean", hex: "#3b82f6" },
    { name: "Forest", hex: "#16a34a" },
    { name: "Sunset", hex: "#ea580c" },
    { name: "Berry", hex: "#db2777" },
    { name: "Grape", hex: "#7c3aed" },
    { name: "Teal", hex: "#0d9488" },
    { name: "Amber", hex: "#d97706" },
    { name: "Crimson", hex: "#dc2626" }
  ];

  var SIMULATIONS = [
    { type: "protanopia", label: "Protanopia", note: "red-blind" },
    { type: "deuteranopia", label: "Deuteranopia", note: "green-blind" },
    { type: "tritanopia", label: "Tritanopia", note: "blue-blind" },
    { type: "achromatopsia", label: "Achromatopsia", note: "no color" }
  ];

  var HARMONY_NOTES = {
    complementary: "opposite on the wheel",
    analogous: "neighbors on the wheel",
    triadic: "three evenly spaced",
    split: "opposite, split both ways",
    square: "four evenly spaced"
  };

  // --- element handles -----------------------------------------------------

  function $(id) { return document.getElementById(id); }

  var basePicker = $("basePicker");
  var baseHex = $("baseHex");
  var baseHint = $("baseHint");
  var liveSwatch = $("liveSwatch");
  var liveHex = $("liveHex");
  var liveMeta = $("liveMeta");
  var liveName = $("liveName");
  var scaleStrip = $("scaleStrip");
  var fgPicker = $("fgPicker");
  var fgHex = $("fgHex");
  var bgPicker = $("bgPicker");
  var bgHex = $("bgHex");
  var ratioValue = $("ratioValue");
  var ratioBadges = $("ratioBadges");
  var samplePreview = $("samplePreview");
  var harmonyRows = $("harmonyRows");
  var simGrid = $("simGrid");
  var prefixInput = $("prefixInput");
  var varsOutput = $("varsOutput");
  var toast = $("toast");

  var state = {
    base: pm.parse("#3b82f6"),
    baseName: "Ocean",
    fg: pm.parse("#211c16"),
    bg: pm.parse("#ffffff")
  };

  // --- toast + clipboard ---------------------------------------------------

  var toastTimer = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }

  // Clipboard in insecure contexts (file://) may not exist, so fall back to
  // selecting the text in a temporary field the user can copy by hand.
  function copyText(text, okMessage) {
    function done() { showToast(okMessage); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        showToast(okMessage);
      } catch (e) {
        showToast("Copy didn't work here — the value is selected, press Ctrl+C.");
      }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  // --- base color ----------------------------------------------------------

  function setBase(color, name) {
    state.base = color;
    if (name) state.baseName = name;

    var hex = color.toHex();
    var hsl = color.toHsl();
    var root = document.documentElement.style;

    // The whole page re-skins around the base color.
    root.setProperty("--accent", hex);
    root.setProperty("--accent-ink", color.bestText().toHex());

    basePicker.value = hex;
    if (document.activeElement !== baseHex) baseHex.value = hex;
    baseHint.textContent = "Hex, rgb(), hsl(), or a CSS name like “tomato”.";
    baseHint.classList.remove("error");

    liveSwatch.style.backgroundColor = hex;
    liveSwatch.style.color = color.bestText().toHex();
    liveHex.textContent = hex;
    liveName.textContent = "Your base color — " + state.baseName;
    liveMeta.textContent =
      color.toRgbString() + "  ·  " +
      "hsl(" + Math.round(hsl.h) + ", " + Math.round(hsl.s) + "%, " + Math.round(hsl.l) + "%)" +
      "  ·  " + (color.isLight() ? "light" : "dark") +
      "  ·  best text: " + color.bestText().toHex();

    renderScale();
    renderHarmonies();
    renderSimulations();
    renderVars();
    syncPresetButtons();
  }

  function setBaseFromText(text) {
    try {
      var color = pm.parse(text);
      var named = Object.keys(pm.namedColors).find(function (n) {
        return pm.namedColors[n] === color.toHex();
      });
      setBase(color, named ? named : "Custom");
    } catch (e) {
      baseHint.textContent = e.message;
      baseHint.classList.add("error");
    }
  }

  // --- scale strip ---------------------------------------------------------

  function renderScale() {
    var scale = pm.tailwindScale(state.base);
    scaleStrip.innerHTML = "";
    Object.keys(scale).sort(function (a, b) { return a - b; }).forEach(function (stop) {
      var c = scale[stop];
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "scale-cell";
      cell.style.backgroundColor = c.toHex();
      cell.style.color = c.bestText().toHex();
      cell.title = "Copy " + c.toHex();
      var tag = stop === "500" ? '<span class="tag">base</span>' : "";
      cell.innerHTML =
        '<span class="stop">' + stop + '</span>' + tag +
        '<span class="hex">' + c.toHex() + '</span>';
      cell.addEventListener("click", function () {
        copyText(c.toHex(), "Copied " + c.toHex());
      });
      scaleStrip.appendChild(cell);
    });
  }

  // --- harmonies -----------------------------------------------------------

  function renderHarmonies() {
    var groups = pm.harmonies(state.base);
    harmonyRows.innerHTML = "";
    Object.keys(groups).forEach(function (name) {
      var row = document.createElement("div");
      row.className = "harmony-row";
      var label = document.createElement("div");
      label.className = "h-name";
      label.innerHTML = name + "<small>" + HARMONY_NOTES[name] + "</small>";
      var swatches = document.createElement("div");
      swatches.className = "harmony-swatches";
      groups[name].forEach(function (c) {
        var sw = document.createElement("button");
        sw.type = "button";
        sw.className = "mini-swatch";
        sw.style.backgroundColor = c.toHex();
        sw.style.color = c.bestText().toHex();
        sw.textContent = c.toHex();
        sw.title = "Click to copy, double-click to make it the base";
        sw.addEventListener("click", function () {
          copyText(c.toHex(), "Copied " + c.toHex());
        });
        sw.addEventListener("dblclick", function () {
          setBase(c, "Harmony pick");
          showToast("New base: " + c.toHex());
        });
        swatches.appendChild(sw);
      });
      row.appendChild(label);
      row.appendChild(swatches);
      harmonyRows.appendChild(row);
    });
  }

  // --- color blindness -----------------------------------------------------

  function renderSimulations() {
    simGrid.innerHTML = "";
    SIMULATIONS.forEach(function (sim) {
      var c = pm.simulate(state.base, sim.type);
      var card = document.createElement("div");
      card.className = "sim-card";
      var block = document.createElement("div");
      block.className = "sim-color";
      block.style.backgroundColor = c.toHex();
      var body = document.createElement("div");
      body.className = "sim-body";
      var title = document.createElement("b");
      title.textContent = sim.label;
      var note = document.createElement("span");
      note.textContent = sim.note + " · " + c.toHex();
      body.appendChild(title);
      body.appendChild(note);
      card.appendChild(block);
      card.appendChild(body);
      simGrid.appendChild(card);
    });
  }

  // --- CSS variables -------------------------------------------------------

  function renderVars() {
    var prefix = prefixInput.value.trim() || "color";
    var vars = pm.cssVars(pm.tailwindScale(state.base), prefix);
    // Syntax-highlight the variable names for readability.
    varsOutput.innerHTML = vars
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/(--[a-z0-9-]+)(:)/gi, '<span class="var-name">$1</span>$2');
  }

  // --- contrast checker ----------------------------------------------------

  function syncContrastInputs() {
    fgPicker.value = state.fg.toHex();
    if (document.activeElement !== fgHex) fgHex.value = state.fg.toHex();
    bgPicker.value = state.bg.toHex();
    if (document.activeElement !== bgHex) bgHex.value = state.bg.toHex();
  }

  function renderContrast() {
    var ratio = state.fg.contrast(state.bg);
    ratioValue.textContent = ratio.toFixed(2);

    var rows = [
      { label: "Normal text · AA", level: pm.wcagLevel(ratio, false) },
      { label: "Normal text · AAA", level: ratio >= pm.thresholds.AAA ? "AAA" : "Fail" },
      { label: "Large text · AA", level: pm.wcagLevel(ratio, true) },
      { label: "Large text · AAA", level: ratio >= pm.thresholds.AAA_LARGE ? "AAA" : "Fail" }
    ];
    ratioBadges.innerHTML = "";
    rows.forEach(function (row) {
      var badge = document.createElement("span");
      badge.className = "badge " + (row.level === "Fail" ? "fail" : "pass");
      badge.textContent = row.label + ": " + row.level;
      ratioBadges.appendChild(badge);
    });

    samplePreview.style.backgroundColor = state.bg.toHex();
    samplePreview.style.color = state.fg.toHex();
  }

  function setContrastSide(side, text) {
    try {
      var color = pm.parse(text);
      state[side] = color;
      syncContrastInputs();
      renderContrast();
    } catch (e) {
      showToast(e.message);
    }
  }

  // --- presets -------------------------------------------------------------

  function buildPresets() {
    var row = $("presetRow");
    PRESETS.forEach(function (preset) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset";
      btn.style.backgroundColor = preset.hex;
      btn.title = preset.name + " " + preset.hex;
      btn.setAttribute("aria-label", "Use " + preset.name + " " + preset.hex + " as base");
      btn.setAttribute("aria-pressed", "false");
      btn.dataset.hex = preset.hex;
      btn.dataset.name = preset.name;
      btn.addEventListener("click", function () {
        setBase(pm.parse(preset.hex), preset.name);
      });
      row.appendChild(btn);
    });
  }

  function syncPresetButtons() {
    var hex = state.base.toHex();
    Array.prototype.forEach.call($("presetRow").children, function (btn) {
      btn.setAttribute("aria-pressed", btn.dataset.hex === hex ? "true" : "false");
    });
  }

  // --- events --------------------------------------------------------------

  basePicker.addEventListener("input", function () {
    setBase(pm.parse(basePicker.value), "Custom");
  });
  baseHex.addEventListener("change", function () {
    setBaseFromText(baseHex.value);
  });
  baseHex.addEventListener("keydown", function (e) {
    if (e.key === "Enter") setBaseFromText(baseHex.value);
  });

  $("randomBtn").addEventListener("click", function () {
    setBase(pm.randomColor(), "Random");
  });
  $("copyHexBtn").addEventListener("click", function () {
    copyText(state.base.toHex(), "Copied " + state.base.toHex());
  });
  liveHex.addEventListener("click", function () {
    copyText(state.base.toHex(), "Copied " + state.base.toHex());
  });

  fgPicker.addEventListener("input", function () { setContrastSide("fg", fgPicker.value); });
  bgPicker.addEventListener("input", function () { setContrastSide("bg", bgPicker.value); });
  fgHex.addEventListener("change", function () { setContrastSide("fg", fgHex.value); });
  bgHex.addEventListener("change", function () { setContrastSide("bg", bgHex.value); });

  $("swapBtn").addEventListener("click", function () {
    var tmp = state.fg;
    state.fg = state.bg;
    state.bg = tmp;
    syncContrastInputs();
    renderContrast();
  });
  $("useBaseBtn").addEventListener("click", function () {
    state.bg = state.base.clone();
    syncContrastInputs();
    renderContrast();
    showToast("Background set to " + state.base.toHex());
  });

  prefixInput.addEventListener("input", renderVars);
  $("copyVarsBtn").addEventListener("click", function () {
    var prefix = prefixInput.value.trim() || "color";
    copyText(pm.cssVars(pm.tailwindScale(state.base), prefix), "CSS variables copied");
  });

  // --- init ----------------------------------------------------------------

  buildPresets();
  setBase(state.base, "Ocean");
  syncContrastInputs();
  renderContrast();
})();
