import type { Claim } from "./types";

export type SourceStatus = "OK" | "MISSING" | "MALFORMED" | "NOT_HTTPS" | "UNLISTED";

export interface SourceResult {
  index: number;
  text: string;
  status: SourceStatus;
}

function statusFor(url: string | undefined, sources: string[] | undefined): SourceStatus {
  if (url === undefined || url.trim() === "") {
    return "MISSING";
  }
  // new URL() trims surrounding whitespace and may encode inner spaces, so reject both here.
  if (url !== url.trim() || /\s/.test(url)) {
    return "MALFORMED";
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "MALFORMED";
  }
  if (!parsed.hostname.includes(".")) {
    return "MALFORMED";
  }
  if (parsed.protocol !== "https:") {
    return "NOT_HTTPS";
  }
  if (Array.isArray(sources) && !sources.includes(url)) {
    return "UNLISTED";
  }
  return "OK";
}

/**
 * Offline source check: one result per claim, in claim order. Looks at the URL text only,
 * so it cannot say whether a link resolves. When `sources` is an array, a URL must be in it.
 */
export function checkSourcesLocal(
  claims: Pick<Claim, "text" | "sourceUrl">[],
  sources?: string[],
): SourceResult[] {
  return claims.map((claim, index) => ({
    index,
    text: claim.text,
    status: statusFor(claim.sourceUrl, sources),
  }));
}
