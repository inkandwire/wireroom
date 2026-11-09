# Requirements: wire-fixes

## Introduction

Two quality gaps remain after the wire-composer spec. First, `slugFromHeadline` cuts the slug at 24 characters in the middle of a word (for example `ACME-LAUNCHES-WIDGET-2-F`). Second, the claim gate checks claims, but the released wire item neither prints them nor carries them as data. This spec fixes both in `src/core`. It keeps the two product rules intact: nothing here weakens the claim gate or the embargo clock, and the footer and JSON exist only for `RELEASED` items. The core stays pure: no DOM, clock, network or randomness, and no locale formatting.

## Glossary

- **Slug**: the first line of the wire text, uppercase and hyphenated, at most `MAX_SLUG_LENGTH` (24) characters.
- **Headline word**: a maximal run of `A-Z0-9` characters in the headline after uppercasing and replacing each run of other characters with a separator. Headline words are taken in headline order.
- **Slug part**: one hyphen-separated piece of a slug.
- **Released claim**: an object `{ text, sourceUrl }` for a claim of a `RELEASED` item. `sourceUrl` is always a valid source URL, because the gate has passed.
- **Sources**: the distinct source URLs of a released item, in order of first use.
- **Footer**: the AP-style block `Sources:` plus one numbered entry per claim, printed after the body and before the end marker.
- **Item JSON**: the string returned by `wireItemToJson`.
- **Composer**: the `composeWireItem` function.

## Requirements

### Requirement 1: Slug at a word boundary

**User Story:** As a founder, I want my slug built from whole words, so that the slug line never shows a chopped word.

#### Acceptance Criteria

1. THE Composer SHALL build the slug from whole headline words only: it takes headline words in order, joins them with single hyphens, and stops before the first word that would make the slug longer than `MAX_SLUG_LENGTH` (24) characters.
2. THE Composer SHALL NOT skip a word that does not fit in order to add a later, shorter word.
3. THE slug SHALL be uppercase, SHALL contain only `A-Z`, `0-9` and single hyphens between parts, and SHALL NOT start or end with a hyphen.
4. IF the headline contains no headline words, THEN THE Composer SHALL use the slug `NEWS`.
5. IF the first headline word alone is longer than 24 characters, THEN THE Composer SHALL cut that single word at exactly 24 characters and use it as the whole slug. This is the one exception to whole-word slugs: no whole-word slug exists in that case, so the first word is cut rather than returning `NEWS` or an empty slug.
6. EXCEPT in the long-first-word case of criterion 5, every slug part SHALL equal a headline word, and the slug parts SHALL be a prefix of the headline word list in order.
7. THE slug SHALL be at most 24 characters in every case.
8. THE slug rule SHALL be pure and deterministic: the same headline gives the same slug.

### Requirement 2: Claims and sources on the released item

**User Story:** As a reader and as a feed consumer, I want the released item to carry its claims and their sources, so that the evidence travels with the news.

#### Acceptance Criteria

1. WHEN the Composer returns status `RELEASED`, THE item SHALL include a `claims` field: a list of `{ text, sourceUrl }` in draft order, with one entry per draft claim and the `text` and `sourceUrl` exactly as in the draft.
2. WHEN the Composer returns status `RELEASED`, THE item SHALL include a `sources` field: the distinct `sourceUrl` values of `claims`, in order of first use.
3. THE Composer SHALL NOT change, repair, normalize, or invent a source URL in `claims` or `sources`.
4. THE Composer SHALL NOT return `claims`, `sources`, or footer text for a `REJECTED` or `HELD` result (the gate and the embargo still run first, unchanged).
5. WHERE a draft has zero claims, THE `claims` field SHALL be an empty list and THE `sources` field SHALL be an empty list.

### Requirement 3: Sources footer in the teletype text

**User Story:** As a reader, I want the printed wire to show where each claim comes from, so that I can check it.

#### Acceptance Criteria

1. WHERE a released item has one or more claims, THE wire text SHALL print, after the body paragraphs and before the end marker: a blank line, the line `Sources:`, then one numbered entry per claim in draft order, then the existing blank line, then the end marker `-30-`.
2. THE footer entry for the claim at zero-based position i SHALL have the form `<i+1>. <claim text> <source URL>`, where runs of whitespace inside the claim text are collapsed to a single space and an empty claim text leaves no extra space.
3. THE Composer SHALL wrap each footer entry with the existing `wrapText`, so that no footer line exceeds 69 columns.
4. THE footer wrapping SHALL NOT lose, add, reorder, or change any non-whitespace character of a claim text or a source URL; a URL longer than 69 columns SHALL be hard-split by the existing wrapping rule.
5. WHERE a released item has no claims, THE wire text SHALL have no footer and SHALL be identical to the text produced before this spec.
6. THE wire text SHALL still end with `-30-`, use `\n` line endings only, and have no line over 69 columns.
7. THE footer SHALL use no locale-dependent formatting, and the same draft and the same current time SHALL give byte-identical wire text.

### Requirement 4: Item JSON export

**User Story:** As a feed writer, I want a deterministic JSON form of a released item, so that feeds can carry the exact claims and URLs.

#### Acceptance Criteria

1. THE core SHALL provide a pure function `wireItemToJson(item)` that takes a released `WireItem` and returns a string.
2. THE returned string SHALL be JSON of an object with keys in this fixed order: `slug`, `priority`, `dateline`, `text`, `claims`, `sources`.
3. THE `priority` value SHALL be the item's priority line, and each entry of `claims` SHALL have keys in the order `text`, `sourceUrl`.
4. THE JSON SHALL contain each source URL exactly as in the item, with no hard split, no trimming, and no change, even when the wire `text` hard-splits that URL.
5. THE function SHALL use no `Date`, no randomness, no clock, and no locale-dependent formatting, and equal items SHALL give byte-identical strings.
6. THE function SHALL NOT be applicable to `REJECTED` or `HELD` results: its parameter is a `WireItem`, which exists only inside a `RELEASED` result.
7. THE function SHALL format with `JSON.stringify` using a two-space indent and SHALL NOT append a trailing newline.

### Requirement 5: Public API

**User Story:** As a maintainer, I want the new function and types exported, so that `ui` and `feeds` can use them.

#### Acceptance Criteria

1. THE file `src/core/index.ts` SHALL export `wireItemToJson` and the new released-claim type by name, in addition to its existing exports.
2. THE exports SHALL be named exports only, and `src/core` SHALL NOT import from `src/ui` or `src/feeds`.

### Requirement 6: Verification

**User Story:** As a maintainer, I want property and example tests, so that these rules cannot silently regress.

#### Acceptance Criteria

1. THE test suite SHALL include a fast-check property that for any headline the slug is at most 24 characters (or exactly the cut first word), never starts or ends with a hyphen, and every hyphen-separated part is a whole headline word, except in the long-first-word case.
2. THE test suite SHALL include a fast-check property that for any list of valid claims, a `RELEASED` item's JSON `sources` equal the distinct claim URLs in first-use order and its JSON `claims` equal the draft claims.
3. THE same property SHALL check that the wire text has no line over 69 columns, ends with `-30-`, and that the non-whitespace characters of every claim text and source URL appear, in claim order, in the footer.
4. THE existing example tests in `src/core/compose.test.ts` that assumed a 24-character mid-word cut SHALL be updated to the new rule, and the exact-text release test SHALL be updated to include the footer its draft now produces. Every other existing test SHALL keep passing unchanged.
5. THE test suite SHALL include example tests for the slug word boundary, the long-first-word case, the footer (including no footer for zero claims, an empty claim text, and a very long URL), and the JSON (key order, exact URLs, determinism).
