import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkClaims } from "../core/index";
import { formatReport } from "./report";

const claimArb = fc.record(
  {
    text: fc.string({ maxLength: 20 }),
    sourceUrl: fc.oneof(
      fc.constant("https://example.com/a"),
      fc.constant("ftp://example.com"),
      fc.constant(""),
      fc.string({ maxLength: 10 }),
    ),
  },
  { requiredKeys: ["text"] },
);

const draftArb = fc.record({ claims: fc.array(claimArb, { maxLength: 5 }) });

const fileJsonArb = fc.oneof(
  { weight: 4, arbitrary: draftArb },
  { weight: 1, arbitrary: fc.constant(undefined) },
  { weight: 1, arbitrary: fc.constant({ nothing: true }) },
);

const filesArb = fc.array(fileJsonArb, { maxLength: 6 }).map((jsons) =>
  jsons.map((json, i) => ({ name: `f${i}.json`, json: json as unknown })),
);

function expectedFailures(files: { json: unknown }[]): number {
  let n = 0;
  for (const f of files) {
    const claims = (f.json as { claims?: { text: string; sourceUrl?: string }[] } | undefined)
      ?.claims;
    n += claims === undefined ? 1 : checkClaims(claims).length;
  }
  return n;
}

function failureLines(stderr: string): string[] {
  const lines = stderr.split("\n").filter((l) => l !== "");
  return lines.slice(0, -1); // drop the summary line
}

describe("formatReport properties", () => {
  it("ok is true exactly when stderr is empty", () => {
    fc.assert(
      fc.property(filesArb, (files) => {
        const r = formatReport(files);
        expect(r.ok).toBe(r.stderr === "");
        expect(r.ok).toBe(expectedFailures(files) === 0);
      }),
    );
  });

  it("failure lines equal failing claims plus not-a-draft files", () => {
    fc.assert(
      fc.property(filesArb, (files) => {
        const r = formatReport(files);
        const expected = expectedFailures(files);
        expect(failureLines(r.stderr)).toHaveLength(expected);
        if (expected > 0) {
          expect(r.stderr.endsWith(`claim gate: ${expected} unsourced claim(s)\n`)).toBe(true);
        }
      }),
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(filesArb, (files) => {
        expect(formatReport(files)).toEqual(formatReport(files));
      }),
    );
  });

  it("prints 1-based claim numbers in claim order", () => {
    fc.assert(
      fc.property(fc.array(claimArb, { maxLength: 8 }), (claims) => {
        const r = formatReport([{ name: "x.json", json: { claims } }]);
        const expected = checkClaims(claims).map((f) => f.index + 1);
        const printed = failureLines(r.stderr).map((l) =>
          Number(/^x\.json: claim (\d+) /.exec(l)?.[1]),
        );
        expect(printed).toEqual(expected);
        expect(printed).toEqual([...printed].sort((a, b) => a - b));
      }),
    );
  });
});
