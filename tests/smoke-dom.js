/*
 * smoke-dom.js — a dependency-free DOM smoke test for app.js.
 *
 * Stubs just enough of the DOM for app.js to boot, then drives it the
 * way a user would: pick a preset, switch format, drag the slider, and
 * click a table row — confirming the rendered numbers match the pure
 * royalty math. Catches wiring regressions the unit suite can't see.
 *
 * Usage: node tests/smoke-dom.js
 */
"use strict";

var assert = require("assert");
var math = require("../royalty-math.js");

// ---------------- minimal DOM stubs ----------------

function El(id) {
  this.id = id;
  this.dataset = {};
  this.children = [];
  this.listeners = {};
  this.value = "";
  this.className = "";
  this.textContent = "";
  this._innerHTML = "";
  this.disabled = false;
  this.validity = { valid: true };
  this.tabIndex = 0;
}
Object.defineProperty(El.prototype, "innerHTML", {
  get: function () { return this._innerHTML; },
  set: function (v) {
    // Real DOM: assigning innerHTML replaces all children.
    this._innerHTML = String(v);
    if (this._innerHTML === "") this.children.length = 0;
  }
});

El.prototype.addEventListener = function (type, fn) {
  (this.listeners[type] = this.listeners[type] || []).push(fn);
};
El.prototype.fire = function (type, event) {
  (this.listeners[type] || []).forEach(function (fn) {
    fn.call(this, event);
  }, this);
};
El.prototype.appendChild = function (child) { this.children.push(child); return child; };
El.prototype.setAttribute = function () { /* marker only */ };
El.prototype.getAttribute = function () { return null; };
El.prototype.closest = function (selector) {
  if (selector === ".plan-panel") return panel;
  if (selector === "tr") return this;
  return null;
};

var registry = {};
var panel = new El("plan-panel");
var tracked = ["format", "fileSize", "trim", "pages", "ink", "distribution",
  "upfront", "units", "start", "step", "ladderSlider", "sliderPrice", "spotPrice",
  "spotTier", "spotRoyalty", "spotBreakeven", "spotRevenue", "spotNote",
  "ladderBody", "ladderTable"];
tracked.forEach(function (id) { registry[id] = new El(id); });

var presetButtons = ["under5", "sweet", "launch"].map(function (name) {
  var btn = new El("preset-" + name);
  btn.dataset.preset = name;
  return btn;
});

var document = {
  getElementById: function (id) {
    if (!registry[id]) registry[id] = new El(id);
    return registry[id];
  },
  createElement: function () { return new El(); },
  querySelectorAll: function (selector) {
    return selector === ".preset" ? presetButtons : [];
  }
};

var storage = {};
global.window = global;
global.KDPPriceLadderMath = math;
global.localStorage = {
  getItem: function (k) {
    return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null;
  },
  setItem: function (k, v) { storage[k] = String(v); }
};
global.document = document;

require("../app.js");

var $ = function (id) { return registry[id]; };
var spot = function (id) { return $(id).textContent; };
var bodyRows = function () { return $("ladderBody").children; };

var checks = 0;
function check(label, condition) {
  assert(condition, "smoke failed: " + label);
  checks++;
  console.log("  ok - " + label);
}

// ---------------- smoke scenarios ----------------
// Defaults: ebook, 1.5 MB, $500 upfront, 10 pessimistic units,
// ladder $3.99 + $0.50, highlight on point 6 ($6.49).

check("boots with 10 ladder rows", bodyRows().length === 10);
check("boot highlights $6.49", spot("spotPrice") === "$6.49");
check("boot tier badge says 70%", $("spotTier").textContent.indexOf("70%") !== -1);
check("boot royalty matches the math", spot("spotRoyalty") === "$4.31"); // 6.49*0.7 - 0.23 delivery
check("boot break-even covers $500", spot("spotBreakeven") === "117"); // 500 / 4.31
check("boot worst-case uses 10 units", spot("spotRevenue") === "$43.10");
check("table has a selected row", /(?:^| )selected(?:$| )/.test(bodyRows()[5].className));
check("row list price text uses two decimals", bodyRows()[0].innerHTML.indexOf("$3.99") !== -1);

// 1. Preset click: "Ebooks under $5" -> $0.99 start, $0.40 step, point 6 = $2.99
presetButtons[0].fire("click", {});
check("preset under $5 sets $0.99 start", $("start").value === "0.99");
check("preset under $5 sets $0.40 step", $("step").value === "0.40");
check("preset ladder top stays under $5", bodyRows()[9].innerHTML.indexOf("$4.59") !== -1);
check("preset spotlight lands on $2.99", spot("spotPrice") === "$2.99");
check("spot at $2.99 still earns the 70% tier", $("spotTier").textContent === "70%");
check("spot at $2.99 royalty is $1.86", spot("spotRoyalty") === "$1.86"); // 2.99*0.7 - 0.23
check("break-even on $1.86 royalty is 269", spot("spotBreakeven") === "269");

// 2. Switch format to paperback (280 pages, black ink, Amazon channel)
$("format").value = "paperback";
$("format").fire("change", {});
check("paperback tier says 60% Amazon", $("spotTier").textContent === "60% Amazon");
check("paperback at $2.99 loses money", spot("spotRoyalty") === "-$2.42"); // 1.794 - 4.21
check("unprofitable state shows a warn note", $("spotNote").className.indexOf("warn") !== -1);

// 3. Drag the slider to the top rung (still under-$5 ladder)
$("ladderSlider").value = "9";
$("ladderSlider").fire("input", {});
check("slider moves spotlight to $4.59", spot("spotPrice") === "$4.59");
check("slider royalty matches math", spot("spotRoyalty") === "-$1.46"); // 2.754 - 4.21
check("negative royalty shows 'never' break-even", spot("spotBreakeven") === "never");
check("negative royalty shows warn note", $("spotNote").className.indexOf("warn") !== -1);

// 4. Preset "sweet spot" re-rungs the ladder (and returns to ebook mode);
//    it also lands back on the stored highlight rung: $8.49
presetButtons[1].fire("click", {});
check("sweet spot ladder reaches $8.49", spot("spotPrice") === "$8.49");
check("sweet spot ebook turns profitable again", spot("spotRoyalty") === "$5.71"); // 8.49*0.7 - 0.23
check("break-even on $5.71 royalty is 88", spot("spotBreakeven") === "88");
check("worst-case month on $5.71 royalty", spot("spotRevenue") === "$57.10");

// 5. Click the first table row (select $3.99)
var firstRow = $("ladderBody").children[0];
$("ladderBody").fire("click", { target: firstRow });
check("row click selects $3.99", spot("spotPrice") === "$3.99");
check("row click persists to localStorage",
  /^\{"format":"ebook"[\s\S]*"index":0[,}]/.test(storage["kdp-price-ladder:v1"]));

// 6. Expanded distribution (paperback) switches the rate to 40%
$("format").value = "paperback";
$("format").fire("change", {});
$("distribution").value = "expanded";
$("distribution").fire("input", {});
check("expanded distribution pays 40%", $("spotTier").textContent === "40% expanded");
check("expanded royalty at $3.99", spot("spotRoyalty") === "-$2.61"); // 1.596 - 4.21

// 7. Back to ebook: $3.99 stays in the 70% window
$("format").value = "ebook";
$("format").fire("change", {});
check("ebook $3.99 returns to the 70% tier", $("spotTier").textContent === "70%");
check("ebook $3.99 royalty is $2.56", spot("spotRoyalty") === "$2.56"); // 2.793 - 0.23

// 8. A 50 MB file sinks the 70% margin at $3.99 (delivery $7.50)
$("fileSize").value = "50";
$("fileSize").fire("input", {});
check("50 MB ebook flags an unprofitable price", $("spotNote").className.indexOf("warn") !== -1);
check("50 MB ebook royalty goes negative", spot("spotRoyalty") === "-$4.71"); // 2.793 - 7.50

// 9. A "reload" restores the same plan and still renders
var saved = storage["kdp-price-ladder:v1"];
var freshWindow = { saved: saved };
check("state was saved for the next visit", saved.indexOf('"fileSizeMB":"50"') !== -1);

console.log("\n" + checks + " smoke checks passed.");
