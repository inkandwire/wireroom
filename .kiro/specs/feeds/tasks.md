# Tasks: feeds

Note: the agent running a task cannot run shell commands. Each task only writes files, including its own tests. Do not add install or run steps. The maintainer runs `npm test` and `npm run build` outside Kiro, and sends back screenshots, an external feed validation and observations after each task.

Rules for every task: add no dependency (plain string builders, no XML or feed library); named exports only; follow `.kiro/steering/*.md` and `design.md`; `src/core` has no clock, randomness, DOM or network; do not change `wireItemToJson`, `composeWireItem` or `printer.ts`.

- [ ] 1. Core serializers (`src/core/feed.ts`, `src/core/index.ts`, `src/core/feed.test.ts`)
  - Implement `FeedEntry`, `FeedMeta`, `toRss`, `toJsonFeed` and `escapeXml` exactly as in design.md, plus the small pure helper that turns a `ComposeResult` and a `publishedAt` into `FeedEntry[]` (empty for `HELD` and `REJECTED`). Export them from `src/core/index.ts`.
  - Write `src/core/feed.test.ts`: the tiny test-only strict XML well-formedness checker; required RSS elements per item; one RSS and one JSON Feed golden example built from `EXAMPLE_SOURCED` and `EXAMPLE_UNSOURCED` (with the missing URL filled in) via `composeWireItem`, or from hand-made entries; empty list; a list built from a `HELD` result is empty; newest first and tie order; escaping of `& < > " '` and removal of forbidden control characters; JSON Feed required fields and types, `external_url` only with a source, `feed_url` only with `selfUrl`.
  - Maintainer: runs `npm test` and `npm run build`, reports failures.
  - Requirements: 1.1 to 1.3, 2.1 to 2.3, 3.1 to 3.4, 4.1 to 4.3, 5.1 to 5.5, 6.1, 10.1.

- [ ] 2. Property tests (`src/core/feed.prop.test.ts`, fixes in `src/core/feed.ts`)
  - Write the fast-check properties from design.md for any list of released entries: RSS well-formed per the checker; JSON Feed parses; item counts equal the entry count in both; every claim text and every source URL appears in both outputs (RSS after unescaping); output deterministic; entries newest first; hostile text (`& < > " '`, emoji, control characters) keeps RSS well-formed and round-trips in JSON. Share the checker from `feed.test.ts` by moving it to a test-only helper file in `src/core` if needed.
  - Fix any defect the properties find in `src/core/feed.ts`.
  - Maintainer: runs `npm test`, reports failures with the fast-check seed and counterexample.
  - Requirements: 2.1 to 2.3, 3.1 to 3.4, 4.1 to 4.3, 5.1 to 5.5, 7.1, 7.2.

- [ ] 3. Export keys and session list (`src/ui/feedMeta.ts`, `src/ui/exportFeed.ts`, `src/ui/exportFeed.test.ts`, `src/ui/main.ts`, `index.html` only if needed, `src/ui/style.css`)
  - `src/ui/feedMeta.ts`: the `FEED_META` constant with a placeholder comment. `src/ui/exportFeed.ts`: pure `buildExport(kind, entries, generatedAt)` returning file name, MIME type and text. `src/ui/exportFeed.test.ts`: file names, MIME types, text equals the core output, empty list still valid.
  - `src/ui/main.ts`: the session list, pushing `{ item, publishedAt: now }` only for `RELEASED` results with the same `now` as the draft; the "Export RSS" (`export-rss`) and "Export JSON feed" (`export-json`) keys in `#nameplate-tools`, `aria-disabled` while the list is empty, thin Blob download with a temporary `<a download>`. Keep existing ids and classes.
  - Styles with existing tokens only (the small grey-green key look), 44px tap height, visible focus ring, no new colour.
  - Maintainer: runs `npm test` and `npm run build`; checks that the page does not scroll at 1440x900 and 1280x720 and that no control is under 44px tall at 390px; prints the sourced example, downloads both files, validates them in an external RSS and JSON Feed validator, checks that a HELD item adds nothing; sends screenshots and observations.
  - Requirements: 1.2, 1.3, 8.1 to 8.3, 9.1 to 9.3, 10.1, 10.2.
