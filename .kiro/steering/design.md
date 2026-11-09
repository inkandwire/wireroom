---
inclusion: always
---

# WireRoom: Design

Visual and sound language for the browser UI in `src/ui`. Every UI spec and task follows this file. The theme is presentation only and never gets in the way of the claim gate or the embargo clock (see `product.md`).

## Directions considered

1. **Newsprint and carbon ink.** Warm cream page, black type, rules and columns. Readable and period-correct, but it looks like a newspaper, not a machine.
2. **Green-phosphor terminal.** Black screen, green text. Instantly "old computer", but it is 1980s, invites glow effects, and has no paper, stamp or tear.
3. **Mid-century wire room.** Green-grey metal desk, cream printer paper in carbon ink, brass controls, one red rubber stamp.

**Pick: 3.** The product is the paper coming out of a machine, so the paper must be a physical object on a surface. The desk frames it, the paper keeps newsprint readability, and the red stamp is the one loud colour, which makes HOLD and rejections unmistakable.

## Tokens

All tokens are CSS custom properties in one `:root` block in `src/ui/tokens.css`. Components use tokens only, never raw hex or pixel values. The one exception is the date and time icon: an inline SVG data URI cannot read a custom property, so its stroke is written as the `--ink` hex (`%231B1915`), with a comment naming the token.

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#EFE6CC` | printer paper; also text on desk |
| `--ink` | `#1B1915` | text on paper and field fill |
| `--desk` | `#38433D` | page background, printer body |
| `--accent` | `#E3B04B` | brass: primary button, focus ring, ticker digits |
| `--stamp` | `#A82A1E` | rejection text only |
| `--stamp-deep` | `#8F1D14` | HOLD stamp border and text, warning mark and warning edge |
| `--ticker` | `#14110D` | countdown ticker strip fill |
| `--muted` | `#5B5444` | secondary text on paper and field fill |
| `--desk-muted` | `#BFC8BF` | hints and secondary text on desk; "RELEASE IN" on the ticker |
| `--field` | `#F8F3E3` | input fill, rejection notice, warning strip |
| `--edge` | `#B9B08F` | input border on desk |
| `--key` | `#4F5C54` | small grey-green key fill (secondary buttons, feed keys) |
| `--desk-dark` | `#232B26` | key bottom edge, field outer line, printer bar |
| `--brass-dark` | `#9A7220` | Print keycap border and bottom edge |

`--stamp-speckle` (`rgba(143, 29, 20, 0.18)`) is the `--stamp-deep` tone at low alpha for the ink speckle on the stamp. It is decoration (small dots), not a text colour.

Contrast (WCAG 2.x relative luminance). Text needs 4.5:1, large text 3:1, borders and UI 3:1.

| Pair | Ratio |
|---|---|
| `--ink` on `--paper` | 14.09:1 |
| `--muted` on `--paper` | 6.03:1 |
| `--stamp` on `--paper` | 5.60:1 |
| `--stamp-deep` on `--paper` (HOLD stamp text and border) | 7.16:1 |
| `--ink` on `--field` | 15.81:1 |
| `--muted` on `--field` | 6.76:1 |
| `--stamp` on `--field` | 6.28:1 |
| `--stamp-deep` on `--field` (warning edge, mark fill) | 8.04:1 |
| `--field` on `--stamp-deep` (warning mark "!") | 8.04:1 |
| `--paper` on `--desk` | 8.27:1 |
| `--desk-muted` on `--desk` | 6.00:1 |
| `--ink` on `--accent` (button text) | 8.84:1 |
| `--accent` on `--desk` (button edge, focus ring) | 5.19:1 |
| `--accent` on `--ticker` (ticker digits) | 9.48:1 |
| `--paper` on `--ticker` (release time) | 15.11:1 |
| `--desk-muted` on `--ticker` ("RELEASE IN") | 10.96:1 |
| `--field` on `--desk` (field fill) | 9.28:1 |
| `--edge` on `--desk` (field border, date and time well border) | 4.74:1 |
| `--paper` on `--key` (secondary key text, feed key text) | 5.65:1 |
| `--paper` on `--ink` (key hover) | 14.09:1 |
| `--desk-muted` on `--desk` (disabled key text, inert feed key) | 6.00:1 |
| `--ink` on `--field` (mono field text, date and time text, warning text) | 15.81:1 |
| `--ink` on `--field` (calendar and clock icon strokes, UI needs 3:1) | 15.81:1 |

The key fill `--key` against `--desk` is only about 1.6:1, so a key never relies on its fill for its boundary: the 2px `--edge` border (4.74:1 on `--desk`) draws it. The Print keycap border `--brass-dark` is decoration; its fill `--accent` is 5.19:1 on `--desk`. The ratios above were computed by hand from the hex values.

`--stamp` and `--stamp-deep` are never used on `--desk` (about 1.5:1 and lower). Errors appear on `--field`, not on the desk.

**Type roles.** Paper: `--font-paper: "Courier New", Courier, "Liberation Mono", "DejaVu Sans Mono", ui-monospace, monospace`. Controls: `--font-ui: "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`. No web fonts, no network requests.
- Field text is paper mono, 16px (never smaller, stops iOS input zoom), line height 1.5. Labels are paper mono, 14px, uppercase, letter-spacing 0.04em (typewriter labels). Page title 20px. Keys use the control font, 14px; Print 16px bold.
- Paper: size is computed to fit 69 columns (see Layout), line height 1.35, `white-space: pre`.

**Spacing** (`--space-1`..`7`): 4, 8, 12, 16, 24, 32, 48px.
**Icons and feed keys** (no colour): `--icon-size: 20px` (calendar and clock icons), `--feed-key-pad-x: var(--space-3)` (horizontal padding of a feed key).
**Radius:** `--radius-paper: 1px` (near square, with a torn edge), `--radius-control: 2px` (inputs, keys, square period corners), `--radius-stamp: 3px`.
**Borders and motion:** 2px control borders, 4px stamp border (`--border-stamp-heavy`). Transitions list their properties, last at most 120ms (the stamp lift is the one longer, 300ms, and is removed under reduced motion), and are never `transition: all`.

## Controls

- **Fields** are recessed: 2px `--edge` border, a 1px `--desk-dark` outer line (double border) and an inner shadow. `color-scheme: light` keeps native pickers matched. The select keeps `appearance: none` and its CSS triangle.
- **Date and time wells** (`#embargo-date`, `#embargo-time`) stay native `type="date"` and `type="time"` inputs with their labels and `aria-describedby`. They use the field recipe in the paper mono font (`--font-paper`), 16px. The picker indicator is restyled with an inline SVG data URI icon (a calendar for date, a clock for time) drawn in the `--ink` tone and sized by `--icon-size`. Firefox keeps its own icon; the well, font and border still apply.
- **Secondary keys** (`.btn`) are small grey-green keycaps: `--key` fill, `--paper` text, 2px `--edge` border, 2px `--desk-dark` bottom edge (an outer shadow, so the box size does not change), 2px press on `:active`. "Sound on" adds a brass border and bold text.
- **Feed key toolbar.** Mute, Export RSS and Export JSON feed sit in one element with `role="toolbar"` and `aria-label="Feed keys"` (`#nameplate-tools`), as a row of secondary keys sharing the class `feed-key`. The BELL label is not inside the toolbar. All three keys are the same height (min 44px at every width), centred text on one line. The toolbar wraps to a second row on a phone, and every row keeps the same key height. An inert export key (nothing to export) uses the dashed `aria-disabled` edge, with the same border width, so it keeps the same height.
- **Print** is the one brass keycap: `--accent` fill, `--brass-dark` 3px bottom edge, 2px press.
- **Claim rows** are stacked at every width: the claim label and Remove on the first line (Remove right aligned), the claim text input full width, then the URL label and the URL input full width, with 4px gaps.
- Focus ring stays 3px `--accent` with 2px offset. Phone tap targets stay at least 44px.

## Layout

- Desktop (900px and up): two columns, `grid-template-columns: minmax(320px, 400px) minmax(0, 1fr)`, gap `--space-6`. Left is the compose form. Right is the printer: a desk-coloured body with the paper roll as a scrolling region (own vertical scroll, newest item at the bottom). Grid children get `min-width: 0`.
- Phone (390px wide): one column, form first, printer below, page margin `--space-2`. After a successful print, scroll the printer into view.
- No sideways page scroll at any width. Check `document.documentElement.scrollWidth <= innerWidth` at 390px.
- **69 columns must fit.** The paper is a size container (`container-type: inline-size`). Paper font size is `clamp(8px, (100cqi - 2 * paper padding) / 42.8, 16px)`; 42.8 is 69 columns times 0.62em, a safe upper bound for the mono stack. At 390px the paper prints at about 8px. At 1280px it reaches the 16px cap. Lines are never re-wrapped for display, since wire text must stay byte-identical. Below the 8px floor, or when the user zooms, the paper box (not the page) scrolls sideways (`overflow-x: auto`, `tabindex="0"`, labelled).
- The paper is a 1px-radius rectangle in `--paper` with a torn bottom edge made in CSS (`clip-path` zigzag, 6px teeth). No images.

## Printer behaviour

- **Feed:** output prints line by line. Per-character delay depends on the character, so it is deterministic: letter 14ms, space 8ms, punctuation 40ms, line end 140ms. Total print time is capped at 6s by scaling the delays down. A "Print instantly" button skips ahead to the finished item. There is no block cursor or print-head marker on the paper in any state.
- **Bell:** a FLASH item rings twice, a BULLETIN once. URGENT and routine items do not. A text label "BELL" appears next to the printer for 1.5s as a static inverted state (not a blink), also when muted.
- **Tear:** after the `-30-` line the item is cut. The finished item shifts 3px for 120ms and keeps its torn edge, with `--space-5` before the next item. The cut plays one thunk.
- **HOLD:** an embargoed item prints as a held proof with a stamp box above the slug reading `HOLD UNTIL <release time>`: `--stamp-deep` text, 4px `--stamp-deep` border, a CSS ink speckle, rotated -3deg, uppercase bold mono. It is text, never colour alone, and it never covers wire text. A held item does not go to any feed.
- **Ticker:** under the held proof, a dark recessed strip (`.ticker`, `--ticker` fill) shows the label "RELEASE IN", the `T-hh:mm:ss` digits (`.ticker-digits`, also `.countdown-label`, `--accent`, tabular digits, wide tracking, a hairline seam across the middle) and the release time. The digits are at least 32px from 900px wide and at least 24px on a phone. The ticker is not a live region.
- **Warning strip:** `.hold-warning` sits under the ticker on `--field` with `--ink` text, a 4px `--stamp-deep` left edge and a small aria-hidden "!" mark. It reads "Kept in this page only. Closing it cancels the release." and is at least 14px on desktop and 16px on a phone.
- **Rejection:** a draft that fails the claim gate prints nothing and makes no sound. A notice on `--field` (`role="alert"`, receives focus) starts "NOT RELEASED: N claims have no source." Then it lists each failing claim in plain words, for example `Claim "The app has 500 users" has no source URL. Add a link that backs it up.` Each entry links to its field. The UI never suggests or invents a source.

## Sound

WebAudio only, synthesised, no audio files. One `AudioContext`, one master gain.
- **Key clack:** 25ms white-noise burst through a band-pass filter (centre 1800-2500Hz by character code, Q 1.2), gain 0.6 to 0.001 exponential over 30ms. Spaces are silent. At most 40 clacks per second.
- **Carriage-return thunk:** 90ms noise burst through a low-pass at 220Hz, gain 0.5 to 0.001 exponential.
- **Bell:** sine partials at 1320Hz, 3168Hz and 5148Hz with gains 1, 0.5, 0.25, exponential decay to 0.0001 over 1.4s.
- **Master gain** is capped at 0.25 and no sound goes through it above that. Nothing plays louder than the bell at the cap.
- **Muted by default.** The `AudioContext` is created or resumed only inside the first user click or key press (browser autoplay rules). Before that, nothing sounds and nothing throws.
- **Mute toggle:** a visible `<button>` named "Mute sound" with `aria-pressed`, starting `true`. It shows the text "Muted" or "Sound on" (the name does not change). Its first press is also the gesture that unlocks audio.

## Motion and accessibility

- `prefers-reduced-motion: reduce`: no typing animation, the finished item appears at once, no tear shift, no smooth scrolling, no screen shake anywhere. The bell is the "BELL" text label only.
- `:focus-visible` ring on every interactive element: 3px `--accent` outline, 2px offset, on the desk (5.19:1). Never `outline: none` without a replacement.
- Tap targets at least 44 by 44px, including the mute toggle, Print instantly and links in the rejection list.
- Every field has a real `<label for>`, not placeholder-only. Hints are linked with `aria-describedby`.
- The paper has `aria-live="off"`. A separate visually hidden `role="status"` region (polite) gets the finished item text in one update after printing ends, then is cleared about 1s later so it is read once. Never announce per character.
- Keyboard-only use works end to end: fill, print, skip, mute, read the paper. Tab order follows reading order. Esc has no hidden behaviour.
- Errors are text with a "NOT RELEASED" prefix and a per-claim sentence. Colour only reinforces.

## Do not

- No emoji as icons. Use text or inline SVG drawn for the purpose.
- No stock photos or bitmap textures.
- No invented metrics, user counts or testimonials. All numbers shown come from the draft.
- No marketing hero or landing copy. The app opens on the working compose form and printer.
- No purple gradients, glow shadows, gradient text, cards inside cards, or `transition: all`.
- No block cursor character (U+2588) or `.caret` block on the paper.
