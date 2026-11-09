# Requirements: design-pass-2

Two design reviews of the running app (1440x900, printed and held states) scored it 6/10 and agreed on eight fixes. This spec covers exactly those eight. The look stays "mid-century wire room". Visual rules come from `.kiro/steering/design.md`; the earlier polish is in the `teletype-polish` spec and is not repeated here. "The system" is the browser UI in `src/ui`, `index.html` and `src/ui/*.css`.

## Fix 1: Empty printer bay

1.1 THE system SHALL draw a paper tray at the bottom of the printer body, as an `aria-hidden` element with class `paper-tray`, using CSS only.

1.2 WHEN the printer holds one or more printed items, THE system SHALL show the paper running down into the tray with a folded-paper edge, so the area below the last item is the tray and not bare desk colour.

1.3 THE system SHALL keep every earlier printed item in the feed, in print order with the newest at the feed end, as now.

## Fix 2: Date and time inputs

2.1 THE system SHALL keep `#embargo-date` as `type="date"` and `#embargo-time` as `type="time"`, with their labels and `aria-describedby`.

2.2 THE system SHALL style both inputs as recessed wells in the paper monospace font (`--font-paper`), with a 2px `--edge` border (at least 3:1 on `--desk`) and a themed calendar icon and clock icon in `--ink`, drawn from inline SVG data URIs or a restyled `::-webkit-calendar-picker-indicator`.

## Fix 3: Feed key toolbar

3.1 THE system SHALL place Mute (`#mute-toggle`), Export RSS (`#export-rss`) and Export JSON (`#export-json`) in one element with `role="toolbar"` and an `aria-label`, laid out as one horizontal row.

3.2 THE system SHALL give the three keys the same computed height and the same key style.

3.3 WHILE the viewport is phone width, THE system SHALL allow the toolbar to wrap to two rows, and each key SHALL keep equal height and a tap target of at least 44px.

## Fix 4: Held state

4.1 WHEN an item is held, THE system SHALL show the countdown as a ticker: a dark recessed strip (`.ticker`) with the label "RELEASE IN" and the `T-hh:mm:ss` digits in a segmented-display look made with CSS.

4.2 THE ticker digits SHALL be at least 32px on desktop and at least 24px on phone, and the ticker SHALL not be a live region (`aria-live` stays off).

4.3 THE system SHALL keep the existing clock loop behaviour and its tests: the digits are still updated through `.countdown-label`.

4.4 THE HOLD stamp SHALL have a border of at least 4px, the text colour `--stamp-deep` (at least 4.5:1 on `--paper`), a CSS-only ink speckle, and a rotation of about -3deg, and SHALL not cover wire text.

## Fix 5: Form locked while held

5.1 WHILE a story is held, THE system SHALL disable the compose form fields (`fieldset disabled` or `inert`), set `aria-disabled="true"` on Print and Print instantly, and dim the form.

5.2 WHILE a story is held, THE system SHALL show a visible reason line, "Story held. Release or cancel to compose.", and the two keys "Release now" (`#release-now`) and "Cancel embargo" (`#cancel-embargo`) in the held area.

5.3 WHEN the user presses "Release now", THE system SHALL print the story at once through the same path as the clock release (`onClockRelease`), and the claim gate SHALL still have passed before the hold.

5.4 WHEN the user presses "Cancel embargo", THE system SHALL drop the held story without printing it, add nothing to any feed, unlock the form, and announce "Embargo cancelled" in `#status`.

5.5 WHEN the clock releases a held story, or the story is released or cancelled, THE system SHALL unlock the form and remove the reason line and the two keys.

## Fix 6: Stray block cursor

6.1 THE system SHALL not show a block cursor (U+2588 or a `.caret` block) on the printed paper, in any state; the `.caret` element and its CSS SHALL be removed.

6.2 THE only blinking caret allowed SHALL be on the headline text being typed, and it SHALL not blink under `prefers-reduced-motion: reduce`.

## Fix 7: Brass rivets

7.1 THE system SHALL show a brass rivet at each of the four corners of the printer housing, as `aria-hidden` elements or pseudo-elements.

## Fix 8: Warning text

8.1 THE system SHALL keep the exact sentence "Kept in this page only. Closing it cancels the release." in a visible warning strip (`.hold-warning`) near the held area, with a small `aria-hidden` warning mark.

8.2 THE sentence SHALL be at least 14px on desktop and at least 16px on phone, with at least 4.5:1 contrast on its background.

## Global constraints

9.1 THE system SHALL add no dependency, no web font, no image file and no `transition: all`; every new colour SHALL be a token in `tokens.css` with its contrast in `design.md`; `prefers-reduced-motion` SHALL stay honoured.

9.2 THE system SHALL keep every existing element id and the `src/ui/printer.ts` tests passing, and SHALL keep the phone layout (390x844) intact: tap targets of at least 44px and `scrollWidth <= innerWidth`.

9.3 AT 1440x900, in the empty, printed and held states, THE page SHALL not scroll: `scrollHeight <= innerHeight`.
