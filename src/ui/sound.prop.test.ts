import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MASTER_GAIN_MAX,
  MAX_CLACKS_PER_SECOND,
  createSound,
  type AudioContextLike,
} from "./sound";
import {
  makeFakeContext,
  pathGains,
  startedSources,
  type FakeContext,
} from "./soundFake";

const printable = fc.constantFrom(..."abcXYZ019.,;:-'\"!?é—".split(""));
const callArb = fc.constantFrom("clack", "thunk", "bell");

function unlocked(masterGain?: number, now: () => number = () => 0) {
  const ctx = makeFakeContext();
  const sound = createSound({ createContext: () => ctx, now }, masterGain);
  sound.unlock();
  return { ctx, sound };
}

describe("sound properties", () => {
  it("P-d1 nothing before unlock", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(callArb, printable)), (calls) => {
        let made = 0;
        const sound = createSound({
          createContext: () => {
            made++;
            return makeFakeContext();
          },
          now: () => 0,
        });
        for (const [c, ch] of calls) {
          sound.setMuted(false);
          if (c === "clack") sound.clack(ch);
          else if (c === "thunk") sound.thunk();
          else sound.bell();
        }
        expect(made).toBe(0);
        expect(sound.isUnlocked()).toBe(false);
      }),
    );
  });

  it("P-d2 muted starts nothing", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(callArb, printable)), (calls) => {
        const { ctx, sound } = unlocked();
        for (const [c, ch] of calls) {
          if (c === "clack") sound.clack(ch);
          else if (c === "thunk") sound.thunk();
          else sound.bell();
        }
        expect(startedSources(ctx)).toHaveLength(0);
      }),
    );
  });

  it("P-d3 master and effective gain are at most 0.25", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ min: -10, max: 100, noNaN: true }),
          fc.constant(undefined),
        ),
        printable,
        (mg, ch) => {
          const { ctx, sound } = unlocked(mg);
          sound.setMuted(false);
          sound.clack(ch);
          sound.thunk();
          sound.bell();
          const master = ctx.nodes.find((n) => n.kind === "gain");
          expect(master?.gain.value).toBeLessThanOrEqual(MASTER_GAIN_MAX);
          const sources = startedSources(ctx);
          expect(sources.length).toBe(5);
          for (const s of sources) {
            const paths = pathGains(ctx, s);
            expect(paths.length).toBe(1);
            for (const g of paths) expect(g).toBeLessThanOrEqual(0.25);
          }
          // the master is the only node feeding the destination
          const feeders = ctx.nodes.filter((n) =>
            n.targets.includes(ctx.destinationNode),
          );
          expect(feeders).toEqual([master]);
        },
      ),
    );
  });

  it("P-d4 spaces and newlines make no clack", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(" ", "\n", "\t", ""), { maxLength: 100 }),
        (chars) => {
          const { ctx, sound } = unlocked();
          sound.setMuted(false);
          for (const c of chars) sound.clack(c);
          expect(startedSources(ctx)).toHaveLength(0);
        },
      ),
    );
  });

  it("P-d5 at most 40 clacks per 1000 ms window, and resumes after", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 60 }), {
          minLength: 1,
          maxLength: 300,
        }),
        (gaps) => {
          let t = 0;
          const ctx = makeFakeContext();
          const sound = createSound({
            createContext: () => ctx,
            now: () => t,
          });
          sound.unlock();
          sound.setMuted(false);
          const accepted: number[] = [];
          for (const gap of gaps) {
            t += gap;
            const before = startedSources(ctx).length;
            sound.clack("a");
            if (startedSources(ctx).length > before) accepted.push(t);
          }
          for (let i = 0; i < accepted.length; i++) {
            const start = accepted[i] ?? 0;
            const inWindow = accepted.filter(
              (x) => x >= start && x < start + 1000,
            ).length;
            expect(inWindow).toBeLessThanOrEqual(MAX_CLACKS_PER_SECOND);
          }
          // after a quiet second a clack is accepted again
          t += 1001;
          const before = startedSources(ctx).length;
          sound.clack("a");
          expect(startedSources(ctx).length).toBe(before + 1);
        },
      ),
    );
  });

  it("P-d5b a burst at one instant is capped at 40", () => {
    const { ctx, sound } = unlocked();
    sound.setMuted(false);
    for (let i = 0; i < 100; i++) sound.clack("a");
    expect(startedSources(ctx)).toHaveLength(MAX_CLACKS_PER_SECOND);
  });

  it("P-d6 never throws for a missing, undefined or throwing factory", () => {
    const factories: Array<(() => AudioContextLike | undefined) | undefined> = [
      undefined,
      () => undefined,
      () => {
        throw new Error("no audio");
      },
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(0, 1, 2),
        fc.array(fc.tuple(callArb, printable), { maxLength: 20 }),
        (which, calls) => {
          const sound = createSound({
            createContext: factories[which],
            now: () => 0,
          });
          expect(() => {
            sound.unlock();
            sound.setMuted(false);
            for (const [c, ch] of calls) {
              if (c === "clack") sound.clack(ch);
              else if (c === "thunk") sound.thunk();
              else sound.bell();
            }
            sound.unlock();
          }).not.toThrow();
          expect(sound.isUnlocked()).toBe(false);
        },
      ),
    );
  });

  it("P-d7 repeated unlock makes one context", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
        let made = 0;
        let last: FakeContext | undefined;
        const sound = createSound({
          createContext: () => {
            made++;
            last = makeFakeContext();
            return last;
          },
          now: () => 0,
        });
        for (let i = 0; i < n; i++) sound.unlock();
        expect(made).toBe(1);
        expect(last?.nodes.filter((x) => x.kind === "gain")).toHaveLength(1);
        expect(last?.resumeCalls).toBe(n);
      }),
    );
  });
});
