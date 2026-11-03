# kdp-price-ladder-webapp

An offline, single-page webapp that turns KDP pricing into a sliding
ladder: pick your trim, pages, and royalty plan, then slide through
**10 price points** and watch **per-unit royalty, break-even units, and
worst-case monthly revenue** line up side by side.

Built by [Asdale Dynamics, LLC](https://dylanasdale.github.io) —
beginner-friendly AI education, in plain English, step by step, never
condescending. This is a visual sliding companion to the
`kdp-profit-planner` CLI (that one does the planning math; this one is
for *feeling out* a price by moving through it). Its numbers are local
estimates for the US marketplace, not affiliated with Amazon — verify
final figures in your KDP account before you publish a price.

## Why you'd use this

- **See the whole ladder at once** — 10 contiguous price points, from
  your start price up by your step, with the proposed price highlighted
  and a summary card right under the slider.
- **Get honest about the floor** — unprofitable rungs show exactly how
  much you'd lose per copy, and break-even shows "never" when a price
  can't get there.
- **Respect the 70% window** — the ladder flags rungs that fall under
  $2.99 or over $9.99, where the 35% tier kicks in and delivery fees
  stop applying.

## Ladder presets

| Preset | What you get |
| --- | --- |
| **Ebooks under $5** | $0.99 → $4.59 in $0.40 steps before the $5.00 line |
| **The $6.99 sweet spot** | $3.99 → $8.49 in $0.50 steps, straddling $6.99 |
| **$0.99 launch** | $0.99 → $3.59 in $0.30 steps for a launch push |

Or type any **start price** and **step** — the ladder rebuilds itself.

## What each price point shows

- **Royalty / unit** — what Amazon actually pays you per sale:
  - Kindle eBooks: 70% of list between $2.99–$9.99 (minus $0.15/MB
    delivery) or 35% outside that window (no delivery fee).
  - Paperbacks: 60% of list (40% expanded distribution) minus printing
    cost ($0.85 fixed + $0.012/page standard black ink, June 2023 US
    rates; large-trim and color variants included).
  - Hardcovers: 60% minus printing ($5.65 fixed + $0.012/page black).
- **Break-even units** — upfront costs (editing, cover, ads) divided by
  royalty, rounded up.
- **Worst-case monthly revenue** — your pessimistic units/month ×
  royalty. Plan marketing against this column; celebrate upward
  surprises.

Also included: a "How the math works" explainer section, unprofitable
rungs flagged in red, and a dark-on-light print-friendly table.

## Run it

No install, no build, no dependencies. Open it:

```
Open index.html in any modern browser (double-click works — file:// is fine)
```

Everything runs locally in the browser: no network calls, no accounts,
no cookies, no tracking. Your plan (format, pages, trim, ink, file
size, upfront costs, units, ladder start/step, selected rung) is saved
in localStorage and restored on your next visit. Clear site data to
reset.

## Tests

The royalty math is pure JavaScript with its own test suite, runnable
two ways — no dependencies for either:

```bash
node tests/run-tests.js    # 18 unit tests in Node
node tests/smoke-dom.js    # 35 wired-up DOM smoke checks in Node
```

Prefer the browser? Open `tests/test.html` from `file://` — same unit
suite, rendered pass/fail with error details.

## Layout

```
index.html            the whole app (one page)
styles.css            warm, slider-friendly styling
royalty-math.js       pure royalty math (browser + Node)
app.js                UI wiring, presets, localStorage
tests/royalty-tests.js  shared test suite
tests/run-tests.js    Node unit runner
tests/smoke-dom.js    Node DOM smoke runner (stubbed DOM)
tests/test.html       browser test runner
LICENSE               MIT, Copyright (c) 2026 Asdale Dynamics, LLC
```

## Credits & scope notes

Built by **Asdale Dynamics, LLC**, Indiana. Price/rates tables mirror
Amazon's published US figures (ebook royalty tiers and $0.15/MB
delivery; June 2023 print rates), which Amazon revisits occasionally —
re-check the KDP pricing pages before locking in a list price. This
tool estimates; it does not sell, track, or talk to any server.
