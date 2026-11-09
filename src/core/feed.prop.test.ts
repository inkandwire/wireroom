import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { escapeXml, toJsonFeed, toRss, type FeedEntry, type FeedMeta } from "./feed";
import { unescapeXml, xmlProblem } from "./feedTestHelpers";
import type { WireItem } from "./types";

const META: FeedMeta = {
  title: "T",
  link: "https://example.com/w/",
  description: "D",
};
const GENERATED_AT = "2030-01-01T00:00:00Z";

const hostileChunk = fc.oneof(
  fc.constantFrom(
    "&",
    "<",
    ">",
    '"',
    "'",
    "&amp;",
    "]]>",
    "\u0000",
    "\u0008",
    "\u000b",
    "\ufffe",
    "\ud800",
    "\u{1F600}",
    "\t",
    "\n",
    " ",
  ),
  fc.string({ unit: "binary", maxLength: 6 }),
);
const hostileText = fc
  .array(hostileChunk, { maxLength: 10 })
  .map((parts) => parts.join(""));

const plainText = fc.string({ unit: "grapheme-ascii", maxLength: 40 });
const textArb = fc.oneof(plainText, hostileText);

const urlArb = fc.oneof(
  fc.webUrl(),
  hostileText.map((t) => `https://example.com/?q=${t}`),
);

const claimArb = fc.record({ text: textArb, sourceUrl: urlArb });

const priorityArb = fc.constantFrom("FLASH", "BULLETIN", "URGENT", "ROUTINE");

const slugArb = fc.oneof(
  fc.stringMatching(/^[A-Z]{1,8}(-[A-Z]{1,8}){0,2}$/),
  hostileText,
);

const itemArb: fc.Arbitrary<WireItem> = fc
  .record({
    slug: slugArb,
    priorityLine: priorityArb,
    dateline: textArb,
    text: textArb,
    claims: fc.array(claimArb, { maxLength: 4 }),
    extraSources: fc.array(urlArb, { maxLength: 2 }),
  })
  .map(({ extraSources, ...rest }) => ({
    ...rest,
    sources: [...rest.claims.map((c) => c.sourceUrl), ...extraSources],
  }));

// Whole seconds from 1970 to 2099, so the instant is a plain ISO string ending in Z.
const instantArb = fc
  .integer({ min: 0, max: 4_102_444_799 })
  .map((s) => new Date(s * 1000).toISOString().replace(".000Z", "Z"));

const entryArb: fc.Arbitrary<FeedEntry> = fc.record({
  item: itemArb,
  publishedAt: instantArb,
});

const entriesArb = fc.array(entryArb, { maxLength: 8 });

/** What survives XML output: forbidden characters are removed. */
function xmlSafe(s: string): string {
  return unescapeXml(escapeXml(s));
}

describe("toRss properties", () => {
  it("is always well-formed XML", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        expect(xmlProblem(toRss(entries, META, GENERATED_AT))).toBeNull();
      }),
    );
  });

  it("stays well-formed with hostile feed metadata", () => {
    fc.assert(
      fc.property(entriesArb, hostileText, hostileText, hostileText, (entries, title, link, description) => {
        const rss = toRss(entries, { title, link, description }, GENERATED_AT);
        expect(xmlProblem(rss)).toBeNull();
      }),
    );
  });

  it("has one <item> per entry", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const rss = toRss(entries, META, GENERATED_AT);
        expect((rss.match(/<item>/g) ?? []).length).toBe(entries.length);
        expect((rss.match(/<\/item>/g) ?? []).length).toBe(entries.length);
      }),
    );
  });

  it("contains every claim text and source URL (after unescaping)", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const plain = unescapeXml(toRss(entries, META, GENERATED_AT));
        for (const { item } of entries) {
          for (const claim of item.claims) {
            expect(plain).toContain(xmlSafe(claim.text));
            expect(plain).toContain(xmlSafe(claim.sourceUrl));
          }
          for (const source of item.sources) {
            expect(plain).toContain(xmlSafe(source));
          }
        }
      }),
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        expect(toRss(entries, META, GENERATED_AT)).toBe(
          toRss(entries, META, GENERATED_AT),
        );
      }),
    );
  });

  it("starts with the XML declaration and ends with a newline", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const rss = toRss(entries, META, GENERATED_AT);
        expect(rss.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
        expect(rss.endsWith("</rss>\n")).toBe(true);
      }),
    );
  });

  it("lists items newest first", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const rss = toRss(entries, META, GENERATED_AT);
        const dates = [...rss.matchAll(/<guid isPermaLink="false">[\s\S]*?:(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)<\/guid>/g)].map(
          (m) => Date.parse(m[1]),
        );
        expect(dates).toHaveLength(entries.length);
        for (let i = 1; i < dates.length; i += 1) {
          expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
        }
      }),
    );
  });

  it("does not mutate its input", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const before = JSON.stringify(entries);
        toRss(entries, META, GENERATED_AT);
        expect(JSON.stringify(entries)).toBe(before);
      }),
    );
  });
});

describe("toJsonFeed properties", () => {
  it("always parses and has the required top-level fields", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const feed = JSON.parse(toJsonFeed(entries, META, GENERATED_AT));
        expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
        expect(typeof feed.title).toBe("string");
        expect(Array.isArray(feed.items)).toBe(true);
      }),
    );
  });

  it("has one item per entry", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const feed = JSON.parse(toJsonFeed(entries, META, GENERATED_AT));
        expect(feed.items).toHaveLength(entries.length);
      }),
    );
  });

  it("round-trips every claim text and source URL", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const feed = JSON.parse(toJsonFeed(entries, META, GENERATED_AT));
        const parsed: Array<{
          content_text: string;
          _wireroom: {
            claims: Array<{ text: string; sourceUrl: string }>;
            sources: string[];
          };
        }> = feed.items;
        const sourcesOut = parsed.flatMap((i) => i._wireroom.sources).sort();
        const claimsOut = parsed
          .flatMap((i) => i._wireroom.claims.map((c) => `${c.text}\u0001${c.sourceUrl}`))
          .sort();
        const sourcesIn = entries.flatMap((e) => e.item.sources).sort();
        const claimsIn = entries
          .flatMap((e) => e.item.claims.map((c) => `${c.text}\u0001${c.sourceUrl}`))
          .sort();
        expect(sourcesOut).toEqual(sourcesIn);
        expect(claimsOut).toEqual(claimsIn);
        expect(parsed.map((i) => i.content_text).sort()).toEqual(
          entries.map((e) => e.item.text).sort(),
        );
      }),
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        expect(toJsonFeed(entries, META, GENERATED_AT)).toBe(
          toJsonFeed(entries, META, GENERATED_AT),
        );
      }),
    );
  });

  it("lists items newest first", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const feed = JSON.parse(toJsonFeed(entries, META, GENERATED_AT));
        const dates: number[] = feed.items.map((i: { date_published: string }) =>
          Date.parse(i.date_published),
        );
        for (let i = 1; i < dates.length; i += 1) {
          expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
        }
      }),
    );
  });

  it("round-trips hostile feed metadata", () => {
    fc.assert(
      fc.property(hostileText, hostileText, (title, description) => {
        const feed = JSON.parse(
          toJsonFeed([], { ...META, title, description }, GENERATED_AT),
        );
        expect(feed.title).toBe(title);
        expect(feed.description).toBe(description);
      }),
    );
  });

  it("sets external_url exactly when the item has a source", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const feed = JSON.parse(toJsonFeed(entries, META, GENERATED_AT));
        for (const out of feed.items as Array<{
          external_url?: string;
          _wireroom: { sources: string[] };
        }>) {
          const sources = out._wireroom.sources;
          if (sources.length > 0) {
            expect(out.external_url).toBe(sources[0]);
          } else {
            expect("external_url" in out).toBe(false);
          }
        }
      }),
    );
  });
});

describe("RSS and JSON Feed agree", () => {
  it("have the same number of items", () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const rssCount = (toRss(entries, META, GENERATED_AT).match(/<item>/g) ?? []).length;
        const jsonCount = JSON.parse(toJsonFeed(entries, META, GENERATED_AT)).items.length;
        expect(rssCount).toBe(jsonCount);
        expect(rssCount).toBe(entries.length);
      }),
    );
  });
});
