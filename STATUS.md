# STATUS.md

## What was built

**kdp-price-ladder-webapp** — an offline single-page webapp for KDP
pricing ladders, as a visual companion to the `kdp-profit-planner`
planning CLI. Built by Asdale Dynamics, LLC as a small-business/author
tool. Pure HTML/JS/CSS, zero dependencies, works straight from
`file://`; no network calls, no secrets, no personal data anywhere in
the codebase.

Core experience:

- Enter a royalty plan: format (Kindle eBook / paperback / hardcover),
  trim size (12 trims with large-trim awareness), page count, ink,
  distribution channel, Kindle file size (MB), upfront costs, and a
  pessimistic units/month estimate.
- Slide through 10 contiguous price points (start + step, whole-cent
  math) with a highlighted rung, keyboard/slider navigation, and
  click-to-select rows.
- Per rung, side by side: per-unit royalty (with tier badge — 70%/35%
  ebook, 60% Amazon / 40% expanded print), break-even units (or
  "never" when a rung can't cover costs), and worst-case monthly
  revenue.
- Three ladder presets: **Ebooks under $5** ($0.99 + $0.40 × 9 = $4.59),
  **The $6.99 sweet spot** ($3.99 + $0.50 × 9 = $8.49), and
  **$0.99 launch** ($0.99 + $0.30 × 9 = $3.59).
- Under-the-hood honesty: unprofitable rungs flagged with the loss per
  copy, 70%-window boundary notes, minimum viable print prices, and a
  plain-English "How the math works" section.
- State auto-saves to localStorage (single versioned key, restores on
  revisit) — the whole plan survives reloads and browser restarts.

Reference rates (all in `royalty-math.js`, one inspectable place):
Amazon US ebook royalty tiers 70% ($2.99–$9.99) / 35% with $0.15/MB
delivery; June 2023 print rates — paperback black $0.85 + $0.012/page
($1.00 fixed for large trim), paperback color, hardcover $5.65 +
$0.012/page (color $8.87 + $0.065/page).

## Layout

```
index.html            the app: plan form, ladder slider, spotlight
                      card, 10-row ladder table, math explainer
styles.css            warm light theme, responsive, print-friendly
royalty-math.js       pure royalty math (ES5-ish, browser + Node)
app.js                UI wiring, presets, localStorage persistence
tests/royalty-tests.js  shared royalty test suite (18 tests)
tests/run-tests.js    Node unit runner
tests/smoke-dom.js    Node smoke test with a stubbed DOM (35 checks)
tests/test.html       browser test runner (openable from file://)
LICENSE               MIT, Copyright (c) 2026 Asdale Dynamics, LLC
README.md             usage, math explainer, credits
```

## How to run

```bash
# use it
open index.html          # any modern browser; double-clicking works
                         # (pure static files — file:// is fine)

# test it
node tests/run-tests.js  # unit suite: 18/18 pass
node tests/smoke-dom.js  # smoke suite: 35/35 pass
```

## Verification results

- `node --check` clean on `royalty-math.js` and `app.js`.
- `node tests/run-tests.js` → **18 passed, 0 failed**: ebook tier
  window (2.99/9.99 inclusive), 70% royalty minus rounded delivery
  fee, 35% without delivery, delivery fee sinking a big-file 70%
  margin, print cost table (standard/large/color/hardcover), 60%/40%
  print royalties, minimum viable price, unprofitable flagging, ladder
  whole-cent math (incl. non-drifting 0.10 steps), break-even edge
  cases (0 upfront → 0, negative/garbage royalty → null, garbage
  upfront → null), worst-case revenue, trim lookup, currency
  formatting, and error paths for invalid prices.
- `node tests/smoke-dom.js` → **35 passed, 0 failed**: boots with
  defaults ($6.49 highlight, 70% tier, $4.31 royalty, 117 units
  break-even, $43.10 worst-case), preset clicks rebuild the ladder,
  format switch flips tiers and prints a paperback loss, slider and
  row-click navigation update spotlight + table + localStorage across
  the run, expanded distribution switches to 40%, and a 50 MB ebook
  correctly sinks a $3.99 price into "never breaks even".
- `tests/test.html` provides the browser runner for the unit suite
  (checked for script-order and hash-based title self-check).
- Cross-checked arithmetic by hand: 280-page black paperback = $4.21
  cost; $6.49 ebook with 1.5 MB file → 4.543 − 0.23 = $4.31 royalty;
  $500 upfront → ceil(500/4.31) = 117 units.

## Known gaps

- Rates are Amazon's published US marketplace figures baked into
  `royalty-math.js`; Amazon updates them periodically and
  international marketplaces differ (different royalty band windows,
  currency conversion, VAT/OSS). Re-check KDP pricing pages before
  finalizing a list price.
- No per-marketplace selection (GBP/EUR etc.), no UK/EU ebook tiers,
  KDP Select exclusivity bonuses, or print-included-in-kindle
  bundling.
- No custom fixed/per-page cost overrides (the companion CLI
  `kdp-profit-planner` supports overrides if you need them).
- File size must be typed in; it isn't estimated from a manuscript
  (epub MB depends heavily on images and embedded fonts).
- Words-per-page estimation and manuscript-word-count → page-count
  features are intentionally left to `kdp-profit-planner`; this tool
  takes a final page count.
- Browser test runner covers the pure math suite (not the DOM smoke
  harness, which exists as a Node script).
