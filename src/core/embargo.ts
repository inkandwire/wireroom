const INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z$/;

/**
 * Strictly parse `YYYY-MM-DDTHH:mm:ss(.fff)?Z` into epoch milliseconds.
 * Returns undefined for any other shape or a calendar-invalid value.
 * Pure: reads no clock.
 */
export function parseInstant(s: string): number | undefined {
  const m = INSTANT_RE.exec(s);
  if (m === null) return undefined;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);

  if (month < 1 || month > 12) return undefined;
  if (hour > 23 || minute > 59 || second > 59) return undefined;

  // Round-trip the date fields to reject values such as Feb 30.
  const check = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC maps years 0-99 to 1900-1999; fix that so the comparison is honest.
  check.setUTCFullYear(year);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return undefined;
  }

  const ms = Date.parse(s);
  return Number.isNaN(ms) ? undefined : ms;
}

/** True when there is no embargo, or `nowMs` has reached the embargo. */
export function isReleased(
  embargoMs: number | undefined,
  nowMs: number,
): boolean {
  return embargoMs === undefined || nowMs >= embargoMs;
}
