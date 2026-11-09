# Design: teletype-ui

This design follows `.kiro/steering/design.md` (look, tokens, layout, printer, sound, accessibility), `tech.md`, `structure.md` and `product.md`. Where this file says "per design.md", the numbers live in the steering file and are not copied here, except where code needs them.

## Overview

A single-page Vite app. `src/core` is already finished and is not touched. The UI adds five pure-or-thin modules and the page files.

```
index.html              page skeleton (root, replaces the placeholder)
src/ui/
  playback.ts           PURE  wire text -> timeline of events
  sound.ts              PURE* WebAudio synth, injected AudioContext factory + clock
  form.ts               PURE  form values -> Draft, rejection messages, examples, hold text
  printer.ts            DOM   plays a timeline onto the paper, calls sound
  main.ts               DOM   entry: reads the clock, wires form, printer, sound
  tokens.css            one :root block of tokens
  style.css             layout and components, tokens only
```

(*) `sound.ts` has no global access. All browser objects arrive through arguments, so it runs in the node test environment with a fake.

Dependency direction: `main.ts` imports `form`, `playback`, `printer`, `sound` and `src/core/index.ts`. `printer.ts` imports `playback` types and the `Sound` type. `form.ts` and `playback.ts` import from `src/core/index.ts` only (types and `parseInstant`, `slugFromHeadline`). Nothing in `src/core` imports from the UI. No new dependency.

## Data flow

```
 click "Print"
   main.ts: values = readForm()
            now    = new Date().toISOString()          <- the only clock read for drafts
   form.ts: { draft, rowIndexes, embargoInvalid } = formToDraft(values, now)
   if embargoInvalid -> show notice, stop
   core:    result = composeWireItem(draft)
   REJECTED -> form.ts rejectionNotice(result, rowIndexes) -> notice (role=alert), focus; no print, no sound
   HELD     -> form.ts heldProof(draft, result.releaseAt) -> printer.print({kind:"held", ...})
   RELEASED -> printer.print({kind:"released", text: item.text, priority})
   printer: timeline = buildTimeline(text, priority, reducedMotion)
            events fire on timers; chars to the paper; sound.clack / thunk / bell; label; tear
            end -> status region update, cleared after about 1 s
```

The clock for sound rate-limiting is a second, separate read: `main.ts` passes `() => performance.now()` into `createSound`. Both reads are in `main.ts`, so it is the only module that reads any clock. `printer.ts` uses `setTimeout` for scheduling (it does not read a clock); to keep it testable by hand, the scheduler functions are fields of its dependency object.

## Module designs

### playback.ts (pure)

```ts
import type { Priority } from "../core/index";

export type PlaybackEvent =
  | { kind: "char"; at: number; char: string }
  | { kind: "newline"; at: number }
  | { kind: "bell"; at: number }
  | { kind: "tear"; at: number };

export const CHAR_DELAY_MS = 14;
export const SPACE_DELAY_MS = 8;
export const PUNCT_DELAY_MS = 40;
export const NEWLINE_DELAY_MS = 140;
export const MAX_PLAY_MS = 6000;
export const BELL_GAP_MS = 600;

export function charDelayMs(char: string): number;
export function buildTimeline(text: string, priority: Priority, reducedMotion: boolean): PlaybackEvent[];
export function bellCount(priority: Priority): number;           // FLASH 2, BULLETIN 1, else 0
export function textAt(events: readonly PlaybackEvent[], timeMs: number): string;
```

Rules:

- Walk the text once. A `\n` becomes a `newline` event; every other code unit becomes a `char` event (iterate by UTF-16 unit, so `join` gives the text back exactly).
- Delay after a character: `\n` 140; space 8; letter or digit (`/[A-Za-z0-9]/`) 14; anything else 40. Cumulative `rawAt` is the sum of delays before the event. `rawTotal` is the sum of all delays.
- `scale = rawTotal > MAX_PLAY_MS ? MAX_PLAY_MS / rawTotal : 1`. Event time `at = Math.floor(rawAt * scale)`. `floor` of a non-decreasing sequence is non-decreasing, and `rawAt <= rawTotal` gives `at <= 6000`.
- `tear` is last, at `Math.floor(rawTotal * scale)` (at most 6000, at least every earlier time).
- Bells: first at 0, second at `min(BELL_GAP_MS, tearAt)`, inserted before the first event with a later time (stable order). A bell never moves a character event.
- `reducedMotion === true`: every event gets `at = 0`; bell events are kept (so the label can show) and the tear event is kept.
- `textAt(events, t)` joins `char` and `newline` events with `at <= t`. At the time of the last event it returns the full text. It is used for "Print instantly" and for the tests.

Why bells are in the timeline and in reduced motion too: the printer decides what to do with an event (label only, no sound under reduced motion). The timeline stays one honest list.

### sound.ts (injected context and clock)

Minimal structural types so a fake fits and the real `AudioContext` also fits:

```ts
export interface AudioParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
}
export interface AudioNodeLike { connect(dest: AudioNodeLike): unknown; }
export interface GainNodeLike extends AudioNodeLike { gain: AudioParamLike; }
export interface FilterNodeLike extends AudioNodeLike { type: string; frequency: AudioParamLike; Q: AudioParamLike; }
export interface SourceNodeLike extends AudioNodeLike { start(t?: number): void; stop(t?: number): void; }
export interface OscillatorNodeLike extends SourceNodeLike { type: string; frequency: AudioParamLike; }
export interface BufferSourceNodeLike extends SourceNodeLike { buffer: unknown; }
export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: AudioNodeLike;
  resume(): Promise<void> | void;
  createGain(): GainNodeLike;
  createBiquadFilter(): FilterNodeLike;
  createOscillator(): OscillatorNodeLike;
  createBufferSource(): BufferSourceNodeLike;
  createBuffer(channels: number, length: number, sampleRate: number): { getChannelData(c: number): Float32Array };
}

export interface SoundDeps {
  createContext: (() => AudioContextLike | undefined) | undefined;
  now: () => number;            // ms, monotonic; injected
}
export interface Sound {
  unlock(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  isUnlocked(): boolean;
  clack(char: string): void;
  thunk(): void;
  bell(): void;
}

export const MASTER_GAIN_MAX = 0.25;
export const MAX_CLACKS_PER_SECOND = 40;
export function createSound(deps: SoundDeps, masterGain?: number): Sound;
```

Behaviour:

- State: `ctx` (undefined), `master` (undefined), `muted = true`, `recent: number[]` (accepted clack times).
- `unlock()`: if `ctx` exists, call `resume()` only; else if `createContext` is a function, call it inside `try/catch`; if it returns a context, create `master = createGain()`, set `master.gain.value = Math.min(masterGain ?? MASTER_GAIN_MAX, MASTER_GAIN_MAX)`, connect master to `destination`, call `resume()` (a rejected promise is swallowed). Any throw leaves the module silent. Calling `unlock` twice never makes a second context.
- Every voice method first returns if `ctx === undefined` or `muted`. Nothing is created before unlock, and nothing is started while muted. Each is wrapped in `try/catch`.
- `clack(char)`: return for `" "`, `"\n"`, `"\t"` and any empty string. Rate limit: drop timestamps older than `now() - 1000`; if 40 remain, return; else push `now()`. Then one noise `AudioBufferSource` (a 25 ms buffer of `Math.random`-free pseudo-noise from a fixed integer LCG, so the output is deterministic), a band-pass `BiquadFilter` (`frequency = 1800 + (code % 8) * 100`, which spans 1800 to 2500, `Q = 1.2`), a voice gain (`0.6` at start, exponential ramp to `0.001` over 30 ms), chain `source -> filter -> voice -> master`, start now, stop at 30 ms.
- `thunk()`: 90 ms noise, low-pass at 220 Hz, voice gain `0.5` to `0.001`, through master.
- `bell()`: three sine oscillators at 1320, 3168, 5148 Hz with voice gains 1, 0.5, 0.25 (each ramps to 0.0001 over 1.4 s), through master, stop at 1.4 s. The thunk and bell are not rate-limited (the printer calls them at most a few times per item).
- The effective peak gain of any voice is `voicePeak * master`, at most `1 * 0.25`. The master gain is the only path to `destination`. A test checks this on the fake graph.
- `Math.random` is not used, in keeping with the "no randomness unless seeded" rule; the noise uses a fixed-seed LCG.

### form.ts (pure)

```ts
import type { ComposeResult, Draft, Priority } from "../core/index";

export interface ClaimRow { text: string; sourceUrl: string; }
export interface FormValues {
  city: string; headline: string; body: string;
  claims: ClaimRow[];
  priority: Priority;
  embargoDate: string;   // "YYYY-MM-DD" or ""
  embargoTime: string;   // "HH:mm" or "HH:mm:ss" or ""
}
export interface MappedDraft {
  draft: Draft;
  rowIndexes: number[];      // rowIndexes[i] = form row of draft.claims[i]
  embargoInvalid: boolean;   // embargo fields filled but not a valid instant; draft.embargo is omitted
}
export function formToDraft(values: FormValues, now: string): MappedDraft;

export interface RejectionItem { claimIndex: number; rowIndex: number; sentence: string; }
export interface RejectionNotice { heading: string; items: RejectionItem[]; }
export function claimSentence(f: ClaimFailure): string;
export function rejectionNotice(failures: ClaimFailure[], rowIndexes: number[]): RejectionNotice;
export function timeErrorNotice(errors: ("now" | "embargo")[]): string;

export function formatReleaseTime(iso: string): string;   // "YYYY-MM-DD HH:mm UTC"
export function heldProof(draft: Draft, releaseAt: string): { stamp: string; text: string };

export const EXAMPLE_SOURCED: FormValues;
export const EXAMPLE_UNSOURCED: FormValues;
```

Mapping rules (match requirements 5.x):

- Keep rows with `text.trim() !== ""`, in order. For each kept row: `{ text: text.trim(), sourceUrl: url.trim() }`, and `sourceUrl` is left out when the trimmed URL is empty.
- `embargo`: if `embargoDate.trim() === ""` then omitted (and `embargoInvalid` false). Otherwise build `${date}T${time}Z` where `time` is `HH:mm` plus `:00`, `HH:mm:ss` as is, empty time as `00:00:00`. If `parseInstant(candidate)` is `undefined`, omit `embargo` and set `embargoInvalid = true`. This keeps the embargo rule safe: a typo can never turn a held item into a released one, because the UI refuses to print.
- A date field is only trusted through `parseInstant`, so the mapper does not duplicate calendar rules.
- The function builds new objects and arrays and never writes to `values`.

Rejection messages:

- `claimSentence`: `MISSING_SOURCE` gives `Claim "<text>" has no source URL. Add a link that backs it up.` `INVALID_SOURCE` gives `Claim "<text>" has a source URL that is not a valid web address. Use a full http or https link.` The claim text is inserted verbatim.
- `rejectionNotice`: heading `NOT RELEASED: ${n} claims have no source.` (`1 claim has no source.` for n = 1); one `RejectionItem` per failure, in the order `checkClaims` returned them; `rowIndex = rowIndexes[failure.index]`.
- `timeErrorNotice`: `now` gives "NOT RELEASED: the clock value is not valid."; `embargo` gives "NOT RELEASED: the embargo date and time are not valid."; both are joined with a space.

Held proof:

- `stamp = "HOLD UNTIL " + formatReleaseTime(releaseAt)`.
- `text` is `slug`, priority word, blank line, `TEXT WITHHELD UNTIL RELEASE.` joined with `\n`. The core gives no wire text for `HELD`, so the proof is built only from `slugFromHeadline(draft.headline)` and `draft.priority`. It has no body, no claims and no `-30-`.
- `formatReleaseTime` slices the fixed positions of an instant already accepted by `parseInstant`: `iso.slice(0, 10) + " " + iso.slice(11, 16) + " UTC"`.

Examples (sample data, a made-up company):

- City `Austin`, headline `Ledgerly opens public beta`, priority `BULLETIN`, no embargo.
- Body, two paragraphs, for example: "Ledgerly, a bookkeeping app for freelancers, opened its public beta Tuesday. The app has 1,200 beta users, the company said.\n\nThe beta costs $9 a month, the company said."
- Claims: `The app has 1,200 beta users` with `https://example.com/ledgerly/beta-users`; `The beta costs $9 a month` with `https://example.com/ledgerly/pricing`.
- `EXAMPLE_UNSOURCED` is identical except the second claim's `sourceUrl` is `""`. A test asserts they differ only there.
- The page copy next to the buttons: "Sample data about Ledgerly, a made-up company. All links use example.com."

### printer.ts (DOM, thin)

```ts
export interface PrinterDeps {
  paper: HTMLElement;            // scroll region (aria-live="off")
  status: HTMLElement;           // visually hidden role="status"
  bellLabel: HTMLElement;        // "BELL" text label
  sound: Pick<Sound, "clack" | "thunk" | "bell">;
  reducedMotion: () => boolean;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
}
export type PrintJob =
  | { kind: "released"; text: string; priority: Priority }
  | { kind: "held"; stamp: string; text: string };
export interface Printer {
  print(job: PrintJob): void;       // ignored while busy
  skip(): void;                     // Print instantly
  isBusy(): boolean;
  onBusyChange(cb: (busy: boolean) => void): void;
}
export function createPrinter(deps: PrinterDeps): Printer;
```

- `print`: build the item element (a `<pre>` with class `item`; for HELD a stamp `<div>` above the slug), append it to `paper`, remove the empty state. Compute `buildTimeline(text, priority, reducedMotion())` (HELD uses `ROUTINE`, so no bell). If reduced motion, apply all events at once.
- Otherwise a single chain of timers: after each event, schedule the next one with `delta = next.at - this.at`. Per event: `char` appends the character to the item's text node, then `sound.clack(char)`; `newline` appends `"\n"` and calls `sound.thunk()`? No. The thunk plays on the tear only (design.md: "The cut plays one thunk"), so a `newline` event only appends and scrolls. `bell` shows the BELL label for 1500 ms and calls `sound.bell()` (not under reduced motion). `tear` adds class `item--cut`, calls `sound.thunk()` (not under reduced motion), and finishes.
- The text node content always equals `textAt(events, t)`, so the final text is the wire text byte for byte.
- `skip()`: clears the pending timer, applies every remaining `char`/`newline` event at once with no key sounds, runs the `tear` and the finish steps once. Bell events not yet played are skipped (no sound), because "Print instantly" skips ahead.
- Finish: set busy false, put the item text into `status` in one write (the hold sentence for HELD), clear it about 1000 ms later with a timer, scroll `paper` to the bottom (`scrollTop = scrollHeight`, no smooth behaviour), notify busy listeners.
- The scroll keeps the printing line visible after each newline event.
- Only one timer is pending at a time; `finish` clears everything. No timer survives the end of an item.

### main.ts (DOM, entry)

- Imports `./tokens.css` and `./style.css`, builds nothing dynamic beyond the claim rows (the static skeleton is in `index.html`).
- Reads form values into `FormValues`, calls `formToDraft`, `composeWireItem`, and routes as in the data-flow section.
- `new Date().toISOString()` is the clock read for `draft.now`. `performance.now` is passed to `createSound`. `window.matchMedia("(prefers-reduced-motion: reduce)")` is read at print time.
- Claim rows: add, remove, renumber, focus management as in requirement 3.
- Example buttons fill the form; they do not print.
- Notice: a `role="alert"` element with `tabindex="-1"`, focused after being filled. Each entry is an `<a href="#claim-url-N">` whose click handler focuses that field.
- Mute toggle: `unlock()` then `setMuted`. A one-time `pointerdown`/`keydown` listener on `document` also calls `unlock()`.
- While `printer.isBusy()`, "Print" and the example buttons get `aria-disabled="true"` and their handlers return early; "Print instantly" is shown only while busy.

## Page structure (index.html)

```
<body>
  <main class="app">
    <h1>WireRoom</h1>
    <section class="compose" aria-labelledby="compose-title"> form, examples, sample-data note </section>
    <section class="printer" aria-labelledby="printer-title">
      controls row: Print instantly, mute toggle, BELL label
      notice container (role="alert", tabindex="-1", empty)
      <div class="paper" role="region" aria-live="off" aria-label="Printed wire items, scrolls sideways and down" tabindex="0"> empty state </div>
    </section>
    <div class="visually-hidden" role="status" aria-live="polite"></div>
  </main>
  <script type="module" src="./src/ui/main.ts"></script>
</body>
```

Tab order follows reading order: form fields, claims, Add claim, examples, Print, then Print instantly, mute toggle, the notice links, the paper. The paper has `tabindex="0"`, `role="region"` and an `aria-label` so a user can scroll it by keyboard.

## Styling

- `tokens.css`: one `:root` block with every token in `design.md` (colours, `--font-paper`, `--font-ui`, `--space-1..7`, radii, border widths, transition durations).
- `style.css`: tokens only. Two-column grid from 900px with `grid-template-columns: minmax(320px, 400px) minmax(0, 1fr)`; `.app > * { min-width: 0 }`.
- Paper: `container-type: inline-size`; `font-size: clamp(12px, calc((100cqi - 2 * var(--paper-pad) - var(--scrollbar-room)) / 42.8), 16px)` (maintainer decision: the floor is 12px, not 8px); `line-height: 1.35`; `white-space: pre`; `overflow-x: auto`; `overflow-y: auto`; torn bottom edge by `clip-path: polygon(...)` zigzag with 6px teeth. Where 69 columns do not fit at 12px (a 390px phone), the paper box scrolls sideways inside itself; `.paper-wrap` has `max-width: 100%`, so the 69ch width never forces page-level sideways scroll (`document.documentElement.scrollWidth <= innerWidth` at 390px). Lines are never re-wrapped.
- Claim rows (maintainer decision, measured: at 1440px the claim text and URL inputs were only about 140px each in a three-column row): the form is a size container; the URL input stacks under the claim text (one column, full width) whenever the form column is narrower than 560px (`@container form (min-width: 560px)` switches to the three-column row). The Remove button stays reachable and 44px tall.
- Priority select (maintainer decision): keep the native `<select>`, no custom dropdown. Style only: `appearance: none`, `--field` background, `--edge` border, `--ink` text, 44px minimum height, focus ring, same look as the text inputs, and a CSS-only arrow (a bordered triangle on the wrapper, tokens only, no image, no gradient). The native option list stays.
- Examples: the two example buttons stack full width under 480px, so their labels stay on one line.
- Focus: `:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }`.
- Reduced motion: `@media (prefers-reduced-motion: reduce)` removes transitions and transforms (the stamp keeps its static -3deg rotation, since it is not motion).
- Transitions list properties and last at most 120 ms (`transform 120ms`, `background-color 120ms`).

## Decisions and open points

1. HELD has no wire text in the core, so the held proof shows slug, priority and a withheld line only. This also keeps embargoed text off the page.
2. A bad embargo (filled but invalid) stops the print in the UI instead of dropping the embargo. Dropping it would silently release an item early, which weakens the embargo rule.
3. A claim row with a URL but no claim text is dropped. A URL with nothing to back is not a claim, and the gate has nothing to check. The user's typed URL stays in the form, since the form is not cleared.
4. Under reduced motion, a bell is shown as the BELL label only and no sound plays, as `design.md` says ("The bell is the BELL text label only").
5. The thunk plays on the tear only. Per-line carriage-return sound is not added, to stay inside the "at most one thunk per cut" rule in `design.md`.
6. Print and example buttons use `aria-disabled` while printing, not `disabled`, so keyboard focus is not lost when printing starts.
7. Sound noise uses a fixed-seed LCG instead of `Math.random`, so the module follows the "no randomness" rule even though it is not in `src/core`.
8. Paper font floor is 12px (maintainer decision), so on a phone the paper box scrolls sideways inside itself instead of shrinking the type to 8px.

## Correctness properties (fast-check)

Each property is written in the test file named in the task list. Wire text for (a) is built from arbitrary strings (including newlines, spaces, punctuation and long lines) and, in one case, from `composeWireItem` results. Runs use the project default (at least 100 runs).

**(a) `playback.prop.test.ts`**

- P-a1: joining the `char` characters and `"\n"` for each `newline` event, in order, equals the text.
- P-a2: event times never decrease, and are non-negative integers.
- P-a3: the last event time is at most 6000, for texts up to several thousand characters.
- P-a4: with `reducedMotion = true`, every event time is 0 and `textAt(events, 0)` equals the text.
- P-a5: bell events: 2 for FLASH, 1 for BULLETIN, 0 for URGENT and ROUTINE (and this holds with reduced motion).
- P-a6: exactly one `tear` event, it is last, and its time is at least that of every other event.
- P-a7: deterministic: two calls with the same input give deep-equal arrays.
- P-a8: for short texts (raw total at most 6000 ms) the times are the unscaled cumulative delays (letter 14, space 8, punctuation 40, line end 140).
- P-a9: `textAt(events, lastTime)` equals the text, and `textAt` is a prefix of the text for any time.

**(b) `form.prop.test.ts`, mapper**

- P-b1: the kept claims are the non-blank rows in the same order, and the count equals the number of non-blank rows (compared by the trimmed text).
- P-b2: no draft claim has blank text.
- P-b3: `rowIndexes` is strictly increasing and `draft.claims[i].text` equals the trimmed text of row `rowIndexes[i]`.
- P-b4: for any valid date and time, `draft.embargo` is accepted by `parseInstant`, ends in `Z`, and `embargoInvalid` is false. For an empty date, `embargo` is omitted. For an invalid pair (for example month 13), `embargo` is omitted and `embargoInvalid` is true.
- P-b5: the input, deep-frozen before the call, is not mutated and the call does not throw.
- P-b6: `draft.now` equals the `now` argument; the same input gives deep-equal output.

**(c) `form.prop.test.ts`, rejection messages**

- P-c1: for any failure list, `items.length` equals `failures.length`.
- P-c2: items are in the same order as the failures, with `claimIndex` equal to the failure index.
- P-c3: each sentence contains its claim text verbatim and ends with a full stop.
- P-c4: the heading starts with `NOT RELEASED: ` and contains the number of failures.
- P-c5: no sentence contains `http` unless the claim text itself does (the notice never invents a source).

**(d) `sound.test.ts` / `sound.prop.test.ts`, with a fake AudioContext**

The fake records every created node, every `connect`, every `start` and every gain `value` and ramp target.

- P-d1: before `unlock`, any sequence of `clack`, `thunk`, `bell` and `setMuted` creates no context (the factory is not called), no node and no start.
- P-d2: after `unlock` while muted (the default), the sequence creates no node beyond the master gain and starts nothing; unmuting then starts nodes.
- P-d3: the master gain value is at most 0.25, even if a larger value is passed in; every voice's path reaches the destination only through the master; the largest set gain times the master gain is at most 0.25.
- P-d4: `clack(" ")` and `clack("\n")` start nothing, for any number of calls.
- P-d5: for any list of clack times (sorted) and any characters, the number of started clacks in any window of 1000 ms is at most 40; clacks 41 and later inside one second are dropped; the same count is accepted again once the window has passed.
- P-d6: with a missing factory, a factory that returns `undefined`, or a factory that throws, no call throws.
- P-d7: calling `unlock` many times creates exactly one context and one master gain.
- Example tests: the clack filter frequency is between 1800 and 2500 and `Q` is 1.2; the bell has three oscillators at the 3 frequencies; the thunk filter is low-pass at 220.

## Testing approach

- All tests run in the node environment under `npm test`. No DOM, no jsdom, no new package.
- Pure modules get property tests; the DOM modules (`printer.ts`, `main.ts`) get no unit tests. They are checked by the maintainer in a browser (screenshots after tasks 3, 4 and 5), which is also where the 390px width, the torn edge and the focus ring are judged. This spec cannot verify those in node, and says so.
- The agent that runs a task cannot run shell commands: it only writes files. The maintainer runs `npm test` and `vite build` and reports back.

## Risks

- The `42.8` font-size constant is a safe upper bound for the mono stack; if a fallback font is wider, the paper box scrolls sideways (requirement 15.6) instead of breaking the page.
- `clip-path` and `cqi` need a current browser; older browsers fall back to a flat edge and the 12px base font, with sideways paper scroll.
- Container queries (`@container`) need a current browser; older browsers keep the stacked claim row, which is the safe layout.
- Autoplay: sound is created only in a user gesture, so a muted first run is silent by design.
