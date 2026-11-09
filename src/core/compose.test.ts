import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { composeWireItem, formatDateline, slugFromHeadline } from "./compose";
import { parseInstant } from "./embargo";
import type { Claim, Draft } from "./types";

const NOW = "2026-03-04T12:00:00Z";

function baseDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    headline: "Acme launch",
    body: "Acme released its app.\n\nThe app has 500 users, the company said.",
    claims: [{ text: "500 users", sourceUrl: "https://example.com/users" }],
    priority: "BULLETIN",
    city: "Austin",
    now: NOW,
    ...overrides,
  };
}

const ms = (s: string): number => {
  const v = parseInstant(s);
  if (v === undefined) throw new Error("bad test instant");
  return v;
};

describe("formatDateline", () => {
  it("formats the product example", () => {
    expect(formatDateline("Austin", ms("2026-03-04T12:00:00Z"))).toBe(
      "AUSTIN, Mar. 4 (WireRoom) --",
    );
  });

  it("does not pad a single-digit day", () => {
    expect(formatDateline("Austin", ms("2026-06-01T00:00:00Z"))).toBe(
      "AUSTIN, June 1 (WireRoom) --",
    );
  });

  it("handles a December date and collapses city whitespace", () => {
    expect(formatDateline("  new   york ", ms("2026-12-25T23:59:59Z"))).toBe(
      "NEW YORK, Dec. 25 (WireRoom) --",
    );
  });
});

describe("slugFromHeadline", () => {
  it("removes punctuation and hyphenates", () => {
    expect(slugFromHeadline("Acme: launches v2.0!")).toBe("ACME-LAUNCHES-V2-0");
  });

  it("caps at 24 characters with no trailing hyphen", () => {
    const slug = slugFromHeadline("abcdefghijklmnopqrstuvw xyz more words");
    expect(slug.length).toBeLessThanOrEqual(24);
    expect(slug).toBe("ABCDEFGHIJKLMNOPQRSTUVW");
    expect(slug.endsWith("-")).toBe(false);
  });

  it("gives NEWS for an empty or symbol-only headline", () => {
    expect(slugFromHeadline("")).toBe("NEWS");
    expect(slugFromHeadline("!!! ???")).toBe("NEWS");
  });
});

describe("composeWireItem", () => {
  it("releases a sourced item with the expected shape", () => {
    const result = composeWireItem(baseDraft());
    expect(result.status).toBe("RELEASED");
    if (result.status !== "RELEASED") return;
    expect(result.item.slug).toBe("ACME-LAUNCH");
    expect(result.item.priorityLine).toBe("BULLETIN");
    expect(result.item.dateline).toBe("AUSTIN, Mar. 4 (WireRoom) --");
    expect(result.item.text).toBe(
      [
        "ACME-LAUNCH",
        "BULLETIN",
        "",
        "AUSTIN, Mar. 4 (WireRoom) -- Acme released its app.",
        "",
        "The app has 500 users, the company said.",
        "",
        "-30-",
      ].join("\n"),
    );
  });

  it("puts the dateline alone when the body is empty", () => {
    const result = composeWireItem(baseDraft({ body: "" }));
    expect(result.status).toBe("RELEASED");
    if (result.status !== "RELEASED") return;
    expect(result.item.text).toContain("\nAUSTIN, Mar. 4 (WireRoom) --\n");
  });

  it("holds a future embargo and returns no text", () => {
    const embargo = "2026-03-05T09:00:00Z";
    const result = composeWireItem(baseDraft({ embargo }));
    expect(result).toEqual({ status: "HELD", releaseAt: embargo });
    expect(JSON.stringify(result)).not.toContain("-30-");
  });

  it("releases when the embargo equals now", () => {
    const result = composeWireItem(baseDraft({ embargo: NOW }));
    expect(result.status).toBe("RELEASED");
  });

  it("rejects invalid time inputs", () => {
    expect(composeWireItem(baseDraft({ now: "yesterday" }))).toEqual({
      status: "REJECTED",
      failures: [],
      timeErrors: ["now"],
    });
    expect(composeWireItem(baseDraft({ embargo: "2026-02-30T00:00:00Z" }))).toEqual(
      { status: "REJECTED", failures: [], timeErrors: ["embargo"] },
    );
  });

  it("rejects an unsourced claim and names it", () => {
    const claims: Claim[] = [
      { text: "ok", sourceUrl: "https://example.com" },
      { text: "no source" },
    ];
    const result = composeWireItem(baseDraft({ claims }));
    expect(result.status).toBe("REJECTED");
    if (result.status !== "REJECTED") return;
    expect(result.failures).toEqual([
      { index: 1, text: "no source", reason: "MISSING_SOURCE" },
    ]);
  });

  it("gate runs before embargo: unsourced and future is REJECTED", () => {
    const result = composeWireItem(
      baseDraft({ claims: [{ text: "x" }], embargo: "2030-01-01T00:00:00Z" }),
    );
    expect(result.status).toBe("REJECTED");
  });
});

// Arbitraries (ASCII-printable, bounded sizes).
const wordArb = fc.string({ unit: "grapheme-ascii", minLength: 1, maxLength: 90 });
const textArb = fc
  .array(wordArb, { maxLength: 40 })
  .map((words) => words.join(" "));
const bodyArb = fc
  .array(textArb, { maxLength: 4 })
  .map((paras) => paras.join("\n\n"));
const priorityArb = fc.constantFrom(
  "FLASH" as const,
  "BULLETIN" as const,
  "URGENT" as const,
  "ROUTINE" as const,
);
const nowArb = fc
  .integer({ min: 0, max: 4_000_000_000_000 })
  .map((t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z"));
const goodClaimArb: fc.Arbitrary<Claim> = fc.record({
  text: fc.string({ maxLength: 30 }),
  sourceUrl: fc.constant("https://example.com/source"),
});
const badClaimArb: fc.Arbitrary<Claim> = fc.oneof(
  fc.record({ text: fc.string({ maxLength: 30 }) }),
  fc.record({
    text: fc.string({ maxLength: 30 }),
    sourceUrl: fc.constantFrom("", "   ", "example.com", "ftp://x.com", "http://"),
  }),
);

function draftArb(claims: fc.Arbitrary<Claim[]>): fc.Arbitrary<Draft> {
  return fc.record({
    headline: fc.string({ maxLength: 60 }),
    body: bodyArb,
    claims,
    priority: priorityArb,
    embargo: fc.option(nowArb, { nil: undefined }),
    city: fc.string({ unit: "grapheme-ascii", maxLength: 40 }),
    now: nowArb,
  });
}

describe("composeWireItem properties", () => {
  it("is deterministic", () => {
    fc.assert(
      fc.property(draftArb(fc.array(goodClaimArb, { maxLength: 3 })), (d) => {
        const a = composeWireItem(d);
        const b = composeWireItem(d);
        expect(a).toEqual(b);
        if (a.status === "RELEASED" && b.status === "RELEASED") {
          expect(a.item.text).toBe(b.item.text);
        }
      }),
    );
  });

  it("every RELEASED item ends with -30- and has no line over 69 columns", () => {
    fc.assert(
      fc.property(draftArb(fc.array(goodClaimArb, { maxLength: 3 })), (d) => {
        const r = composeWireItem(d);
        if (r.status !== "RELEASED") return;
        expect(r.item.text.endsWith("-30-")).toBe(true);
        expect(r.item.text.includes("\r")).toBe(false);
        for (const line of r.item.text.split("\n")) {
          expect(line.length).toBeLessThanOrEqual(69);
        }
      }),
    );
  });

  it("a draft with an unsourced claim is never RELEASED", () => {
    const claimsArb = fc
      .tuple(
        fc.array(goodClaimArb, { maxLength: 2 }),
        badClaimArb,
        fc.array(goodClaimArb, { maxLength: 2 }),
      )
      .map(([a, bad, c]) => [...a, bad, ...c]);
    fc.assert(
      fc.property(draftArb(claimsArb), (d) => {
        expect(composeWireItem(d).status).not.toBe("RELEASED");
      }),
    );
  });
});
