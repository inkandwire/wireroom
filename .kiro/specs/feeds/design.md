# Design: feeds

Pure serializers in `src/core/feed.ts`, a thin export layer in `src/ui`. Follows `tech.md` (pure core, deterministic, `\n`, no locale APIs) and `structure.md` (named exports, camelCase files, `core` imports nothing from `ui`).

## Modules

| File | Role |
|---|---|
| `src/core/feed.ts` | `FeedEntry`, `FeedMeta`, `toRss`, `toJsonFeed`, `escapeXml` (pure) |
| `src/core/index.ts` | re-exports the above (types with `type`) |
| `src/ui/feedMeta.ts` | constant `FEED_META` (pure, placeholder values) |
| `src/ui/exportFeed.ts` | pure `buildExport(kind, entries, generatedAt)` |
| `src/ui/main.ts` | session list, two keys, Blob download (thin DOM) |

`wireItemToJson`, `composeWireItem` and `printer.ts` are not changed.

## Types

```ts
export interface FeedEntry { item: WireItem; publishedAt: string } // ISO 8601 UTC, ends in Z
export interface FeedMeta { title: string; link: string; description: string; selfUrl?: string }
export function toRss(entries: readonly FeedEntry[], meta: FeedMeta, generatedAt: string): string
export function toJsonFeed(entries: readonly FeedEntry[], meta: FeedMeta, generatedAt: string): string
export function escapeXml(text: string): string
```

Only `RELEASED` results become entries. HELD and REJECTED carry no `WireItem`, so the helper that builds entries from a result returns `[]` for them (unit tested). The core never sees a held item.

## Shared rules

- Order: copy the input, stable sort by `publishedAt` descending. ISO strings with the same format compare as text; to be safe compare `parseInstant` values (from `embargo.ts`), ties keep input order.
- Id: `wireroom:${slug}:${publishedAt}` for both formats.
- Dates: RFC 822 GMT by hand from UTC fields with fixed English tables, for example `Tue, 04 Mar 2025 10:00:00 GMT`. No `toUTCString`, no `Intl`.
- `generatedAt` is used only for `lastBuildDate` when there are no entries. An invalid instant in `publishedAt` is a caller bug; the serializers do not guess.

## RSS 2.0

```
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:wireroom="https://example.com/ns/wireroom">
  <channel>
    <title>…</title><link>…</link><description>…</description>
    <lastBuildDate>…</lastBuildDate>
    <item>
      <title>FLASH: ACME-LAUNCH</title>
      <description>full wire text, newlines kept</description>
      <pubDate>…</pubDate>
      <guid isPermaLink="false">wireroom:ACME-LAUNCH:2025-03-04T10:00:00Z</guid>
      <category>FLASH</category>
      <wireroom:claim url="https://…">claim text</wireroom:claim>
      <wireroom:source>https://…</wireroom:source>
    </item>
  </channel>
</rss>
```

- Two-space indent, `\n` between lines, final `\n`.
- `escapeXml` first removes characters outside the XML 1.0 `Char` set (keep `\t \n \r`, `U+0020–D7FF`, `U+E000–FFFD`, and surrounding pairs for `U+10000+`; lone surrogates are removed), then replaces `& < > " '` with the five entities (`&amp;` first).
- The `meta.selfUrl` adds `<atom:link>` only if wanted later; it is not written in RSS now (keeps the namespace list to one).
- `wireroom:claim` and `wireroom:source` follow the item order of `claims` and `sources`.

## JSON Feed 1.1

Built from plain objects with literal key order, then `JSON.stringify(obj, null, 2)` plus a final `\n`.

Top level order: `version`, `title`, `home_page_url`, `feed_url` (only with `selfUrl`), `description`, `items`.
Item order: `id`, `title`, `content_text`, `date_published`, `tags`, `external_url` (only with a source), `_wireroom`.
`_wireroom` order: `dateline`, `priority`, `claims`, `sources`. `title` is the same text as the RSS title. `JSON.stringify` escapes control characters, so text round-trips.

## UI

- `main.ts` keeps `const sessionEntries: FeedEntry[] = []`. In the submit handler, on `RELEASED`, push `{ item: result.item, publishedAt: now }` where `now` is the string already read for the draft. No second clock read for the entry.
- Export keys are two `btn` buttons added next to the mute toggle in `#nameplate-tools` (ids `export-rss`, `export-json`), starting with `aria-disabled="true"`; the click handler returns early while the list is empty. Enabled when the first entry is pushed.
- Download: `new Blob([text], { type })`, `URL.createObjectURL`, a temporary `<a download>` clicked, then `revokeObjectURL` and `a.remove()`.
- `exportFeed.ts`: `buildExport("rss" | "json", entries, generatedAt)` returns `{ fileName, mimeType, text }` with `wireroom.rss.xml` / `application/rss+xml;charset=utf-8` and `wireroom.feed.json` / `application/feed+json;charset=utf-8`. `generatedAt` is passed in by `main.ts` (the click handler reads `new Date().toISOString()`, as the UI may).
- `feedMeta.ts`: `FEED_META = { title: "WireRoom printed wire", link: "https://example.com/wireroom/", description: "Items printed in this WireRoom session. Sample data." }`. A comment says the link is a placeholder and is never fetched.
- Styles: reuse `.btn` (grey-green key). Add at most a small rule so the three tools wrap and keep a 44px tap height. Disabled look reuses the existing `[aria-disabled="true"]` dashed style. No new token or colour.

## Tests

Core example tests (`feed.test.ts`): a test-only strict well-formedness checker (tag stack, one root, only the five entities, quoted attributes, declaration first), required RSS elements per item, a golden RSS and a golden JSON Feed, empty list, HELD gives `[]`, newest first, tie order, escaping and control characters, JSON required fields and types.
Property tests (`feed.prop.test.ts`), for any list of released entries: well-formed RSS; JSON parses; counts equal; every claim text and source URL present in both outputs (RSS unescaped); deterministic; newest first; hostile text (`& < > " '`, emoji, control characters) stays well-formed and round-trips in JSON.
UI unit test (`exportFeed.test.ts`): file names, MIME types, text equals the core output.

## Verification

The maintainer runs `npm test`, `npm run build`, checks the page does not scroll at 1440x900 and 1280x720, checks 44px keys at 390px, and validates both downloads in an external RSS and JSON Feed validator.
