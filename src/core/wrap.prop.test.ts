import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { splitLongWord, wrapText } from "./wrap";

const word = fc.stringMatching(/^[!-~]{1,30}$/);
const longWord = fc.stringMatching(/^[!-~]{70,200}$/);
const separator = fc.constantFrom(" ", "  ", "\n", "\t", "\n\n", " \n \n ");

const textArb = fc
  .array(fc.tuple(word, separator), { maxLength: 40 })
  .map((parts) => parts.map(([w, s]) => w + s).join(""));

const stripWs = (s: string): string => s.replace(/\s+/g, "");

describe("wrapText properties", () => {
  it("never exceeds max and keeps non-whitespace characters in order", () => {
    fc.assert(
      fc.property(textArb, fc.integer({ min: 1, max: 100 }), (text, max) => {
        const out = wrapText(text, max);
        for (const line of out.split("\n")) {
          expect(line.length).toBeLessThanOrEqual(max);
        }
        expect(stripWs(out)).toBe(stripWs(text));
      }),
    );
  });

  it("keeps the word list when every word fits", () => {
    fc.assert(
      fc.property(textArb, fc.integer({ min: 30, max: 100 }), (text, max) => {
        const out = wrapText(text, max);
        const words = (s: string): string[] => s.split(/\s+/).filter((w) => w.length > 0);
        expect(words(out)).toEqual(words(text));
      }),
    );
  });

  it("hard-splits words longer than 69 without losing characters", () => {
    fc.assert(
      fc.property(fc.array(longWord, { minLength: 1, maxLength: 4 }), (words) => {
        const text = words.join(" ");
        const out = wrapText(text);
        for (const line of out.split("\n")) {
          expect(line.length).toBeLessThanOrEqual(69);
        }
        expect(stripWs(out)).toBe(stripWs(text));
      }),
    );
  });

  it("splitLongWord slices rejoin to the original word", () => {
    fc.assert(
      fc.property(longWord, fc.integer({ min: 1, max: 100 }), (w, max) => {
        const pieces = splitLongWord(w, max);
        expect(pieces.join("")).toBe(w);
        for (const p of pieces) {
          expect(p.length).toBeLessThanOrEqual(max);
        }
      }),
    );
  });
});

describe("wrapText examples", () => {
  it("keeps a blank-line paragraph break", () => {
    expect(wrapText("One idea.\n\nTwo idea.")).toBe("One idea.\n\nTwo idea.");
  });

  it("normalizes CRLF line endings", () => {
    expect(wrapText("One.\r\n\r\nTwo.")).toBe("One.\n\nTwo.");
  });

  it("leaves a word of exactly 69 columns on one line", () => {
    const w = "a".repeat(69);
    expect(wrapText(w)).toBe(w);
  });

  it("splits a word of 70 columns into 69 and 1", () => {
    expect(wrapText("a".repeat(70))).toBe("a".repeat(69) + "\n" + "a");
  });

  it("returns an empty string for blank input", () => {
    expect(wrapText("  \n\n  ")).toBe("");
  });
});
