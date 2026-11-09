import {
  countdown,
  releaseDue,
  type HeldEntry,
  type ReleasedOne,
} from "../core/index";

export interface ClockRow {
  id: string;
  label: string;
  due: boolean;
}

export interface ClockLoopDeps {
  now(): number;
  setInterval(fn: () => void, ms: number): number;
  clearInterval(id: number): void;
  onTick(rows: ClockRow[]): void;
  onRelease(one: ReleasedOne): void;
}

export interface ClockLoop {
  add(entry: HeldEntry): void;
  size(): number;
  stop(): void;
}

const TICK_MS = 1000;

/**
 * DOM-free clock loop. One interval runs while at least one entry is held.
 * Every timer and clock read comes in through `deps`.
 */
export function createClockLoop(deps: ClockLoopDeps): ClockLoop {
  let held: HeldEntry[] = [];
  let timer: number | undefined;
  let stopped = false;

  function clearTimer(): void {
    if (timer !== undefined) {
      deps.clearInterval(timer);
      timer = undefined;
    }
  }

  function tick(): void {
    if (stopped) return;
    const t = deps.now();
    deps.onTick(
      held.map((e) => {
        const c = countdown(e.releaseAt, t);
        return { id: e.id, label: c.label, due: c.due };
      }),
    );
    if (stopped) return;

    const { released, stillHeld } = releaseDue(held, t);
    held = stillHeld;
    if (held.length === 0) clearTimer();

    for (const one of released) {
      if (stopped) return;
      deps.onRelease(one);
    }
  }

  return {
    add(entry: HeldEntry): void {
      if (stopped) return;
      held.push(entry);
      if (timer === undefined) {
        timer = deps.setInterval(tick, TICK_MS);
      }
    },
    size(): number {
      return held.length;
    },
    stop(): void {
      clearTimer();
      held = [];
      stopped = true;
    },
  };
}
