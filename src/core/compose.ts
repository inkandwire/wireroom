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

function trimHyphens(s: string): string {
  return s.replace(/^-+/, "").replace(/-+$/, "");
}

/** Uppercase, hyphenated slug of at most 24 characters. Empty gives NEWS. */
export function slugFromHeadline(headline: string): string {
  const hyphenated = trimHyphens(
    headline.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
  );
  const slug = trimHyphens(hyphenated.slice(0, MAX_SLUG_LENGTH));
  return slug === "" ? "NEWS" : slug;
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
