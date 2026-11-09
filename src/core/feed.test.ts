import { describe, expect, it } from "vitest";
import { composeWireItem } from "./compose";
import {
  entriesFromResult,
  escapeXml,
  toJsonFeed,
  toRss,
  type FeedEntry,
  type FeedMeta,
} from "./feed";
import type { Draft, WireItem } from "./types";

// ---------------------------------------------------------------------------
// Test-only strict XML well-formedness checker.
// Returns null when the document is well-formed, else a message.
// ---------------------------------------------------------------------------

const PROLOG = '<?xml version="1.0" encoding="UTF-8"?>\n';
const NAME = "[A-Za-z_][A-Za-z0-9_.:-]*";
const ATTR = `\\s+${NAME}="(?:[^"<&]|&(?:amp|lt|gt|quot|apos);)*"`;
const TAG_RE = new RegExp(`<(/?)(${NAME})((?:${ATTR})*)\\s*(/?)>`, "y");
const TEXT_RE = /^(?:[^<>&]|&(?:amp|lt|gt|quot|apos);)*$/;

function hasForbiddenChar(s: string): boolean {
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    const ok =
      cp === 0x9 ||
      cp === 0xa ||
      cp === 0xd ||
      (cp >= 0x20 && cp <= 0xd7ff) ||
      (cp >= 0xe000 && cp <= 0xfffd) ||
      (cp >= 0x10000 && cp <= 0x10ffff);
    if (!ok) return true;
  }
  return false;
}

export function xmlProblem(xml: string): string | null {
  if (!xml.startsWith(PROLOG)) return "declaration must come first";
  if (hasForbiddenChar(xml)) return "forbidden character";
  const stack: string[] = [];
  let roots = 0;
  let pos = PROLOG.length;
  while (pos < xml.length) {
    if (xml[pos] === "<") {
      TAG_RE.lastIndex = pos;
      const m = TAG_RE.exec(xml);
      if (m === null) return `bad tag at ${pos}`;
      const closing = m[1] === "/";
      const name = m[2];
      const selfClosing = m[4] === "/";
      if (closing) {
        if (selfClosing || m[3] !== "") return `bad closing tag at ${pos}`;
        if (stack.pop() !== name) return `mismatched </${name}> at ${pos}`;
      } else {
        if (stack.length === 0) {
          roots += 1;
          if (roots > 1) return "more than one root";
        }
        if (!selfClosing) stack.push(name);
      }
      pos = TAG_RE.lastIndex;
    } else {
      const next = xml.indexOf("<", pos);
      const end = next === -1 ? xml.length : next;
      const text = xml.slice(pos, end);
      if (!TEXT_RE.test(text)) return `bad text at ${pos}`;
      if (stack.length === 0 && text.trim() !== "") return "text outside root";
      pos = end;
    }
  }
  if (stack.length > 0) return `unclosed <${stack[stack.length - 1]}>`;
  if (roots !== 1) return "need exactly one root";
  return null;
}

describe("test-only XML checker", () => {
  it("accepts a small document", () => {
    expect(xmlProblem(`${PROLOG}<a x="1&amp;2"><b/>t&lt;</a>\n`)).toBeNull();
  });
  it("rejects bad documents", () => {
    expect(xmlProblem("<a/>")).not.toBeNull();
    expect(xmlProblem(`${PROLOG}<a><b></a>`)).not.toBeNull();
    expect(xmlProblem(`${PROLOG}<a>x & y</a>`)).not.toBeNull();
    expect(xmlProblem(`${PROLOG}<a>x < y</a>`)).not.toBeNull();
    expect(xmlProblem(`${PROLOG}<a x='1'/>`)).not.toBeNull();
    expect(xmlProblem(`${PROLOG}<a/><b/>`)).not.toBeNull();
    expect(xmlProblem(`${PROLOG}<a>\u0000</a>`)).not.toBeNull();
    expect(xmlProblem(`${PROLOG}<a>&nbsp;</a>`)).not.toBeNull();
    expect(xmlProblem(`${PROLOG}<a>`)).not.toBeNull();
  });
});

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const META: FeedMeta = {
  title: "T",
  link: "https://example.com/w/",
  description: "D",
};

const URL_A = "https://example.com/a";

function makeItem(over: Partial<WireItem> = {}): WireItem {
  return {
    slug: "ACME-LAUNCH",
    priorityLine: "FLASH",
    dateline: "AUSTIN, Mar. 4 (WireRoom) --",
    text: "ACME-LAUNCH\nFLASH\n\nBody.\n\n-30-",
    claims: [{ text: "Acme opened", sourceUrl: URL_A }],
    sources: [URL_A],
    ...over,
  };
}

const ENTRY_A: FeedEntry = {
  item: makeItem(),
  publishedAt: "2025-03-04T10:00:00Z",
};

const ENTRY_B: FeedEntry = {
  item: makeItem({
    slug: "PRICE-CUT",
    priorityLine: "ROUTINE",
    text: "PRICE-CUT\nROUTINE\n\nBody.\n\n-30-",
    claims: [],
    sources: [],
  }),
  publishedAt: "2025-03-03T08:05:09Z",
};

function entryAt(slug: string, publishedAt: string): FeedEntry {
  return { item: makeItem({ slug }), publishedAt };
}

function sourcedDraft(over: Partial<Draft> = {}): Draft {
  return {
    headline: "Ledgerly opens public beta",
    body: "Ledgerly opened its public beta. The app has 12 users, the company said.",
    claims: [
      { text: "The app has 12 users", sourceUrl: "https://example.com/users" },
    ],
    priority: "BULLETIN",
    city: "Austin",
    now: "2026-11-09T10:00:00Z",
    ...over,
  };
}

// ---------------------------------------------------------------------------
// escapeXml
// ---------------------------------------------------------------------------

describe("escapeXml", () => {
  it("escapes the five characters, ampersand first", () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f");
    expect(escapeXml("&lt;")).toBe("&amp;lt;");
  });

  it("removes forbidden control characters and lone surrogates", () => {
    expect(escapeXml("a\u0000b\u0008c\u000bd\ufffee")).toBe("abcde");
    expect(escapeXml("a\ud800b")).toBe("ab");
    expect(escapeXml("a\udc00b")).toBe("ab");
  });

  it("keeps tab, newline, carriage return and astral characters", () => {
    expect(escapeXml("a\tb\nc\rd")).toBe("a\tb\nc\rd");
    expect(escapeXml("x\u{1F600}y")).toBe("x\u{1F600}y");
  });
});

// ---------------------------------------------------------------------------
// entriesFromResult
// ---------------------------------------------------------------------------

describe("entriesFromResult", () => {
  it("gives one entry for a RELEASED result with the given publishedAt", () => {
    const draft = sourcedDraft();
    const result = composeWireItem(draft);
    expect(result.status).toBe("RELEASED");
    const entries = entriesFromResult(result, draft.now);
    expect(entries).toHaveLength(1);
    expect(entries[0].publishedAt).toBe(draft.now);
    if (result.status === "RELEASED") {
      expect(entries[0].item).toBe(result.item);
    }
  });

  it("gives an empty list for a HELD result", () => {
    const result = composeWireItem(
      sourcedDraft({ embargo: "2026-12-01T09:00:00Z" }),
    );
    expect(result.status).toBe("HELD");
    expect(entriesFromResult(result, "2026-11-09T10:00:00Z")).toEqual([]);
  });

  it("gives an empty list for a REJECTED result", () => {
    const result = composeWireItem(
      sourcedDraft({ claims: [{ text: "The app has 12 users" }] }),
    );
    expect(result.status).toBe("REJECTED");
    expect(entriesFromResult(result, "2026-11-09T10:00:00Z")).toEqual([]);
  });

  it("a feed from a HELD result has no item", () => {
    const result = composeWireItem(
      sourcedDraft({ embargo: "2026-12-01T09:00:00Z" }),
    );
    const entries = entriesFromResult(result, "2026-11-09T10:00:00Z");
    expect(toRss(entries, META, "2026-11-09T10:00:00Z")).not.toContain("<item>");
    expect(JSON.parse(toJsonFeed(entries, META, "2026-11-09T10:00:00Z")).items).toEqual([]);
  });

  it("a composed released item serializes to a well-formed feed", () => {
    const draft = sourcedDraft();
    const entries = entriesFromResult(composeWireItem(draft), draft.now);
    const rss = toRss(entries, META, draft.now);
    expect(xmlProblem(rss)).toBeNull();
    expect(rss).toContain("<title>BULLETIN: LEDGERLY-OPENS-PUBLIC</title>");
    expect(rss).toContain(
      '<wireroom:claim url="https://example.com/users">The app has 12 users</wireroom:claim>',
    );
  });
});

// ---------------------------------------------------------------------------
// RSS
// ---------------------------------------------------------------------------

const GOLDEN_RSS = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:wireroom="https://example.com/ns/wireroom">',
  "  <channel>",
  "    <title>T</title>",
  "    <link>https://example.com/w/</link>",
  "    <description>D</description>",
  "    <lastBuildDate>Tue, 04 Mar 2025 10:00:00 GMT</lastBuildDate>",
  "    <item>",
  "      <title>FLASH: ACME-LAUNCH</title>",
  "      <description>ACME-LAUNCH\nFLASH\n\nBody.\n\n-30-</description>",
  "      <pubDate>Tue, 04 Mar 2025 10:00:00 GMT</pubDate>",
  '      <guid isPermaLink="false">wireroom:ACME-LAUNCH:2025-03-04T10:00:00Z</guid>',
  "      <category>FLASH</category>",
  '      <wireroom:claim url="https://example.com/a">Acme opened</wireroom:claim>',
  "      <wireroom:source>https://example.com/a</wireroom:source>",
  "    </item>",
  "    <item>",
  "      <title>ROUTINE: PRICE-CUT</title>",
  "      <description>PRICE-CUT\nROUTINE\n\nBody.\n\n-30-</description>",
  "      <pubDate>Mon, 03 Mar 2025 08:05:09 GMT</pubDate>",
  '      <guid isPermaLink="false">wireroom:PRICE-CUT:2025-03-03T08:05:09Z</guid>',
  "      <category>ROUTINE</category>",
  "    </item>",
  "  </channel>",
  "</rss>",
  "",
].join("\n");

describe("toRss", () => {
  it("matches the golden document (input given oldest first)", () => {
    expect(toRss([ENTRY_B, ENTRY_A], META, "2030-01-01T00:00:00Z")).toBe(
      GOLDEN_RSS,
    );
  });

  it("is well-formed and has the required elements per item", () => {
    const rss = toRss([ENTRY_A, ENTRY_B], META, "2030-01-01T00:00:00Z");
    expect(xmlProblem(rss)).toBeNull();
    expect(rss.match(/<item>/g)).toHaveLength(2);
    for (const tag of ["title", "description", "pubDate", "guid", "category"]) {
      expect(rss.match(new RegExp(`<${tag}[ >]`, "g"))?.length).toBeGreaterThanOrEqual(2);
    }
    expect(rss.endsWith("\n")).toBe(true);
    expect(rss.includes("\r")).toBe(false);
  });

  it("empty list is a valid channel with no item and uses generatedAt", () => {
    const rss = toRss([], META, "2025-01-02T03:04:05Z");
    expect(xmlProblem(rss)).toBeNull();
    expect(rss).not.toContain("<item>");
    expect(rss).toContain(
      "<lastBuildDate>Thu, 02 Jan 2025 03:04:05 GMT</lastBuildDate>",
    );
  });

  it("lastBuildDate comes from the newest entry, not generatedAt", () => {
    const rss = toRss([ENTRY_A], META, "2030-01-01T00:00:00Z");
    expect(rss).toContain(
      "<lastBuildDate>Tue, 04 Mar 2025 10:00:00 GMT</lastBuildDate>",
    );
  });

  it("lists newest first", () => {
    const rss = toRss(
      [
        entryAt("OLD", "2025-01-01T00:00:00Z"),
        entryAt("NEW", "2025-03-01T00:00:00Z"),
        entryAt("MID", "2025-02-01T00:00:00Z"),
      ],
      META,
      "2030-01-01T00:00:00Z",
    );
    const order = [...rss.matchAll(/<title>FLASH: ([A-Z]+)<\/title>/g)].map(
      (m) => m[1],
    );
    expect(order).toEqual(["NEW", "MID", "OLD"]);
  });

  it("keeps input order for equal publishedAt", () => {
    const t = "2025-03-01T00:00:00Z";
    const rss = toRss(
      [entryAt("ONE", t), entryAt("TWO", t), entryAt("THREE", t)],
      META,
      "2030-01-01T00:00:00Z",
    );
    const order = [...rss.matchAll(/<title>FLASH: ([A-Z]+)<\/title>/g)].map(
      (m) => m[1],
    );
    expect(order).toEqual(["ONE", "TWO", "THREE"]);
  });

  it("does not mutate its input", () => {
    const input = [ENTRY_B, ENTRY_A];
    toRss(input, META, "2030-01-01T00:00:00Z");
    expect(input).toEqual([ENTRY_B, ENTRY_A]);
  });

  it("escapes hostile text and stays well-formed", () => {
    const hostile = `A & B < C > D "q" 'a' \u0000\u0008 \u{1F600}`;
    const entry: FeedEntry = {
      item: makeItem({
        text: `SLUG\nFLASH\n\n${hostile}\n\n-30-`,
        claims: [{ text: hostile, sourceUrl: `https://example.com/?a=1&b="2"` }],
        sources: [`https://example.com/?a=1&b="2"`],
      }),
      publishedAt: "2025-03-04T10:00:00Z",
    };
    const rss = toRss([entry], { ...META, title: hostile }, "2030-01-01T00:00:00Z");
    expect(xmlProblem(rss)).toBeNull();
    expect(rss).toContain("A &amp; B &lt; C &gt; D &quot;q&quot; &apos;a&apos;");
    expect(rss).not.toContain("\u0000");
    expect(unescapeXml(rss)).toContain(`https://example.com/?a=1&b="2"`);
  });

  it("throws on an invalid publishedAt rather than guessing", () => {
    expect(() =>
      toRss([entryAt("BAD", "yesterday")], META, "2030-01-01T00:00:00Z"),
    ).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// JSON Feed
// ---------------------------------------------------------------------------

const GOLDEN_JSON = [
  "{",
  '  "version": "https://jsonfeed.org/version/1.1",',
  '  "title": "T",',
  '  "home_page_url": "https://example.com/w/",',
  '  "description": "D",',
  '  "items": [',
  "    {",
  '      "id": "wireroom:ACME-LAUNCH:2025-03-04T10:00:00Z",',
  '      "title": "FLASH: ACME-LAUNCH",',
  '      "content_text": "ACME-LAUNCH\\nFLASH\\n\\nBody.\\n\\n-30-",',
  '      "date_published": "2025-03-04T10:00:00Z",',
  '      "tags": [',
  '        "FLASH"',
  "      ],",
  '      "external_url": "https://example.com/a",',
  '      "_wireroom": {',
  '        "dateline": "AUSTIN, Mar. 4 (WireRoom) --",',
  '        "priority": "FLASH",',
  '        "claims": [',
  "          {",
  '            "text": "Acme opened",',
  '            "sourceUrl": "https://example.com/a"',
  "          }",
  "        ],",
  '        "sources": [',
  '          "https://example.com/a"',
  "        ]",
  "      }",
  "    }",
  "  ]",
  "}",
  "",
].join("\n");

describe("toJsonFeed", () => {
  it("matches the golden document", () => {
    expect(toJsonFeed([ENTRY_A], META, "2030-01-01T00:00:00Z")).toBe(
      GOLDEN_JSON,
    );
  });

  it("has the required fields and types", () => {
    const text = toJsonFeed([ENTRY_B, ENTRY_A], META, "2030-01-01T00:00:00Z");
    const feed = JSON.parse(text);
    expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
    expect(typeof feed.title).toBe("string");
    expect(typeof feed.home_page_url).toBe("string");
    expect(typeof feed.description).toBe("string");
    expect(Array.isArray(feed.items)).toBe(true);
    expect(feed.items).toHaveLength(2);
    for (const item of feed.items) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.content_text).toBe("string");
      expect(typeof item.date_published).toBe("string");
      expect(Array.isArray(item.tags)).toBe(true);
      expect(item.tags).toHaveLength(1);
      expect(Array.isArray(item._wireroom.claims)).toBe(true);
      expect(Array.isArray(item._wireroom.sources)).toBe(true);
    }
    expect(text.endsWith("\n")).toBe(true);
  });

  it("uses the same id as the RSS guid", () => {
    const feed = JSON.parse(toJsonFeed([ENTRY_A], META, "2030-01-01T00:00:00Z"));
    expect(feed.items[0].id).toBe("wireroom:ACME-LAUNCH:2025-03-04T10:00:00Z");
    expect(toRss([ENTRY_A], META, "2030-01-01T00:00:00Z")).toContain(
      `>${feed.items[0].id}</guid>`,
    );
  });

  it("sets external_url only when there is a source, to the first one", () => {
    const two = makeItem({
      claims: [
        { text: "One", sourceUrl: "https://example.com/1" },
        { text: "Two", sourceUrl: "https://example.com/2" },
      ],
      sources: ["https://example.com/1", "https://example.com/2"],
    });
    const feed = JSON.parse(
      toJsonFeed(
        [{ item: two, publishedAt: "2025-03-05T00:00:00Z" }, ENTRY_B],
        META,
        "2030-01-01T00:00:00Z",
      ),
    );
    expect(feed.items[0].external_url).toBe("https://example.com/1");
    expect("external_url" in feed.items[1]).toBe(false);
  });

  it("sets feed_url only with selfUrl", () => {
    const without = JSON.parse(toJsonFeed([], META, "2030-01-01T00:00:00Z"));
    expect("feed_url" in without).toBe(false);
    const withSelf = JSON.parse(
      toJsonFeed([], { ...META, selfUrl: "https://example.com/w/feed.json" }, "2030-01-01T00:00:00Z"),
    );
    expect(withSelf.feed_url).toBe("https://example.com/w/feed.json");
  });

  it("empty list gives an empty items array", () => {
    const feed = JSON.parse(toJsonFeed([], META, "2030-01-01T00:00:00Z"));
    expect(feed.items).toEqual([]);
  });

  it("uses a fixed key order", () => {
    const feed = JSON.parse(
      toJsonFeed(
        [ENTRY_A],
        { ...META, selfUrl: "https://example.com/w/feed.json" },
        "2030-01-01T00:00:00Z",
      ),
    );
    expect(Object.keys(feed)).toEqual([
      "version",
      "title",
      "home_page_url",
      "feed_url",
      "description",
      "items",
    ]);
    expect(Object.keys(feed.items[0])).toEqual([
      "id",
      "title",
      "content_text",
      "date_published",
      "tags",
      "external_url",
      "_wireroom",
    ]);
    expect(Object.keys(feed.items[0]._wireroom)).toEqual([
      "dateline",
      "priority",
      "claims",
      "sources",
    ]);
  });

  it("lists newest first and keeps input order on ties", () => {
    const t = "2025-03-01T00:00:00Z";
    const feed = JSON.parse(
      toJsonFeed(
        [
          entryAt("OLD", "2025-01-01T00:00:00Z"),
          entryAt("ONE", t),
          entryAt("TWO", t),
          entryAt("NEW", "2025-04-01T00:00:00Z"),
        ],
        META,
        "2030-01-01T00:00:00Z",
      ),
    );
    const slugs = feed.items.map((i: { title: string }) => i.title.slice(7));
    expect(slugs).toEqual(["NEW", "ONE", "TWO", "OLD"]);
  });

  it("round-trips hostile text", () => {
    const hostile = `A & B < C > D "q" 'a' \u0000\u0008 \u{1F600}`;
    const entry: FeedEntry = {
      item: makeItem({
        text: hostile,
        claims: [{ text: hostile, sourceUrl: URL_A }],
      }),
      publishedAt: "2025-03-04T10:00:00Z",
    };
    const feed = JSON.parse(toJsonFeed([entry], META, "2030-01-01T00:00:00Z"));
    expect(feed.items[0].content_text).toBe(hostile);
    expect(feed.items[0]._wireroom.claims[0].text).toBe(hostile);
  });

  it("is deterministic", () => {
    const a = toJsonFeed([ENTRY_A, ENTRY_B], META, "2030-01-01T00:00:00Z");
    const b = toJsonFeed([ENTRY_A, ENTRY_B], META, "2030-01-01T00:00:00Z");
    expect(a).toBe(b);
  });
});
