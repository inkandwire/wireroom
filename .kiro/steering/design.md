---
inclusion: always
---

# WireRoom: Design

Visual and sound language for the browser UI in `src/ui`. Every UI spec and task follows this file. The theme is presentation only and never gets in the way of the claim gate or the embargo clock (see `product.md`).

## Directions considered

1. **Newsprint and carbon ink.** Warm cream page, black type, rules and columns. Readable and period-correct, but it looks like a newspaper, not a machine.
2. **Green-phosphor terminal.** Black screen, green text. Instantly "old computer", but it is 1980s, invites glow effects, and has no paper, stamp or tear.
3. **Mid-century wire room.** Green-grey metal desk, cream printer paper in carbon ink, brass controls, one red rubber stamp.

**Pick: 3.** The product is the paper coming out of a machine, so the paper must be a physical object on a surface. The desk frames it, the paper keeps newsprint readability, and the crimson stamp is the one loud colour, which makes HOLD and rejections unmistakable.

The ink look (spec `wireroom-ink`) took its values from a reference mockup. Where the mockup and an older row disagree, the mockup wins (for example the stamp turns about -10deg, not -3deg).

## Tokens

All tokens are CSS custom properties in one `:root` block in `src/ui/tokens.css`. Components use tokens only, never raw hex or pixel values. The one exception is the date and time icon: an inline SVG data URI cannot read a custom property, so its stroke is written as the `--ink-field` hex (`%231C201A`), with a comment naming the token.

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#EFE6CC` | text on desk and on the dark panel; empty-state text |
| `--ink` | `#1B1915` | text on the sheet |
| `--desk` | `#363D31` | page background |
| `--panel` | `#1B1F19` | compose column (from 800px wide) |
| `--cream` | `#E5DCBE` | input fill, Print key, labels on desk and panel |
| `--ink-field` | `#1C201A` | field text and field border, select arrow, icon strokes |
| `--ring` | `#8C8668` | lighter 2px outer ring of a field |
| `--brass` | `#B89255` | keys, badge, plate, caps, rivets, lock reason edge (`--accent` is an alias) |
| `--brass-hi` | `#E0C58E` | key highlight and hover, compose heading |
| `--brass-dark` | `#7C6234` | badge border, nameplate rule, rivet and cap shading |
| `--key-ink` | `#1F2123` | text and border of a key; text on brass |
| `--steel-hi` / `--steel` / `--steel-lo` | `#6A7064` / `#4A4F46` / `#2A2E27` | raised printer housing, tray lip |
| `--well` | `#0E100C` | housing border, tray well, ticker border, rivet shadow |
| `--hole` | `#3A3D34` | sprocket holes |
| `--perf` | `#CFC4A0` | dashed perforation beside the holes |
| `--sheet` / `--sheet-hi` | `#F2EAD0` / `#FAF4DE` | printer paper gradient |
| `--bezel` | `#1A1710` | ticker bezel (`--ticker` is an alias) |
| `--amber` | `#EAA023` | ticker digits, focus ring |
| `--crimson` | `#C72E24` | HOLD stamp |
| `--stamp` | `#A82A1E` | rejection text only |
| `--stamp-deep` | `#8F1D14` | warning mark and warning edge |
| `--muted` | `#5B5444` | secondary text on sheet and cream; text of a locked field |
| `--desk-muted` | `#BFC8BF` | hints and secondary text on desk and panel; "RELEASE IN" on the bezel; labels of a locked form |
| `--field` | `#F8F3E3` | rejection notice, warning strip |
| `--edge` | `#B9B08F` | fieldset border, claim row rule, inert key border |
| `--desk-dark` | `#232B26` | printer bar, paper stage floor, scrollbar track |
| `--platen-h` | `60px` | platen height (56 to 64px, taller than a 44px key) |

Decorative colour tokens (no text and no information sit on them, so they need no contrast ratio): `--roller-hi` `#4A4F4B`, `--roller-mid` `#232826` and `--roller-lo` `#141516` (platen roller shading); `--steel-*`, `--well`, `--hole`, `--perf`; `--shadow-ink` (`rgba(15, 18, 16, 0.45)`, inner shadow of recessed fields); `--grain` (`rgba(27, 25, 21, 0.035)`, paper grain, alpha at most 0.04); `--stamp-speckle` (`rgba(199, 46, 36, 0.18)`), the `--crimson` tone at low alpha for the ink speckle on the stamp (small dots, not a text colour).

Contrast (WCAG 2.x relative luminance, computed by hand from the hex values). Text needs 4.5:1, large text 3:1, borders and UI 3:1.

| Pair | Ratio |
|---|---|
| `--ink` on `--sheet` (wire text) | 14.6:1 |
| `--muted` on `--sheet` (perforation, empty state) | 6.26:1 |
| `--crimson` on `--sheet` (HOLD stamp text and border, large bold text) | 4.54:1 |
| `--ink-field` on `--cream` (field text, icon strokes) | 12.04:1 |
| `--muted` on `--cream` (locked field text) | 5.49:1 |
| `--cream` on `--panel` (labels) | 12.18:1 |
| `--cream` on `--desk` (labels on phone) | 8.25:1 |
| `--ring` on `--panel` (field outer ring, UI) | 4.55:1 |
| `--ring` on `--desk` (field outer ring on phone, UI) | 3.09:1 |
| `--key-ink` on `--brass` (key text, key border, plate text, badge) | 5.60:1 |
| `--key-ink` on `--brass-hi` (key hover) | 9.65:1 |
| `--key-ink` on `--cream` (Print) | 11.78:1 |
| `--brass` on `--desk` (key shape, lock reason edge, UI) | 3.93:1 |
| `--brass` on `--panel` (key shape, UI) | 5.79:1 |
| `--brass-hi` on `--desk` (compose heading) | 6.77:1 |
| `--brass-hi` on `--panel` (compose heading) | 9.98:1 |
| `--amber` on `--bezel` (ticker digits) | 8.13:1 |
| `--amber` on `--panel` (focus ring, UI) | 7.60:1 |
| `--amber` on `--desk` (focus ring, UI) | 5.15:1 |
| `--paper` on `--bezel` (release time) | 14.31:1 |
| `--desk-muted` on `--bezel` ("RELEASE IN") | 10.41:1 |
| `--paper` on `--desk` (also the lock reason line) | 9.06:1 |
| `--desk-muted` on `--desk` (hints, locked labels on phone) | 6.59:1 |
| `--desk-muted` on `--panel` (hints, locked labels, inert keys) | 9.72:1 |
| `--desk-muted` on `--desk-dark` (inert feed key in the printer bar) | 8.46:1 |
| `--edge` on `--desk` (fieldset border, action bar rule) | 5.21:1 |
| `--stamp` on `--field` (rejection notice) | 6.28:1 |
| `--ink` on `--field` (warning text) | 15.81:1 |
| `--stamp-deep` on `--field` (warning edge, mark fill) | 8.04:1 |
| `--field` on `--stamp-deep` (warning mark "!") | 8.04:1 |
| `--paper` on `--desk-dark` (printer bar text) | 10.8:1 |

A key never relies on its dark border for its boundary: the `--brass` fill (3.93:1 on `--desk`, 5.79:1 on `--panel`) draws it. Print (`--cream`) is 9.2:1 or more against `--panel` and the desk. Every text pair is at least 4.5:1 (the stamp is large bold text at 4.54:1) and every border or UI pair at least 3:1. The ratios were computed by hand and need a re-check if a hex changes.

`--stamp` and `--stamp-deep` are never used on `--desk`. Errors appear on `--field`, not on the desk.

**Type roles.** Paper: `--font-paper: "Courier New", Courier, "Liberation Mono", "DejaVu Sans Mono", ui-monospace, monospace`. Controls: `--font-ui: "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`. No web fonts, no network requests.
- Field text is paper mono, 16px (never smaller, stops iOS input zoom), line height 1.5. Labels are paper mono, 14px, uppercase, letter-spacing 0.04em (typewriter labels). Page title 20px. Keys use the control font, 14px; Print 16px bold.
- Paper: size is computed to fit 69 columns (see Layout), line height 1.35, `white-space: pre`.

**Spacing** (`--space-1`..`7`): 4, 8, 12, 16, 24, 32, 48px.
**Icons and feed keys** (no colour): `--icon-size: 20px` (calendar and clock icons), `--feed-key-pad-x: var(--space-3)` (horizontal padding of a feed key).
**Radius:** `--radius-paper: 1px` (near square, with a torn edge), `--radius-control: 2px` (inputs, square period corners), `--radius-key: 5px` (keys), `--radius-bar: 4px`, `--radius-panel: 6px`, `--radius-housing: 8px`, `--radius-stamp: 3px`.
**Borders and motion:** 2px control borders, 4px stamp border (`--border-stamp-heavy`). Transitions list their properties, last at most 120ms (the stamp lift is the one longer, 300ms, and is removed under reduced motion), and are never `transition: all`.

## Controls

- **Fields** have a cream fill (`--cream`), `--ink-field` text, a 2px `--ink-field` border and a lighter 2px outer ring (`--ring`, a box-shadow), with a soft inner shadow. `color-scheme: light` keeps native pickers matched. The select keeps `appearance: none` and its CSS triangle.
- **Date and time wells** (`#embargo-date`, `#embargo-time`) stay native `type="date"` and `type="time"` inputs with their labels and `aria-describedby`. They use the field recipe in the paper mono font (`--font-paper`), 16px. The picker indicator is restyled with an inline SVG data URI icon (a calendar for date, a clock for time) drawn in the `--ink-field` tone and sized by `--icon-size`. Firefox keeps its own icon; the well, font and border still apply.
- **Keys** (`.btn`) are brass keycaps: `--brass` fill, `--key-ink` text and 2px border, a 5px bottom edge (2px while pressed), a `--brass-hi` highlight on the top edge, at least 44px high (Remove on a claim row is shorter from 800px up, where it shares the label line). On `:active` the key moves down 3px. Hover is `--brass-hi`. "Sound on" adds bold text and a second inner ring, so it is not colour alone.
- **Feed key toolbar.** Mute, Export RSS and Export JSON feed sit in one element with `role="toolbar"` and `aria-label="Feed keys"` (`#nameplate-tools`), as a row of keys sharing the class `feed-key`. The BELL label is not inside the toolbar. All three keys are the same height (min 44px at every width), centred text on one line. The toolbar wraps to a second row on a phone, and every row keeps the same key height. An inert export key (nothing to export) uses the dashed `aria-disabled` edge in `--edge` with transparent fill, with the same border widths, so it keeps the same height.
- **Print** is the cream keycap: `--cream` fill, `--key-ink` text, the same border and 3px press as other keys.
- **Claim rows** are stacked at every width: the claim label and Remove on the first line (Remove right aligned), the claim text input full width, then the URL label and the URL input full width, with 4px gaps.
- **Form lock.** While a story is held, all fields sit in `fieldset#form-fields`, which is `disabled`. Print and Print instantly get `aria-disabled="true"` (the inert dashed look). The form is dimmed without `opacity`, so contrast holds: labels turn `--desk-muted`, field text `--muted`, borders become dashed, and keys inside the form drop their fill and get a dashed `--edge` border. A visible reason line `#lock-reason` reads "Story held. Release or cancel to compose." (`--paper` on `--desk`, 4px `--accent` left edge). The lock ends when the clock releases the story, or on Release now or Cancel embargo.
- **Held keys.** `.hold-keys` in the held area holds "Release now" (`#release-now`) and "Cancel embargo" (`#cancel-embargo`), ordinary keys at least 44px high. Release now prints at once through the same path as the clock release. Cancel embargo drops the story without printing, adds nothing to a feed, unlocks the form, announces "Embargo cancelled" in `#status` and moves focus to `#headline`.
- Focus ring is 3px `--amber` with 2px offset. Phone tap targets stay at least 44px.

## Layout

- The body is `min-height: 100vh` and never `overflow: hidden`. Under 800px the layout is one column (768px included); from 800px (820px included) it is two columns.
- Desktop (800px and up): `grid-template-columns: minmax(320px, 400px) minmax(0, 1fr)` (from 1100px: `minmax(520px, 40%) minmax(0, 1fr)`), gap `--space-6`. The shell fills the viewport height; the compose panel, the claims list and the paper scroll inside their own boxes. At 1440x900 the page does not scroll vertically in the empty, printed and held states. Left is the compose form on the dark `--panel` (2px `--well` border, `--radius-panel`). Right is the printer: a raised steel housing with the paper roll as a scrolling region (own vertical scroll, newest item at the bottom). Grid children get `min-width: 0`.
- Phone (390px wide): one column, form first, printer below, page margin `--space-2`. After a successful print, scroll the printer into view. Keys are at least 44px high.
- No sideways page scroll at any width. Check `document.documentElement.scrollWidth <= innerWidth` at 390px.
- **69 columns must fit.** The paper is a size container (`container-type: inline-size`). Paper font size is `clamp(12px, (100cqi - 2 * paper side padding - scrollbar room) / 42.8, 16px)` (`--paper-font-min`, `--paper-font-max`, `--paper-pad-x`); 42.8 is 69 columns times 0.62em, a safe upper bound for the mono stack. Lines are never re-wrapped for display, since wire text must stay byte-identical. Below the 12px floor (a 390px phone), or when the user zooms, the paper box (not the page) scrolls sideways (`overflow-x: auto`, `tabindex="0"`, labelled).
- **Each item is its own sheet** (`.item`, not `.paper`): a `--sheet` to `--sheet-hi` gradient over two layered `repeating-linear-gradient` grain lines (`--grain`, alpha 0.035), with a torn bottom edge made in CSS (`clip-path` zigzag, 6px teeth). No images.
- **Sprocket holes.** Each sheet has a hole strip down both edges, drawn by `::before` and `::after` with `radial-gradient(circle at 50% 14px, var(--hole) 5px, transparent 5.5px) 0 0 / <strip> 28px repeat-y`, 30px wide (24px under 800px, `--strip-w`), 6px from the edge (`--strip-inset`) and a dashed `--perf` inner line. The sheet side padding is `--paper-pad-x` (strip, inset and 12px), so holes never overlap wire text, and the text stays selectable.
- **Housing.** A raised steel panel: `--steel` to `--steel-lo` gradient, a `--steel-hi` highlight along the top, a `--well` border, side padding `--housing-pad-x` (24px) and top padding 24px.
- **Rivets.** Four `.rivet` elements, 12px, a brass radial gradient with a 1px `--well` shadow, 8px from the housing corners, above the caps in z-order. Each lies inside the housing and does not intersect either `.platen-cap`.
- **Platen.** `--platen-h` is 60px. The roller is a rounded cylinder gradient (`--roller-lo`, `--roller-hi` at 30%, `--roller-lo`). Two brass `.platen-cap` end caps, 40px tall (`--cap-h`), stand at the ends of the roller, centred on it and in front of it.
- **Paper tray.** `.paper-tray` (`aria-hidden`) is a darker well (`--steel-lo` to `--well`) with a lighter `--steel-hi` 3px top border (the lip) and an inset shadow, with a pile of folded paper inside.

## Printer behaviour

- **Feed:** output prints line by line. Per-character delay depends on the character, so it is deterministic: letter 14ms, space 8ms, punctuation 40ms, line end 140ms. Total print time is capped at 6s by scaling the delays down. A "Print instantly" button skips ahead to the finished item. There is no block cursor or print-head marker on the paper in any state.
- **Bell:** a FLASH item rings twice, a BULLETIN once. URGENT and routine items do not. A text label "BELL" appears next to the printer for 1.5s as a static inverted state (not a blink), also when muted.
- **Tear:** after the `-30-` line the item is cut. The finished item shifts 3px for 120ms and keeps its torn edge, with `--space-5` before the next item. The cut plays one thunk.
- **HOLD:** an embargoed item prints as a held proof with a stamp box above the slug reading `HOLD UNTIL <release time>`: `--crimson` text, a 4px double `--crimson` border (an uneven, inked edge), a CSS ink speckle, rotated about -10deg, uppercase bold mono, 1.6em. It sits in the flow of the sheet with margins (24px above, 32px below) that clear the swing of the rotated corners, so it never covers wire text. It is text, never colour alone. No glow. A held item does not go to any feed. Visual order on a held sheet: the stamp first, the countdown digits second.
- **Ticker:** under the held proof, a dark recessed bezel (`.ticker`, `--bezel` fill, 4px `--well` border) shows the label "RELEASE IN", the `T-hh:mm:ss` digits (`.ticker-digits`, also `.countdown-label`, `--amber`, tabular digits, wide tracking, a hairline seam across the middle) and the release time. The digits are at least 32px from 800px wide and at least 24px on a phone. The ticker is not a live region.
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
- `:focus-visible` ring on every interactive element: 3px `--amber` outline, 2px offset (5.15:1 on `--desk`, 7.60:1 on `--panel`). Never `outline: none` without a replacement.
- Tap targets at least 44 by 44px, including the mute toggle, Print instantly, the held keys and links in the rejection list.
- Every field has a real `<label for>`, not placeholder-only. Hints are linked with `aria-describedby`.
- The paper has `aria-live="off"`. A separate visually hidden `role="status"` region (polite) gets the finished item text in one update after printing ends, then is cleared about 1s later so it is read once. Never announce per character.
- Keyboard-only use works end to end: fill, print, skip, mute, release now, cancel, read the paper. Tab order follows reading order. Esc has no hidden behaviour.
- Errors are text with a "NOT RELEASED" prefix and a per-claim sentence. Colour only reinforces.

## Do not

- No emoji as icons. Use text or inline SVG drawn for the purpose.
- No stock photos or bitmap textures.
- No invented metrics, user counts or testimonials. All numbers shown come from the draft.
- No marketing hero or landing copy. The app opens on the working compose form and printer.
- No purple gradients, glow shadows, gradient text, cards inside cards, or `transition: all`.
- No block cursor character (U+2588) or `.caret` block on the paper.
