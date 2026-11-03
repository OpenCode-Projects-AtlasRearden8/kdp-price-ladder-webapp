/*
 * royalty-math.js — pure KDP-style royalty math for the price ladder.
 *
 * Plain estimates only: royalty rates and printing costs mirror Amazon's
 * publicly listed US marketplace rates. Nothing here calls the network,
 * and every number can be traced to the notes in README.md.
 *
 * Works in the browser (window.KDPPriceLadderMath) and in Node
 * (module.exports) so the same functions power the test suite.
 */
(function (global) {
  "use strict";

  // ---- Reference constants (US marketplace, June 2023 print rates) ----

  var EBOOK = "ebook";
  var PAPERBACK = "paperback";
  var HARDCOVER = "hardcover";

  var FORMATS = [EBOOK, PAPERBACK, HARDCOVER];
  var INK_BLACK = "black";
  var INK_COLOR = "color";

  var ROYALTY_RATE_70 = 0.7;
  var ROYALTY_RATE_35 = 0.35;
  var ROYALTY_RATE_PRINT = 0.6;
  var ROYALTY_RATE_EXPANDED = 0.4;

  // The 70% ebook tier only applies inside this list-price window.
  var EBOOK_70_MIN_PRICE = 2.99;
  var EBOOK_70_MAX_PRICE = 9.99;

  // Kindle delivery fee charged against the 70% tier, per megabyte.
  var DELIVERY_FEE_PER_MB = 0.15;

  // US printing cost = fixed + per-page * page count.
  var PRINTING_RATES = {
    "paperback|black|standard": { fixed: 0.85, perPage: 0.012 },
    "paperback|black|large": { fixed: 1.0, perPage: 0.012 },
    "paperback|color|standard": { fixed: 0.85, perPage: 0.0575 },
    "paperback|color|large": { fixed: 1.0, perPage: 0.0575 },
    "hardcover|black|standard": { fixed: 5.65, perPage: 0.012 },
    "hardcover|color|standard": { fixed: 8.87, perPage: 0.065 }
  };

  var TRIMS = [
    { name: "5x8", label: "5 x 8 in", large: false, wordsPerPage: 200 },
    { name: "5.25x8", label: "5.25 x 8 in", large: false, wordsPerPage: 215 },
    { name: "5.5x8.5", label: "5.5 x 8.5 in", large: false, wordsPerPage: 250 },
    { name: "6x9", label: "6 x 9 in", large: false, wordsPerPage: 300 },
    { name: "6.14x9.21", label: "6.14 x 9.21 in", large: true, wordsPerPage: 320 },
    { name: "6.69x9.61", label: "6.69 x 9.61 in", large: true, wordsPerPage: 360 },
    { name: "7x10", label: "7 x 10 in", large: true, wordsPerPage: 400 },
    { name: "7.44x9.69", label: "7.44 x 9.69 in", large: true, wordsPerPage: 420 },
    { name: "7.5x9.25", label: "7.5 x 9.25 in", large: true, wordsPerPage: 430 },
    { name: "8x10", label: "8 x 10 in", large: true, wordsPerPage: 480 },
    { name: "8.25x11", label: "8.25 x 11 in", large: true, wordsPerPage: 520 },
    { name: "8.5x11", label: "8.5 x 11 in", large: true, wordsPerPage: 550 }
  ];

  var EBOOK_MIN_LIST_PRICE = 0.99;
  var PAPERBACK_MIN_PAGES = 24;
  var PAPERBACK_MAX_PAGES = 828;
  var HARDCOVER_MIN_PAGES = 75;
  var HARDCOVER_MAX_PAGES = 240;
  var LADDER_SIZE = 10;

  // ---- Small helpers ----

  var round2 = function (value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  };

  var roundMoney = function (value) {
    if (typeof value !== "number" || !isFinite(value)) return value;
    return round2(value);
  };

  var trimByName = function (name) {
    for (var i = 0; i < TRIMS.length; i++) {
      if (TRIMS[i].name === name) return TRIMS[i];
    }
    return null;
  };

  // ---- Ladder prices ----

  /*
   * Build LADDER_SIZE price points from a start price and step, working
   * in whole cents so repeated floating-point addition can't drift.
   */
  var priceLadder = function (startPrice, step) {
    var startCents = Math.round(parseFloat(startPrice) * 100);
    var stepCents = Math.round(parseFloat(step) * 100);
    if (!isFinite(startCents) || !isFinite(stepCents)) return null;
    var prices = [];
    for (var i = 0; i < LADDER_SIZE; i++) {
      prices.push(round2((startCents + i * stepCents) / 100));
    }
    return prices;
  };

  // ---- Printing cost ----

  var printingCost = function (options) {
    var format = options.format;
    var pages = Math.floor(Number(options.pages));
    if (format !== EBOOK) {
      var large = options.largeTrim === true;
      var key = format + "|" + (options.ink || INK_BLACK) + "|" +
        (format === PAPERBACK && large ? "large" : "standard");
      var rate = PRINTING_RATES[key];
      if (!rate) {
        throw new Error("no printing rate for " + format + "/" + options.ink);
      }
      if (!(pages > 0)) {
        throw new Error("pages must be a positive number");
      }
      return round2(rate.fixed + rate.perPage * pages);
    }
    return 0;
  };

  // ---- Ebook delivery fee ----

  /*
   * Kindle delivery fee: charged per MB against the 70% tier only.
   * A conservative 1.5 MB default keeps small novels in a sane range.
   */
  var deliveryFee = function (fileSizeMB) {
    var mb = Number(fileSizeMB);
    if (!(mb >= 0) || !isFinite(mb)) return 0;
    return round2(DELIVERY_FEE_PER_MB * mb);
  };

  // ---- Ebook royalty rate ----

  var ebookRoyaltyRate = function (listPrice) {
    var price = Number(listPrice);
    if (price >= EBOOK_70_MIN_PRICE - 1e-9 && price <= EBOOK_70_MAX_PRICE + 1e-9) {
      return ROYALTY_RATE_70;
    }
    return ROYALTY_RATE_35;
  };

  // ---- Per-unit royalty result ----

  /*
   * Returns everything the ladder needs for one price point:
   * royalty, the rate behind it, cost components, tier label, flags.
   */
  var royaltyForPrice = function (plan, listPrice) {
    var price = Number(listPrice);
    if (!(price >= 0) || !isFinite(price)) {
      throw new Error("list price must be a non-negative number");
    }
    var result = {
      format: plan.format,
      listPrice: price,
      royaltyRate: 0,
      printingCost: 0,
      deliveryFee: 0,
      royalty: 0,
      tier: "",
      profitable: false,
      note: ""
    };

    if (plan.format === EBOOK) {
      var rate = ebookRoyaltyRate(price);
      var fee = rate === ROYALTY_RATE_70 ? deliveryFee(plan.fileSizeMB) : 0;
      var royalty = rate * price - fee;
      result.royaltyRate = rate;
      result.royalty = roundMoney(royalty);
      result.deliveryFee = fee;
      result.tier = rate === ROYALTY_RATE_70 ? "70%" : "35%";
      if (price < EBOOK_70_MIN_PRICE) {
        result.note = "under the $2.99 70% floor";
      } else if (price > EBOOK_70_MAX_PRICE) {
        result.note = "over the $9.99 70% ceiling";
      }
    } else {
      var distributionExpanded = plan.format === PAPERBACK && plan.distribution === "expanded";
      var ratePrint = distributionExpanded ? ROYALTY_RATE_EXPANDED : ROYALTY_RATE_PRINT;
      var cost = printingCost({
        format: plan.format,
        pages: plan.pages,
        ink: plan.ink,
        largeTrim: plan.largeTrim
      });
      var royaltyPrint = ratePrint * price - cost;
      result.royaltyRate = ratePrint;
      result.printingCost = cost;
      result.royalty = roundMoney(royaltyPrint);
      result.tier = distributionExpanded ? "40% expanded" : "60% Amazon";
      var minPrice = ratePrint > 0 ? round2(Math.ceil((cost / ratePrint) * 100) / 100) : price;
      if (price < minPrice) {
        result.note = "loses " + formatCurrency(0 - royaltyPrint) + " a copy";
      }
    }

    result.profitable = result.royalty > 0;
    result.minimumViablePrice = plan.format === EBOOK
      ? EBOOK_MIN_LIST_PRICE
      : result.royaltyRate > 0
        ? round2(Math.ceil((result.printingCost / result.royaltyRate) * 100) / 100)
        : 0;
    return result;
  };

  var formatCurrency = function (value) {
    if (typeof value !== "number" || !isFinite(value)) return "—";
    var cents = Math.round(Math.abs(value) * 100);
    var whole = Math.floor(cents / 100);
    var rem = String(cents % 100).padStart(2, "0");
    var text = "$" + whole.toLocaleString("en-US") + "." + rem;
    return value < 0 ? "-" + text : text;
  };

  // ---- Break-even ----

  /*
   * Units needed to cover upfront production costs (editing, cover,
   * ads). Returns null when the royalty never turns positive, or 0
   * when there is nothing upfront to cover.
   */
  var breakEvenUnits = function (upfrontCosts, royaltyPerUnit) {
    var upfront = Number(upfrontCosts);
    var royalty = Number(royaltyPerUnit);
    if (!(royalty > 0)) return null;
    if (!isFinite(upfront) || upfront < 0) return null;
    if (upfront === 0) return 0;
    return Math.ceil(upfront / royalty);
  };

  // ---- Worst-case monthly revenue ----

  var worstCaseMonthlyRevenue = function (pessimisticUnitsPerMonth, royaltyPerUnit) {
    var units = Math.floor(Number(pessimisticUnitsPerMonth));
    var royalty = Number(royaltyPerUnit);
    if (!(units > 0) || !isFinite(royalty)) return 0;
    return round2(units * royalty);
  };

  // ---- Public API ----

  var api = {
    EBOOK: EBOOK,
    PAPERBACK: PAPERBACK,
    HARDCOVER: HARDCOVER,
    FORMATS: FORMATS,
    INK_BLACK: INK_BLACK,
    INK_COLOR: INK_COLOR,
    TRIMS: TRIMS,
    LADDER_SIZE: LADDER_SIZE,
    EBOOK_70_MIN_PRICE: EBOOK_70_MIN_PRICE,
    EBOOK_70_MAX_PRICE: EBOOK_70_MAX_PRICE,
    ROYALTY_RATE_70: ROYALTY_RATE_70,
    ROYALTY_RATE_35: ROYALTY_RATE_35,
    ROYALTY_RATE_PRINT: ROYALTY_RATE_PRINT,
    ROYALTY_RATE_EXPANDED: ROYALTY_RATE_EXPANDED,
    DELIVERY_FEE_PER_MB: DELIVERY_FEE_PER_MB,
    EBOOK_MIN_LIST_PRICE: EBOOK_MIN_LIST_PRICE,
    PAPERBACK_MIN_PAGES: PAPERBACK_MIN_PAGES,
    PAPERBACK_MAX_PAGES: PAPERBACK_MAX_PAGES,
    HARDCOVER_MIN_PAGES: HARDCOVER_MIN_PAGES,
    HARDCOVER_MAX_PAGES: HARDCOVER_MAX_PAGES,

    roundMoney: roundMoney,
    trimByName: trimByName,
    priceLadder: priceLadder,
    printingCost: printingCost,
    deliveryFee: deliveryFee,
    ebookRoyaltyRate: ebookRoyaltyRate,
    royaltyForPrice: royaltyForPrice,
    formatCurrency: formatCurrency,
    breakEvenUnits: breakEvenUnits,
    worstCaseMonthlyRevenue: worstCaseMonthlyRevenue
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.KDPPriceLadderMath = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
