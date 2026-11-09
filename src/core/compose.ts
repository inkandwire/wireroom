import { checkClaims } from "./claimGate";
import { isReleased, parseInstant } from "./embargo";
import {
  END_MARKER,
  MAX_SLUG_LENGTH,
  type ComposeResult,
  type Draft,
} from "./types";
import { wrapText } from "./wrap";

/** Fixed AP month abbreviations. No locale APIs. */
const MONTHS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "June",
  "July",
  "Aug.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
] as const;

function headlineWords(headline: string): string[] {
  return headline
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w !== "");
}

/**
 * Uppercase, hyphenated slug of at most 24 characters, built from whole
 * headline words. Words are added until the next one would not fit; it is
 * dropped whole and nothing after it is added. Only a first word longer than
 * 24 characters is cut. No words gives NEWS.
 */
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

/** Dateline in the form `CITY, Mon. D (WireRoom) --`, using the UTC date of `nowMs`. */
export function formatDateline(city: string, nowMs: number): string {
  const date = new Date(nowMs);
  const cityText = city.trim().replace(/\s+/g, " ").toUpperCase();
  const month = MONTHS[date.getUTCMonth()];
  const day = date.getUTCDate();
  return `${cityText}, ${month} ${day} (WireRoom) --`;
}

/** Gate, then embargo, then format. Wire text exists only for RELEASED results. */
export function composeWireItem(draft: Draft): ComposeResult {
  const nowMs = parseInstant(draft.now);
  const embargoMs =
    draft.embargo === undefined ? undefined : parseInstant(draft.embargo);

  const timeErrors: ("now" | "embargo")[] = [];
  if (nowMs === undefined) timeErrors.push("now");
  if (draft.embargo !== undefined && embargoMs === undefined) {
    timeErrors.push("embargo");
  }
  if (nowMs === undefined || timeErrors.length > 0) {
    return { status: "REJECTED", failures: [], timeErrors };
  }

  const failures = checkClaims(draft.claims);
  if (failures.length > 0) {
    return { status: "REJECTED", failures, timeErrors: [] };
  }

  if (draft.embargo !== undefined && !isReleased(embargoMs, nowMs)) {
    return { status: "HELD", releaseAt: draft.embargo };
  }

  const slug = slugFromHeadline(draft.headline);
  const priorityLine: string = draft.priority;
  const dateline = formatDateline(draft.city, nowMs);

  const paragraphs = draft.body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  const first =
    paragraphs.length > 0 ? `${dateline} ${paragraphs[0]}` : dateline;
  const wrapped = wrapText([first, ...paragraphs.slice(1)].join("\n\n"));

  const text = [slug, priorityLine, "", wrapped, "", END_MARKER].join("\n");

  return {
    status: "RELEASED",
    item: { slug, priorityLine, dateline, text },
  };
}
