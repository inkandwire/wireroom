import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { countdown, releaseDue, type HeldEntry } from "./embargoClock";
import type { Draft } from "./types";

const BASE_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const LABEL_RE = /^(T-(\d+d )?\d{2}:\d{2}:\d{2}|RELEASING|T-\?\?:\?\?:\?\?)$/;

// Whole-second instants within about two years of the base.
const secondsArb = fc.integer({ min: 0, max: 60 * 60 * 24 * 730 });
const nowArb = fc.integer({ min: 0, max: 60 * 60 * 24 * 800 * 1000 });

function iso(seconds: number): string {
  return new Date(BASE_MS + seconds * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
}

function draftFor(releaseAt: string): Draft {
  return {
    headline: "Acme launch",
    body: "Acme released its app.",
    claims: [{ text: "500 users", sourceUrl: "https://example.com/users" }],
    priority: "ROUTINE",
    embargo: releaseAt,
    city: "Austin",
    now: "2025-12-31T00:00:00Z",
  };
}

const entriesArb = fc
  .array(secondsArb, { maxLength: 12 })
  .map((list): HeldEntry[] =>
    list.map((s, i) => ({
      id: `hold-${i + 1}`,
      releaseAt: iso(s),
      draft: draftFor(iso(s)),
    })),
  );

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) {
      deepFreeze(v);
    }
  }
  return value;
}

describe("countdown properties", () => {
  it("remaining time never increases as now grows", () => {
    fc.assert(
      fc.property(secondsArb, nowArb, nowArb, (s, a, b) => {
        const lo = BASE_MS + Math.min(a, b);
        const hi = BASE_MS + Math.max(a, b);
        const r = iso(s);
        expect(countdown(r, hi).remainingMs).toBeLessThanOrEqual(
          countdown(r, lo).remainingMs,
        );
      }),
    );
  });

  it("remainingMs is never negative", () => {
    fc.assert(
      fc.property(secondsArb, nowArb, (s, n) => {
        expect(countdown(iso(s), BASE_MS + n).remainingMs).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("the label has a fixed shape", () => {
    fc.assert(
      fc.property(secondsArb, nowArb, (s, n) => {
        expect(countdown(iso(s), BASE_MS + n).label).toMatch(LABEL_RE);
      }),
    );
  });

  it("an invalid releaseAt still gives a well-formed label", () => {
    fc.assert(
      fc.property(fc.string(), nowArb, (r, n) => {
        expect(countdown(r, BASE_MS + n).label).toMatch(LABEL_RE);
      }),
    );
  });

  it("due is true exactly when now has reached releaseAt", () => {
    fc.assert(
      fc.property(secondsArb, nowArb, (s, n) => {
        const now = BASE_MS + n;
        expect(countdown(iso(s), now).due).toBe(now >= BASE_MS + s * 1000);
      }),
    );
  });
});

describe("releaseDue properties", () => {
  it("released and stillHeld partition the input", () => {
    fc.assert(
      fc.property(entriesArb, nowArb, (held, n) => {
        const { released, stillHeld } = releaseDue(held, BASE_MS + n);
        const ids = [
          ...released.map((r) => r.entry.id),
          ...stillHeld.map((e) => e.id),
        ];
        expect([...ids].sort()).toEqual(held.map((e) => e.id).sort());
        expect(new Set(ids).size).toBe(held.length);
      }),
    );
  });

  it("stillHeld keeps input order and released is ordered by release time", () => {
    fc.assert(
      fc.property(entriesArb, nowArb, (held, n) => {
        const { released, stillHeld } = releaseDue(held, BASE_MS + n);
        const order = held.map((e) => e.id);
        const idx = stillHeld.map((e) => order.indexOf(e.id));
        expect(idx).toEqual([...idx].sort((a, b) => a - b));
        const times = released.map((r) => Date.parse(r.entry.releaseAt));
        expect(times).toEqual([...times].sort((a, b) => a - b));
      }),
    );
  });

  it("a second releaseDue on stillHeld releases nothing", () => {
    fc.assert(
      fc.property(entriesArb, nowArb, (held, n) => {
        const now = BASE_MS + n;
        const first = releaseDue(held, now);
        const second = releaseDue(first.stillHeld, now);
        expect(second.released).toEqual([]);
        expect(second.stillHeld).toEqual(first.stillHeld);
      }),
    );
  });

  it("does not mutate a deep-frozen input", () => {
    fc.assert(
      fc.property(entriesArb, nowArb, (held, n) => {
        const frozen = deepFreeze(structuredClone(held));
        expect(() => releaseDue(frozen, BASE_MS + n)).not.toThrow();
      }),
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(entriesArb, nowArb, (held, n) => {
        const a = releaseDue(held, BASE_MS + n);
        const b = releaseDue(held, BASE_MS + n);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }),
    );
  });

  it("every released item ends with -30-", () => {
    fc.assert(
      fc.property(entriesArb, nowArb, (held, n) => {
        for (const r of releaseDue(held, BASE_MS + n).released) {
          expect(r.result.status).toBe("RELEASED");
          if (r.result.status === "RELEASED") {
            expect(r.result.item.text.endsWith("-30-")).toBe(true);
          }
        }
      }),
    );
  });
});
