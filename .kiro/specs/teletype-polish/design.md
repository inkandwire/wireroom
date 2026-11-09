# Design: teletype-polish

Refines `.kiro/specs/teletype-ui/design.md`. Follows `.kiro/steering/design.md` and `tech.md`. Only the five fixes in `requirements.md`. CSS only except the footer (core) and a small markup change in `index.html`.

## Files

| File | Change |
|---|---|
| `src/core/compose.ts` | Sources footer (fix 5) |
| `src/core/compose.test.ts`, `wireFooter.prop.test.ts`, `wireJson.test.ts` | Update pinned footer text and properties |
| `index.html` | Compact form markup, printer housing wrapper, platen and cap elements |
| `src/ui/tokens.css` | New tokens, smaller radius |
| `src/ui/style.css` | Form, layout, controls |
| `src/ui/printer.css` | Housing, platen, paper feed |
| `.kiro/steering/design.md` | Contrast table rows for new pairs |

`src/ui/printer.ts`, `main.ts` and `src/core` (other than `compose.ts`) are not changed. Existing ids stay: `nameplate-tools`, `notice`, `paper`, `empty`, `status`, `claims`, `add-claim`, `print`, `print-instantly`, `example-sourced`, `example-unsourced`, `body`, and all field ids.

## Fix 5: footer (core)

`sourcesFooter` builds, per claim:

```
N. claim text wrapped by wrapText to 69 columns
   https://example.com/x          <- "   " + URL, one line, never wrapped
```

- Text part: `wrapText(`${i + 1}. ${c.text}`.replace(/\s+/g, " "))`. Continuation lines are not indented (as today).
- URL part: `"   " + c.sourceUrl` appended as the next line. It does not go through `wrapText`, so `splitLongWord` never cuts it.
- Entries with no URL (cannot happen after the gate, but the function takes `ReleasedClaim`) skip the URL line. Implement as `url === "" ? [] : ["   " + url]`.
- Exception to 69 columns: a URL line is `3 + length` columns. If the URL is longer than 66 characters the line is over 69. This is deliberate, because a broken URL is not a link. Put this as a comment at `sourcesFooter` and keep it here. Every other line stays at most 69.
- The body wrapper, claims, `sources` and JSON are untouched.

Test changes:
- `compose.test.ts`: the pinned footer becomes `"1. 500 users"` then `"   https://example.com/users"`.
- `wireJson.test.ts`: the test "keeps the long URL unsplit in JSON while the text splits it" becomes "keeps the long URL whole in JSON and in the text": `parsed.text.split("\n")` contains `"   " + LONG_URL`.
- `wireFooter.prop.test.ts`: replace the "no line over 69" test by: for every claim, `lines.includes("   " + url)`; let `urlLines` be the set of `"   " + url`; every line not in `urlLines` has length at most 69; text ends with `-30-`. Replace the subsequence test by: after `Sources:`, the claim text (whitespace stripped) is a subsequence of the non-URL footer lines joined, and URLs appear in order. A claim text equal to a URL line cannot be told apart by the test; the arbitrary text is ASCII and starts with `N. `, so a non-URL line can match `"   " + url` only by chance with zero impact on the 69-column check, because the check exempts exactly those lines.

## Fix 1: textarea

Likely cause (to confirm from the screenshot): the shared `input, select, textarea` rule sets `min-height: var(--tap)` and the font stack `--font-ui` with a fixed 24px line height, while the textarea has `rows="6"` and a `min-height` of 88px; the box is 160px with 8px padding, so the content height is not a whole number of lines and the first line sits against the top border.

Fix: the textarea gets `font-family: var(--font-paper)`, `line-height: 1.5` (24px at 16px), `padding-block: var(--space-2)`, `block-size: calc(5 * 1.5em + 2 * var(--space-2) + 2 * var(--border-control))` (the 5-line minimum, a whole number of lines) with `resize: vertical`, and `scroll-padding-block: var(--space-2)`. The shared `min-height` rule is not applied to it. The maintainer checks the first line at 390 and 1440.

## Fix 2: layout rebalance

Desktop grid stays `minmax(320px, 400px) minmax(0, 1fr)`. Changes:

- Heading row: `.compose > h2` and the two example buttons sit in one flex row (the buttons move from `.actions-examples` into a `.compose-head` wrapper in `index.html`; ids and `aria-describedby` stay). The sample-data note shrinks to one short hint under the row.
- Rows: city + priority already a `.field-pair`; embargo date + time already a pair, with the embargo hint cut to "UTC. Empty date: release now."
- Hints shortened: body "Blank line between paragraphs."; claims "Each claim needs a source URL."
- Claim row: text and URL stacked, Remove as a small key on the row's first line (right aligned). `#claims` gets `max-height: calc(3 * var(--claim-row-h))` and `overflow-y: auto`. The row height token is measured by the maintainer.
- Height budget at 900px (estimate, the maintainer measures): nameplate 72, page padding 16 + 24, heading row 44, actions bar 56, city/priority 68, headline 68, body 150, claims block (legend, hint, one row, Add claim) about 220, embargo 100. Sum about 820, below 900. If it is over, drop the claims hint first, then the nameplate tagline on desktop.
- Printer column: `.printer` is sticky with `top: var(--space-5)` and `height: calc(100dvh - var(--chrome-h))`, where `--chrome-h` is the nameplate plus page padding (token, measured). It is a flex column: the bar and platen take their height, `.paper-stage` takes `flex: 1 1 auto; min-height: 0`, and `.paper` takes the rest with `max-height: none` and `overflow: auto`. A long item scrolls inside; the page height is fixed by the viewport.
- Phone: unchanged: one column, `--paper-max-height` stays for the paper, the housing sits above the paper.

## Fix 3: platen and paper feed

Markup (new wrappers only; existing nodes move inside):

```html
<section class="printer" aria-labelledby="printer-title">
  <div class="printer-body">
    <div class="printer-bar">
      <h2 id="printer-title">Printer</h2>
      <div id="nameplate-tools" class="nameplate-tools"></div>  <!-- moved from the header -->
    </div>
    <div class="platen" aria-hidden="true"><i class="platen-cap"></i><i class="platen-roll"></i><i class="platen-cap"></i></div>
    <div id="notice" ...></div>
    <div class="paper-stage"> ... existing .paper-wrap / #paper ... </div>
  </div>
</section>
```

- `#nameplate-tools` moves from the header into the bar (same id, so `main.ts` finds it). The header keeps the `h1` and the tagline; its grid loses the tools area. The bar is the printer nameplate ("Printer" plate in `--accent` text on `--desk-dark`? no: `--ink` on `--accent`, 8.84:1, as the nameplate).
- `.printer-body`: `--desk` body with a lighter top edge and darker bottom edge (inset `box-shadow`), radius `--radius-housing` (2px), border `var(--border-control)` in `--edge`. Rounded-square bar: `--radius-bar` (4px).
- Platen: `.platen-roll` is a flex bar 28px high with `linear-gradient(to bottom, ...)` bands from `--roller-hi` through `--roller-mid` to `--roller-lo` (cylinder shading) and a 1px slot line (`--desk-dark`) at the bottom. `.platen-cap` is a 14px wide brass block (`--accent` to `--brass-dark` gradient). All CSS, no images. `pointer-events: none`.
- Paper tucked under the roller: the platen has `position: relative; z-index: 1` and `margin-bottom: calc(-1 * var(--slot-overlap))` (6px). The paper stage starts at the platen bottom, so the paper top edge is covered by the roller and no desk shows between them. The platen's `::after` is a soft shadow: `linear-gradient(to bottom, var(--shadow-ink), transparent)` 10px high placed under the roller on the paper.
- The old `.paper-slot` element stays in the DOM (hidden by CSS, `display: none`) so nothing that queries it breaks.
- Housing and notice: `.notice` keeps `--field` fill and its `--stamp` border, so it stays readable on `--desk` (the stamp is only on `--field`). The HOLD stamp stays inside the paper, as now.
- Reduced motion: nothing animates in the housing; the existing media query already sets `animation: none` and `transition: none`.

## Fix 4: period controls (CSS only)

- Radius: `--radius-control` goes from 6px to 2px (token change), so all controls change at once. Fieldsets use the same token.
- Fields: `border: 2px solid var(--edge)` plus `box-shadow: inset 0 0 0 1px var(--field-rim), inset 0 2px 3px var(--field-shadow)` (stepped double border and a dark inner shadow). Fill stays `--field`. Font `var(--font-paper)` 16px. `--edge` on `--desk` stays 4.74:1.
- Labels: `font-family: var(--font-paper)`, 14px, uppercase, `letter-spacing: 0.08em`.
- Select: keeps `appearance: none` and the drawn arrow (`.select-wrap::after`).
- Keycap Print (`.btn--primary`): `background: var(--accent)`, `border: 0`, `border-bottom: 3px solid var(--brass-dark)`, radius 2px. `:active` gives `transform: translateY(2px); border-bottom-width: 1px;`. Transition lists `transform`, at most 120ms.
- Secondary keys (`.btn`): `--key` fill with `--paper` text, `border-bottom: 3px solid var(--key-dark)`, 14px text, same `:active`. Hover lightens to `--key-hi`. Dashed edge for `aria-disabled` stays (printer.css).
- Tap targets: phone (below 900px) keeps `min-height: var(--tap)`. Desktop secondary keys use `min-height: 32px`, which is above the 24px minimum. Controls stay at 16px; secondary keys use 14px bold only for the label inside a key (labels in keys are controls text: the requirement says 16px, so keys use 16px too; shrinking is done by padding, not font).

## New tokens

| Token | Hex | Use |
|---|---|---|
| `--brass-dark` | `#9A7220` | keycap bottom edge, cap shade |
| `--key` | `#4F5E55` | secondary key fill |
| `--key-hi` | `#5E6F65` | secondary key hover |
| `--key-dark` | `#2A332E` | secondary key bottom edge |
| `--roller-hi` | `#4A4F4B` | platen highlight band |
| `--roller-mid` | `#232826` | platen mid band |
| `--roller-lo` | `#0F1210` | platen lower band |
| `--field-rim` | `#D9D0B0` | inner rim of a field |
| `--field-shadow` | `rgba(27, 25, 21, 0.45)` | inner shadow of a field |
| `--shadow-ink` | `rgba(15, 18, 16, 0.45)` | roller shadow on paper |
| `--radius-housing`, `--radius-bar` | 2px, 4px | housing |
| `--slot-overlap`, `--claim-row-h`, `--chrome-h` | measured | layout |

Hex values are proposals. Task 4 computes the ratios (WCAG 2.x) and writes them into the contrast table of `.kiro/steering/design.md`. Pairs to list: `--paper` on `--key` (needs 4.5:1), `--ink` on `--accent` (unchanged, 8.84:1), `--edge` on `--desk` (unchanged, 4.74:1), `--accent` focus ring on `--key` and on `--desk-dark` (3:1), `--field-rim` is decoration. Roller colours carry no text and need no ratio. If a proposed `--key` fails 4.5:1 with `--paper`, darken it until it passes.

## Test plan

- Core: `npm test` (fast-check properties above). No UI unit tests, since this is CSS and markup.
- Maintainer: `npm run build`, then screenshots at 1440x900 and 390x844 after each task, plus `document.documentElement.scrollHeight` (1440x900, empty) and `scrollWidth` (390).
