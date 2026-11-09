import type { WireItem } from "./types";

/** Serialize a released item. Fixed key order, two-space indent, no trailing newline. */
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
