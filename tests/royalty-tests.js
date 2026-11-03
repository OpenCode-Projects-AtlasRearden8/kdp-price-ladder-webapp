/*
 * royalty-tests.js — the royalty math test suite.
 *
 * One suite, two runners: upload nothing, install nothing.
 *   - Browser: open tests/test.html from file://
 *   - Node:    node tests/run-tests.js
 */
(function (global) {
  "use strict";

  var approx = function (actual, expected, tolerance) {
    var tol = tolerance === undefined ? 1e-9 : tolerance;
    return Math.abs(actual - expected) <= tol;
  };

  /*
   * runSuite(math, t) — t provides test(name, fn) and the assertion
   * helpers. Throws on first failure (browser harness catches per test;
   * node harness reports and exits non-zero).
   */
  var runSuite = function (math, t) {
    var assert = t.assert;
    var equal = t.equal;

    t.test("formats and reference constants are exposed", function () {
      deepArrays(math.FORMATS, ["ebook", "paperback", "hardcover"]);
      equal(math.ROYALTY_RATE_70, 0.7);
      equal(math.ROYALTY_RATE_35, 0.35);
      equal(math.ROYALTY_RATE_PRINT, 0.6);
      equal(math.ROYALTY_RATE_EXPANDED, 0.4);
      equal(math.DELIVERY_FEE_PER_MB, 0.15);
      equal(math.LADDER_SIZE, 10);
    });
    function deepArrays(actual, expected) {
      assert(actual.length === expected.length, "format list length");
      for (var i = 0; i < expected.length; i++) {
        assert(actual[i] === expected[i], "format item " + expected[i]);
      }
    }

    t.test("ebook 70% tier window (2.99 to 9.99 inclusive)", function () {
      equal(math.ebookRoyaltyRate(2.98), 0.35);
      equal(math.ebookRoyaltyRate(2.99), 0.7);
      equal(math.ebookRoyaltyRate(6.99), 0.7);
      equal(math.ebookRoyaltyRate(9.99), 0.7);
      equal(math.ebookRoyaltyRate(10.0), 0.35);
      equal(math.ebookRoyaltyRate(0.99), 0.35);
    });

    t.test("ebook royalty: 70% rate minus delivery fee", function () {
      var plan = { format: math.EBOOK, fileSizeMB: 2 };
      var r = math.royaltyForPrice(plan, 6.99);
      // 6.99 * 0.70 = 4.893 - 0.30 delivery = 4.593 -> 4.59
      equal(r.royalty, 4.59);
      equal(r.deliveryFee, 0.3);
      equal(r.tier, "70%");
      assert(r.profitable);
      equal(r.royaltyRate, 0.7);

      var free = math.royaltyForPrice({ format: math.EBOOK, fileSizeMB: 0 }, 6.99);
      approx(free.royalty, 4.893);
      equal(free.deliveryFee, 0);
    });

    t.test("ebook royalty: 35% tier has no delivery fee", function () {
      var plan = { format: math.EBOOK, fileSizeMB: 5 };
      var low = math.royaltyForPrice(plan, 0.99);
      // 0.99 * 0.35 = 0.3465 -> 0.35
      equal(low.royalty, 0.35);
      equal(low.deliveryFee, 0);
      equal(low.tier, "35%");
      assert(low.profitable);

      var high = math.royaltyForPrice(plan, 12.99);
      equal(high.royalty, 4.55); // 12.99 * 0.35 = 4.5465
      equal(high.tier, "35%");
      assert(high.note.length > 0, "flags above-ceiling prices");
    });

    t.test("ebook royalty: delivery fee can sink the 70% margin", function () {
      var plan = { format: math.EBOOK, fileSizeMB: 50 };
      var r = math.royaltyForPrice(plan, 4.5);
      // 4.5 * 0.70 = 3.15 - 7.50 delivery = -4.35
      equal(r.royalty, -4.35);
      assert(!r.profitable, "large files can lose money on the 70% tier");
    });

    t.test("delivery fee is 15 cents per MB, rounded to cents", function () {
      equal(math.deliveryFee(1), 0.15);
      equal(math.deliveryFee(10), 1.5);
      equal(math.deliveryFee(3.33), 0.5); // 0.4995 -> 0.50
      equal(math.deliveryFee(0), 0);
      equal(math.deliveryFee(-4), 0, "negative sizes fall back to zero");
    });

    t.test("paperback printing cost: June 2023 US rates", function () {
      equal(math.printingCost({ format: math.PAPERBACK, pages: 280, ink: math.INK_BLACK, largeTrim: false }), 4.21);
      equal(math.printingCost({ format: math.PAPERBACK, pages: 100, ink: math.INK_BLACK, largeTrim: true }), 2.2);
      equal(math.printingCost({ format: math.PAPERBACK, pages: 200, ink: math.INK_COLOR, largeTrim: false }), 12.35);
      equal(math.printingCost({ format: math.HARDCOVER, pages: 200, ink: math.INK_BLACK }), 8.05);
    });

    t.test("paperback royalty: 60% of list minus printing cost", function () {
      var plan = {
        format: math.PAPERBACK,
        pages: 280,
        ink: math.INK_BLACK,
        largeTrim: false,
        distribution: "amazon"
      };
      var r = math.royaltyForPrice(plan, 12.99);
      // 12.99 * 0.60 = 7.794 - 4.21 = 3.584
      equal(r.royalty, 3.58);
      equal(r.printingCost, 4.21);
      equal(r.tier, "60% Amazon");
      assert(r.profitable);
      // Minimum viable list price: 4.21 / 0.60 = 7.0166... -> ceil to 7.02
      equal(r.minimumViablePrice, 7.02);
    });

    t.test("paperback expanded distribution uses 40%", function () {
      var plan = {
        format: math.PAPERBACK,
        pages: 200,
        ink: math.INK_BLACK,
        largeTrim: false,
        distribution: "expanded"
      };
      var r = math.royaltyForPrice(plan, 12.99);
      // 12.99 * 0.40 = 5.196 - 3.25 = 1.946
      equal(r.royalty, 1.95);
      equal(r.tier, "40% expanded");
    });

    t.test("unprofitable print prices are flagged", function () {
      var plan = { format: math.PAPERBACK, pages: 280, ink: math.INK_BLACK, largeTrim: false };
      var r = math.royaltyForPrice(plan, 6.99);
      // 6.99 * 0.60 = 4.194 - 4.21 = -0.016
      assert(approx(r.royalty, -0.02, 0.01));
      assert(!r.profitable);
      assert(r.note.length > 0, "explains the loss");
    });

    t.test("price ladder: whole-cent math over 10 points", function () {
      var ladder = math.priceLadder(0.99, 0.4);
      deepArrays(ladder, [0.99, 1.39, 1.79, 2.19, 2.59, 2.99, 3.39, 3.79, 4.19, 4.59]);
      var sweet = math.priceLadder(3.99, 0.5);
      equal(sweet[3], 5.49);
      deepArrays(sweet, [3.99, 4.49, 4.99, 5.49, 5.99, 6.49, 6.99, 7.49, 7.99, 8.49]);
      // Floating-point step 0.1 must not drift: 12.01 stays 12.01 on point 10
      equal(math.priceLadder(11.2, 0.1)[9], 12.1);
      equal(math.priceLadder(11.2, 0.1)[5], 11.7);
    });

    t.test("price ladder handles bad input without crashing", function () {
      assert(math.priceLadder("", "") === null);
      assert(math.priceLadder(NaN, 1) === null);
    });

    t.test("break-even units cover upfront costs at the asking royalty", function () {
      equal(math.breakEvenUnits(500, 4.59), 109); // 500/4.59 = 108.93 -> 109
      equal(math.breakEvenUnits(100, 1.0), 100);
      equal(math.breakEvenUnits(0, 4.5), 0, "nothing upfront, nothing to cover");
      equal(math.breakEvenUnits(50, -1), null, "negative royalty never breaks even");
      equal(math.breakEvenUnits(50, 0), null);
      assert(math.breakEvenUnits("oops", 4.5) === null, "garbage input is safe");
    });

    t.test("worst-case monthly revenue scales royalty by pessimistic units", function () {
      equal(math.worstCaseMonthlyRevenue(10, 4.59), 45.9);
      equal(math.worstCaseMonthlyRevenue(25, 0.35), 8.75);
      equal(math.worstCaseMonthlyRevenue(0, 4.5), 0);
      assert(math.worstCaseMonthlyRevenue(-3, 4.5) === 0);
    });

    t.test("roundMoney keeps money to two decimals", function () {
      equal(math.roundMoney(4.893), 4.89);
      equal(math.roundMoney(3.555), 3.56);
      assert(math.roundMoney(Infinity) === Infinity, "non-finite passes through untouched");
    });

    t.test("trim lookup returns known trims and nulls unknowns", function () {
      var six9 = math.trimByName("6x9");
      assert(six9 && !six9.large, "6x9 is a standard trim");
      assert(math.trimByName("8.5x11").large, "8.5x11 is a large trim");
      equal(math.trimByName("12x42"), null);
    });

    t.test("currency formatting", function () {
      equal(math.formatCurrency(4.59), "$4.59");
      equal(math.formatCurrency(1234.5), "$1,234.50");
      equal(math.formatCurrency(-0.05), "-$0.05");
      equal(math.formatCurrency(0), "$0.00");
      equal(math.formatCurrency(NaN), "—");
    });

    t.test("invalid list price throws a readable error", function () {
      var raised = false;
      try {
        math.royaltyForPrice({ format: math.EBOOK, fileSizeMB: 1 }, -3);
      } catch (err) {
        raised = true;
        assert(err.message.indexOf("non-negative") !== -1);
      }
      assert(raised, "rejects negative prices");
    });
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { runSuite: runSuite };
  } else {
    global.RoyaltySuite = { runSuite: runSuite };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
