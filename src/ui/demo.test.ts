import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildSourcedDemo, buildUnsourcedDemo, embargoInstant } from "./demo";

const nowArb = fc.integer({ min: 0, max: 4_000_000_000_000 });

describe("embargoInstant", () => {
  it("is a whole UTC minute 45 to 105 seconds ahead", () => {
    fc.assert(
      fc.property(nowArb, (now) => {
        const at = embargoInstant(now);
        expect(at % 60000).toBe(0);
        expect(at - now).toBeGreaterThanOrEqual(45000);
        expect(at - now).toBeLessThanOrEqual(105000);
      }),
    );
  });
});

describe("demo fills", () => {
  it("unsourced fill has exactly one claim without a URL", () => {
    const fill = buildUnsourcedDemo();
    expect(fill.claims.filter((c) => c.sourceUrl.trim() === "")).toHaveLength(1);
    expect(fill.embargoDate).toBe("");
  });

  it("sourced fill uses example.com and parses to embargoInstant(now)", () => {
    fc.assert(
      fc.property(nowArb, (now) => {
        const fill = buildSourcedDemo(now);
        expect(fill.claims.length).toBeGreaterThan(0);
        for (const c of fill.claims) {
          expect(new URL(c.sourceUrl).hostname).toBe("example.com");
        }
        expect(fill.embargoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(fill.embargoTime).toMatch(/^\d{2}:\d{2}$/);
        const parsed = Date.parse(`${fill.embargoDate}T${fill.embargoTime}:00Z`);
        expect(parsed).toBe(embargoInstant(now));
      }),
    );
  });
});
