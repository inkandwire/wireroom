// Pure lock state for the compose form while a story is held. No DOM, no
// clock. main.ts reads the held count from the clock loop and applies this.

export const LOCK_REASON = "Story held. Release or cancel to compose.";
export const CANCEL_ANNOUNCE = "Embargo cancelled";

export interface HeldView {
  locked: boolean;
  /** Visible reason line; empty when the form is unlocked. */
  reason: string;
  /** Text for the status region when the lock starts; empty when unlocked. */
  announce: string;
}

/** The form is locked exactly when at least one story is held. */
export function lockView(heldCount: number): HeldView {
  if (Number.isFinite(heldCount) && heldCount > 0) {
    return { locked: true, reason: LOCK_REASON, announce: LOCK_REASON };
  }
  return { locked: false, reason: "", announce: "" };
}
