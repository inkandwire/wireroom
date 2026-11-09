import type { Priority } from "../core/index";

export type PlaybackEvent =
  | { kind: "char"; at: number; char: string }
  | { kind: "newline"; at: number }
  | { kind: "bell"; at: number }
  | { kind: "tear"; at: number };

export const CHAR_DELAY_MS = 14;
export const SPACE_DELAY_MS = 8;
export const PUNCT_DELAY_MS = 40;
export const NEWLINE_DELAY_MS = 140;
export const MAX_PLAY_MS = 6000;
export const BELL_GAP_MS = 600;

/** Delay after printing one character (a UTF-16 code unit). */
export function charDelayMs(char: string): number {
  if (char === "\n") return NEWLINE_DELAY_MS;
  if (char === " ") return SPACE_DELAY_MS;
  if (/^[A-Za-z0-9]$/.test(char)) return CHAR_DELAY_MS;
  return PUNCT_DELAY_MS;
}

/** FLASH rings twice, BULLETIN once, URGENT and ROUTINE not at all. */
export function bellCount(priority: Priority): number {
  if (priority === "FLASH") return 2;
  if (priority === "BULLETIN") return 1;
  return 0;
}

export function buildTimeline(
  text: string,
  priority: Priority,
  reducedMotion: boolean,
): PlaybackEvent[] {
  const raw: { char: string; rawAt: number }[] = [];
  let rawTotal = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    raw.push({ char, rawAt: rawTotal });
    rawTotal += charDelayMs(char);
  }

  const timeOf = (rawAt: number): number => {
    if (reducedMotion) return 0;
    if (rawTotal > MAX_PLAY_MS) return Math.floor((rawAt * MAX_PLAY_MS) / rawTotal);
    return rawAt;
  };

  const events: PlaybackEvent[] = raw.map(({ char, rawAt }): PlaybackEvent => {
    const at = timeOf(rawAt);
    return char === "\n" ? { kind: "newline", at } : { kind: "char", at, char };
  });
  const tearAt = timeOf(rawTotal);
  events.push({ kind: "tear", at: tearAt });

  const bellTimes: number[] = [];
  const count = bellCount(priority);
  if (count >= 1) bellTimes.push(0);
  if (count >= 2) bellTimes.push(reducedMotion ? 0 : Math.min(BELL_GAP_MS, tearAt));

  for (const bellAt of bellTimes) {
    let index = events.findIndex((e) => e.at > bellAt);
    if (index === -1) index = events.length - 1; // before the tear, which stays last
    events.splice(index, 0, { kind: "bell", at: bellAt });
  }
  return events;
}

/** Text printed by the given time: all char and newline events with at <= timeMs. */
export function textAt(events: readonly PlaybackEvent[], timeMs: number): string {
  let out = "";
  for (const e of events) {
    if (e.at > timeMs) break;
    if (e.kind === "char") out += e.char;
    else if (e.kind === "newline") out += "\n";
  }
  return out;
}
