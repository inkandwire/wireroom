# Requirements: teletype-polish

Scope: fix exactly five defects found in a design review of the running app (1440x900 desktop, self-check about 6/10). The look stays "mid-century wire room" (`.kiro/steering/design.md`). Native `input`, `textarea`, `select` and `button` elements stay. No custom dropdown, no custom date picker, no new dependency, no web fonts, no images. Anything not listed here is out of scope. Base behaviour is in `.kiro/specs/teletype-ui/`; this spec only refines it.

Terms: "the form" is `#compose-form` plus its action bar. "The printer" is the `.printer` section. "Desktop" is a viewport 900px wide or more. "Phone" is below 900px.

## Fix 1: clipped body textarea

### Requirement 1

**User story:** As a founder, I want to see the first line of the body in full, so that I can read what I type.

1. The textarea `#body` SHALL show the top of the letters of its first line in full, with no cut by the border, at 390px, 900px and 1440px width.
2. WHEN the textarea is scrolled to the top, THE first line SHALL still show in full.
3. THE textarea SHALL show at least 5 full lines of text (content height of at least 5 times its line height).
4. THE fix SHALL change the cause (line height, padding or box height against font metrics) and SHALL NOT hide the clip with negative margins, overlays or `overflow` tricks.

## Fix 5: Sources footer, one URL per line

### Requirement 2

**User story:** As a reader of the wire, I want each source URL on its own line, so that a link never runs into the claim text.

1. THE `Sources:` footer in `src/core/compose.ts` SHALL print, for each claim with a source URL, the numbered claim text (`N. text`) wrapped to 69 columns as today, followed by the URL on its own line.
2. THE URL line SHALL be the URL preceded by exactly 3 spaces (the width of `1. `).
3. THE URL SHALL never be wrapped or broken. A URL longer than 66 characters SHALL stay whole on its own line, and that line MAY exceed 69 columns. This is the only exception to the 69-column rule and SHALL be documented in `design.md` and in a comment at the footer code.
4. IF a footer entry has no URL, THEN THE footer SHALL print no URL line for it.

### Requirement 3

**User story:** As a maintainer, I want the data and the gate unchanged, so that this is a presentation fix only.

1. THE item JSON fields `claims` and `sources`, the claim gate, the embargo rules and `-30-` ending SHALL stay as they are.
2. THE same draft and the same clock input SHALL give byte-identical text, with `\n` line endings.
3. THE property tests SHALL state: every URL appears whole on a line of its own, preceded only by 3 spaces; every line that is not such a URL line is at most 69 columns; the text ends with `-30-`.

## Fix 2: form too tall, printer column empty

### Requirement 4

**User story:** As a founder on a laptop, I want the whole form and the Print button in view, so that I do not scroll to find them.

1. WHILE the viewport is 1440x900 AND the form has one claim row AND the printer is empty, THE page `scrollHeight` SHALL be at most the viewport height, with the embargo fields and the Print button fully visible.
2. FROM 900px width up, THE form SHALL be compact: city and priority on one row, embargo date and time on one row, the two example buttons as small secondary buttons next to the form heading, shorter hints.
3. WHEN there are many claim rows, THE claims list SHALL scroll inside its own region (`max-height`), and the page SHALL NOT grow.
4. THE hints that tell the rules (source URL needed, time is UTC) SHALL stay, in shortened form, and stay linked with `aria-describedby`.

### Requirement 5

**User story:** As a founder, I want the printer to use the right-hand side of the screen, so that the page feels balanced.

1. FROM 900px width up, THE printer column SHALL be a full-height region (sticky) whose body fills the column height.
2. WHEN a long item prints, THE paper SHALL scroll inside the printer and the page height SHALL NOT change.
3. BELOW 900px, THE layout SHALL stay one column, form first, as now. THE page SHALL NOT scroll sideways at 390px (`scrollWidth <= innerWidth`).

## Fix 3: platen and paper feed

### Requirement 6

**User story:** As a visitor, I want the printer to look like a machine, so that the paper feels like it comes out of something.

1. THE printer SHALL be a housing: a desk-coloured body with a rounded-square top bar that holds the printer nameplate, the BELL label and the controls (mute toggle, Print instantly).
2. UNDER the bar, THE printer SHALL show a dark platen roller: a horizontal cylinder made with CSS gradients only, with brass end caps and a thin slot line.
3. THE roller SHALL be decoration: `aria-hidden="true"`, no text, no information, no focus.

### Requirement 7

**User story:** As a visitor, I want the paper to come out from under the roller, so that there is no floating sheet.

1. THE top edge of the paper SHALL sit under the roller with no visible gap between roller and paper, and the roller SHALL cast a soft shadow on the top of the paper.
2. THE paper SHALL keep 69-column text, the torn edge at the end of an item, the perforation, and the existing behaviour of `src/ui/printer.ts`.
3. EVERY existing element id and class used by `src/ui/printer.ts`, `src/ui/main.ts` and the tests SHALL stay. A wrapper MAY be added in `index.html`.
4. THE HOLD stamp and the rejection notice SHALL stay readable and keep their contrast on top of the new housing, and the stamp SHALL NOT cover wire text.

### Requirement 8

**User story:** As a visitor sensitive to motion, I want the new parts to be calm.

1. THE housing SHALL use CSS gradients only (no images), no `transition: all`, and transitions of at most 120ms that list their properties.
2. WHILE `prefers-reduced-motion: reduce` is set, THE housing SHALL have no animation and no transition.

## Fix 4: period-style controls

### Requirement 9

**User story:** As a visitor, I want the controls to match the 1970s look.

1. THE inputs, textarea and select SHALL have square or 2px-radius corners and a stepped double border or inset bevel with a dark inner shadow, so they look recessed into the desk.
2. THE field text SHALL use `--font-paper` at 16px. Labels SHALL stay uppercase with a typewriter feel.
3. THE priority select SHALL keep `appearance: none` with the drawn arrow.
4. ONLY CSS (`style.css`, `tokens.css`, `printer.css`) SHALL change for this fix. The native elements and their behaviour stay.

### Requirement 10

**User story:** As a visitor, I want buttons that look like keys.

1. THE Print button SHALL look like a keycap: flat top, brass, a 3px darker bottom edge. WHEN pressed (`:active`) it SHALL move down 2px.
2. THE secondary buttons (Add claim, Remove, the examples, mute) SHALL be smaller grey-green keys with the same press behaviour.
3. THE `aria-disabled` state SHALL stay visible by more than colour (dashed edge, as now).

### Requirement 11

**User story:** As a keyboard or phone user, I want the controls to stay usable.

1. THE focus ring SHALL stay the 3px brass ring with 2px offset on every interactive element and SHALL stay visible against the new surfaces.
2. ON phone widths, THE tap targets SHALL stay at least 44px by 44px. At desktop widths the small secondary keys MAY be smaller visually but SHALL keep a hit area of at least 24px by 24px and 16px text.
3. THE controls SHALL stay at 16px text or larger.

### Requirement 12

**User story:** As a maintainer, I want the colour rules to stay checkable.

1. EVERY new colour SHALL be a token in `tokens.css`. Components SHALL use tokens, not raw hex.
2. `.kiro/steering/design.md` SHALL list the contrast ratio of every new text, border and focus pair. Text needs 4.5:1, large text and field borders 3:1.
3. `--stamp` SHALL NOT be used on `--desk` or on the housing.
