# Design: embargo-clock

Follows `product.md` (embargo clock: time is always an argument), `tech.md` (pure core, no clock reads, deterministic) and `design.md` (tokens, motion, a11y). Requirement numbers are in brackets.

## Existing code this builds on

- `composeWireItem(draft)` returns `HELD { releaseAt }` while `draft.now < draft.embargo`, else `RELEASED`. `isReleased(embargoMs, nowMs)` is `nowMs >= embargoMs`. `parseInstant` parses ISO UTC.
- `main.ts` is the only clock reader. The submit handler passes `new Date().toISOString()` as `draft.now`.
- `printer.print(job)` is ignored while busy. It builds `.item` and, for held jobs, a `.stamp` div. `form.ts` has `formatReleaseTime` and `heldProof`.
- The feeds spec: `FeedEntry = { item, publishedAt }` and `sessionEntries` in `main.ts`.

## Core: `src/core/embargoClock.ts` [R1 to R4]

```ts
export interface HeldEntry { id: string; draft: Draft; releaseAt: string }
export interface Countdown { remainingMs: number; label: string; due: boolean }
export interface ReleasedOne { entry: HeldEntry; result: ComposeResult }
export function countdown(releaseAt: string, nowMs: number): Countdown;
export function releaseDue(
  held: readonly HeldEntry[], nowMs: number,
): { released: ReleasedOne[]; stillHeld: HeldEntry[] };
```

`countdown`:
- `parseInstant(releaseAt)` invalid or `nowMs` not finite: `{ remainingMs: 0, label: "T-??:??:??", due: false }`.
- `due = isReleased(releaseMs, nowMs)`; `remainingMs = max(0, releaseMs - nowMs)`.
- Due: label `RELEASING`. Otherwise `s = ceil(remainingMs / 1000)`; if `s < 86400` the label is `T-HH:MM:SS`, else `T-${floor(s/86400)}d HH:MM:SS` with the rest of `s` split in two-digit parts. Hand-built padding, no `toLocaleString`, no `Intl`.
- Examples: 1 ms is `T-00:00:01`; 59 999 ms is `T-00:01:00`; exactly 24 h is `T-1d 00:00:00`; 90 061 s is `T-1d 01:01:01`.

`releaseDue`:
- Walks the input once and splits it by `countdown(...).due`.
- Each due entry is composed with `{ ...entry.draft, now: entry.releaseAt }`. The dateline and `publishedAt` are therefore the release time, never the wake-up time. The claims were gated when the draft was held, and the gate runs again inside `composeWireItem`.
- `released` is sorted by `releaseMs`, stable on ties. `stillHeld` keeps input order. Input and entries are not mutated (new draft object, no sort in place on the input).
- The imports are `./types`, `./embargo` and `./compose` only.

`index.ts` gets one more export line (types and both functions).

## Loop: `src/ui/clockLoop.ts` [R5, R6]

```ts
export interface ClockRow { id: string; label: string; due: boolean }
export interface ClockLoopDeps {
  now(): number;
  setInterval(fn: () => void, ms: number): number;
  clearInterval(id: number): void;
  onTick(rows: ClockRow[]): void;
  onRelease(one: ReleasedOne): void;
}
export function createClockLoop(deps): { add(e: HeldEntry): void; size(): number; stop(): void };
```

- State: `held: HeldEntry[]`, `timer: number | undefined`, `stopped`.
- `add` pushes the entry, and starts one `setInterval(tick, 1000)` only when `timer` is undefined. After `stop()`, `add` does nothing.
- `tick`: `t = deps.now()`; `onTick(held.map(e => ({ id, ...pick(countdown(e.releaseAt, t)) })))`; then `{ released, stillHeld } = releaseDue(held, t)`; `held = stillHeld`; `onRelease` for each `released`; if `held` is empty, `clearInterval` and `timer = undefined`. A late wake-up therefore releases everything due in one tick.
- `stop()` clears the interval, empties `held` and sets `stopped`; no callback runs after it, even if a callback is already queued.
- `onTick` is called before `onRelease`, so a row can show `RELEASING` for its last tick; the UI replaces it on release.
- No DOM, no global timer, no clock read: everything comes in through `deps`.

## UI wiring [R7 to R10]

`main.ts`:
- A counter gives each held entry an id (`hold-1`, `hold-2`). On HELD, the submit handler calls `printer.print({ kind: "held", ..., holdId })` and `loop.add({ id, draft, releaseAt })`. The invalid-embargo notice returns before this, as today.
- The loop is built with `now: () => Date.now()`, `setInterval: (f, ms) => window.setInterval(f, ms)` and `clearInterval: (id) => window.clearInterval(id)`.
- `onTick(rows)`: for each row, find `[data-hold-id="<id>"] .countdown-label` and set its `textContent`. Nothing else is touched, so the cost per second is one text write per held item.
- `onRelease({ entry, result })`: if `result.status !== "RELEASED"`, ignore it (cannot happen). Otherwise lift the stamp, set the line to `RELEASED <formatReleaseTime>`, push `entriesFromResult(result, entry.releaseAt)` into `sessionEntries`, call `renderExportKeys()`, then `enqueuePrint(...)`.
- `enqueuePrint` is a small FIFO in `main.ts`: if the printer is busy, the job waits; `printer.onBusyChange(false)` runs the next one. Release order is `releaseAt` order because the loop delivers it so.

`printer.ts` (smallest change):
- The held `PrintJob` gains optional `holdId` and `releaseIso`. When set, `buildItem` adds `data-hold-id` on the item and a `<p class="countdown">` with a `<span class="countdown-label">` (initial text from the job), a `<time datetime>` and a `<span class="countdown-note">Kept in this page only. Closing it cancels the release.</span>` (55 columns). The printer keeps no timers for it.
- `PrintJob` gains an optional `announce` string that replaces the status text. Held proofs announce `Held until <time>`; a released-from-hold job announces `Released: <slug>`. A normal RELEASED job is unchanged.

`form.ts`: `heldProof` is unchanged. `index.html` is probably unchanged.

Stamp lift: `main.ts` adds `stamp--lifted` to `[data-hold-id] .stamp`. The countdown line shows `RELEASED <time>` in the same element.

CSS (`printer.css`, tokens only): `.countdown` uses `--font-paper`, `font-variant-numeric: tabular-nums`, `--ink` on `--paper`, `white-space: pre-wrap` and `overflow-wrap: anywhere`; the note is `--muted`. `.stamp { transition: opacity 300ms ease, transform 300ms ease }` (a new `--duration-lift: 300ms` token is allowed only if a duration token pattern already exists, else a literal in the rule). `.stamp--lifted { opacity: 0; transform: rotate(-3deg) translateY(-6px) }`. In `prefers-reduced-motion: reduce` the transition is `none`. The stamp keeps its space (`visibility`/`opacity`) so the sheet does not jump.

## Layout and a11y

- The countdown is a normal paragraph in the paper scroll region (`aria-live="off"`), not a live region. Only the status region speaks, once per event.
- The proof sheet grows by two lines at most, inside the paper scroll region. The page does not scroll, and no control is added.

## Tests [R1 to R6]

All with a fake clock written in the test file: a manual `now`, a recorded interval callback, and `advance(ms)` that moves `now` and fires the callback once per whole 1000 ms step.
- `embargoClock.test.ts`: labels at 0, 1 ms, 59 999 ms, exactly 24 h, 90 061 s; invalid `releaseAt`; `due` flips exactly at `releaseAt`; `releaseDue` releases only due entries, keeps order, uses `releaseAt` as `now`.
- `embargoClock.prop.test.ts` (fast-check): remaining never increases as `nowMs` grows; `remainingMs >= 0`; label matches `^(T-(\d+d )?\d{2}:\d{2}:\d{2}|RELEASING|T-\?\?:\?\?:\?\?)$`; `released` plus `stillHeld` is a partition; a second `releaseDue` on `stillHeld` releases nothing; the input is not mutated; the output is deterministic.
- `clockLoop.test.ts`: one interval for two adds; cleared after the last release; each item released once; several due items released in one tick after a 10-minute jump; no callback after `stop()`; `onTick` once per tick with all rows.
- UI wiring is DOM code and is checked by the maintainer in a browser with fake time.
