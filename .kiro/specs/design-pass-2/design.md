# Design: design-pass-2

Fixes the eight review findings listed in `requirements.md`. Presentation stays in `src/ui` and CSS; the claim gate and the embargo rule in `src/core` are not changed. Read `teletype-polish/design.md` for the housing, platen and paper-stage rules; only the differences are written here.

## Files

| File | Change |
|---|---|
| `index.html` | tray, rivet elements, toolbar wrapper, form lock reason line, held area slot |
| `src/ui/tokens.css` | two new tokens (below) |
| `src/ui/printer.css` | tray, rivets, ticker, stamp, warning strip, remove `.caret` |
| `src/ui/style.css` | date and time wells, toolbar, form lock dimming, headline caret |
| `src/ui/printer.ts` | held item markup (ticker, warning strip, two keys), remove caret creation |
| `src/ui/heldState.ts` (new) | pure lock state, no DOM |
| `src/ui/clockLoop.ts` | add `take(id)` to remove one held entry |
| `src/ui/main.ts` | thin wiring for lock, Release now, Cancel embargo |
| `.kiro/steering/design.md` | new tokens and contrast rows |

No change to `src/core`, so the pure-core rules in `tech.md` still hold. The UI reads the clock and passes time in.

## Fix 1 and 7: tray and rivets

`.paper-stage` already has a dark floor. Add `<div class="paper-tray" aria-hidden="true">` as the last child of `.printer-body`, with `flex: 1 1 auto` and a `min-height` token, so it takes the space under the paper. The tray is `--desk-dark` with a front lip (`--edge` 2px top border, inset shadow) and a pile of folded paper drawn with two `repeating-linear-gradient` layers in `--paper` and `--muted`, plus a `clip-path` zigzag edge. The paper scroll region stays above it, so a short item ends at the tray mouth. Printed items stay in `#paper`, in print order.

Rivets: four `<i class="rivet" aria-hidden="true">` children of `.printer-body` placed by `top`/`bottom` and `left`/`right` at `--space-1`, radial-gradient `--accent` to `--brass-dark` (replaces the two pseudo-elements). They are `pointer-events: none` and sit outside the layout flow.

## Fix 2: date and time wells

Keep the native inputs. In `style.css`, `#embargo-date, #embargo-time` get the field recipe from `design.md` (2px `--edge` border, `--desk-dark` outer line, inner shadow, `--field` fill, `font-family: var(--font-paper)`, 16px). `::-webkit-calendar-picker-indicator` gets `opacity: 1` and a `background-image` data URI of an inline SVG (calendar for date, clock for time) drawn with `--ink`-toned strokes (`#1B1915` in the URI is allowed because a URI cannot read a custom property; a comment names the token). Firefox shows its own icon; the well, font and border still apply. Focus ring unchanged.

## Fix 3: toolbar

`#nameplate-tools` becomes `role="toolbar" aria-label="Feed keys"`; the BELL label stays in the printer bar outside it. Mute, Export RSS and Export JSON share one class `.feed-key` on top of `.btn`: `min-height: 44px`, same padding, font and border, `display: inline-flex; align-items: center; justify-content: center`. The toolbar is `display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: stretch`, so wrapped rows keep equal key heights. Disabled export keys use the existing dashed `aria-disabled` look and the same height.

## Fix 4, 6, 8: held item

`printer.ts` builds the held area as one block under the proof text:

```
<div class="hold-area">
  <div class="ticker">
    <span class="ticker-title">RELEASE IN</span>
    <span class="countdown-label ticker-digits">T-00:12:03</span>
    <time class="countdown-time" datetime=...>...</time>
  </div>
  <p class="hold-warning"><span class="hold-mark" aria-hidden="true">!</span>
     Kept in this page only. Closing it cancels the release.</p>
  <div class="hold-keys"> Release now | Cancel embargo </div>
</div>
```

`.countdown-label` stays the node that `onClockTick` and `onClockRelease` update, so the clock loop and its tests do not change. `COUNTDOWN_NOTE` keeps its exact text; the old `.countdown-note` span becomes `.hold-warning` (the `main.ts` removal on release is updated to the new selector).

Ticker: `--ticker` fill, inset shadow, `--accent` digits in `--font-paper`, `font-size: clamp(24px, 4vw, 40px)` (at least 24px on phone, 32px or more at 900px and up via a media query that sets 32px+), `font-variant-numeric: tabular-nums`, per-digit segmented look with `letter-spacing` and a `repeating-linear-gradient` hairline across the middle (flip-counter seam). No animation, so reduced motion needs nothing.

Stamp: `border: 4px solid var(--stamp-deep)`, `color: var(--stamp-deep)`, speckle from two `radial-gradient` layers in `--stamp-deep` at low alpha over the box, still rotated -3deg, still text and never over wire text.

Warning strip: `--field` fill, `--ink` text, 4px `--stamp-deep` left border, `font-size: 14px` and `16px` under 900px. The mark is a bold `!` in a `--stamp-deep` square, `aria-hidden`.

Block cursor: grep `src`, `index.html` and CSS for `2588`, `█` and `.caret`. The paper item caret (`CARET_CLASS`, its creation in `buildItem`, `finish()` removal and the `.caret` CSS) is removed. `printer.ts` tests that mention it are updated to expect no caret. A headline caret may be added with `caret-color: var(--accent)` on `#headline` (native caret, no blink animation of our own).

## Fix 5: form lock

Pure logic in `src/ui/heldState.ts`:

```ts
export interface HeldView { locked: boolean; reason: string; announce: string }
export function lockView(heldCount: number): HeldView
```

`lockView(0)` is unlocked with empty reason. `lockView(n > 0)` is locked with reason `"Story held. Release or cancel to compose."`. Tested in `heldState.test.ts` with a fast-check property: locked iff count > 0.

`clockLoop.take(id)` removes and returns one held entry (or `undefined`). Test: after `take`, no tick releases it and the interval stops when the list is empty.

`main.ts` wiring, thin:
- `applyLock()` reads `clockLoop.size()`; sets `disabled` on a new `fieldset#form-fields` wrapping the form fields (the ids inside do not change), `aria-disabled` on Print and Print instantly, `data-locked` on `.compose` for the dim style, and the reason line text in `#lock-reason`. Called after `clockLoop.add`, after `onClockRelease`, and after Cancel.
- Release now: `const one = clockLoop.take(id)`; build the released result from the held entry, then call `onClockRelease(one)`, the same function the clock uses. The `publishedAt` is the click time. This does not weaken the embargo: only the user's explicit key press ends the hold early, and the claim gate ran before the hold. A maintainer note in the task flags this as a product decision.
- Cancel embargo: `clockLoop.take(id)`, remove the held item's `.hold-area`, mark the proof "CANCELLED" in the `.countdown-label`, set `#status` to `Embargo cancelled`, call `applyLock()`, move focus to `#headline`. Nothing is added to `sessionEntries`.

Dim style: `.compose[data-locked] fieldset` text uses `--desk-muted` on `--desk` (6.00:1); the reason line is `--paper` on `--desk` (8.27:1). Disabled fields keep the dashed edge, not colour alone.

## Tokens and contrast

Two new tokens in `tokens.css`; everything else reuses existing ones. Ratios computed by hand from the hex values (WCAG 2.x).

| Token | Hex | Use |
|---|---|---|
| `--stamp-deep` | `#8F1D14` | HOLD stamp border and text, warning mark and edge |
| `--ticker` | `#14110D` | ticker strip fill |

| Pair | Ratio |
|---|---|
| `--stamp-deep` on `--paper` | 7.16:1 |
| `--stamp-deep` on `--field` | 8.03:1 |
| `--accent` on `--ticker` (digits) | 5.03:1 |
| `--paper` on `--ticker` | 8.03:1 |
| `--desk-muted` on `--ticker` ("RELEASE IN") | 5.82:1 |
| `--ink` on `--field` (warning text) | 15.81:1 |
| `--edge` on `--desk` (date and time well border) | 4.74:1 |

Task 4 recomputes these and fixes any pair under 4.5:1 for text or 3:1 for borders before the rows go into `.kiro/steering/design.md`.

## Testing

Pure logic (`lockView`, `take`) gets unit and property tests. DOM wiring is checked by the maintainer with selectors: `.paper-tray`, `.rivet` (count 4), `[role="toolbar"] .feed-key` (equal `offsetHeight`), `.ticker-digits` computed `font-size`, `.stamp` computed `border-top-width`, `.hold-warning` computed `font-size`, `#release-now`, `#cancel-embargo`, `#form-fields:disabled`, and `document.body.innerText` free of U+2588.
