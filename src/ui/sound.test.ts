import { describe, expect, it } from "vitest";
import { MASTER_GAIN_MAX, createSound } from "./sound";
import { makeFakeContext, pathGains, startedSources } from "./soundFake";

function setup() {
  const ctx = makeFakeContext();
  let t = 0;
  const sound = createSound({ createContext: () => ctx, now: () => t });
  sound.unlock();
  sound.setMuted(false);
  return { ctx, sound };
}

describe("sound examples", () => {
  it("is muted and locked at the start and creates nothing", () => {
    let calls = 0;
    const sound = createSound({
      createContext: () => {
        calls++;
        return makeFakeContext();
      },
      now: () => 0,
    });
    expect(sound.isMuted()).toBe(true);
    expect(sound.isUnlocked()).toBe(false);
    sound.clack("a");
    sound.thunk();
    sound.bell();
    expect(calls).toBe(0);
  });

  it("unlock makes one context, one capped master gain, and resumes", () => {
    const ctx = makeFakeContext();
    const sound = createSound({ createContext: () => ctx, now: () => 0 }, 5);
    sound.unlock();
    expect(sound.isUnlocked()).toBe(true);
    const gains = ctx.nodes.filter((n) => n.kind === "gain");
    expect(gains).toHaveLength(1);
    expect(gains[0]?.gain.value).toBe(MASTER_GAIN_MAX);
    expect(gains[0]?.targets).toEqual([ctx.destinationNode]);
    expect(ctx.resumeCalls).toBe(1);
  });

  it("swallows a rejected resume", async () => {
    const ctx = makeFakeContext({ resumeRejects: true });
    const sound = createSound({ createContext: () => ctx, now: () => 0 });
    expect(() => sound.unlock()).not.toThrow();
    await Promise.resolve();
  });

  it("key clack: band-pass 1800 to 2500 Hz, Q 1.2, gain 0.6 to 0.001 over 30 ms", () => {
    const { ctx, sound } = setup();
    sound.clack("a");
    const filter = ctx.nodes.find((n) => n.kind === "filter");
    expect(filter?.type).toBe("bandpass");
    expect(filter?.frequency.value).toBeGreaterThanOrEqual(1800);
    expect(filter?.frequency.value).toBeLessThanOrEqual(2500);
    expect(filter?.Q.value).toBe(1.2);
    const voice = ctx.nodes.filter((n) => n.kind === "gain")[1];
    expect(voice?.gain.events).toEqual([
      { kind: "set", v: 0.6, t: 0 },
      { kind: "ramp", v: 0.001, t: 0.03 },
    ]);
    const src = startedSources(ctx);
    expect(src).toHaveLength(1);
    expect(src[0]?.kind).toBe("buffer");
  });

  it("carriage-return thunk: low-pass at 220 Hz, gain 0.5 to 0.001", () => {
    const { ctx, sound } = setup();
    sound.thunk();
    const filter = ctx.nodes.find((n) => n.kind === "filter");
    expect(filter?.type).toBe("lowpass");
    expect(filter?.frequency.value).toBe(220);
    const voice = ctx.nodes.filter((n) => n.kind === "gain")[1];
    expect(voice?.gain.events[0]).toEqual({ kind: "set", v: 0.5, t: 0 });
    expect(voice?.gain.events[1]?.v).toBe(0.001);
  });

  it("bell: three sine partials at 1320, 3168 and 5148 Hz", () => {
    const { ctx, sound } = setup();
    sound.bell();
    const oscs = ctx.nodes.filter((n) => n.kind === "osc");
    expect(oscs.map((o) => o.type)).toEqual(["sine", "sine", "sine"]);
    expect(oscs.map((o) => o.frequency.value)).toEqual([1320, 3168, 5148]);
    const gains = ctx.nodes.filter((n) => n.kind === "gain").slice(1);
    expect(gains.map((g) => g.gain.events[0]?.v)).toEqual([1, 0.5, 0.25]);
    for (const g of gains) {
      expect(g.gain.events[1]).toEqual({ kind: "ramp", v: 0.0001, t: 1.4 });
    }
    for (const o of oscs) {
      for (const p of pathGains(ctx, o)) {
        expect(p).toBeLessThanOrEqual(MASTER_GAIN_MAX);
      }
    }
  });

  it("makes no sound while muted", () => {
    const { ctx, sound } = setup();
    sound.setMuted(true);
    sound.clack("a");
    sound.thunk();
    sound.bell();
    expect(startedSources(ctx)).toHaveLength(0);
  });
});
