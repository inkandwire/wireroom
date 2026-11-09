import { toJsonFeed, toRss, type FeedEntry } from "../core/index";
import { FEED_META } from "./feedMeta";

export type ExportKind = "rss" | "json";

export interface ExportFile {
  fileName: string;
  mimeType: string;
  text: string;
}

/**
 * Pure: builds the file name, MIME type and text for one export. The clock
 * value `generatedAt` is passed in by the caller.
 */
export function buildExport(
  kind: ExportKind,
  entries: readonly FeedEntry[],
  generatedAt: string,
): ExportFile {
  if (kind === "rss") {
    return {
      fileName: "wireroom.rss.xml",
      mimeType: "application/rss+xml;charset=utf-8",
      text: toRss(entries, FEED_META, generatedAt),
    };
  }
  return {
    fileName: "wireroom.feed.json",
    mimeType: "application/feed+json;charset=utf-8",
    text: toJsonFeed(entries, FEED_META, generatedAt),
  };
}
