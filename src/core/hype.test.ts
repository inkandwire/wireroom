import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { composeWireItem } from "./compose";
import { HYPE_WORDS, detectHypeInClaim, detectHypeWords } from "./hype";
import type { Draft } from "./types";

const SRC = "https://example.com/a";

function draft(claims: string[]): Draft {
  return {
    headline: "Acme launch",
    body: "Acme released its app.",
    claims: claims.map((text) => ({ text, sourceUrl: SRC })),
    priority: "BULLETIN",
    city: "Austin",
    now: "2026-03-04T12:00:00Z",
  };
}

describe("HYPE_WORDS", () => {
  it("holds only non-empty lowercase words and hyphens", () => {
    expect(HYPE_WORDS.length).toBe(12);
    for (const w of HYPE_WORDS) expect(w).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});

describe("detectHypeInClaim", () => {
  it("finds a word with its offset and the text as typed", () => {
    expect(detectHypeInClaim("A Revolutionary app")).toEqual([
      { start: 2, text: "Revolutionary", word: "revolutionary" },
    ]);
  });

  it("reports every occurrence, in order of appearance", () => {
    const m = detectHypeInClaim("world-class and revolutionary, truly revolutionary");
    expect(m.map((x) => [x.start, x.word])).toEqual([
      [0, "world-class"],
      [16, "revolutionary"],
      [37, "revolutionary"],
    ]);
  });

  it("needs a word boundary on both sides", () => {
    expect(detectHypeInClaim("prerevolutionary")).toEqual([]);
    expect(detectHypeInClaim("revolutionaryism")).toEqual([]);
    expect(detectHypeInClaim("(revolutionary)")).toHaveLength(1);
    expect(detectHypeInClaim("revolutionary")).toHaveLength(1);
  });

  it("returns an empty list for plain text and for an empty claim", () => {
    expect(detectHypeInClaim("500 users joined the beta.")).toEqual([]);
    expect(detectHypeInClaim("")).toEqual([]);
  });
});

describe("detectHypeWords", () => {
  it("gives one warning per affected claim with a 0-indexed claim number", () => {
    const w = detectHypeWords(draft(["500 users", "a groundbreaking, cutting-edge tool", "ok"]));
    expect(w).toHaveLength(1);
    expect(w[0].claimIndex).toBe(1);
    expect(w[0].matches.map((m) => m.word)).toEqual(["groundbreaking", "cutting-edge"]);
  });

  it("is empty when no claim has hype", () => {
    expect(detectHypeWords(draft(["500 users", "available today"]))).toEqual([]);
  });

  it("never blocks or changes the wire text", () => {
    const a = composeWireItem(draft(["a revolutionary app"]));
    const b = composeWireItem(draft(["a revolutionary app"]));
    expect(a.status).toBe("RELEASED");
    expect(a).toEqual(b);
  });
});

describe("hype properties", () => {
  it("is deterministic and complete against an independent count", () => {
    const hypeArb = fc.constantFrom(...HYPE_WORDS);
    const claimArb = fc
      .array(fc.oneof(hypeArb, fc.stringMatching(/^[a-z0-9 ,.]{0,12}$/)), { maxLength: 8 })
      .map((parts) => parts.join(" "));
    fc.assert(
      fc.property(claimArb, (text) => {
        const first = detectHypeInClaim(text);
        expect(detectHypeInClaim(text)).toEqual(first);
        let expected = 0;
        for (const w of HYPE_WORDS) {
          const re = new RegExp(`(?<![a-z0-9])${w}(?![a-z0-9])`, "gi");
          expected += (text.match(re) ?? []).length;
        }
        expect(first.length).toBe(expected);
        for (const m of first) expect(text.slice(m.start, m.start + m.text.length)).toBe(m.text);
        for (let i = 1; i < first.length; i++) expect(first[i].start).toBeGreaterThanOrEqual(first[i - 1].start);
      }),
    );
  });
});
