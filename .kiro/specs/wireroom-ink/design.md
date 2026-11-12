# Design: wireroom-ink

Builds on `design-pass-2` (tokens, layout) and `mcp-source-lookup` (old check). Read `ref/style.css` for values. Not copied: its fixed `height: 900px` and `overflow: hidden`.

## Tokens (src/ui/tokens.css)

New tokens, names are final; hex follows the mockup. Old tokens that clash are re-valued, not renamed.

| Token | Hex | Use |
|---|---|---|
| `--desk` | `#363D31` | page background |
| `--panel` | `#1B1F19` | compose column |
| `--cream` | `#E5DCBE` | input fill, Print key |
| `--ink-field` | `#1C201A` | field text, field border |
| `--ring` | `#8C8668` | outer 2px field ring |
| `--brass` / `--brass-hi` / `--brass-dark` | `#B89255` / `#E0C58E` / `#7C6234` | keys, caps, rivets, badge |
| `--key-ink` | `#1F2123` | key text and border |
| `--steel-hi` / `--steel` / `--steel-lo` | `#6A7064` / `#4A4F46` / `#2A2E27` | housing, tray lip |
| `--well` | `#0E100C` | tray well, housing border |
| `--roller-hi` / `--roller-lo` | `#4A4F4B` / `#141516` | platen cylinder |
| `--hole` | `#3A3D34` | sprocket holes |
| `--sheet` / `--sheet-hi` | `#F2EAD0` / `#FAF4DE` | paper |
| `--bezel` | `#1A1710` | ticker bezel |
| `--amber` | `#EAA023` | ticker digits, focus ring |
| `--crimson` | `#C72E24` | HOLD stamp |
| `--platen-h` | `60px` | platen height |

## Contrast (WCAG 2.x, computed by hand; re-check after edit)

| Pair | Ratio | Need |
|---|---|---|
| `--ink-field` on `--cream` | ~11:1 | 4.5 |
| `--cream` on `--panel` (labels, field fill edge) | ~12:1 | 4.5 / 3 |
| `--ring` on `--panel` | ~4.7:1 | 3 |
| `--key-ink` on `--brass` | ~6:1 | 4.5 |
| `--key-ink` on `--cream` (Print) | ~12:1 | 4.5 |
| `--key-ink` border on `--brass` | ~6:1 | 3 |
| `--amber` on `--bezel` | ~9:1 | 4.5 |
| `--amber` focus ring on `--panel` / `--desk` | ~8:1 / ~6:1 | 3 |
| `--crimson` on `--sheet` (stamp) | ~4.6:1 | 4.5 |
| `#1E1E1E` paper text on `--sheet` | ~14:1 | 4.5 |
| `--hole` on `--sheet` (decoration) | ~9:1 | none |

If any pair measures lower once computed, darken the foreground token and update this table in the same task. The same rows go into `.kiro/steering/design.md`, replacing older rows for changed tokens.

## Look and the six gaps (CSS only)

- Keys: brass face, `border: 2px solid var(--key-ink)`, `border-bottom-width: 5px`, `min-height: 44px`, `:active` goes to `2px` bottom and `translateY(3px)`. Transitions list properties, at most 120ms.
- Fields: `border: 2px solid var(--ink-field)`, `outline`-free ring via `box-shadow: 0 0 0 2px var(--ring)`. Focus ring stays 3px `--amber`, offset 2px.
- Gap 1: `.paper` uses `::before`/`::after` strips, 30px wide (24px under 800px), `radial-gradient(circle at 50% 14px, var(--hole) 5px, transparent 5.5px) 0 0/30px 28px repeat-y`. Paper padding left and right is strip width plus 12px. Strips are pseudo-elements, so `.paper` text is untouched.
- Gap 2: `.platen { height: var(--platen-h) }`; `.platen-roll` gradient `roller-lo, roller-hi 30%, roller-lo`; `.platen-cap` is 40px tall, brass radial gradient, positioned so it extends beyond the roller top and bottom.
- Gap 3: `.rivet` 12px, brass radial gradient, `box-shadow: 0 1px 1px var(--well)`, `z-index` above caps, placed 8px from housing corners; the housing gets padding so caps start inside the rivet columns (rivets do not overlap caps). Maintainer checks four bounding boxes.
- Gap 4: `.paper-tray` gets `border-top: 3px solid var(--steel-hi)`, `box-shadow: inset 0 4px 6px var(--well)`, background `--well` to `--steel-lo`, min height 16px. Stays `aria-hidden`.
- Gap 5: `.paper` items get `background-image` of two `repeating-linear-gradient`s (0deg and 90deg, alpha at most 0.04) over the sheet gradient. `.stamp`: `rotate(-10deg)`, `border: 4px double var(--crimson)`, in flow, `margin` of `--space-3` top and bottom, `display: inline-block`. Stamp is largest weight; ticker digits are second (size from design-pass-2).
- Gap 6: `body { min-height: 100vh }`, no `overflow: hidden` on body. The existing `@media (min-width: 900px)` grid and no-scroll block changes to `min-width: 800px`; in that block the app fills the viewport (`height: 100vh` on the grid, inner regions scroll). The `max-width: 479px` stacking rule stays for the example and demo rows only. Phone: `.paper` keeps `overflow-x: auto`.
- Reduced motion: transitions and the stamp lift are removed in the existing media query.

## Source checker

```ts
type SourceStatus = "OK" | "MISSING" | "MALFORMED" | "NOT_HTTPS" | "UNLISTED";
interface SourceResult { index: number; text: string; status: SourceStatus }
function checkSourcesLocal(
  claims: { text: string; sourceUrl?: string }[],
  sources?: string[],
): SourceResult[];
```

Order per claim: no URL or empty after trim is `MISSING`; surrounding whitespace, inner space, `new URL` throws, or a host without a dot is `MALFORMED`; protocol other than `https:` is `NOT_HTTPS`; `sources` is an array and lacks the URL is `UNLISTED`; else `OK`. Uses `URL` only (no `fetch`, no import outside `src/core`). Exported from `src/core/index.ts`.

`src/cli/report.ts`: `readClaims` also reads an optional `sources` string array. A new `formatSourceReport(files)` prints `<file>: claim N "<text>" STATUS` per claim, and a final summary line; `ok` is false when any status is not `OK`. `claimgate.ts` prints that and exits 1 on failure. `formatReport` and `checkClaims` stay as they are. Script: `"sourcecheck": "vite-node src/cli/claimgate.ts drafts"`.

`.kiro/steering/source-check.md` is rewritten: run the CLI, read its lines, name each non-`OK` claim, never edit or invent a URL, never fetch. The MCP `fetch` tool is optional, IDE-only, never headless.

## Demo helper (src/ui/demo.ts)

```ts
interface DemoFill { city: string; priority: string; headline: string; body: string;
  claims: { text: string; sourceUrl: string }[]; embargoDate: string; embargoTime: string }
function buildUnsourcedDemo(): DemoFill;
function buildSourcedDemo(now: number): DemoFill;
function embargoInstant(now: number): number; // ms
```

`embargoInstant`: `ceil((now + 45000) / 60000) * 60000`, so 45 to 105s ahead on whole UTC minutes. Date and time strings are formatted by hand as `YYYY-MM-DD` and `HH:mm` from UTC fields. `main.ts` reads `Date.now()` (UI may), fills the form with the existing fill function, then calls the same submit handler as Print. Buttons share the disabled rule of the example buttons.

## Files

`index.html` (demo row, markup only if needed), `tokens.css`, `style.css`, `printer.css`, `printer.ts` (only if markup needs it), `src/core/sourceCheck.ts` (+ tests), `src/cli/report.ts`, `src/cli/claimgate.ts`, `package.json`, `src/ui/demo.ts` (+ test), `src/ui/main.ts` (thin), two steering files.
