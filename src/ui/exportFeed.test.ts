import { describe, expect, it } from "vitest";
import { toJsonFeed, toRss, type FeedEntry } from "../core/index";
import { buildExport } from "./exportFeed";
import { FEED_META } from "./feedMeta";

const GENERATED_AT = "2025-03-04T12:00:00Z";

const ENTRY: FeedEntry = {
  publishedAt: "2025-03-04T10:00:00Z",
  item: {
    slug: "ACME-LAUNCH",
    priorityLine: "FLASH",
    dateline: "AUSTIN, Mar. 4 (WireRoom) --",
    text: "ACME-LAUNCH\nFLASH\nAUSTIN, Mar. 4 (WireRoom) --\nThe app has 500 users, the company said.\n-30-",
    claims: [
      {
        text: "The app has 500 users",
        sourceUrl: "https://example.com/users",
      },
    ],
    sources: ["https://example.com/users"],
  } as unknown as FeedEntry["item"],
};

describe("buildExport", () => {
  it("names the RSS file and MIME type", () => {
    const out = buildExport("rss", [ENTRY], GENERATED_AT);
    expect(out.fileName).toBe("wireroom.rss.xml");
    expect(out.mimeType).toBe("application/rss+xml;charset=utf-8");
  });

  it("names the JSON Feed file and MIME type", () => {
    const out = buildExport("json", [ENTRY], GENERATED_AT);
    expect(out.fileName).toBe("wireroom.feed.json");
    expect(out.mimeType).toBe("application/feed+json;charset=utf-8");
  });

  it("returns the core RSS text", () => {
    expect(buildExport("rss", [ENTRY], GENERATED_AT).text).toBe(
      toRss([ENTRY], FEED_META, GENERATED_AT),
    );
  });

  it("returns the core JSON Feed text", () => {
    expect(buildExport("json", [ENTRY], GENERATED_AT).text).toBe(
      toJsonFeed([ENTRY], FEED_META, GENERATED_AT),
    );
  });

  it("still gives a valid empty RSS feed", () => {
    const out = buildExport("rss", [], GENERATED_AT);
    expect(out.text.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(out.text).toContain("<channel>");
    expect(out.text).not.toContain("<item>");
    expect(out.text.endsWith("</rss>\n")).toBe(true);
  });

  it("still gives a valid empty JSON Feed", () => {
    const out = buildExport("json", [], GENERATED_AT);
    const parsed = JSON.parse(out.text) as { version: string; items: unknown[] };
    expect(parsed.version).toBe("https://jsonfeed.org/version/1.1");
    expect(parsed.items).toEqual([]);
  });

  it("is deterministic", () => {
    expect(buildExport("rss", [ENTRY], GENERATED_AT)).toEqual(
      buildExport("rss", [ENTRY], GENERATED_AT),
    );
  });
});
