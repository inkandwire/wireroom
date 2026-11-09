import { parseInstant } from "./embargo";
import type { ComposeResult, WireItem } from "./types";

/** An item released at `publishedAt` (ISO 8601 UTC, ends in Z). */
export interface FeedEntry {
  item: WireItem;
  publishedAt: string;
}

export interface FeedMeta {
  title: string;
  link: string;
  description: string;
  selfUrl?: string;
}

/**
 * Namespace URI for the wireroom extension elements. It is a placeholder on
 * example.com. It names the namespace only and is never fetched.
 */
const WIREROOM_NS = "https://example.com/ns/wireroom";

const JSON_FEED_VERSION = "https://jsonfeed.org/version/1.1";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** RFC 822 date in GMT from UTC fields and fixed English tables. */
function formatRfc822(instant: string): string {
  const ms = parseInstant(instant);
  if (ms === undefined) {
    throw new RangeError(`Invalid instant: ${instant}`);
  }
  const d = new Date(ms);
  return (
    `${DAYS[d.getUTCDay()]}, ${pad2(d.getUTCDate())} ` +
    `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ` +
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} GMT`
  );
}

function isXmlChar(cp: number): boolean {
  return (
    cp === 0x9 ||
    cp === 0xa ||
    cp === 0xd ||
    (cp >= 0x20 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) ||
    (cp >= 0x10000 && cp <= 0x10ffff)
  );
}

/**
 * Removes characters XML 1.0 forbids (including lone surrogates), then
 * escapes `& < > " '` with the five entities.
 */
export function escapeXml(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (!isXmlChar(cp)) continue;
    switch (ch) {
      case "&":
        out += "&amp;";
        break;
      case "<":
        out += "&lt;";
        break;
      case ">":
        out += "&gt;";
        break;
      case '"':
        out += "&quot;";
        break;
      case "'":
        out += "&apos;";
        break;
      default:
        out += ch;
    }
  }
  return out;
}

/** Copy, then stable sort newest first. Ties keep input order. */
function sortNewestFirst(entries: readonly FeedEntry[]): FeedEntry[] {
  const keyed = entries.map((entry, index) => ({
    entry,
    index,
    ms: parseInstant(entry.publishedAt),
  }));
  keyed.sort((a, b) => {
    if (a.ms !== undefined && b.ms !== undefined) {
      if (a.ms !== b.ms) return b.ms - a.ms;
    } else if (a.entry.publishedAt !== b.entry.publishedAt) {
      return a.entry.publishedAt < b.entry.publishedAt ? 1 : -1;
    }
    return a.index - b.index;
  });
  return keyed.map((k) => k.entry);
}

function entryId(entry: FeedEntry): string {
  return `wireroom:${entry.item.slug}:${entry.publishedAt}`;
}

function entryTitle(item: WireItem): string {
  return `${item.priorityLine}: ${item.slug}`;
}

/**
 * Entries for one compose result: one entry for RELEASED, none for HELD and
 * REJECTED. `publishedAt` is passed in by the caller.
 */
export function entriesFromResult(
  result: ComposeResult,
  publishedAt: string,
): FeedEntry[] {
  if (result.status !== "RELEASED") return [];
  return [{ item: result.item, publishedAt }];
}

export function toRss(
  entries: readonly FeedEntry[],
  meta: FeedMeta,
  generatedAt: string,
): string {
  const sorted = sortNewestFirst(entries);
  const lastBuild = formatRfc822(
    sorted.length > 0 ? sorted[0].publishedAt : generatedAt,
  );
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<rss version="2.0" xmlns:wireroom="${WIREROOM_NS}">`,
    "  <channel>",
    `    <title>${escapeXml(meta.title)}</title>`,
    `    <link>${escapeXml(meta.link)}</link>`,
    `    <description>${escapeXml(meta.description)}</description>`,
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
  ];
  for (const entry of sorted) {
    const { item } = entry;
    lines.push("    <item>");
    lines.push(`      <title>${escapeXml(entryTitle(item))}</title>`);
    lines.push(`      <description>${escapeXml(item.text)}</description>`);
    lines.push(`      <pubDate>${formatRfc822(entry.publishedAt)}</pubDate>`);
    lines.push(
      `      <guid isPermaLink="false">${escapeXml(entryId(entry))}</guid>`,
    );
    lines.push(`      <category>${escapeXml(item.priorityLine)}</category>`);
    for (const claim of item.claims) {
      lines.push(
        `      <wireroom:claim url="${escapeXml(claim.sourceUrl)}">${escapeXml(claim.text)}</wireroom:claim>`,
      );
    }
    for (const source of item.sources) {
      lines.push(`      <wireroom:source>${escapeXml(source)}</wireroom:source>`);
    }
    lines.push("    </item>");
  }
  lines.push("  </channel>", "</rss>");
  return lines.join("\n") + "\n";
}

export function toJsonFeed(
  entries: readonly FeedEntry[],
  meta: FeedMeta,
  // Kept for a symmetric signature with toRss. JSON Feed has no build date.
  _generatedAt: string,
): string {
  const sorted = sortNewestFirst(entries);
  const items = sorted.map((entry) => {
    const { item } = entry;
    const out: Record<string, unknown> = {
      id: entryId(entry),
      title: entryTitle(item),
      content_text: item.text,
      date_published: entry.publishedAt,
      tags: [item.priorityLine],
    };
    if (item.sources.length > 0) out.external_url = item.sources[0];
    out._wireroom = {
      dateline: item.dateline,
      priority: item.priorityLine,
      claims: item.claims.map((c) => ({ text: c.text, sourceUrl: c.sourceUrl })),
      sources: [...item.sources],
    };
    return out;
  });
  const feed: Record<string, unknown> = {
    version: JSON_FEED_VERSION,
    title: meta.title,
    home_page_url: meta.link,
  };
  if (meta.selfUrl !== undefined) feed.feed_url = meta.selfUrl;
  feed.description = meta.description;
  feed.items = items;
  return JSON.stringify(feed, null, 2) + "\n";
}
