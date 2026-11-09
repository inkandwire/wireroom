# Tasks: embargo-clock

Note: the agent running a task cannot run shell commands. Each task only writes files, including its own tests. Do not add install or run steps. The maintainer runs `npm test` and `npm run build`, then a fake-time browser run and screenshots, and sends back observations.

Rules for every task: follow `.kiro/steering/*.md`; add no dependency; use named exports only; `src/core` stays pure (no clock, DOM, network or randomness); `src/ui` imports the core only from `src/core/index.ts`; keep every existing id and class.

- [ ] 1. Core: embargo clock (`src/core/embargoClock.ts`, `src/core/index.ts`)
  - Implement `HeldEntry`, `Countdown`, `ReleasedOne`, `countdown` and `releaseDue` exactly as in design.md, and add the export line to `src/core/index.ts`.
  - Write `src/core/embargoClock.test.ts`: labels at 0 ms (`RELEASING`), 1 ms (`T-00:00:01`), 59 999 ms, exactly 24 h (`T-1d 00:00:00`) and 90 061 s (`T-1d 01:01:01`); an invalid `releaseAt`; `due` flips exactly at `releaseAt` and not 1 ms before; `releaseDue` releases only due entries, keeps order, and composes with `releaseAt` as `now` (dateline checked).
  - Write `src/core/embargoClock.prop.test.ts` with fast-check: remaining time never increases as `nowMs` grows; `remainingMs >= 0`; the label matches `^(T-(\d+d )?\d{2}:\d{2}:\d{2}|RELEASING|T-\?\?:\?\?:\?\?)$`; `released` plus `stillHeld` is a partition of the input for any list and `nowMs`; a second `releaseDue` on `stillHeld` with the same time releases nothing; a deep-frozen input is not mutated; the output is deterministic.
  - Maintainer: runs `npm test` and reports failures.
  - Requirements: 1.1 to 1.4, 2.1, 3.1 to 3.4, 4.1.

- [ ] 2. Loop: DOM-free clock loop (`src/ui/clockLoop.ts`)
  - Implement `createClockLoop(deps)` with `add`, `size` and `stop` as in design.md: one 1000 ms interval for the first entry, never a second, cleared after the last release or on `stop()`; each tick reads `now()`, calls `onTick` once with every held row, then `onRelease` for each due entry in `releaseAt` order.
  - Write `src/ui/clockLoop.test.ts` with a fake clock object defined in the test file (manual `now`, recorded interval callback, `advance(ms)` firing the callback once per whole 1000 ms step): one interval for two adds; interval cleared after the last release; each item released once; several due items released in one tick after a 10-minute jump; no callback after `stop()`; `onTick` once per tick with all rows.
  - Fix anything the tests find in task 1 or here.
  - Maintainer: runs `npm test` and reports failures.
  - Requirements: 4.2, 5.1 to 5.3, 6.1, 6.2.

- [ ] 3. UI wiring (`src/ui/main.ts`, `src/ui/printer.ts`, `src/ui/printer.css`, and `src/ui/form.ts` or `index.html` only if needed)
  - In `main.ts`, build the loop with `Date.now()`, `window.setInterval` and `window.clearInterval`; on HELD, print the proof with `holdId` and add the `HeldEntry`; update countdown labels in `onTick`; in `onRelease`, lift the stamp, set `RELEASED <time>`, push the `FeedEntry` (`publishedAt` = `releaseAt`), call `renderExportKeys()`, and print through a FIFO that waits while the printer is busy. An invalid embargo is never added.
  - In `printer.ts`, make the smallest change: optional `holdId`, `releaseIso` and `announce` on the job; the countdown line (label span, `<time datetime>`, note) inside the held item; no live region for it; the status text `Held until <time>` and `Released: <slug>`.
  - Styles: `.countdown` (paper mono, tabular figures, tokens only), `.stamp--lifted` with a 300 ms transition of opacity and transform listed explicitly (no `transition: all`), and `prefers-reduced-motion` with no transition. No new colours.
  - Do not add unit tests: this is DOM code, and the pure parts are tested in tasks 1 and 2. If a rule is missing there, add it to the pure module and its test.
  - Maintainer: runs `npm test` and `npm run build`, then a browser run with fake time (set an embargo 1 to 2 minutes ahead, hold two items, let one release while another prints), reports the countdown ticking, the stamp lifting, the release print with its bell, the status messages, the export keys including the released item, and reduced motion. Sends screenshots at 1440x900, 1280x720 and 390px, checks that the page does not scroll and that no control is under 44px tall on the phone.
  - Requirements: 7.1 to 7.4, 8.1 to 8.4, 9.1 to 9.3, 10.1, 10.2.
