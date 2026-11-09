import type { Claim, ClaimFailure } from "./types";

/** True for an absolute http or https URL with a non-empty host. No repair is attempted. */
export function isValidSourceUrl(s: string): boolean {
  // new URL() silently trims surrounding whitespace, so reject it explicitly.
  if (s !== s.trim()) {
    return false;
  }
  try {
    const url = new URL(s);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== ""
    );
  } catch {
    return false;
  }
}

/** Returns one failure per unsourced or badly sourced claim, in claim order. Empty means pass. */
export function checkClaims(claims: Claim[]): ClaimFailure[] {
  const failures: ClaimFailure[] = [];
  claims.forEach((claim, index) => {
    const url = claim.sourceUrl;
    if (url === undefined || url.trim() === "") {
      failures.push({ index, text: claim.text, reason: "MISSING_SOURCE" });
    } else if (!isValidSourceUrl(url)) {
      failures.push({ index, text: claim.text, reason: "INVALID_SOURCE" });
    }
  });
  return failures;
}
