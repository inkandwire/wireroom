# Requirements: embargo-clock

## Introduction

A held (embargoed) item today prints a proof sheet with a red HOLD stamp, and then nothing happens: the page never checks the clock again. This feature adds a visible countdown to every held item, lifts the HOLD stamp at the release time, and then prints the item. The countdown and release rules are pure functions in `src/core/embargoClock.ts`. A DOM-free loop in `src/ui/clockLoop.ts` drives them from injected time functions. Only `main.ts` reads the real clock. The claim gate and the embargo rule in `product.md` are not weakened, and no dependency is added.

## Glossary

- **Held entry**: `HeldEntry = { id, draft, releaseAt }`, a draft that composed to `HELD`. `releaseAt` is an ISO UTC instant.
- **Countdown**: `countdown(releaseAt, nowMs)` giving `{ remainingMs, label, due }`.
- **Clock loop**: `createClockLoop(deps)` in `src/ui/clockLoop.ts`.
- **Proof sheet**: the printed HELD sheet with the HOLD stamp.

## Requirements

### Requirement 1: Countdown label

**User Story:** As a founder, I want to see how long a held item still has to wait, so that I know when it goes out.

#### Acceptance Criteria

1. THE `countdown` function SHALL return `remainingMs` equal to the time left, never below 0.
2. WHILE the item is not due, THE `label` SHALL be `T-HH:MM:SS` for under 24 hours and `T-Nd HH:MM:SS` for one day or more, with the remaining time rounded UP to whole seconds, `N` unpadded (no plural) and hours, minutes and seconds in two digits.
3. WHEN the item is due, THE `label` SHALL be `RELEASING`.
4. IF `releaseAt` is not a valid instant, THEN `countdown` SHALL return `due: false`, `remainingMs: 0` and the label `T-??:??:??`, and SHALL NOT throw.

### Requirement 2: Due rule

**User Story:** As a maintainer, I want one rule for "released", so that the countdown and the composer never disagree.

#### Acceptance Criteria

1. THE `due` flag SHALL be true exactly when `nowMs >= releaseAt`, the same rule as `isReleased`, and false one millisecond before.

### Requirement 3: Release of due entries

**User Story:** As a founder, I want a held item to come out at its release time with that time on it, so that the wire text does not depend on when my browser woke up.

#### Acceptance Criteria

1. WHEN `releaseDue(held, nowMs)` is called, THE function SHALL compose every due entry again with `draft.now` set to `entry.releaseAt` and return it in `released` with a `RELEASED` result, ordered by `releaseAt` (ties keep input order).
2. THE function SHALL return the entries that are not due in `stillHeld`, in their original order, so that `released` and `stillHeld` together partition the input.
3. THE function SHALL NOT mutate its input, and the same inputs SHALL give the same output.
4. WHEN `releaseDue` is called again on `stillHeld` with the same `nowMs`, THE function SHALL release nothing new.

### Requirement 4: Purity

**User Story:** As a maintainer, I want the core to stay free of clocks, so that tests are deterministic.

#### Acceptance Criteria

1. THE `embargoClock` module SHALL be named exports only, exported from `src/core/index.ts`, and SHALL NOT read a clock, use randomness, touch the DOM, use the network or import from `src/ui` or `src/feeds`.
2. THE clock loop SHALL get `now`, `setInterval` and `clearInterval` through injected dependencies, and only `src/ui/main.ts` SHALL supply `Date.now()`, `setInterval` and `clearInterval`.

### Requirement 5: One interval

**User Story:** As a visitor, I want the page to use one cheap timer, so that held items do not slow it down.

#### Acceptance Criteria

1. WHEN the first entry is added, THE clock loop SHALL start one interval of 1000 ms, and SHALL NOT start a second one while it runs.
2. WHEN the last entry is released, or `stop()` is called, THE clock loop SHALL clear the interval.
3. WHILE `stop()` has been called, THE clock loop SHALL call neither `onTick` nor `onRelease`.

### Requirement 6: Ticks read the clock

**User Story:** As a founder, I want an item to release on time even if my tab slept, so that a throttled tab does not delay the news.

#### Acceptance Criteria

1. WHEN a tick fires, THE clock loop SHALL read `now()` (it SHALL NOT count ticks), call `onTick` once with a row `{ id, label, due }` for every held entry, and then call `onRelease` once for each entry that is due.
2. WHEN several entries are due in one tick, THE clock loop SHALL release all of them in that tick, in `releaseAt` order, each exactly once.

### Requirement 7: Countdown line on the proof sheet

**User Story:** As a founder, I want the countdown on the held sheet, so that I see the wait without opening anything.

#### Acceptance Criteria

1. WHEN a draft is HELD, THE UI SHALL print the proof sheet as before (stamp, slug, no body, no `-30-`) and add a countdown line with the `label`, a `<time datetime>` element holding the release instant, tabular figures and the paper mono font, and a short note that the release lives in this page only.
2. WHEN two items are held, THE UI SHALL give each its own countdown line, and SHALL update it on every tick.
3. THE countdown line SHALL NOT be a live region, so that a screen reader is not read to every second.
4. THE UI SHALL keep a held entry in memory for the page session only, with no storage and no network, and SHALL add no held entry to a feed before its release.

### Requirement 8: Release on the page

**User Story:** As a founder, I want the stamp to lift and the item to print at the release time, so that the hold ends by itself.

#### Acceptance Criteria

1. WHEN an entry is released, THE UI SHALL add the class `stamp--lifted` to its HOLD stamp (a 300 ms transition of opacity and transform, listed explicitly; under `prefers-reduced-motion` the stamp just disappears), SHALL change its countdown line to `RELEASED <time>`, and SHALL print the full item through the existing printer with its usual sound and bell rules.
2. WHEN an entry is released, THE UI SHALL push a `FeedEntry` whose `publishedAt` is its `releaseAt`.
3. WHILE the printer is busy when an entry is released, THE UI SHALL queue the print and run it after the printer is free, in `releaseAt` order, and SHALL lose no item.
4. THE UI SHALL NOT change a draft with an invalid embargo: it still shows the existing notice and is never added to the loop.

### Requirement 9: Announcements

**User Story:** As a screen reader user, I want to hear only what matters, so that I can follow the wire.

#### Acceptance Criteria

1. WHEN an item is held, THE status region SHALL announce `Held until <time>` once.
2. WHEN an item is released from hold, THE status region SHALL announce `Released: <slug>` once.
3. THE status region SHALL NOT announce countdown ticks.

### Requirement 10: Layout and theme

**User Story:** As a visitor on any device, I want the page to stay usable with held items, so that the countdown costs me nothing.

#### Acceptance Criteria

1. THE UI SHALL add no control, SHALL keep every existing id and class, and SHALL use only existing tokens.
2. THE page SHALL NOT scroll at 1440x900 and 1280x720, no control SHALL be under 44px tall on a phone, and the countdown line SHALL keep every printed line within 69 columns without re-wrapping wire text.
