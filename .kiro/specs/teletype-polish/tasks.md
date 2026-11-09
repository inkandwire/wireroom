# Tasks: teletype-polish

Note: the agent running a task cannot run shell commands. Each task only writes files, including its own tests. Do not add install or run steps. The maintainer runs `npm test` and `npm run build` outside Kiro, and sends back screenshots (1440x900 and 390x844) and observations after each task.

Rules for every task: add no dependency, no web font, no image; use CSS gradients only; no `transition: all`; honour `prefers-reduced-motion`; use tokens, not raw hex; keep every existing element id and class used by `src/ui/printer.ts` and `src/ui/main.ts`; do not change `printer.ts`, `main.ts`, the claim gate, the embargo rules or the JSON fields; follow `.kiro/steering/design.md` and `tech.md`.

- [x] 1. Sources footer and textarea (fixes 5 and 1)
  - Files: `src/core/compose.ts`, `src/core/compose.test.ts`, `src/core/wireFooter.prop.test.ts`, `src/core/wireJson.test.ts`, `src/ui/style.css`.
  - Change `sourcesFooter` as in design.md: numbered claim text wrapped to 69 columns, then `"   " + url` on its own line, never wrapped; no URL line when there is no URL; comment the over-69 exception for URLs longer than 66 characters.
  - Update the three test files as in design.md. Properties: every URL appears whole on a line `"   " + url`; every other line is at most 69 columns; text ends with `-30-`; deterministic.
  - Fix the `#body` textarea in `style.css` (paper mono font, whole-line height for at least 5 lines, vertical padding, no `min-height` clash).
  - Requirements: 1.1 to 1.4, 2.1 to 2.4, 3.1 to 3.3.
  - Maintainer checks: `npm test` and `npm run build` pass; screenshots at 1440x900 and 390x844 show the first body line in full (also after scrolling the textarea to the top); a printed example shows each URL on its own line, indented 3 spaces.

- [ ] 2. Layout rebalance (fix 2)
  - Files: `index.html` (`.compose-head` row with heading and example buttons, shorter hints), `src/ui/style.css`, `src/ui/tokens.css` (layout tokens).
  - Compact form from 900px: pairs on one row, examples next to the heading, claim row with Remove on its first line, `#claims` with `max-height` and in-form scroll, sticky full-height printer column whose paper scrolls inside it. Phone stays one column.
  - Requirements: 4.1 to 4.4, 5.1 to 5.3.
  - Maintainer checks: at 1440x900 with one claim row and an empty printer, `scrollHeight <= innerHeight` and Print and embargo are visible; adding 6 claim rows scrolls only the claims list; a long printed item does not change page height; at 390x844 one column and `scrollWidth <= innerWidth`. Sends the measured values.

- [ ] 3. Platen and paper feed (fix 3)
  - Files: `index.html` (printer housing wrapper, bar, platen; `#nameplate-tools` moved into the bar, same id), `src/ui/printer.css`, `src/ui/style.css` (header grid without the tools area), `src/ui/tokens.css` (roller, brass, shadow tokens).
  - Housing, rounded-square bar, CSS-only platen with brass caps and slot line, paper tucked under the roller with a soft shadow and no gap. `.paper-slot` stays in the DOM, hidden. Check the HOLD stamp and the rejection notice on the new housing.
  - Requirements: 6.1 to 6.3, 7.1 to 7.4, 8.1, 8.2.
  - Maintainer checks: screenshots (1440x900 and 390x844) of the empty printer, a printed and cut item, a HELD item and a rejection; no gap between roller and paper; BELL label and mute toggle work in the bar; reduced motion on shows no animation.

- [ ] 4. Period-style controls and final contrast check (fix 4)
  - Files: `src/ui/style.css`, `src/ui/printer.css`, `src/ui/tokens.css`, `.kiro/steering/design.md`.
  - Square 2px corners, recessed fields (double border, inner shadow), paper mono 16px field text, typewriter labels, keycap Print (3px dark bottom edge, 2px press), smaller grey-green secondary keys, select keeps `appearance: none` and its arrow, focus ring stays brass 3px with 2px offset, phone tap targets 44px.
  - Compute the WCAG 2.x ratio of every new pair and add the rows to the contrast table in `.kiro/steering/design.md`; adjust a token until text pairs reach 4.5:1 and borders and focus rings 3:1. Re-read `tokens.css` for any raw hex left in components.
  - Requirements: 9.1 to 9.4, 10.1 to 10.3, 11.1 to 11.3, 12.1 to 12.3.
  - Maintainer checks: `npm test` and `npm run build`; screenshots at 1440x900 and 390x844 of the empty page, the page with focus on a field and on Print, and a pressed Print key; keyboard-only run through fill, print, skip and mute; tap targets at 390px are at least 44px.
