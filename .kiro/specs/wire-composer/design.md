# Design: wire-composer

## Overview

`composeWireItem(draft)` is a pure function in `src/core`. It validates times, runs the claim gate, applies the embargo, and only then formats wire text. Order matters: gate, then embargo, then format. Wire text is produced only for `RELEASED` results, so a rejected or held item has no text that could leak to a feed.

## Module layout

```
src/core/
  types.ts       shared types and constants
  wrap.ts        wrapText, splitLongWord
  claimGate.ts   checkClaims, isValidSourceUrl
  embargo.ts     isReleased, parseInstant
  compose.ts     slugFromHeadline, formatDateline, composeWireItem
  index.ts       named re-exports
```

Dependencies: `compose` imports `wrap`, `claimGate`, `embargo`, `types`. The others import only `types`. Nothing imports from `src/ui` or `src/feeds`. Named exports only. Constants: `MAX_COLUMNS = 69`, `END_MARKER = "-30-"`, `MAX_SLUG_LENGTH = 24`.

## Types (`types.ts`)

```ts
export type Priority = "FLASH" | "BULLETIN" | "URGENT" | "ROUTINE";

export interface Claim { text: string; sourceUrl?: string }

export interface Draft {
  headline: string;
  body: string;            // paragraphs separated by blank lines
  claims: Claim[];
  priority: Priority;
  embargo?: string;        // ISO 8601 UTC instant
  city: string;
  now: string;             // ISO 8601 UTC instant, passed in
}

export interface ClaimFailure {
  index: number;
  text: string;
  reason: "MISSING_SOURCE" | "INVALID_SOURCE";
}

export interface WireItem {
  slug: string;
  priorityLine: string;
  dateline: string;
  text: string;            // full teletype text, ends with -30-
}

export type ComposeResult =
  | { status: "REJECTED"; failures: ClaimFailure[]; timeErrors: ("now" | "embargo")[] }
  | { status: "HELD"; releaseAt: string }
  | { status: "RELEASED"; item: WireItem };
```

## Time handling

`parseInstant(s): number | undefined` accepts only `YYYY-MM-DDTHH:mm:ss(.fff)?Z`, checks it with a regex, and then converts using `Date.parse` on that string. `Date.parse` of an explicit string is deterministic and reads no clock. Calendar-invalid values (for example month 13 or Feb 30) are rejected by round-tripping the date fields through `Date.UTC` and comparing. Invalid `now` or `embargo` gives `REJECTED` with `timeErrors`, and `failures` is empty in that case.

## Claim gate (`claimGate.ts`)

`isValidSourceUrl(s)`: trim is not applied (a URL with surrounding whitespace is invalid). Use `new URL(s)`, require protocol `http:` or `https:` and a non-empty `hostname`; any thrown error means invalid. `new URL` is pure and does no network access. `checkClaims(claims)` returns `ClaimFailure[]`: `MISSING_SOURCE` when `sourceUrl` is undefined or an empty/whitespace-only string, `INVALID_SOURCE` otherwise when invalid. Failures are in claim order. Empty list means pass. No repair or guessing.

## Embargo (`embargo.ts`)

`isReleased(embargoMs | undefined, nowMs)` returns `true` when there is no embargo or `nowMs >= embargoMs`. It is a threshold comparison on a number, so it is monotonic in `nowMs` by construction. The composer compares parsed instants, never strings.

## Wrapping (`wrap.ts`)

- `splitLongWord(word, max)` returns consecutive slices of at most `max` characters; `join("")` equals the word.
- `wrapParagraph(text, max)`: split on `/\s+/` after trimming, drop empty tokens, then greedy fill. A token longer than `max` is split with `splitLongWord`; the first piece starts a fresh line only if the current line cannot fit it, and the last piece becomes the current line so following words can join it.
- `wrapText(text, max = MAX_COLUMNS)`: split the input into paragraphs on blank lines (`/\n\s*\n/` after normalizing `\r\n` to `\n`), wrap each, and join paragraphs with one blank line. Empty paragraphs are dropped.

Columns are counted as string length (UTF-16 code units). This is exact for ASCII. A hard split that would cut a surrogate pair is a known limitation; property tests use ASCII-printable words. The "no loss" property compares the word list of the input with the word list of the output after re-joining hard-split pieces; because pieces are only split where a word exceeds the limit, the tests compare the concatenation of all non-whitespace characters, plus a word-level check when no word exceeds 69.

## Composer (`compose.ts`)

Steps:

1. Parse `now` and `embargo`. Any invalid gives `REJECTED` with `timeErrors`.
2. `checkClaims`. Any failure gives `REJECTED` with `failures`.
3. If `embargo` exists and not `isReleased`, give `HELD` with `releaseAt` set to the embargo string as given.
4. Build the item.

Slug: uppercase the headline, replace each run of characters outside `A-Z0-9` with one `-`, trim hyphens, cut to 24 characters, trim hyphens again; empty gives `NEWS`.

Dateline: `${CITY}, ${Mon}. ${D} (WireRoom) --`. City is trimmed, whitespace collapsed, uppercased with `toUpperCase()` (locale-independent). The date comes from `getUTC*` of the parsed `now`. Month table (fixed): `Jan. Feb. Mar. Apr. May June July Aug. Sept. Oct. Nov. Dec.`. Note: `product.md` gives `Mar.` in its example; the table keeps `Mar.` and `Apr.` as the product example does, and uses the AP forms for the others. Day is a plain number with no padding.

Number style: the composer does not rewrite the body's numbers or hype words; those are founder content. This feature only enforces structure. (Rewriting or flagging hype adjectives is out of scope and may be a later spec.)

Text assembly:

```
<SLUG>
<PRIORITY>

<wrapped: "<DATELINE> <first paragraph>" then remaining paragraphs>

-30-
```

The dateline joins the first paragraph before wrapping, so it wraps with the same 69-column rule. The slug and priority lines are at most 24 and 8 characters. If the body is empty, the dateline stands alone as the first paragraph. Lines are joined with `\n`; no trailing newline after `-30-`.

## Correctness properties

- P1 (wrap): for any text and any max >= 1, every line has length <= max, and the non-whitespace characters of the output equal those of the input in order.
- P2 (gate): for any draft containing a claim with a missing or invalid URL, the status is never `RELEASED`, regardless of `now` and `embargo`.
- P3 (embargo): for any draft and `t <= t2`, `RELEASED` at `t` implies `RELEASED` at `t2`.
- P4 (determinism): `composeWireItem(d)` called twice gives deep-equal results with identical `text`.
- P5 (shape): every `RELEASED` item has `text` ending with `-30-` and no line over 69 columns.

## Error handling

No exceptions for bad input: every failure is a typed `REJECTED` result. `new URL` and date parsing exceptions are caught inside the pure helpers.

## Testing strategy

Tests sit next to code: `wrap.prop.test.ts`, `claimGate.prop.test.ts`, `embargo.prop.test.ts`, `compose.test.ts`. Property tests use fast-check arbitraries with bounded sizes. Example tests cover the dateline (`AUSTIN, Mar. 4 (WireRoom) --`, a single-digit day, a December date) and the slug (punctuation, long headlines, empty headline). The maintainer runs `npm test` outside Kiro.
