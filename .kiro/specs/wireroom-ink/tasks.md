# Tasks: wireroom-ink

Note: the agent running a task cannot run shell commands. Each task only writes files, including its own tests. Do not add install or run steps. The maintainer runs `npm test` and `npm run build`, takes screenshots at 1440x900, 820x1180 and 390x844, and sends observations after each task.

Rules for every task: add no dependency, no web font, no image file; no `transition: all`; honour `prefers-reduced-motion`; use tokens, not raw hex; keep every existing element id, test class and ARIA attribute; do not change `checkClaims` or its tests; do not touch `.kiro/settings`; do not edit or import `ref/`; follow `.kiro/steering/*.md`.

- [ ] 1. Look port and the six gaps
  - Files: `index.html`, `src/ui/tokens.css`, `src/ui/style.css`, `src/ui/printer.css`, `src/ui/printer.ts` (only if markup needs it), `.kiro/steering/design.md` (token and contrast table).
  - Requirements: R1 to R9.
  - Keep all existing tests green; add one small pure test only if logic is added.
  - Maintainer checks, DOM: `getComputedStyle` of `--platen-h` is 56 to 64px and `.platen` is taller than 44px; `.platen-cap` about 40px; each of 4 `.rivet` is 12px, inside the housing rect, not intersecting either `.platen-cap`; `.paper-tray` has a lighter top border and inset shadow and `aria-hidden`; `.paper` has two `repeating-linear-gradient` layers and a `radial-gradient` hole strip on both sides; `.stamp` has a double border, about -10deg, no overlap with wire text; body `min-height` is `100vh` with no `overflow: hidden`; 768px is one column, 820px two. `scrollHeight <= innerHeight` at 1440x900 (empty, printed, held); `scrollWidth <= innerWidth` at 390x844 and keys at least 44px.
  - Maintainer checks, screenshot: holes both edges, thick platen with brass caps, rivets, tray lip, grain, stamp first and digits second.

- Operator step, not a Kiro task: the maintainer changes the `command` in `.kiro/settings/mcp.json` to plain `uvx` by hand (kiro-scope blocks writes to `.kiro/settings`). Kiro does not touch that file.

- [ ] 2. Offline source checker
  - Files: `src/core/sourceCheck.ts`, `src/core/sourceCheck.test.ts`, `src/core/sourceCheck.prop.test.ts`, `src/core/index.ts`, `src/cli/report.ts`, `src/cli/claimgate.ts`, `src/cli/report.test.ts`, `package.json` (script `sourcecheck`), `.kiro/steering/source-check.md` (rewrite).
  - Requirements: R10 to R12.
  - fast-check properties: valid https URLs on dotted hosts are `OK`; http and other schemes are `NOT_HTTPS`; junk (spaces, padding, no dot) is `MALFORMED`; results keep claim order and count; same input gives same output; the module source has no `fetch`, `XMLHttpRequest` or network import.
  - Maintainer checks: `npm test`; `npm run sourcecheck` prints one status line per claim and exits 1 on any non-`OK` claim; `drafts/launch-note.json` output read; hook command output unchanged in form.

- [ ] 3. Demo buttons
  - Files: `src/ui/demo.ts`, `src/ui/demo.test.ts`, `index.html` (Demo row), `src/ui/style.css` (row layout), `src/ui/main.ts` (thin wiring).
  - Requirements: R13, R14.
  - Tests: `embargoInstant(now)` is a whole UTC minute and 45 to 105s ahead for any `now` (fast-check); the unsourced fill has exactly one claim without a URL; the sourced fill has every claim on `example.com` and a date and time that parse to `embargoInstant(now)`.
  - Maintainer checks, DOM: `#demo-unsourced` and `#demo-sourced` are `button[type=button]`, text exact, height at least 44px, `disabled` while held or printing. Press unsourced: `#notice` has focus, names the claim, nothing printed. Press sourced: held proof with stamp and `.ticker`, then it releases at zero.
  - Screenshot: Demo row under Compose at 1440x900 and 390x844 (no horizontal scroll).
