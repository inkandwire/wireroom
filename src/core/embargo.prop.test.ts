import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { isReleased, parseInstant } from "./embargo";

const ms = fc.integer({ min: 0, max: 4_000_000_000_000 });

describe("isReleased (properties)", () => {
  it("is monotonic: released at t implies released at any t2 >= t", () => {
    fc.assert(
      fc.property(fc.option(ms, { nil: undefined }), ms, ms, (e, a, b) => {
        const t = Math.min(a, b);
        const t2 = Math.max(a, b);
        if (isReleased(e, t)) {
          expect(isReleased(e, t2)).toBe(true);
        }
      }),
    );
  });

  it("is held strictly before the embargo and released exactly at it", () => {
    fc.assert(
      fc.property(ms, fc.integer({ min: 1, max: 1_000_000 }), (e, d) => {
        expect(isReleased(e, e - d)).toBe(false);
        expect(isReleased(e, e)).toBe(true);
        expect(isReleased(e, e + d)).toBe(true);
      }),
    );
  });

  it("is always released with no embargo", () => {
    fc.assert(
      fc.property(ms, (t) => {
        expect(isReleased(undefined, t)).toBe(true);
      }),
    );
  });
});

describe("parseInstant", () => {
  it("parses a valid instant without milliseconds", () => {
    expect(parseInstant("2026-03-04T12:00:00Z")).toBe(
      Date.UTC(2026, 2, 4, 12, 0, 0),
    );
  });

  it("parses a valid instant with milliseconds", () => {
    expect(parseInstant("2026-03-04T12:00:00.250Z")).toBe(
      Date.UTC(2026, 2, 4, 12, 0, 0, 250),
    );
  });

  it("accepts Feb 29 in a leap year", () => {
    expect(parseInstant("2028-02-29T00:00:00Z")).toBe(
      Date.UTC(2028, 1, 29),
    );
  });

  it("rejects a missing Z", () => {
    expect(parseInstant("2026-03-04T12:00:00")).toBeUndefined();
  });

  it("rejects a non-UTC offset", () => {
    expect(parseInstant("2026-03-04T12:00:00+02:00")).toBeUndefined();
  });

  it("rejects month 13", () => {
    expect(parseInstant("2026-13-04T12:00:00Z")).toBeUndefined();
  });

  it("rejects Feb 30", () => {
    expect(parseInstant("2026-02-30T12:00:00Z")).toBeUndefined();
  });

  it("rejects Feb 29 in a non-leap year", () => {
    expect(parseInstant("2027-02-29T12:00:00Z")).toBeUndefined();
  });

  it("rejects an out-of-range hour", () => {
    expect(parseInstant("2026-03-04T24:00:00Z")).toBeUndefined();
  });

  it("rejects an empty string", () => {
    expect(parseInstant("")).toBeUndefined();
  });

  it("round-trips any generated instant", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        (t) => {
          const iso = new Date(t).toISOString();
          expect(parseInstant(iso)).toBe(t);
        },
      ),
    );
  });
});
