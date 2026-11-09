# Requirements: teletype-ui

## Introduction

The teletype UI is a single-page Vite app in `src/ui`. It sits on top of the pure core (`src/core`, imported only through `src/core/index.ts`). The page opens on the working app: a compose form on one side and a teletype printer with a paper roll on the other.

The look, tokens, layout, printer behaviour, sound and accessibility rules are fixed by `.kiro/steering/design.md`. This spec points to that file instead of repeating every value, and states the testable behaviour. The product rules in `product.md` (claim gate, embargo clock) are never weakened by presentation.

## Glossary

- **App**: the single page built from `index.html` and `src/ui`.
- **Form**: the compose form.
- **Printer**: the right-hand (or lower, on a phone) region with the paper roll.
- **Paper**: the scrolling region inside the Printer where items print.
- **Draft**: the core `Draft` type.
- **Result**: the core `ComposeResult`, with status `RELEASED`, `HELD` or `REJECTED`.
- **Timeline**: the ordered list of playback events built by `src/ui/playback.ts` from wire text and a priority.
- **Clack, thunk, bell**: the three synthesised sounds.
- **Unlocked**: the audio context has been created or resumed inside a user click or key press.
- **Reduced motion**: `prefers-reduced-motion: reduce` is set.
- **Sample data**: the made-up company, story and `example.com` URLs used by the two example buttons.

## Requirements

### Requirement 1: Page opens on the working app

**User Story:** As a founder, I want the page to open on the form and the printer, so that I can start without any landing copy.

#### Acceptance Criteria

1. WHEN the page loads, THE App SHALL show the Form and the Printer, with no hero, landing copy, sign-in or other screen before them.
2. WHEN the page loads, THE Form SHALL show exactly one empty claim row.
3. WHEN the page loads, THE Paper SHALL show an empty state that says nothing has been printed yet, and SHALL NOT show any item.
4. THE App SHALL set a page `<title>` of "WireRoom" and a single `<h1>` of 20px size per `design.md`.
5. THE App SHALL work as plain static files built by `vite build` into `dist/`, with relative asset paths, no server, no runtime network request, no web font and no API key.

### Requirement 2: Compose form fields

**User Story:** As a founder, I want clearly labelled fields for my news, so that I can fill them without help.

#### Acceptance Criteria

1. THE Form SHALL provide these fields, each with a real `<label for>`: dateline city (text), headline (text), body (textarea), priority (select with FLASH, BULLETIN, URGENT, ROUTINE), embargo date and embargo time (both optional).
2. THE Form SHALL label the embargo fields with the text "UTC" so that the time zone is visible, and SHALL link a hint to them with `aria-describedby` that says the time is UTC.
3. THE Form SHALL provide a hint for the body that says paragraphs are separated by a blank line.
4. THE Form SHALL default priority to ROUTINE.
5. THE Form SHALL provide a "Print" submit button.
6. WHEN the user presses Enter inside a single-line field, THE Form SHALL submit as if "Print" were pressed.
7. THE Form SHALL use a control font size of at least 16px so that mobile browsers do not zoom on focus.

### Requirement 3: Repeatable claim rows

**User Story:** As a founder, I want to list each factual claim with its source, so that the gate can check them.

#### Acceptance Criteria

1. THE Form SHALL show claim rows, each with a claim-text field and a source-URL field, both with real labels that include the row number.
2. THE Form SHALL provide an "Add claim" button that appends one empty row after the last row and moves focus to the new row's claim-text field.
3. THE Form SHALL provide a "Remove" button on each row.
4. WHEN the user removes a row, THE Form SHALL renumber the remaining labels and ids, and SHALL move focus to the "Add claim" button if no row follows, otherwise to the next row's claim-text field.
5. WHILE only one claim row exists, THE Form SHALL keep that row, and "Remove" on it SHALL clear its two fields instead of removing the row.
6. THE Form SHALL keep claim rows in the order the user sees them.

### Requirement 4: Example buttons with sample data

**User Story:** As a visitor, I want ready-made examples, so that I can see the claim gate and the printer work in one click.

#### Acceptance Criteria

1. THE Form SHALL provide two buttons named "Example: all claims sourced" and "Example: one claim unsourced".
2. WHEN the user presses either example button, THE Form SHALL replace all field values with the sample story for a made-up company and SHALL NOT print by itself.
3. THE sample story SHALL use only `example.com` style URLs, SHALL use no real company, person or brand, and SHALL follow the AP-style rules in `product.md` (numerals for 10 and up, attribution after the claim, no hype adjectives).
4. THE App SHALL show visible copy next to the example buttons stating that the examples are sample data about a made-up company.
5. WHEN the user presses "Example: all claims sourced" and then "Print", THE App SHALL print the item.
6. WHEN the user presses "Example: one claim unsourced" and then "Print", THE App SHALL reject the draft and SHALL name the claim that has no source.
7. WHEN the user fills the missing source URL of the unsourced example with a valid `http` or `https` URL and presses "Print", THE App SHALL print the same draft.
8. THE two examples SHALL differ only in the one missing source URL.

### Requirement 5: Form to draft mapping and the clock

**User Story:** As a maintainer, I want the form mapped to a core draft in one pure function, so that the mapping is testable and the clock is read in one place.

#### Acceptance Criteria

1. THE form mapper SHALL produce a core `Draft` from form values and a `now` string passed in as an argument.
2. THE form mapper SHALL keep the order of the claim rows it keeps, and SHALL keep every row whose claim text is not blank after trimming.
3. THE form mapper SHALL drop every row whose claim text is blank after trimming, regardless of its URL field.
4. WHEN a kept row has a blank URL field, THE form mapper SHALL omit `sourceUrl` for that claim (so that the core claim gate reports it).
5. THE form mapper SHALL trim surrounding whitespace on city, headline, claim text and URL, and SHALL otherwise pass text to the core unchanged. It SHALL NOT repair, guess or add a URL.
6. WHEN an embargo date is given, THE form mapper SHALL build `YYYY-MM-DDTHH:mm:ssZ` from the date and the time (a missing time means `00:00`), as an ISO 8601 UTC instant that `parseInstant` accepts.
7. WHEN the embargo date is empty, THE form mapper SHALL omit `embargo`.
8. IF the embargo fields are filled but do not form a valid instant, THEN THE form mapper SHALL omit `embargo` from the draft AND SHALL report `embargoInvalid`, AND THE App SHALL NOT print and SHALL show an error that names the embargo fields.
9. THE form mapper SHALL return, with the draft, the form row index of every kept claim, so that a failure index in the draft can be linked to its form row.
10. THE form mapper SHALL NOT mutate its input and SHALL NOT read the clock.
11. WHEN the user presses "Print", THE UI entry `src/ui/main.ts` SHALL be the only module that reads the clock, and SHALL pass that value to the mapper as the `now` of the draft, as an ISO 8601 UTC string with a trailing `Z`.

### Requirement 6: Claim gate result and rejection notice

**User Story:** As a founder, I want to be told exactly which claim lacks a source, so that I can fix it.

#### Acceptance Criteria

1. WHEN the Result is `REJECTED` with failures, THE Printer SHALL print nothing, SHALL make no sound and SHALL NOT show the BELL label.
2. WHEN the Result is `REJECTED` with failures, THE App SHALL show a notice with `role="alert"` on the `--field` fill, and SHALL move keyboard focus to it.
3. THE notice SHALL begin with "NOT RELEASED: N claims have no source." where N is the number of failing claims, and "NOT RELEASED: 1 claim has no source." when N is 1.
4. THE notice SHALL list one sentence per failing claim, in claim order, and each sentence SHALL contain the claim text.
5. WHEN a failure reason is `MISSING_SOURCE`, THE sentence SHALL read `Claim "<text>" has no source URL. Add a link that backs it up.`
6. WHEN a failure reason is `INVALID_SOURCE`, THE sentence SHALL say the source is not a valid web address and ask for a full `http` or `https` link.
7. THE notice SHALL NOT suggest, invent or fill in a source.
8. WHEN the user activates a list entry, THE App SHALL move focus to the source-URL field of that claim's row.
9. WHEN the Result is `REJECTED` with time errors only (a bad clock value or embargo), THE notice SHALL begin with "NOT RELEASED:" and say which time value is not valid.
10. WHEN a later print succeeds or is held, THE App SHALL remove the earlier notice.
11. THE notice text SHALL be text with the "NOT RELEASED" prefix, so that colour is never the only signal.

### Requirement 7: Embargo hold

**User Story:** As a founder, I want an embargoed item held and clearly marked, so that nothing goes out early.

#### Acceptance Criteria

1. WHEN the Result is `HELD`, THE Printer SHALL print a held proof that contains a stamp box above the slug reading `HOLD UNTIL <release time>`, in uppercase bold monospace, rotated -3deg, with a 3px `--stamp` border.
2. THE held proof SHALL show the slug and the priority word, and SHALL state that the text is withheld until release. It SHALL NOT show the wire text, the body, the claims or the `-30-` end marker.
3. THE release time in the stamp SHALL be formatted as `YYYY-MM-DD HH:mm UTC` without any locale API.
4. THE stamp SHALL never cover other text.
5. WHEN the Result is `HELD`, THE Printer SHALL NOT ring the bell or show the BELL label, and THE App SHALL NOT expose the item to any feed.
6. WHEN an embargo equals the draft's `now`, THE App SHALL print the item as `RELEASED` (the core decides; the UI adds no second rule).

### Requirement 8: Printed released item

**User Story:** As a founder, I want my released news to print exactly as the wire text, so that what I see is what goes out.

#### Acceptance Criteria

1. WHEN the Result is `RELEASED`, THE Printer SHALL print `item.text` from the core byte for byte (no re-wrapping, no trimming, no added characters) in a `white-space: pre` monospace block.
2. THE printed item SHALL include the numbered `Sources:` footer exactly as it appears in the wire text, and SHALL end with `-30-`.
3. THE Paper SHALL keep earlier items above later ones, with the newest at the bottom, and SHALL scroll to keep the line being printed in view.
4. THE App SHALL NOT add a second, different rendering of the wire text for display (the text node content equals the wire text).

### Requirement 9: Playback timeline

**User Story:** As a maintainer, I want the print rhythm as pure data, so that it is deterministic and testable.

#### Acceptance Criteria

1. THE playback module SHALL build a Timeline from wire text, a priority and a `reducedMotion` flag, as a pure function with no DOM, no clock and no randomness.
2. THE Timeline SHALL contain one `char` event per character other than `\n`, and one `newline` event per `\n`, in wire order. Joining the `char` characters and `\n` for the `newline` events, in order, SHALL give back the wire text exactly.
3. THE Timeline SHALL use these delays: 14 ms after a letter or digit, 8 ms after a space, 40 ms after any other character (punctuation), 140 ms after a line end.
4. THE Timeline event times SHALL never decrease from one event to the next, and every event time SHALL be a non-negative integer number of milliseconds.
5. WHEN the sum of the delays exceeds 6000 ms, THE Timeline SHALL scale all times down so that the last event time is at most 6000 ms. WHEN the sum is 6000 ms or less, THE Timeline SHALL use the delays unscaled.
6. THE Timeline SHALL end with exactly one `tear` event that comes after the last character and the last line end.
7. WHERE the priority is FLASH, THE Timeline SHALL contain exactly two `bell` events. WHERE the priority is BULLETIN, THE Timeline SHALL contain exactly one `bell` event. WHERE the priority is URGENT or ROUTINE, THE Timeline SHALL contain no `bell` event.
8. WHEN `reducedMotion` is true, THE Timeline SHALL put every event at time 0, so that the whole text is available at time 0.
9. THE Timeline SHALL give the same result for the same input, byte for byte.
10. THE playback module SHALL provide a pure function that returns the text printed up to a given time, and the printed text at the time of the last event SHALL equal the wire text.

### Requirement 10: Animated printer and Print instantly

**User Story:** As a founder, I want the machine to type my item line by line, and to be able to skip ahead.

#### Acceptance Criteria

1. WHEN an item is printed and Reduced motion is not set, THE Printer SHALL add characters to the Paper following the Timeline, line by line.
2. WHEN Reduced motion is set, THE Printer SHALL show the finished item at once, with no typing animation, no tear shift and no smooth scrolling.
3. WHILE an item is printing, THE App SHALL show a "Print instantly" button, and WHEN the user activates it, THE Printer SHALL show the finished item at once and run the end-of-item steps (tear, status message) once.
4. WHILE no item is printing, THE "Print instantly" button SHALL be hidden or `disabled`, with an accessible state that says why.
5. WHILE an item is printing, THE "Print" and the two example buttons SHALL be inert (`aria-disabled="true"` and ignoring activation) so that a second print cannot start, and the Form fields SHALL stay readable.
6. WHEN the printing ends (by finishing or by "Print instantly"), THE App SHALL make "Print" and the example buttons active again and SHALL NOT lose the user's focus position.
7. THE Printer SHALL NOT start a second print while one is running, and SHALL NOT leave a timer running after an item ends.
8. WHEN a print ends, THE App SHALL scroll the Printer into view on a phone-width layout.

### Requirement 11: Bell label and paper tear

**User Story:** As a visitor, I want a visible bell cue and a cut after the end marker, so that the machine feels real even without sound.

#### Acceptance Criteria

1. WHEN a `bell` event plays, THE Printer SHALL show a text label "BELL" next to the printer for 1.5 s as a static inverted state (not a blink), also when sound is muted.
2. WHEN the `tear` event plays, THE Printer SHALL mark the item as cut, shift it 3px for 120 ms, keep its torn bottom edge, leave `--space-5` before the next item, and call the thunk sound once.
3. WHEN Reduced motion is set, THE Printer SHALL show the "BELL" label for a bell event but SHALL NOT play key clacks, SHALL NOT shift the item, and SHALL NOT animate.
4. WHERE the priority is FLASH, THE bell SHALL ring twice. WHERE it is BULLETIN, THE bell SHALL ring once. Otherwise the bell SHALL NOT ring.

### Requirement 12: Synthesised sound

**User Story:** As a visitor, I want a quiet, optional typing sound that never surprises me.

#### Acceptance Criteria

1. THE sound module SHALL synthesise all sound with WebAudio and SHALL use no audio file.
2. THE sound module SHALL receive a factory that creates the audio context, and a clock function, as injected arguments.
3. WHEN no unlock has happened, THE sound module SHALL NOT call the factory, create any node or start any source, and SHALL NOT throw.
4. WHEN `unlock` is called (inside the first user click or key press), THE sound module SHALL create the single audio context through the factory, create one master gain, and resume the context.
5. IF the factory is missing, returns nothing, or throws, THEN THE sound module SHALL stay silent and SHALL NOT throw from any call.
6. THE sound module SHALL start muted. WHILE muted, THE sound module SHALL NOT start any node, though `unlock` MAY still create the context.
7. THE master gain SHALL be set to at most 0.25, and every voice SHALL connect only through the master gain, so that no sound has an effective gain above 0.25.
8. THE key clack SHALL be a 25 ms white-noise burst through a band-pass filter (centre between 1800 Hz and 2500 Hz chosen from the character code, Q 1.2) with gain 0.6 falling exponentially to 0.001 over 30 ms.
9. THE sound module SHALL make no clack for a space, and for a newline.
10. THE sound module SHALL allow at most 40 clacks in any 1000 ms window measured with the injected clock, and SHALL drop the rest.
11. THE carriage-return thunk SHALL be a 90 ms noise burst through a low-pass at 220 Hz, with gain 0.5 falling exponentially to 0.001.
12. THE bell SHALL be sine partials at 1320 Hz, 3168 Hz and 5148 Hz with gains 1, 0.5 and 0.25, decaying exponentially to 0.0001 over 1.4 s.

### Requirement 13: Mute toggle

**User Story:** As a visitor, I want to turn sound on myself, with the keyboard if I like.

#### Acceptance Criteria

1. THE App SHALL show a visible `<button>` with the accessible name "Mute sound" and `aria-pressed`, starting `true`.
2. THE button SHALL show the visible text "Muted" when pressed state is true and "Sound on" when false, and its accessible name SHALL NOT change.
3. WHEN the user presses the button the first time, THE App SHALL call `unlock` in that same event handler, and then toggle the muted state.
4. THE App SHALL also call `unlock` from the first click or key press anywhere on the page, once, and SHALL NOT make any sound from it.
5. THE button SHALL be at least 44 by 44 px and be reachable and operable by keyboard.

### Requirement 14: Accessibility and motion

**User Story:** As a user of assistive technology or a keyboard, I want the whole app to work for me.

#### Acceptance Criteria

1. THE App SHALL show a `:focus-visible` ring on every interactive element: a 3px `--accent` outline with a 2px offset. THE App SHALL NOT remove an outline without a replacement.
2. THE App SHALL make every button, select, link and input at least 44 by 44 px, including "Print instantly", the mute toggle and the links in the rejection list.
3. THE Paper SHALL have `aria-live="off"`.
4. THE App SHALL provide a separate visually hidden region with `role="status"` and polite announcement.
5. WHEN an item has finished printing, THE App SHALL put the finished item text into the status region in one update, and SHALL clear it about 1 s later, so that it is read once. It SHALL NOT announce per character.
6. WHEN the item is held, THE status region SHALL carry the hold sentence instead of wire text.
7. WHEN a field has a hint, THE hint SHALL be linked with `aria-describedby`.
8. THE App SHALL be usable by keyboard end to end: fill, add and remove claims, print, skip, mute, read the paper. THE tab order SHALL follow reading order, and Esc SHALL have no hidden behaviour.
9. WHEN the paper box can scroll sideways, THE Paper SHALL have `tabindex="0"` and an accessible label.
10. WHEN Reduced motion is set, THE App SHALL use no screen shake, no smooth scrolling, no typing animation and no tear shift.
11. THE App SHALL NOT use `transition: all`, and every transition SHALL list its properties and last at most 120 ms.

### Requirement 15: Layout and 69 columns

**User Story:** As a founder on a phone or a desktop, I want the whole 69-column line to be visible.

#### Acceptance Criteria

1. WHEN the viewport is 900px wide or more, THE App SHALL show two columns, `grid-template-columns: minmax(320px, 400px) minmax(0, 1fr)` with a `--space-6` gap, Form on the left and Printer on the right, with `min-width: 0` on grid children.
2. WHEN the viewport is under 900px wide, THE App SHALL show one column with the Form first and the Printer below, and a page margin of `--space-2`.
3. THE App SHALL NOT scroll sideways at any width: `document.documentElement.scrollWidth <= innerWidth` at 390px.
4. THE Paper SHALL be a size container (`container-type: inline-size`) with a font size of `clamp(8px, (100cqi - 2 * paper padding) / 42.8, 16px)`, so that 69 columns fit at 390px (about 8px) and the size reaches 16px at 1280px.
5. THE App SHALL NOT re-wrap wire lines for display.
6. WHEN the 69 columns cannot fit even at the 8px floor, or the user zooms, THE Paper box (not the page) SHALL scroll sideways with `overflow-x: auto`.
7. THE Paper SHALL be a 1px-radius rectangle in `--paper` with a torn bottom edge made with a CSS `clip-path` zigzag with 6px teeth, and no image.
8. THE Printer's Paper SHALL scroll vertically on its own, with the newest item at the bottom.

### Requirement 16: Visual language

**User Story:** As the product owner, I want the look to match `design.md` exactly.

#### Acceptance Criteria

1. THE App SHALL define all colours, fonts, spacing, radii and motion values as CSS custom properties in one `:root` block in `src/ui/tokens.css`, with the names and values in `design.md`.
2. THE components SHALL use tokens only, with no raw hex colour or raw pixel value outside `tokens.css`, except for the layout values `design.md` states as numbers (breakpoint, column bounds, tooth size, tap-target minimum).
3. THE App SHALL use `--stamp` only for the HOLD stamp and rejection text, and only on `--paper` or `--field`, never on `--desk`.
4. THE App SHALL use the font stacks `--font-paper` and `--font-ui`, and no web font.
5. THE App SHALL use no emoji as icons, no stock photo, no bitmap texture, no invented metric or testimonial, no purple gradient, no glow shadow, no gradient text and no card inside a card.
6. THE controls SHALL be 16px with line height 1.5, labels 14px uppercase with letter spacing 0.04em, and paper line height 1.35.

### Requirement 17: Architecture and testability

**User Story:** As a maintainer, I want thin DOM code and tested pure code, with no new dependencies.

#### Acceptance Criteria

1. THE UI code SHALL import from the core only through `src/core/index.ts`, and SHALL NOT change any file in `src/core`.
2. THE spec SHALL add files only in `src/ui` and `index.html` at the repository root.
3. THE spec SHALL add no dependency; only `vite`, `vitest`, `fast-check` and `typescript` from the existing `devDependencies` SHALL be used.
4. THE DOM code SHALL live only in `main.ts` and `printer.ts`. `playback.ts`, `sound.ts` and `form.ts` SHALL contain no DOM access, no global `AudioContext`, `window`, `document`, `Date.now()` or `performance.now()`.
5. THE unit tests SHALL run in the existing node environment, using the sound module with an injected fake audio context and an injected clock.
6. THE property tests SHALL cover: (a) the Timeline, (b) the form mapper, (c) the rejection messages, (d) the sound module, as listed in `design.md`.
7. THE App SHALL use `\n` line endings in all wire text it handles, and named exports only.
