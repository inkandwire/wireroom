# Requirements: wire-composer

## Introduction

The wire composer is a pure core function that turns a founder's draft into a wire item in 1970s teletype style. It enforces the two product rules (claim gate and embargo clock) and the wire style rules from `product.md`. It lives in `src/core`, has no DOM, clock, network or randomness, and gets the current time as an argument.

## Glossary

- **Draft**: headline, body, claims, priority, optional embargo time, dateline city, and the current time.
- **Claim**: a factual statement with `text` and an optional `sourceUrl`.
- **Valid source URL**: an absolute `http` or `https` URL with a non-empty host.
- **Wire item**: slug line, priority line, dateline, teletype text, and end marker `-30-`.
- **Composer**: the `composeWireItem` function.
- **Gate**: the claim gate.
- **Result status**: one of `REJECTED`, `HELD`, `RELEASED`.
- **Column**: one character of a teletype line (text is ASCII-oriented; one UTF-16 code unit counts as one column, see Design).

## Requirements

### Requirement 1: Draft input

**User Story:** As a founder, I want to give the composer my news as a plain draft, so that it can print it in wire style.

#### Acceptance Criteria

1. THE Composer SHALL accept a draft containing headline, body, claims, priority, dateline city, current time, and an optional embargo time.
2. THE Composer SHALL accept priority only as one of `FLASH`, `BULLETIN`, `URGENT`, `ROUTINE`.
3. THE Composer SHALL treat body paragraphs as text separated by one or more blank lines.
4. THE Composer SHALL receive the current time as an argument and SHALL NOT read any clock.
5. IF the current time, or a provided embargo time, is not a valid ISO 8601 UTC instant, THEN THE Composer SHALL return status `REJECTED` with an `INVALID_TIME` reason naming the offending field.

### Requirement 2: Claim gate

**User Story:** As a reader, I want every claim to carry a source, so that released news is credible.

#### Acceptance Criteria

1. WHEN a claim has no source URL, THE Gate SHALL fail that claim.
2. WHEN a claim has a source URL that is not an absolute `http` or `https` URL with a host, THE Gate SHALL fail that claim.
3. WHEN a claim has an absolute `http` or `https` source URL with a host, THE Gate SHALL pass that claim.
4. IF one or more claims fail, THEN THE Composer SHALL return status `REJECTED` and SHALL NOT return wire text.
5. WHEN the Gate rejects a draft, THE rejection SHALL name each failing claim by its zero-based index and text, with a reason of `MISSING_SOURCE` or `INVALID_SOURCE`.
6. THE Gate SHALL NOT guess, repair, or invent a source URL.
7. THE Gate SHALL run before the embargo check, so a draft with a failing claim is `REJECTED` whether or not its embargo has passed.
8. WHERE a draft has zero claims, THE Gate SHALL pass.

### Requirement 3: Embargo clock

**User Story:** As a founder, I want my item held until its release time, so that nothing is published early.

#### Acceptance Criteria

1. WHILE the embargo time is later than the current time, THE Composer SHALL return status `HELD` and SHALL NOT return wire text.
2. WHEN the current time is equal to or later than the embargo time, THE Composer SHALL treat the embargo as lifted.
3. WHERE no embargo time is provided, THE Composer SHALL treat the embargo as lifted.
4. FOR ALL drafts and times t and t2 with t2 >= t, IF the item is released at t, THEN THE Composer SHALL release it at t2 (monotonic release).
5. A `HELD` result SHALL report the embargo time so the UI can show when the item will release.

### Requirement 4: Teletype wrapping

**User Story:** As a reader, I want text printed in teletype lines, so that it looks like a wire.

#### Acceptance Criteria

1. THE Composer SHALL emit wire text in which every line is at most 69 columns.
2. THE Composer SHALL wrap at word boundaries, where a word is a maximal run of non-whitespace characters.
3. THE wrapping SHALL NOT lose, add, reorder, or change any word.
4. IF a single word is longer than 69 columns, THEN THE wrapping SHALL split it with hard breaks into pieces of at most 69 columns, and concatenating the pieces SHALL give the original word.
5. THE wrapping SHALL keep paragraphs separate, with one blank line between paragraphs.
6. THE wrapping SHALL use `\n` line endings only.

### Requirement 5: Wire item parts

**User Story:** As a founder, I want my item to have the standard wire parts, so that it reads as credible.

#### Acceptance Criteria

1. THE Composer SHALL derive the slug line from the headline: uppercase, words joined by hyphens, characters other than `A-Z`, `0-9` and hyphen removed, and at most 24 characters with no leading, trailing or repeated hyphens.
2. IF the headline yields an empty slug, THEN THE Composer SHALL use the slug `NEWS`.
3. THE Composer SHALL emit a priority line that is the uppercase priority word.
4. THE Composer SHALL emit a dateline of the form `CITY, Mon. D (WireRoom) --`, using the uppercase dateline city and the UTC date of the current time, with fixed AP month abbreviations and no locale formatting.
5. THE wire text SHALL be, in order: slug line, priority line, a blank line, the body paragraphs with the dateline leading the first paragraph, a blank line, and the end marker.
6. THE wire text SHALL end with the end marker `-30-`.

### Requirement 6: Determinism

**User Story:** As a maintainer, I want identical input to give identical output, so that the core is testable and free.

#### Acceptance Criteria

1. FOR ALL equal drafts and equal current times, THE Composer SHALL return byte-identical wire text.
2. THE Composer SHALL NOT call `Date.now()`, `new Date()` without arguments, `performance.now()`, or any randomness.
3. THE Composer SHALL NOT use `toLocaleString`, `Intl`, or other locale-dependent formatting.
4. THE Composer SHALL NOT access the DOM or network, and `src/core` SHALL NOT import from `src/ui` or `src/feeds`.

### Requirement 7: Verification

**User Story:** As a maintainer, I want property and example tests, so that the rules cannot silently regress.

#### Acceptance Criteria

1. THE test suite SHALL include a fast-check property that wrapping never produces a line over 69 columns and never loses words.
2. THE test suite SHALL include a fast-check property that the Gate never releases a draft containing an unsourced or invalidly sourced claim.
3. THE test suite SHALL include a fast-check property for embargo monotonicity.
4. THE test suite SHALL include example tests for the dateline and the slug.
5. THE test suite SHALL include a determinism test for the Composer.
6. THE test suite SHALL include a check that every released item ends with `-30-` and has no line over 69 columns.
