import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { Priority } from "../core/index";
import {
  BELL_GAP_MS,
  MAX_PLAY_MS,
  bellCount,
  buildTimeline,
  charDelayMs,
  textAt,
  type PlaybackEvent,
} from "./playback";

const CHARS = [
  ..."abcXYZ019 ",
  ...".,;:-'\"!?()/",
  "\n",
  "\n",
  "é",
  "—",
  "😀",
];
const charArb = fc.constantFrom(...CHARS);
const textArb = (maxLength: number) =>
  fc.array(charArb, { maxLength }).map((a) => a.join(""));
const shortText = textArb(40);
const anyText = fc.oneof(textArb(60), textArb(3000));
const priorityArb: fc.Arbitrary<Priority> = fc.constantFrom(
  "FLASH",
  "BULLETIN",
  "URGENT",
  "ROUTINE",
);

function printed(events: readonly PlaybackEvent[]): string {
  let out = "";
  for (const e of events) {
    if (e.kind === "char") out += e.char;
    else if (e.kind === "newline") out += "\n";
  }
  return out;
}

describe("playback properties", () => {
  it("P-a1: joining events gives back the text", () => {
    fc.assert(
      fc.property(anyText, priorityArb, fc.boolean(), (t, p, r) => {
        expect(printed(buildTimeline(t, p, r))).toBe(t);
      }),
    );
  });

  it("P-a2: times never decrease and are non-negative integers", () => {
    fc.assert(
      fc.property(anyText, priorityArb, fc.boolean(), (t, p, r) => {
        const events = buildTimeline(t, p, r);
        let prev = 0;
        for (const e of events) {
          expect(Number.isInteger(e.at)).toBe(true);
          expect(e.at).toBeGreaterThanOrEqual(prev);
          prev = e.at;
        }
      }),
    );
  });

  it("P-a3: last time is at most 6000", () => {
    fc.assert(
      fc.property(anyText, priorityArb, (t, p) => {
        const events = buildTimeline(t, p, false);
        expect(events[events.length - 1]!.at).toBeLessThanOrEqual(MAX_PLAY_MS);
      }),
    );
  });

  it("P-a4: reduced motion puts everything at 0", () => {
    fc.assert(
      fc.property(anyText, priorityArb, (t, p) => {
        const events = buildTimeline(t, p, true);
        expect(events.every((e) => e.at === 0)).toBe(true);
        expect(textAt(events, 0)).toBe(t);
      }),
    );
  });

  it("P-a5: bell counts are 2 / 1 / 0 / 0", () => {
    const expected: Record<Priority, number> = {
      FLASH: 2,
      BULLETIN: 1,
      URGENT: 0,
      ROUTINE: 0,
    };
    fc.assert(
      fc.property(anyText, priorityArb, fc.boolean(), (t, p, r) => {
        const bells = buildTimeline(t, p, r).filter((e) => e.kind === "bell");
        expect(bells.length).toBe(expected[p]);
        expect(bellCount(p)).toBe(expected[p]);
      }),
    );
  });

  it("P-a6: exactly one tear, last, not before any other event", () => {
    fc.assert(
      fc.property(anyText, priorityArb, fc.boolean(), (t, p, r) => {
        const events = buildTimeline(t, p, r);
        const tears = events.filter((e) => e.kind === "tear");
        expect(tears.length).toBe(1);
        const last = events[events.length - 1]!;
        expect(last.kind).toBe("tear");
        for (const e of events) expect(last.at).toBeGreaterThanOrEqual(e.at);
      }),
    );
  });

  it("P-a7: deterministic", () => {
    fc.assert(
      fc.property(anyText, priorityArb, fc.boolean(), (t, p, r) => {
        expect(buildTimeline(t, p, r)).toEqual(buildTimeline(t, p, r));
      }),
    );
  });

  it("P-a8: short texts keep unscaled cumulative delays", () => {
    fc.assert(
      fc.property(shortText, priorityArb, (t, p) => {
        const events = buildTimeline(t, p, false);
        const textEvents = events.filter(
          (e) => e.kind === "char" || e.kind === "newline",
        );
        let expectedAt = 0;
        for (let i = 0; i < t.length; i++) {
          expect(textEvents[i]!.at).toBe(expectedAt);
          expectedAt += charDelayMs(t[i]!);
        }
        expect(events[events.length - 1]!.at).toBe(expectedAt);
      }),
    );
  });

  it("P-a9: textAt at the last time is the text; always a prefix", () => {
    fc.assert(
      fc.property(
        anyText,
        priorityArb,
        fc.integer({ min: -10, max: 7000 }),
        (t, p, time) => {
          const events = buildTimeline(t, p, false);
          const lastAt = events[events.length - 1]!.at;
          expect(textAt(events, lastAt)).toBe(t);
          expect(t.startsWith(textAt(events, time))).toBe(true);
        },
      ),
    );
  });
});

describe("playback examples", () => {
  it("charDelayMs", () => {
    expect(charDelayMs("a")).toBe(14);
    expect(charDelayMs("7")).toBe(14);
    expect(charDelayMs(" ")).toBe(8);
    expect(charDelayMs(".")).toBe(40);
    expect(charDelayMs("\n")).toBe(140);
  });

  it("one-line text has known times", () => {
    const events = buildTimeline("Hi.\n", "ROUTINE", false);
    expect(events).toEqual([
      { kind: "char", at: 0, char: "H" },
      { kind: "char", at: 14, char: "i" },
      { kind: "char", at: 28, char: "." },
      { kind: "newline", at: 68 },
      { kind: "tear", at: 208 },
    ]);
  });

  it("FLASH bells at 0 and min(600, tearAt)", () => {
    const short = buildTimeline("Hi", "FLASH", false);
    const shortBells = short.filter((e) => e.kind === "bell").map((e) => e.at);
    expect(shortBells).toEqual([0, 28]);
    const long = buildTimeline("a".repeat(100), "FLASH", false);
    const longBells = long.filter((e) => e.kind === "bell").map((e) => e.at);
    expect(longBells).toEqual([0, BELL_GAP_MS]);
  });

  it("a long text is scaled down to 6000 ms", () => {
    const text = "x\n".repeat(500); // raw total 500 * 154 = 77000 ms
    const events = buildTimeline(text, "ROUTINE", false);
    expect(events[events.length - 1]!.at).toBe(MAX_PLAY_MS);
    expect(printed(events)).toBe(text);
  });
});
