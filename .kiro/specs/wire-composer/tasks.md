# Tasks: wire-composer

Note: the agent running a task cannot run shell commands. Each task only writes files, including its own tests. Do not add install or run steps. The maintainer runs `npm install` and `npm test` outside Kiro.

- [ ] 1. Project scaffold and shared types
  - Create `package.json`: `"type": "module"`, scripts `"test": "vitest run"` and `"build": "vite build"`, devDependencies `typescript`, `vite`, `vitest`, `fast-check` (pinned versions, no ranges).
  - Create `tsconfig.json` with `strict: true`, ES module settings, and `include` of `src`.
  - Create `vite.config.ts` with `base: "./"` (relative paths for static hosting) and a vitest `test` block (`include: ["src/**/*.test.ts", "tests/**/*.test.ts"]`, node environment).
  - Create `src/core/types.ts` with `Priority`, `Claim`, `Draft`, `ClaimFailure`, `WireItem`, `ComposeResult`, and constants `MAX_COLUMNS = 69`, `END_MARKER = "-30-"`, `MAX_SLUG_LENGTH = 24` (see design.md).
  - Add a minimal `index.html` and `src/ui/main.ts` placeholder only if `vite build` needs an entry point; no app logic.
  - Write `src/core/types.test.ts`: checks the constants have the required values and that a sample `Draft` object type-checks.
  - Requirements: 1.1, 1.2, 6.4.

- [ ] 2. Teletype wrapping (`src/core/wrap.ts`)
  - Implement `splitLongWord`, `wrapParagraph`, and `wrapText(text, max = MAX_COLUMNS)` as in design.md. Pure, `\n` line endings, no locale APIs.
  - Write `src/core/wrap.prop.test.ts` with fast-check: (a) for any text and any max from 1 to 100, no line exceeds max; the non-whitespace characters of the output equal the input's in order; when every word fits, the output word list equals the input word list.
  - Include a property that words longer than 69 are hard-split with no characters lost, and example tests for a blank-line paragraph break and an exactly 69-column word.
  - Requirements: 4.1 to 4.6, 7.1.

- [ ] 3. Claim gate (`src/core/claimGate.ts`)
  - Implement `isValidSourceUrl` (absolute `http`/`https` with a host) and `checkClaims` returning `ClaimFailure[]` with `MISSING_SOURCE` / `INVALID_SOURCE`, in claim order. No repair or guessing.
  - Write `src/core/claimGate.prop.test.ts` with fast-check: (b) any claim list containing a claim with an undefined, empty, non-URL, non-http(s) scheme, or hostless URL always yields at least one failure that names that claim's index; lists of valid http/https URLs yield no failures.
  - Include example tests: `https://example.com/a` valid, `ftp://x.com` invalid, `example.com` invalid, `http://` invalid, `javascript:alert(1)` invalid, empty claim list passes.
  - Requirements: 2.1 to 2.6, 2.8, 7.2.

- [ ] 4. Embargo rule (`src/core/embargo.ts`)
  - Implement `parseInstant` (strict `YYYY-MM-DDTHH:mm:ss(.fff)?Z`, calendar-checked, returns epoch ms or `undefined`) and `isReleased(embargoMs | undefined, nowMs)` where release means no embargo or `nowMs >= embargoMs`.
  - Write `src/core/embargo.prop.test.ts` with fast-check: (c) for any embargo and any `t <= t2`, `isReleased(e, t)` implies `isReleased(e, t2)`; held strictly before the embargo and released exactly at it.
  - Include example tests for `parseInstant`: valid with and without milliseconds; rejects missing `Z`, a non-UTC offset, month 13, Feb 30, and an empty string.
  - Requirements: 1.5, 3.1 to 3.4, 7.3.

- [ ] 5. Wire item composer (`src/core/compose.ts` and `src/core/index.ts`)
  - Implement `slugFromHeadline`, `formatDateline`, and `composeWireItem` (time parse, then gate, then embargo, then format) as in design.md. Return `REJECTED`, `HELD` (with `releaseAt`) or `RELEASED` (with a `WireItem`); wire text exists only on `RELEASED`.
  - Create `src/core/index.ts` with named re-exports of the public API and types from `types`, `wrap`, `claimGate`, `embargo`, `compose`.
  - Write `src/core/compose.test.ts`: example tests for the dateline (`AUSTIN, Mar. 4 (WireRoom) --`, a single-digit day, a December date) and the slug (punctuation removed, 24-character cap with no trailing hyphen, empty headline gives `NEWS`); a determinism test (same draft and same `now` give identical results, checked with fast-check); a property that every `RELEASED` item ends with `-30-` and has no line over 69 columns; a property that a draft with an unsourced claim is never `RELEASED`; a test that an embargo in the future gives `HELD` with no text, and equal to `now` gives `RELEASED`.
  - Requirements: 2.4, 2.5, 2.7, 3.1, 3.5, 5.1 to 5.6, 6.1 to 6.4, 7.4 to 7.6.
