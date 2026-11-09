export type Priority = "FLASH" | "BULLETIN" | "URGENT" | "ROUTINE";

export interface Claim {
  text: string;
  sourceUrl?: string;
}

export interface Draft {
  headline: string;
  /** Paragraphs separated by blank lines. */
  body: string;
  claims: Claim[];
  priority: Priority;
  /** ISO 8601 UTC instant. */
  embargo?: string;
  city: string;
  /** ISO 8601 UTC instant, passed in by the caller. */
  now: string;
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
  /** Full teletype text, ends with -30-. */
  text: string;
}

export type ComposeResult =
  | {
      status: "REJECTED";
      failures: ClaimFailure[];
      timeErrors: ("now" | "embargo")[];
    }
  | { status: "HELD"; releaseAt: string }
  | { status: "RELEASED"; item: WireItem };

export const MAX_COLUMNS = 69;
export const END_MARKER = "-30-";
export const MAX_SLUG_LENGTH = 24;
