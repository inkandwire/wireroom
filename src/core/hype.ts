import type { Draft } from "./types";

/** Hype words that wire copy should not use. Lowercase; matched case-insensitively. */
export const HYPE_WORDS: readonly string[] = [
  "revolutionary",
  "groundbreaking",
  "game-changing",
  "world-class",
  "cutting-edge",
  "unprecedented",
  "disruptive",
  "paradigm-shifting",
  "transformative",
  "next-generation",
  "bleeding-edge",
  "industry-leading",
];

/** One hype word found in a claim: 0-indexed `start`, `text` as typed, canonical lowercase `word`. */
export interface HypeMatch {
  start: number;
  text: string;
  word: string;
}

/** Hype found in one claim. `claimIndex` is 0-indexed in draft order. */
export interface HypeWarning {
  claimIndex: number;
  claimText: string;
  matches: HypeMatch[];
}

export type HypeWarnings = HypeWarning[];

const isAlnum = (ch: string): boolean => /[a-z0-9]/i.test(ch);

/**
 * Finds every hype word in `claimText`, in order of appearance. A word matches only when the
 * characters on both sides are not letters or digits (so "prerevolutionary" does not match).
 * Pure: no clock, DOM, network or randomness. Warnings never block a release.
 */
export function detectHypeInClaim(claimText: string): HypeMatch[] {
  const matches: HypeMatch[] = [];
  const lower = claimText.toLowerCase();
  for (const word of HYPE_WORDS) {
    let from = 0;
    for (;;) {
      const pos = lower.indexOf(word, from);
      if (pos === -1) {
        break;
      }
      const end = pos + word.length;
      const leftOk = pos === 0 || !isAlnum(lower[pos - 1]);
      const rightOk = end === lower.length || !isAlnum(lower[end]);
      if (leftOk && rightOk) {
        matches.push({ start: pos, text: claimText.slice(pos, end), word });
      }
      from = pos + 1;
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

/** One warning per claim that contains hype, in claim order. Empty means no hype. Never cached. */
export function detectHypeWords(draft: Readonly<Pick<Draft, "claims">>): HypeWarnings {
  const warnings: HypeWarnings = [];
  draft.claims.forEach((claim, claimIndex) => {
    const matches = detectHypeInClaim(claim.text);
    if (matches.length > 0) {
      warnings.push({ claimIndex, claimText: claim.text, matches });
    }
  });
  return warnings;
}
