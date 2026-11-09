import { describe, expect, it } from "vitest";
import { createClockLoop, type ClockRow } from "./clockLoop";
import type { Draft, HeldEntry, ReleasedOne } from "../core/index";

const START = Date.UTC(2026, 2, 4, 10, 0, 0);

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function draft(embargo: string): Draft {
  return {
    headline: "Acme launch",
    body: "Acme released its app.",
    claims: [{ text: "500 users", sourceUrl: "https://example.com/users" }],
    priority: "BULLETIN",
    city: "Austin",
    now: iso(START),
    embargo,
  };
}

function entry(id: string, releaseMs: number): HeldEntry {
  const releaseAt = iso(releaseMs);
  return { id, draft: draft(releaseAt), releaseAt };
}

function setup() {
  let nowMs = START;
  let callback: (() => void) | undefined;
  let nextId = 1;
  let created = 0;
  let cleared = 0;
  const ticks: ClockRow[][] = [];
  const released: ReleasedOne[] = [];

  const deps = {
    now: () => nowMs,
    setInterval: (fn: () => void) => {
      created += 1;
      callback = fn;
      return nextId++;
    },
    clearInterval: () => {
      cleared += 1;
      callback = undefined;
    },
    onTick: (rows: ClockRow[]) => {
      ticks.push(rows);
    },
    onRelease: (one: ReleasedOne) => {
      released.push(one);
    },
  };

  return {
    deps,
    ticks,
    released,
    created: () => created,
    cleared: () => cleared,
    active: () => callback !== undefined,
    /** Move time and fire the callback once per whole 1000 ms step. */
    advance(ms: number) {
      const steps = Math.floor(ms / 1000);
      for (let i = 0; i < steps; i += 1) {
        nowMs += 1000;
        callback?.();
      }
    },
    /** Jump time and fire exactly one tick (a late wake-up). */
    jump(ms: number) {
      nowMs += ms;
      callback?.();
    },
    /** Fire a stale queued callback regardless of the cleared timer. */
    fireQueued(fn: (() => void) | undefined) {
      fn?.();
    },
  };
}

describe("createClockLoop", () => {
  it("starts no interval until the first add", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    expect(f.created()).toBe(0);
    expect(loop.size()).toBe(0);
  });

  it("uses one interval for two adds", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("hold-1", START + 5000));
    loop.add(entry("hold-2", START + 8000));
    expect(f.created()).toBe(1);
    expect(loop.size()).toBe(2);
  });

  it("clears the interval after the last release", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("hold-1", START + 2000));
    loop.add(entry("hold-2", START + 4000));
    f.advance(2000);
    expect(f.released.map((r) => r.entry.id)).toEqual(["hold-1"]);
    expect(f.active()).toBe(true);
    expect(f.cleared()).toBe(0);
    f.advance(2000);
    expect(f.released.map((r) => r.entry.id)).toEqual(["hold-1", "hold-2"]);
    expect(f.active()).toBe(false);
    expect(f.cleared()).toBe(1);
    expect(loop.size()).toBe(0);
  });

  it("releases each item once", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("hold-1", START + 1000));
    loop.add(entry("hold-2", START + 3000));
    f.advance(10_000);
    const ids = f.released.map((r) => r.entry.id);
    expect(ids).toEqual(["hold-1", "hold-2"]);
    expect(f.released.every((r) => r.result.status === "RELEASED")).toBe(true);
  });

  it("releases several due items in one tick after a 10-minute jump", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("late", START + 300_000));
    loop.add(entry("early", START + 60_000));
    loop.add(entry("future", START + 3_600_000));
    f.jump(600_000);
    expect(f.ticks).toHaveLength(1);
    expect(f.released.map((r) => r.entry.id)).toEqual(["early", "late"]);
    expect(loop.size()).toBe(1);
    expect(f.active()).toBe(true);
  });

  it("calls onTick once per tick with all rows", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("hold-1", START + 3000));
    loop.add(entry("hold-2", START + 9000));
    f.advance(1000);
    expect(f.ticks).toHaveLength(1);
    expect(f.ticks[0]).toEqual([
      { id: "hold-1", label: "T-00:00:02", due: false },
      { id: "hold-2", label: "T-00:00:08", due: false },
    ]);
    f.advance(1000);
    expect(f.ticks).toHaveLength(2);
    expect(f.ticks[1]).toHaveLength(2);
  });

  it("shows RELEASING on the last tick row of a due entry", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("hold-1", START + 1000));
    f.advance(1000);
    expect(f.ticks[0]).toEqual([
      { id: "hold-1", label: "RELEASING", due: true },
    ]);
  });

  it("runs no callback after stop()", () => {
    let queued: (() => void) | undefined;
    const f = setup();
    const loop = createClockLoop({
      ...f.deps,
      setInterval: (fn) => {
        queued = fn;
        return f.deps.setInterval(fn);
      },
    });
    loop.add(entry("hold-1", START + 1000));
    loop.stop();
    expect(f.cleared()).toBe(1);
    expect(loop.size()).toBe(0);
    f.jump(5000);
    f.fireQueued(queued);
    expect(f.ticks).toHaveLength(0);
    expect(f.released).toHaveLength(0);
  });

  it("ignores add() after stop()", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.stop();
    loop.add(entry("hold-1", START + 1000));
    expect(f.created()).toBe(0);
    expect(loop.size()).toBe(0);
  });

  it("starts a new interval when an entry is added after all released", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("hold-1", START + 1000));
    f.advance(1000);
    expect(f.active()).toBe(false);
    loop.add(entry("hold-2", START + 5000));
    expect(f.created()).toBe(2);
    expect(f.active()).toBe(true);
  });
});

describe("createClockLoop take()", () => {
  it("returns undefined for an unknown id", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("hold-1", START + 5000));
    expect(loop.take("nope")).toBeUndefined();
    expect(loop.size()).toBe(1);
  });

  it("removes and returns the entry, and no tick releases it", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("hold-1", START + 2000));
    loop.add(entry("hold-2", START + 4000));
    const taken = loop.take("hold-1");
    expect(taken?.id).toBe("hold-1");
    expect(loop.size()).toBe(1);
    f.advance(10_000);
    expect(f.released.map((r) => r.entry.id)).toEqual(["hold-2"]);
    expect(f.ticks[0]?.map((r) => r.id)).toEqual(["hold-2"]);
  });

  it("stops the interval when the last entry is taken", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("hold-1", START + 2000));
    expect(f.active()).toBe(true);
    loop.take("hold-1");
    expect(f.active()).toBe(false);
    expect(f.cleared()).toBe(1);
    expect(loop.size()).toBe(0);
  });

  it("keeps the interval while other entries remain", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("hold-1", START + 2000));
    loop.add(entry("hold-2", START + 4000));
    loop.take("hold-1");
    expect(f.active()).toBe(true);
    expect(f.cleared()).toBe(0);
  });

  it("starts a new interval when an entry is added after a take", () => {
    const f = setup();
    const loop = createClockLoop(f.deps);
    loop.add(entry("hold-1", START + 2000));
    loop.take("hold-1");
    loop.add(entry("hold-2", START + 4000));
    expect(f.created()).toBe(2);
    expect(f.active()).toBe(true);
  });
});
