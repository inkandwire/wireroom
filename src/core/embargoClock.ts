import { composeWireItem } from "./compose";
import { isReleased, parseInstant } from "./embargo";
import type { ComposeResult, Draft } from "./types";

export interface HeldEntry {
  id: string;
  draft: Draft;
  /** ISO 8601 UTC instant. */
  releaseAt: string;
}

export interface Countdown {
  remainingMs: number;
  label: string;
  due: boolean;
}

export interface ReleasedOne {
  entry: HeldEntry;
  result: ComposeResult;
}

const SECONDS_PER_DAY = 86400;
const UNKNOWN_LABEL = "T-??:??:??";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Time left until `releaseAt`, as a fixed-format label. Pure: `nowMs` is an
 * argument. No locale APIs.
 */
export function countdown(releaseAt: string, nowMs: number): Countdown {
  const releaseMs = parseInstant(releaseAt);
  if (releaseMs === undefined || !Number.isFinite(nowMs)) {
    return { remainingMs: 0, label: UNKNOWN_LABEL, due: false };
  }
  const due = isReleased(releaseMs, nowMs);
  const remainingMs = Math.max(0, releaseMs - nowMs);
  if (due) return { remainingMs, label: "RELEASING", due };

  const total = Math.ceil(remainingMs / 1000);
  const days = Math.floor(total / SECONDS_PER_DAY);
  const rest = total - days * SECONDS_PER_DAY;
  const hh = Math.floor(rest / 3600);
  const mm = Math.floor((rest % 3600) / 60);
  const ss = rest % 60;
  const clock = `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
  const label = total < SECONDS_PER_DAY ? `T-${clock}` : `T-${days}d ${clock}`;
  return { remainingMs, label, due };
}

/**
 * Split held entries into those due at `nowMs` and those still held.
 * Due entries are composed with `now = releaseAt`, so the dateline is the
 * release time, never the wake-up time. `released` is sorted by release time
 * (stable on ties); `stillHeld` keeps input order. Inputs are not mutated.
 */
export function releaseDue(
  held: readonly HeldEntry[],
  nowMs: number,
): { released: ReleasedOne[]; stillHeld: HeldEntry[] } {
  const dueList: { entry: HeldEntry; releaseMs: number; order: number }[] = [];
  const stillHeld: HeldEntry[] = [];

  held.forEach((entry, order) => {
    const releaseMs = parseInstant(entry.releaseAt);
    if (releaseMs !== undefined && countdown(entry.releaseAt, nowMs).due) {
      dueList.push({ entry, releaseMs, order });
    } else {
      stillHeld.push(entry);
    }
  });

  dueList.sort((a, b) => a.releaseMs - b.releaseMs || a.order - b.order);

  const released: ReleasedOne[] = dueList.map(({ entry }) => ({
    entry,
    result: composeWireItem({ ...entry.draft, now: entry.releaseAt }),
  }));

  return { released, stillHeld };
}
