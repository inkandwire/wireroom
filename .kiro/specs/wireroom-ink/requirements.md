# Requirements: wireroom-ink

## Introduction

Port the look of the reference mockup (`ref/index.html`, `ref/style.css`; reference only, not edited, not imported, its fixed body height is not copied) into the real UI, fix six gaps a reviewer named, add an offline source checker and two demo buttons. Builds on `design-pass-2` (tokens, layout, no-scroll rules) and `mcp-source-lookup` (the old fetch-based check, now replaced as the required check). The claim gate (`checkClaims`) and the embargo clock are not changed. Plain CSS only; no dependency, web font, image file, glow shadow or `transition: all`.

## Requirements

### R1. Ink look tokens
The desk shall be `#363D31` and the compose column a dark panel `#1B1F19`. WHEN the page loads, THE UI SHALL take every new colour from a token in `src/ui/tokens.css`, with no raw hex in components. Brass, steel, amber and crimson are tokens.

### R2. Fields and keys
THE UI SHALL draw inputs with cream fill `#E5DCBE`, `#1C201A` text, a 2px dark border and a lighter 2px outer ring so the edge is at least 3:1 against the panel. Keys shall be brass with a dark 2px border, a 5px bottom edge and at least 44px height, and WHEN pressed they shall move down 3px. Print shall be cream. Existing ids, test classes and ARIA attributes stay.

### R3. Sprocket holes (gap 1)
THE paper SHALL show round dark holes down both edges, from a paper-coloured strip using `radial-gradient(circle at 50% 14px, <dark token> 5px, transparent 5.5px) 0 0/30px 28px repeat-y` (24px strip on phone; not `repeating-radial-gradient`). The paper shall reserve left and right padding so holes never overlap wire text. Paper text shall stay byte-identical and selectable.

### R4. Thicker platen (gap 2)
THE `--platen-h` token SHALL be 56 to 64px. The roller shall have a rounded cylinder gradient with a light band near 30%. Two brass `.platen-cap` end caps about 40px tall shall stand above and below the roller. The platen shall be taller than a 44px key.

### R5. Visible rivets (gap 3)
THE four `.rivet` elements SHALL be 12px, brass radial gradient with a 1px dark shadow, at the housing corners, above the caps in z-order. Each rivet's bounding box shall lie inside the housing and shall not intersect either `.platen-cap`.

### R6. Visible tray (gap 4)
THE `.paper-tray` (still `aria-hidden`) SHALL have a lighter brass or steel top border, an inset shadow and a darker well, so the roll visibly feeds from a tray.

### R7. Grain, housing, stamp (gap 5)
THE `.paper` items SHALL carry a faint grain from two layered `repeating-linear-gradient`s at very low alpha. The printer housing shall be a raised steel panel with a top highlight, the ticker digits amber on a near-black bezel, and the paper a torn zigzag bottom edge. The HOLD stamp shall be crimson, rotated about -10deg, always in flow with a margin and never covering wire text, with an uneven edge (double border or gradient-built mask). Visual order on a held item: stamp first, countdown digits second. No glow.

### R8. Responsive (gap 6)
THE body SHALL use `min-height: 100vh` and no `overflow: hidden`. WHILE the viewport is under 800px wide, THE UI SHALL show one column, compose above printer (768px: one column; 820px: two columns). At 1440x900 the page shall not scroll vertically in the empty, printed and held states. At 390x844 there shall be no horizontal page scroll, keys at least 44px tall, and the paper box scrolls inside itself. `prefers-reduced-motion` and every `:focus-visible` ring are kept.

### R9. Contrast and steering table
THE design.md of this spec SHALL list the contrast of every new colour pair (text 4.5:1, borders and UI 3:1), and `.kiro/steering/design.md` shall be updated to match. The mockup wins over older rows (stamp rotation about -10deg).

### R10. Local source checker
WHEN `checkSourcesLocal(claims, sources?)` runs, THE module `src/core/sourceCheck.ts` SHALL return one result per claim, in claim order, with status `OK`, `MISSING` (no URL), `MALFORMED` (unparseable, contains spaces, surrounding whitespace, or no dotted host), `NOT_HTTPS` (any non-`https` scheme) or `UNLISTED` (URL not in `sources` when `sources` is an array; no array skips this rule). It shall be pure, deterministic and import nothing network-related.

### R11. CLI and script
WHEN `node_modules/.bin/vite-node src/cli/claimgate.ts drafts` runs, THE CLI SHALL print one line per claim with its status and exit 1 if any claim is not `OK`. `package.json` shall have a script `sourcecheck` running the same CLI. `checkClaims` in `claimGate.ts` and its tests are unchanged.

### R12. Steering rewrite
THE `.kiro/steering/source-check.md` SHALL make the local checker the check Kiro runs (read the CLI output, never fetch). The MCP fetch tool is optional, IDE-only, never required and never run headless. The MCP server config is unchanged.

### R13. Demo buttons
THE Compose header SHALL have a "Demo" row with `<button type="button">` elements `#demo-unsourced` ("Try: launch with an unsourced claim") and `#demo-sourced` ("Try: launch fully sourced"), each at least 44px tall, disabled while a story is held or printing. The existing `example-sourced` and `example-unsourced` buttons keep their behaviour.

### R14. Demo behaviour
WHEN `#demo-unsourced` is pressed, THE UI SHALL fill a made-up draft with one unsourced claim and submit it through the normal Print path; nothing prints and the existing rejection notice names the claim and takes focus. WHEN `#demo-sourced` is pressed, THE UI SHALL fill the sourced example (example.com links), set an embargo at least 45s ahead, rounded up to the next whole UTC minute (so 45 to 105s), and submit through the normal Print path; the item prints held with the stamp and ticker and releases at zero via the existing clock loop. Time comes from an injected `now`; no network.
