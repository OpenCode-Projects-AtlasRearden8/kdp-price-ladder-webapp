#!/usr/bin/env node
/*
 * run-tests.js — zero-dependency node runner for the royalty suite.
 * Usage: node tests/run-tests.js
 */
"use strict";

var path = require("path");
var math = require("../royalty-math.js");
var suite = require("./royalty-tests.js");

var passed = 0;
var failed = 0;

var t = {
  assert: function (condition, message) {
    if (condition) return;
    throw new Error(message || "assertion failed");
  },
  equal: function (actual, expected, message) {
    var ok = actual === expected && typeof actual === typeof expected;
    if (ok) return;
    throw new Error(
      (message || "not equal") + ": expected [" + expected + "], got [" + actual + "]"
    );
  },
  test: function (name, fn) {
    try {
      fn();
      passed++;
      console.log("  ok - " + name);
    } catch (err) {
      failed++;
      console.log("FAIL  - " + name + "\n        " + err.message);
    }
  }
};

suite.runSuite(math, t);

console.log(
  "\n" + passed + " passed, " + failed + " failed" +
  (failed ? " — see FAIL lines above." : " — royalty math checks out.")
);

process.exit(failed ? 1 : 0);
