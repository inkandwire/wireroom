import { describe, expect, it } from "vitest";
import { countdown, releaseDue, type HeldEntry } from "./embargoClock";
import { parseInstant } from "./embargo";
import type { Draft } from "./types";

const RELEASE = "2026-03-04T12:00:00Z";
const REL_MS = Date.UTC(2026, 2, 4, 12, 0, 0);

function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    headline: "Acme launch",
    body: "Acme released its app.",
    claims: [{ text: "500 users", sourceUrl: "https://example.com/users" }],
    priority: "BULLETIN",
    city: "Austin",
    now: "2026-03-04T10:00:00Z",
    ...overrides,
  };
}

function entry(id: string, releaseAt: string): HeldEntry {
  return { id, draft: draft({ embargo: releaseAt }), releaseAt };
}

describe("countdown labels", () => {
  it("is RELEASING at 0 ms", () => {
    const c = countdown(RELEASE, REL_MS);
    expect(c.label).toBe("RELEASING");
    expect(c.due).toBe(true);
    expect(c.remainingMs).toBe(0);
  });

  it("is T-00:00:01 at 1 ms left", () => {
    const c = countdown(RELEASE, REL_MS - 1);
    expect(c.label).toBe("T-00:00:01");
    expect(c.due).toBe(false);
    expect(c.remainingMs).toBe(1);
  });

  it("rounds 59 999 ms up to T-00:01:00", () => {
    expect(countdown(RELEASE, REL_MS - 59_999).label).toBe("T-00:01:00");
  });

  it("is T-1d 00:00:00 at exactly 24 h", () => {
    expect(countdown(RELEASE, REL_MS - 86_400_000).label).toBe(
      "T-1d 00:00:00",
    );
  });

  it("is T-23:59:59 just under 24 h", () => {
    expect(countdown(RELEASE, REL_MS - 86_399_000).label).toBe("T-23:59:59");
  });

  it("is T-1d 01:01:01 at 90 061 s", () => {
    expect(countdown(RELEASE, REL_MS - 90_061_000).label).toBe(
      "T-1d 01:01:01",
    );
  });

  it("stays RELEASING after the release time", () => {
    const c = countdown(RELEASE, REL_MS + 5000);
    expect(c.label).toBe("RELEASING");
    expect(c.remainingMs).toBe(0);
  });
});

describe("countdown with bad input", () => {
  it("returns the unknown label for an invalid releaseAt", () => {
    expect(countdown("not a date", REL_MS)).toEqual({
      remainingMs: 0,
      label: "T-??:??:??",
      due: false,
    });
  });

  it("returns the unknown label for a non-finite now", () => {
    const c = countdown(RELEASE, Number.NaN);
    expect(c.label).toBe("T-??:??:??");
    expect(c.due).toBe(false);
  });
});

describe("due flips exactly at releaseAt", () => {
  it("is not due 1 ms before", () => {
    expect(countdown(RELEASE, REL_MS - 1).due).toBe(false);
  });

  it("is due at releaseAt", () => {
    expect(countdown(RELEASE, REL_MS).due).toBe(true);
  });
});

describe("releaseDue", () => {
  it("releases only due entries and keeps held order", () => {
    const a = entry("a", "2026-03-04T13:00:00Z");
    const b = entry("b", "2026-03-04T11:00:00Z");
    const c = entry("c", "2026-03-04T14:00:00Z");
    const now = Date.UTC(2026, 2, 4, 11, 30, 0);
    const { released, stillHeld } = releaseDue([a, b, c], now);
    expect(released.map((r) => r.entry.id)).toEqual(["b"]);
    expect(stillHeld).toEqual([a, c]);
  });

  it("releases several due entries in releaseAt order, stable on ties", () => {
    const late = entry("late", "2026-03-04T12:10:00Z");
    const early = entry("early", "2026-03-04T12:00:00Z");
    const tie1 = entry("tie1", "2026-03-04T12:05:00Z");
    const tie2 = entry("tie2", "2026-03-04T12:05:00Z");
    const now = Date.UTC(2026, 2, 4, 13, 0, 0);
    const { released, stillHeld } = releaseDue([late, tie1, early, tie2], now);
    expect(released.map((r) => r.entry.id)).toEqual([
      "early",
      "tie1",
      "tie2",
      "late",
    ]);
    expect(stillHeld).toEqual([]);
  });

  it("does not release 1 ms before and does at releaseAt", () => {
    const e = entry("e", RELEASE);
    expect(releaseDue([e], REL_MS - 1).released).toHaveLength(0);
    expect(releaseDue([e], REL_MS).released).toHaveLength(1);
  });

  it("composes with releaseAt as now (dateline is the release date)", () => {
    const e = entry("e", RELEASE);
    // Wake up two days late: the dateline must still show Mar. 4.
    const { released } = releaseDue([e], REL_MS + 2 * 86_400_000);
    expect(released).toHaveLength(1);
    const result = released[0].result;
    expect(result.status).toBe("RELEASED");
    if (result.status === "RELEASED") {
      expect(result.item.dateline).toBe("AUSTIN, Mar. 4 (WireRoom) --");
      expect(result.item.text.endsWith("-30-")).toBe(true);
    }
  });

  it("does not mutate the input entries or list", () => {
    const e = entry("e", RELEASE);
    const list = [e];
    const before = JSON.stringify(list);
    releaseDue(list, REL_MS + 1000);
    expect(JSON.stringify(list)).toBe(before);
    expect(e.draft.now).toBe("2026-03-04T10:00:00Z");
  });

  it("keeps an entry with an invalid releaseAt held", () => {
    const bad: HeldEntry = { id: "bad", draft: draft(), releaseAt: "nope" };
    const { released, stillHeld } = releaseDue([bad], REL_MS);
    expect(released).toHaveLength(0);
    expect(stillHeld).toEqual([bad]);
  });

  it("test instant parses", () => {
    expect(parseInstant(RELEASE)).toBe(REL_MS);
  });
});
