import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseInstant, type ClaimFailure, type Priority } from "../core/index";
import {
  claimSentence,
  formToDraft,
  rejectionNotice,
  type ClaimRow,
  type FormValues,
} from "./form";

const PRIORITIES: Priority[] = ["FLASH", "BULLETIN", "URGENT", "ROUTINE"];

const pad = (n: number, w = 2): string => String(n).padStart(w, "0");

const rowArb: fc.Arbitrary<ClaimRow> = fc.record({
  text: fc.oneof(fc.string(), fc.constant("   "), fc.constant("")),
  sourceUrl: fc.oneof(fc.string(), fc.constant(""), fc.constant("  ")),
});

const validEmbargoArb = fc
  .record({
    y: fc.integer({ min: 1971, max: 2099 }),
    mo: fc.integer({ min: 1, max: 12 }),
    d: fc.integer({ min: 1, max: 28 }),
    h: fc.integer({ min: 0, max: 23 }),
    mi: fc.integer({ min: 0, max: 59 }),
  })
  .map(({ y, mo, d, h, mi }) => ({
    embargoDate: `${pad(y, 4)}-${pad(mo)}-${pad(d)}`,
    embargoTime: `${pad(h)}:${pad(mi)}`,
  }));

function valuesArb(
  embargo: fc.Arbitrary<{ embargoDate: string; embargoTime: string }>,
): fc.Arbitrary<FormValues> {
  return fc
    .record({
      city: fc.string(),
      headline: fc.string(),
      body: fc.string(),
      claims: fc.array(rowArb, { maxLength: 12 }),
      priority: fc.constantFrom(...PRIORITIES),
      embargo,
    })
    .map(({ embargo: e, ...rest }) => ({ ...rest, ...e }));
}

const noEmbargo = fc.constant({ embargoDate: "", embargoTime: "" });
const anyValuesArb = valuesArb(
  fc.oneof(
    noEmbargo,
    validEmbargoArb,
    fc.record({ embargoDate: fc.string(), embargoTime: fc.string() }),
  ),
);

const NOW = "2026-03-04T12:00:00Z";

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value as object)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

describe("formToDraft properties", () => {
  it("P-b1: kept claims are the non-blank rows, in order", () => {
    fc.assert(
      fc.property(anyValuesArb, (values) => {
        const expected = values.claims
          .map((r) => r.text.trim())
          .filter((t) => t !== "");
        const { draft } = formToDraft(values, NOW);
        expect(draft.claims.map((c) => c.text)).toEqual(expected);
        expect(draft.claims.length).toBe(expected.length);
      }),
    );
  });

  it("P-b2: no draft claim is blank", () => {
    fc.assert(
      fc.property(anyValuesArb, (values) => {
        const { draft } = formToDraft(values, NOW);
        for (const c of draft.claims) expect(c.text.trim()).not.toBe("");
      }),
    );
  });

  it("P-b3: rowIndexes increase and match the trimmed row text", () => {
    fc.assert(
      fc.property(anyValuesArb, (values) => {
        const { draft, rowIndexes } = formToDraft(values, NOW);
        expect(rowIndexes.length).toBe(draft.claims.length);
        for (let i = 1; i < rowIndexes.length; i++) {
          expect(rowIndexes[i]).toBeGreaterThan(rowIndexes[i - 1]);
        }
        rowIndexes.forEach((r, i) => {
          expect(draft.claims[i].text).toBe(values.claims[r].text.trim());
        });
      }),
    );
  });

  it("P-b4: valid embargo is a UTC instant; empty is omitted; bad is flagged", () => {
    fc.assert(
      fc.property(
        valuesArb(validEmbargoArb),
        (values) => {
          const { draft, embargoInvalid } = formToDraft(values, NOW);
          expect(embargoInvalid).toBe(false);
          expect(draft.embargo).toBeDefined();
          expect(draft.embargo!.endsWith("Z")).toBe(true);
          expect(parseInstant(draft.embargo!)).not.toBeUndefined();
        },
      ),
    );
    fc.assert(
      fc.property(valuesArb(noEmbargo), (values) => {
        const { draft, embargoInvalid } = formToDraft(values, NOW);
        expect(draft.embargo).toBeUndefined();
        expect(embargoInvalid).toBe(false);
      }),
    );
    fc.assert(
      fc.property(
        valuesArb(
          fc.record({
            embargoDate: fc.constantFrom("2026-13-01", "2026-02-30", "abc"),
            embargoTime: fc.constantFrom("", "10:00", "25:00"),
          }),
        ),
        (values) => {
          const { draft, embargoInvalid } = formToDraft(values, NOW);
          expect(draft.embargo).toBeUndefined();
          expect(embargoInvalid).toBe(true);
        },
      ),
    );
  });

  it("P-b5: a deep-frozen input is not mutated", () => {
    fc.assert(
      fc.property(anyValuesArb, (values) => {
        const copy = JSON.parse(JSON.stringify(values)) as FormValues;
        deepFreeze(values);
        expect(() => formToDraft(values, NOW)).not.toThrow();
        expect(values).toEqual(copy);
      }),
    );
  });

  it("P-b6: draft.now is the argument and output is deterministic", () => {
    fc.assert(
      fc.property(anyValuesArb, fc.constantFrom(NOW, "2030-01-01T00:00:00Z"), (values, now) => {
        const a = formToDraft(values, now);
        const b = formToDraft(values, now);
        expect(a.draft.now).toBe(now);
        expect(a).toEqual(b);
      }),
    );
  });
});

const failuresArb: fc.Arbitrary<ClaimFailure[]> = fc.array(
  fc.record({
    index: fc.nat({ max: 30 }),
    text: fc.string({ minLength: 1 }),
    reason: fc.constantFrom<ClaimFailure["reason"]>(
      "MISSING_SOURCE",
      "INVALID_SOURCE",
    ),
  }),
  { maxLength: 15 },
);

describe("rejectionNotice properties", () => {
  const rowIndexes = Array.from({ length: 31 }, (_, i) => i * 2);

  it("P-c1: one item per failure", () => {
    fc.assert(
      fc.property(failuresArb, (failures) => {
        expect(rejectionNotice(failures, rowIndexes).items.length).toBe(
          failures.length,
        );
      }),
    );
  });

  it("P-c2: same order and claimIndex", () => {
    fc.assert(
      fc.property(failuresArb, (failures) => {
        const { items } = rejectionNotice(failures, rowIndexes);
        items.forEach((item, i) => {
          expect(item.claimIndex).toBe(failures[i].index);
          expect(item.rowIndex).toBe(rowIndexes[failures[i].index]);
        });
      }),
    );
  });

  it("P-c3: sentence contains the claim text and ends with a full stop", () => {
    fc.assert(
      fc.property(failuresArb, (failures) => {
        const { items } = rejectionNotice(failures, rowIndexes);
        items.forEach((item, i) => {
          expect(item.sentence).toContain(failures[i].text);
          expect(item.sentence.endsWith(".")).toBe(true);
        });
      }),
    );
  });

  it("P-c4: heading starts NOT RELEASED and holds the count", () => {
    fc.assert(
      fc.property(failuresArb, (failures) => {
        const { heading } = rejectionNotice(failures, rowIndexes);
        expect(heading.startsWith("NOT RELEASED: ")).toBe(true);
        expect(heading).toContain(String(failures.length));
      }),
    );
  });

  it("P-c5: no invented URL in a sentence", () => {
    fc.assert(
      fc.property(failuresArb, (failures) => {
        for (const f of failures) {
          const sentence = claimSentence(f);
          if (!f.text.includes("://")) expect(sentence).not.toContain("://");
        }
      }),
    );
  });
});
