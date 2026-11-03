/*
 * app.js — UI wiring for the KDP Price Ladder.
 *
 * Reads pure math from royalty-math.js (window.KDPPriceLadderMath).
 * All state lives in localStorage under one versioned key; nothing
 * leaves the browser.
 */
(function () {
  "use strict";

  var M = window.KDPPriceLadderMath;
  var STORAGE_KEY = "kdp-price-ladder:v1";
  var LADDER_SIZE = M.LADDER_SIZE;

  // ---------- state ----------

  var DEFAULTS = {
    format: M.EBOOK,
    fileSizeMB: "1.5",
    trim: "6x9",
    pages: "280",
    ink: M.INK_BLACK,
    distribution: "amazon",
    upfront: "500",
    units: "10",
    start: "3.99",
    step: "0.50",
    index: 5
  };

  var state = loadState();

  function loadState() {
    var saved = safeParse();
    var merged = {};
    for (var key in DEFAULTS) merged[key] = DEFAULTS[key];
    if (saved) {
      for (key in DEFAULTS) {
        if (Object.prototype.hasOwnProperty.call(saved, key) && isSane(saved[key])) {
          merged[key] = String(saved[key]);
        }
      }
    }
    return merged;
  }

  function isSane(value) {
    return value === 0 || (value !== undefined && value !== null && value !== "");
  }

  function safeParse() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    } catch (err) {
      return null;
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* private mode or blocked storage: keep running in-memory */
    }
  }

  // ---------- element helpers ----------

  function $(id) { return document.getElementById(id); }

  var planPanel = $("format").closest(".plan-panel");
  var els = {
    format: $("format"),
    fileSize: $("fileSize"),
    trim: $("trim"),
    pages: $("pages"),
    ink: $("ink"),
    distribution: $("distribution"),
    upfront: $("upfront"),
    units: $("units"),
    start: $("start"),
    step: $("step"),
    slider: $("ladderSlider"),
    sliderPrice: $("sliderPrice"),
    spotPrice: $("spotPrice"),
    spotTier: $("spotTier"),
    spotRoyalty: $("spotRoyalty"),
    spotBreakeven: $("spotBreakeven"),
    spotRevenue: $("spotRevenue"),
    spotNote: $("spotNote"),
    ladderBody: $("ladderBody"),
    table: $("ladderTable")
  };

  // ---------- plan -> math ----------

  function currentPlan() {
    var trim = M.trimByName(state.trim);
    return {
      format: state.format,
      fileSizeMB: parseFloat(state.fileSizeMB),
      largeTrim: trim ? trim.large : false,
      pages: parseInt(state.pages, 10),
      ink: state.ink,
      distribution: state.distribution
    };
  }

  function ladderPrices() {
    var prices = M.priceLadder(state.start, state.step);
    return prices || M.priceLadder(DEFAULTS.start, DEFAULTS.step);
  }

  function ladderNav() {
    var prices = ladderPrices();
    var idx = clampIndex(parseInt(state.index, 10));
    return { prices: prices, idx: idx };
  }

  function clampIndex(i) {
    return Math.min(LADDER_SIZE - 1, Math.max(0, i));
  }

  // ---------- rendering ----------

  function renderPlanVisibility() {
    planPanel.setAttribute("data-format", state.format);
    $("distribution").disabled = (state.format !== M.PAPERBACK);
    if (state.format === M.HARDCOVER) {
      // expanded distribution is paperback-only
      els.distribution.value = "amazon";
    }
  }

  function renderSlider() {
    var nav = ladderNav();
    els.slider.value = String(nav.idx);
    els.sliderPrice.value = "$" + nav.prices[nav.idx].toFixed(2);
  }

  function renderSpotlight() {
    var nav = ladderNav();
    var plan = currentPlan();
    var price = nav.prices[nav.idx];
    var res = M.royaltyForPrice(plan, price);
    var breakeven = M.breakEvenUnits(state.upfront, res.royalty);
    var revenue = M.worstCaseMonthlyRevenue(state.units, res.royalty);

    els.spotPrice.textContent = "$" + price.toFixed(2);
    els.spotTier.textContent = res.tier;

    setMoneyCell(els.spotRoyalty, res.royalty, res.profitable ? "" : "negative");
    if (breakeven === null) {
      if (!res.profitable && isFinite(parseFloat(state.upfront)) && parseFloat(state.upfront) > 0) {
        els.spotBreakeven.textContent = "never";
        els.spotBreakeven.className = "negative";
      } else {
        els.spotBreakeven.textContent = "—";
        els.spotBreakeven.className = "muted";
      }
    } else {
      els.spotBreakeven.textContent = breakeven.toLocaleString("en-US");
      els.spotBreakeven.className = "";
    }
    els.spotRevenue.textContent = M.formatCurrency(revenue);
    els.spotRevenue.className = res.royalty > 0 ? "" : "negative";

    els.spotNote.textContent = noteFor(res, breakeven);
    els.spotNote.className = "spot-note " + (res.profitable ? "good" : "warn");
  }

  function setMoneyCell(el, value, extraClass) {
    el.textContent = M.formatCurrency(value);
    el.className = extraClass || "";
  }

  function noteFor(res, breakeven) {
    var parts = [];
    if (res.note) parts.push(res.note.replace("the $2.99 70% floor", "the 70% window (below $2.99)")
      .replace("the $9.99 70% ceiling", "the 70% window (above $9.99)"));
    if (res.profitable && breakeven !== null && breakeven > 0) {
      parts.push(breakeven.toLocaleString("en-US") + " copies pays for setup");
    }
    if (!res.profitable) parts.push("raise the price or trim your upfront costs");
    else if (breakeven === 0) parts.push("nothing upfront — every sale is profit");
    return parts.join(" · ");
  }

  function renderTable() {
    var nav = ladderNav();
    var plan = currentPlan();
    var upfront = parseFloat(state.upfront);
    var rows = [];

    for (var i = 0; i < nav.prices.length; i++) {
      var price = nav.prices[i];
      var res = M.royaltyForPrice(plan, price);
      var breakeven = M.breakEvenUnits(upfront, res.royalty);
      var revenue = M.worstCaseMonthlyRevenue(state.units, res.royalty);
      var rowClass = (res.profitable ? "royalty-positive" : "unprofitable") +
        (i === nav.idx ? " selected" : "");

      var tr = document.createElement("tr");
      tr.dataset.index = String(i);
      tr.className = rowClass;
      tr.tabIndex = 0;
      tr.setAttribute("aria-selected", i === nav.idx ? "true" : "false");

      tr.innerHTML =
        "<td class='muted'>" + (i + 1) + "</td>" +
        "<td><strong>$" + price.toFixed(2) + "</strong>" +
          (res.note ? "<br><span class='muted'>" + res.note + "</span>" : "") + "</td>" +
        "<td><span class='tier-badge" + tierBadgeClass(res.tier) + "'>" + res.tier + "</span></td>" +
        "<td class='num'>" + costsCell(res) + "</td>" +
        "<td class='num royalty-cell'>" + M.formatCurrency(res.royalty) + "</td>" +
        "<td class='num'>" + breakevenCell(breakeven, upfront) + "</td>" +
        "<td class='num'>" + revenueCell(revenue, res.royalty) + "</td>";
      rows.push(tr);
    }

    els.ladderBody.innerHTML = "";
    while (rows.length) els.ladderBody.appendChild(rows.shift());
  }

  function tierBadgeClass(tier) {
    if (tier.indexOf("35%") === 0) return " off";
    if (tier.indexOf("expanded") !== -1) return " expand";
    return "";
  }

  function costsCell(res) {
    if (res.printingCost > 0) return M.formatCurrency(res.printingCost);
    if (res.deliveryFee > 0) return M.formatCurrency(res.deliveryFee);
    return "<span class='muted'>—</span>";
  }

  function breakevenCell(breakeven, upfront) {
    if (breakeven === null) {
      if (!isFinite(upfront)) return "<span class='muted'>—</span>";
      return "<span class='muted'>never</span>";
    }
    if (breakeven === 0) return "<span class='muted'>met ✓</span>";
    return breakeven.toLocaleString("en-US");
  }

  function revenueCell(revenue, royalty) {
    var text = M.formatCurrency(revenue);
    if (!(royalty > 0)) return "<span title='No positive royalty on this price'>" + text +
      "<span class='muted'> (crisis)</span></span>";
    return text;
  }

  function renderAll() {
    renderPlanVisibility();
    renderSlider();
    renderSpotlight();
    renderTable();
    saveState();
  }

  // ---------- inputs ----------

  function bindField(el, key, parse) {
    el.addEventListener("input", function () {
      var raw = el.value;
      if (el.validity && !el.validity.valid && raw !== "") return;
      state[key] = raw;
      renderAll();
    });
    el.addEventListener("change", function () {
      if (parse) {
        var cleaned = parse(el.value);
        if (cleaned !== undefined && cleaned !== null) {
          state[key] = cleaned;
          el.value = cleaned;
          renderAll();
        }
      }
    });
  }

  els.format.addEventListener("change", function () {
    state.format = els.format.value;
    if (state.format === M.HARDCOVER) {
      // Expanded distribution is paperback-only; keep state in sync with UI.
      state.distribution = "amazon";
      els.distribution.value = "amazon";
    }
    renderAll();
  });

  els.slider.addEventListener("input", function () {
    state.index = clampIndex(parseInt(this.value, 10) || 0);
    renderSliderLock();
  });

  function renderSliderLock() {
    renderSpotlight();
    renderTable();
    saveState();
    els.slider.setAttribute("value", String(clampIndex(parseInt(state.index, 10))));
    els.sliderPrice.value = "$" + ladderPrices()[clampIndex(parseInt(state.index, 10))].toFixed(2);
  }

  // Clicking a row or focusing it selects that price point.
  els.ladderBody.addEventListener("click", function (event) {
    var tr = event.target.closest("tr");
    if (tr && tr.dataset.index !== undefined) {
      state.index = clampIndex(parseInt(tr.dataset.index, 10));
      renderAll();
    }
  });

  els.ladderBody.addEventListener("keydown", function (event) {
    var tr = event.target.closest("tr");
    if (!tr || tr.dataset.index === undefined) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      state.index = clampIndex(parseInt(tr.dataset.index, 10));
      renderAll();
    }
  });

  // ---------- presets ----------

  var PRESETS = {
    under5: { format: M.EBOOK, start: "0.99", step: "0.40" },
    sweet: { format: M.EBOOK, start: "3.99", step: "0.50" },
    launch: { format: M.EBOOK, start: "0.99", step: "0.30" }
  };

  document.querySelectorAll(".preset").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var preset = PRESETS[btn.dataset.preset];
      if (!preset) return;
      for (var key in preset) {
        state[key] = preset[key];
        if (els[key]) els[key].value = preset[key];
      }
      renderAll();
    });
  });

  var parseTrim = function (value) {
    var trim = M.trimByName(value);
    return trim ? trim.name : DEFAULTS.trim;
  };

  var parseChoice = function (choices, fallback) {
    return function (value) {
      return choices.indexOf(value) !== -1 ? value : fallback;
    };
  };

  bindField(els.fileSize, "fileSizeMB");
  bindField(els.pages, "pages");
  bindField(els.upfront, "upfront");
  bindField(els.units, "units");
  bindField(els.start, "start");
  bindField(els.step, "step");
  bindField(els.ink, "ink", parseChoice([M.INK_BLACK, M.INK_COLOR], M.INK_BLACK));
  bindField(els.distribution, "distribution", parseChoice(["amazon", "expanded"], "amazon"));
  bindField(els.trim, "trim", parseTrim);

  // ---------- init ----------

  function init() {
    // Populate trim dropdown from the math module (single source of truth).
    els.trim.innerHTML = "";
    M.TRIMS.forEach(function (trim) {
      var opt = document.createElement("option");
      opt.value = trim.name;
      opt.textContent = trim.label + (trim.large ? " · large" : "");
      els.trim.appendChild(opt);
    });

    // Restore saved values into inputs.
    ["format", "fileSize", "trim", "pages", "ink", "distribution",
     "upfront", "units", "start", "step"].forEach(function (id) {
      var fieldKey = id;
      if (id === "fileSize") fieldKey = "fileSizeMB";
      if (Object.prototype.hasOwnProperty.call(state, fieldKey)) {
        els[id].value = state[fieldKey];
      }
    });

    renderAll();
  }

  init();
})();
