import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { composeWireItem } from "./compose";
import type { Draft } from "./types";
import { wireItemToJson } from "./wireJson";

const urlArb = fc.oneof(
  fc.constantFrom(
    "https://example.com/a",
    "https://example.com/b",
    "https://example.org/c",
  ),
  fc
    .string({ unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-"), minLength: 1, maxLength: 120 })
    .map((p) => `https://example.com/${p}`),
);
const claimArb = fc.record({
  text: fc.string({ unit: "grapheme-ascii", maxLength: 120 }),
  sourceUrl: urlArb,
});

function draftWith(claims: { text: string; sourceUrl: string }[]): Draft {
  return {
    headline: "Acme launch",
    body: "Acme released its app.",
    claims,
    priority: "ROUTINE",
    city: "Austin",
    now: "2026-03-04T12:00:00Z",
  };
}

const stripWs = (s: string): string => s.replace(/\s+/g, "");

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

describe("sources footer properties", () => {
  it("claims and sources match the draft, in the JSON too", () => {
    fc.assert(
      fc.property(fc.array(claimArb, { maxLength: 6 }), (claims) => {
        const r = composeWireItem(draftWith(claims));
        if (r.status !== "RELEASED") throw new Error("expected RELEASED");
        const expectedSources: string[] = [];
        for (const c of claims) {
          if (!expectedSources.includes(c.sourceUrl)) {
            expectedSources.push(c.sourceUrl);
          }
        }
        const parsed = JSON.parse(wireItemToJson(r.item)) as {
          claims: unknown;
          sources: unknown;
        };
        expect(parsed.sources).toEqual(expectedSources);
        expect(parsed.claims).toEqual(claims);
        expect(r.item.sources).toEqual(expectedSources);
        expect(r.item.claims).toEqual(claims);
      }),
    );
  });

  it("text has no line over 69 columns and ends with -30-", () => {
    fc.assert(
      fc.property(fc.array(claimArb, { maxLength: 6 }), (claims) => {
        const r = composeWireItem(draftWith(claims));
        if (r.status !== "RELEASED") throw new Error("expected RELEASED");
        expect(r.item.text.endsWith("-30-")).toBe(true);
        for (const line of r.item.text.split("\n")) {
          expect(line.length).toBeLessThanOrEqual(69);
        }
      }),
    );
  });

  it("claim text and URL characters survive in the footer", () => {
    fc.assert(
      fc.property(fc.array(claimArb, { maxLength: 6 }), (claims) => {
        const r = composeWireItem(draftWith(claims));
        if (r.status !== "RELEASED") throw new Error("expected RELEASED");
        const idx = r.item.text.indexOf("Sources:");
        if (claims.length === 0) {
          expect(idx).toBe(-1);
          return;
        }
        expect(idx).toBeGreaterThanOrEqual(0);
        const footer = stripWs(r.item.text.slice(idx + "Sources:".length));
        const needle = claims.map((c) => stripWs(c.text + c.sourceUrl)).join("");
        expect(isSubsequence(needle, footer)).toBe(true);
      }),
    );
  });
});
