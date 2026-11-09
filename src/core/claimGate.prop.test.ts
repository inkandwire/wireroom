import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { checkClaims, isValidSourceUrl } from "./claimGate";
import type { Claim } from "./types";

const LOWER = "abcdefghijklmnopqrstuvwxyz".split("");

const word = fc
  .array(fc.constantFrom(...LOWER), { minLength: 1, maxLength: 10 })
  .map((cs) => cs.join(""));

const validUrl = fc
  .tuple(fc.constantFrom("http", "https"), word, word)
  .map(([scheme, host, path]) => `${scheme}://${host}.com/${path}`);

const invalidUrl: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constant(""),
  fc.constant("   "),
  word, // no scheme
  word.map((w) => `${w}.com`), // bare domain
  fc.constantFrom("ftp", "javascript", "mailto", "file", "ws").chain((scheme) =>
    word.map((w) => `${scheme}://${w}.com`),
  ),
  fc.constantFrom("http://", "https://", "http:///", "javascript:alert(1)"),
  validUrl.map((u) => ` ${u}`), // surrounding whitespace is invalid
);

const claimText = word;

function toClaim(text: string, sourceUrl: string | undefined): Claim {
  return sourceUrl === undefined ? { text } : { text, sourceUrl };
}

describe("claim gate properties", () => {
  it("a claim with a bad source always yields a failure naming its index", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(claimText, validUrl), { maxLength: 5 }),
        fc.tuple(claimText, invalidUrl),
        fc.array(fc.tuple(claimText, validUrl), { maxLength: 5 }),
        (before, [badText, badUrl], after) => {
          const claims: Claim[] = [
            ...before.map(([t, u]) => toClaim(t, u)),
            toClaim(badText, badUrl),
            ...after.map(([t, u]) => toClaim(t, u)),
          ];
          const badIndex = before.length;
          const failures = checkClaims(claims);
          expect(failures.length).toBeGreaterThanOrEqual(1);
          expect(failures.map((f) => f.index)).toContain(badIndex);
          // Failures are in claim order.
          const indexes = failures.map((f) => f.index);
          expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
        },
      ),
    );
  });

  it("lists of valid http/https URLs yield no failures", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(claimText, validUrl), { maxLength: 8 }),
        (items) => {
          const claims = items.map(([t, u]) => toClaim(t, u));
          expect(checkClaims(claims)).toEqual([]);
        },
      ),
    );
  });
});

describe("claim gate examples", () => {
  it("accepts a plain https URL", () => {
    expect(isValidSourceUrl("https://example.com/a")).toBe(true);
  });

  it.each(["ftp://x.com", "example.com", "http://", "javascript:alert(1)"])(
    "rejects %s",
    (url) => {
      expect(isValidSourceUrl(url)).toBe(false);
    },
  );

  it("passes an empty claim list", () => {
    expect(checkClaims([])).toEqual([]);
  });

  it("reports MISSING_SOURCE and INVALID_SOURCE with the claim index", () => {
    const failures = checkClaims([
      { text: "ok", sourceUrl: "https://example.com/a" },
      { text: "none" },
      { text: "blank", sourceUrl: "  " },
      { text: "bad", sourceUrl: "example.com" },
    ]);
    expect(failures).toEqual([
      { index: 1, text: "none", reason: "MISSING_SOURCE" },
      { index: 2, text: "blank", reason: "MISSING_SOURCE" },
      { index: 3, text: "bad", reason: "INVALID_SOURCE" },
    ]);
  });
});
