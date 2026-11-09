import { describe, it } from "vitest";
import fc from "fast-check";
import { slugFromHeadline } from "./compose";

const MAX = 24;

function expectedWords(headline: string): string[] {
  return headline
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w !== "");
}

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const headlineArb = fc.oneof(
  fc.string({ maxLength: 80 }),
  fc.array(fc.stringMatching(/^[A-Za-z0-9]{1,30}$/), { maxLength: 10 }).map((w) => w.join(" ")),
);

describe("slugFromHeadline properties", () => {
  it("builds a bounded, well-formed, maximal whole-word slug", () => {
    fc.assert(
      fc.property(headlineArb, (headline) => {
        const slug = slugFromHeadline(headline);
        const words = expectedWords(headline);

        check(slug.length <= MAX, "slug longer than 24");
        check(!slug.startsWith("-") && !slug.endsWith("-"), "edge hyphen");
        check(!slug.includes("--"), "double hyphen");

        if (words.length === 0) {
          check(slug === "NEWS", "expected NEWS");
          return;
        }
        if (words[0].length > MAX) {
          check(slug === words[0].slice(0, MAX), "long first word cut");
          return;
        }
        const parts = slug.split("-");
        check(parts.length <= words.length, "too many parts");
        for (let i = 0; i < parts.length; i++) {
          check(parts[i] === words[i], "parts are not a word prefix");
        }
        const next = words[parts.length];
        if (next !== undefined) {
          check(slug.length + 1 + next.length > MAX, "not maximal");
        }
      }),
    );
  });
});
