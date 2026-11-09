# Requirements: feeds

## Introduction

This feature exports the wire printed in the current page session as an RSS 2.0 feed and a JSON Feed 1.1 document. Claims and their sources are included. Embargoed (HELD) items are never included. The serializers are pure string builders in `src/core/feed.ts` (no XML or feed library, no new dependency). The two export keys are a thin UI layer in `src/ui`. The claim gate and the embargo clock in `product.md` are not weakened.

## Glossary

- **Feed module**: `src/core/feed.ts`.
- **FeedEntry**: `{ item: WireItem; publishedAt: string }`. `publishedAt` is an ISO 8601 UTC instant ending in `Z`.
- **FeedMeta**: `{ title, link, description, selfUrl? }`.
- **Session list**: the `FeedEntry` values for items printed since the page loaded.
- **Export keys**: the "Export RSS" and "Export JSON feed" buttons.

## Requirements

### Requirement 1: Only released items become entries

**User Story:** As a founder, I want held and rejected drafts kept out of my feeds, so that nothing leaks before its release time.

#### Acceptance Criteria

1. THE Feed module SHALL define `FeedEntry` and accept only `FeedEntry` values, which are built only from `RELEASED` results.
2. WHEN a `ComposeResult` has status `HELD` or `REJECTED`, THE entry list built from it SHALL be empty.
3. WHEN an item is released, THE entry SHALL carry `publishedAt` equal to the instant passed in by the caller (`draft.now`, or the release time for a later-released embargoed item).

### Requirement 2: Purity and determinism

**User Story:** As a maintainer, I want the same entries to give the same bytes, so that feeds can be tested and diffed.

#### Acceptance Criteria

1. THE Feed module SHALL NOT read a clock, use randomness, touch the DOM or use the network; time comes only from `publishedAt` values and the `generatedAt` argument.
2. THE same entries, meta and `generatedAt` SHALL give byte-identical output, with `\n` line endings, fixed ordering and no locale-dependent formatting.
3. THE Feed module SHALL list entries newest first by `publishedAt`, and entries with equal `publishedAt` SHALL keep their input order.

### Requirement 3: RSS 2.0 document

**User Story:** As a reader, I want a valid RSS feed, so that any reader app can subscribe.

#### Acceptance Criteria

1. THE `toRss` function SHALL return an XML 1.0 document with the declaration `<?xml version="1.0" encoding="UTF-8"?>`, one `<rss version="2.0">` root with the `wireroom` namespace, and one `<channel>` holding title, link, description and `lastBuildDate`.
2. THE `lastBuildDate` SHALL be in RFC 822 form in GMT, taken from the newest `publishedAt`, or from `generatedAt` when there are no entries.
3. WHEN the entry list is empty, THE document SHALL be valid and have a channel with no `<item>`.
4. THE `toRss` function SHALL write one `<item>` per entry with `<title>` (priority line, `": "`, slug), `<description>` (the full wire text, newlines kept), `<pubDate>` (RFC 822 GMT), `<guid isPermaLink="false">`, and `<category>` (the priority).

### Requirement 4: Claims and sources in RSS

**User Story:** As a reader, I want each claim next to its source, so that I can check it.

#### Acceptance Criteria

1. FOR each claim of an entry, THE `toRss` function SHALL write a `<wireroom:claim url="...">` element holding the claim text.
2. FOR each distinct source of an entry, THE `toRss` function SHALL write a `<wireroom:source>` element holding the URL.
3. THE `toRss` function SHALL escape `&`, `<`, `>`, `"` and `'` in all text and attribute values, and SHALL remove characters that XML 1.0 forbids.

### Requirement 5: JSON Feed 1.1 document

**User Story:** As a developer, I want a JSON Feed, so that I can read the wire without XML.

#### Acceptance Criteria

1. THE `toJsonFeed` function SHALL return JSON with `version` "https://jsonfeed.org/version/1.1", `title`, `home_page_url`, `feed_url` only when `selfUrl` is given, `description`, and `items` (always an array).
2. FOR each entry, THE item SHALL have `id` (the same string as the RSS guid), `title`, `content_text` (the full wire text), `date_published` (the `publishedAt`) and `tags` holding the priority.
3. WHEN an entry has at least one source, THE item SHALL set `external_url` to the first source; otherwise it SHALL omit it.
4. FOR each entry, THE item SHALL include the extension `_wireroom` with `dateline`, `priority`, `claims` (`text`, `sourceUrl`) and `sources`.
5. THE output SHALL use two-space indent and a fixed key order.

### Requirement 6: Stable identifiers

**User Story:** As a feed reader, I want a stable id per item, so that I do not show duplicates.

#### Acceptance Criteria

1. THE id of an entry SHALL be `wireroom:` + slug + `:` + `publishedAt` in both formats.

### Requirement 7: No lost claims

**User Story:** As a founder, I want every claim and source to appear in the export, so that the evidence travels with the news.

#### Acceptance Criteria

1. FOR every entry, every claim text and every source URL SHALL appear in both outputs (in RSS after unescaping).
2. THE item counts of both outputs SHALL equal the entry count.

### Requirement 8: Session list and export keys

**User Story:** As a founder, I want to download what I printed, so that I can publish it.

#### Acceptance Criteria

1. WHEN a `RELEASED` result is printed, THE page SHALL add a `FeedEntry` to the Session list with `publishedAt` equal to the same `now` used for the draft; `HELD` and `REJECTED` results SHALL add nothing.
2. WHILE the Session list is empty, THE Export keys SHALL have `aria-disabled="true"` and SHALL do nothing when activated.
3. WHEN an Export key is activated and the list is not empty, THE page SHALL download `wireroom.rss.xml` or `wireroom.feed.json` built from the list, using a Blob and a temporary `<a download>`.

### Requirement 9: Presentation and layout

**User Story:** As a user, I want the export keys to fit the existing look.

#### Acceptance Criteria

1. THE Export keys SHALL use the existing secondary key style and tokens, with no new colour, and SHALL keep a visible focus ring.
2. THE page SHALL NOT scroll at 1440x900 and 1280x720, and no control SHALL be under 44px tall on a phone.
3. THE change SHALL keep existing element ids and classes and SHALL NOT change `printer.ts` behaviour.

### Requirement 10: Static and free

**User Story:** As a maintainer, I want the feature to stay static and free.

#### Acceptance Criteria

1. THE feature SHALL add no dependency, no network request, no secret and no backend.
2. THE namespace URI and the `FeedMeta` link SHALL be placeholders on `example.com`, marked as such in a comment, and never fetched.
