# Design: wire-fixes

## Overview

Two small changes in `src/core`, both pure. `slugFromHeadline` becomes a greedy whole-word builder. `composeWireItem` adds `claims` and `sources` to a released item and prints a `Sources:` footer. A new function `wireItemToJson` serializes a released item. The order in `composeWireItem` is unchanged: time parse, claim gate, embargo, then format. Claims, sources and footer exist only on the `RELEASED` path.

## Module layout

```
src/core/
  types.ts      add ReleasedClaim, extend WireItem
  compose.ts    new slugFromHeadline, footer in composeWireItem
  wireJson.ts   wireItemToJson (new)
  index.ts      add exports
```

`wireJson.ts` imports only `types`. `compose.ts` keeps importing `wrap`, `claimGate`, `embargo`, `types`. Nothing imports from `src/ui` or `src/feeds`. Named exports only.

## Slug (`compose.ts`)

```ts
function headlineWords(headline: string): string[] {
  return headline
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w !== "");
}

export function slugFromHeadline(headline: string): string {
  const words = headlineWords(headline);
  if (words.length === 0) return "NEWS";
  const first = words[0];
  if (first.length > MAX_SLUG_LENGTH) return first.slice(0, MAX_SLUG_LENGTH);
  let slug = first;
  for (const word of words.slice(1)) {
    if (slug.length + 1 + word.length > MAX_SLUG_LENGTH) break;
    slug += "-" + word;
  }
  return slug;
}
```

- The loop stops at the first word that does not fit. It does not look ahead for a shorter word.
- Words contain only `A-Z0-9`, so the slug cannot start or end with a hyphen, and hyphens are single.
- The only mid-word cut is the first word longer than 24 characters. The cut word is all alphanumeric, so there is no trailing hyphen.
- `toUpperCase()` is locale-independent. One known quirk: non-ASCII letters such as `ß` can uppercase to `SS`; they are then ASCII words like any other. The `[^A-Z0-9]` replacement runs after uppercasing, as before, so the word list is defined exactly as in the requirements glossary. The property test builds its expected word list with the same two steps (uppercase, then replace), written independently of the implementation.
- Behavior change from the old code on the example: `Acme launches widget 2 for founders` gave `ACME-LAUNCHES-WIDGET-2-F` and now gives `ACME-LAUNCHES-WIDGET-2` (22 characters; adding `-FOR` would make 26).

## Types (`types.ts`)

```ts
export interface ReleasedClaim {
  text: string;
  sourceUrl: string;
}

export interface WireItem {
  slug: string;
  priorityLine: string;
  dateline: string;
  /** Full teletype text, ends with -30-. */
  text: string;
  /** Draft claims in draft order. Only on released items. */
  claims: ReleasedClaim[];
  /** Distinct source URLs in order of first use. */
  sources: string[];
}
```

`Claim` is unchanged (`sourceUrl` stays optional on drafts). `ComposeResult` is unchanged; `WireItem` only exists in the `RELEASED` variant, which is how `wireItemToJson` is restricted to released items at the type level.

## Composer changes (`compose.ts`)

After the gate passes, every claim has a defined valid `sourceUrl`. Build the item data:

```ts
const claims: ReleasedClaim[] = draft.claims.map((c) => ({
  text: c.text,
  sourceUrl: c.sourceUrl as string, // gate passed: defined and valid
}));
const sources: string[] = [];
for (const c of claims) {
  if (!sources.includes(c.sourceUrl)) sources.push(c.sourceUrl);
}
```

To avoid the `as` cast, a small loop that pushes only when `c.sourceUrl !== undefined` may be used instead; the gate guarantees nothing is skipped. Either way the claims are not trimmed or altered.

Footer builder (private helper in `compose.ts`):

```ts
function sourcesFooter(claims: ReleasedClaim[]): string {
  if (claims.length === 0) return "";
  const entries = claims.map((c, i) =>
    wrapText(`${i + 1}. ${c.text} ${c.sourceUrl}`.replace(/\s+/g, " ")),
  );
  return ["Sources:", ...entries].join("\n");
}
```

- `.replace(/\s+/g, " ")` collapses whitespace inside the entry, so a claim text with blank lines or newlines cannot make `wrapText` split the entry into paragraphs or add blank lines. An empty claim text gives `1.  <url>`, which collapses to `1. <url>`. Collapsing changes only whitespace, so the non-whitespace-character guarantee holds.
- Source URLs contain no whitespace (the gate rejects padded URLs; `new URL` also percent-encodes interior spaces only in its own output, but we print the draft string, which if it had an interior space would be collapsed to one; such a draft is already outside normal input and the JSON still carries the exact string).
- `wrapText` caps each line at 69 columns and hard-splits a long URL with the existing `splitLongWord`, with no character lost.
- A zero-length-after-trim entry cannot occur: it always begins with `N.`.

Text assembly:

```
<SLUG>
<PRIORITY>

<wrapped body, dateline leading the first paragraph>

Sources:                      <- only when claims exist
1. <claim text> <url>
2. <claim text> <url>

-30-
```

In code: `const footer = sourcesFooter(claims); const parts = [slug, priorityLine, "", wrapped, ""]; if (footer !== "") parts.push(footer, ""); parts.push(END_MARKER); const text = parts.join("\n");`. With no claims this gives exactly the old text `slug\nprio\n\nwrapped\n\n-30-`. With claims, the blank line before `Sources:` is the old pre-marker blank line, and a second blank line separates the footer from `-30-`, so the text keeps the same "blank line before the end marker" rule as before.

## JSON (`wireJson.ts`)

```ts
import type { WireItem } from "./types";

export function wireItemToJson(item: WireItem): string {
  return JSON.stringify(
    {
      slug: item.slug,
      priority: item.priorityLine,
      dateline: item.dateline,
      text: item.text,
      claims: item.claims.map((c) => ({ text: c.text, sourceUrl: c.sourceUrl })),
      sources: [...item.sources],
    },
    null,
    2,
  );
}
```

Object literal key order is the insertion order for string keys, so the order is fixed and `JSON.stringify` follows it. No `Date`, randomness or locale APIs. The wire `text` field is the wrapped teletype text; `claims` and `sources` carry the exact, unsplit URLs. No trailing newline.

## Index (`index.ts`)

Add `type ReleasedClaim` to the `./types` export list and `export { wireItemToJson } from "./wireJson";`.

## Correctness properties

- P6 (slug): for any headline, `slug.length <= 24` or the slug is exactly the first 24 characters of the first headline word; the slug never starts or ends with `-` and has no `--`; unless the first word is longer than 24, the slug parts are a prefix of the headline word list, and appending the next word would exceed 24 (maximality).
- P7 (claims and sources): for any list of valid claims, a `RELEASED` item has `claims` equal to the draft claims and `sources` equal to the distinct URLs in first-use order; `JSON.parse(wireItemToJson(item))` has the same `claims` and `sources`.
- P8 (footer shape): the wire text still ends with `-30-` and has no line over 69 columns; the non-whitespace characters of each claim text followed by its URL, for all claims in order, form a subsequence of the footer's non-whitespace characters.
- P1 to P5 from wire-composer still hold.

## Error handling

No new failure modes. `wireItemToJson` is total on `WireItem`. A draft with bad claims is still `REJECTED` by the gate before any footer is built.

## Testing strategy

- `src/core/compose.test.ts` (update): slug example tests rewritten for the word-boundary rule; the exact-text release test now expects the footer for its one claim; new footer examples (no claims keeps the old text, an empty claim text, a very long URL hard-split in text); `claims`/`sources` fields on the item.
- `src/core/slug.prop.test.ts` (new): property P6.
- `src/core/wireJson.test.ts` (new): JSON example tests (key order via the raw string, exact long URL, determinism).
- `src/core/wireFooter.prop.test.ts` (new): properties P7 and P8, with claim texts from ASCII-printable strings and URLs from a generated `https://host/path` arbitrary, including some URLs longer than 69 columns, and with repeated URLs to exercise distinct-in-first-use-order.

The maintainer runs `npm test` outside Kiro.
