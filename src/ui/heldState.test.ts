import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CANCEL_ANNOUNCE, LOCK_REASON, lockView } from "./heldState";

describe("lockView", () => {
  it("is unlocked with an empty reason when nothing is held", () => {
    expect(lockView(0)).toEqual({ locked: false, reason: "", announce: "" });
  });

  it("is locked with the exact reason when one story is held", () => {
    const view = lockView(1);
    expect(view.locked).toBe(true);
    expect(view.reason).toBe("Story held. Release or cancel to compose.");
    expect(LOCK_REASON).toBe(view.reason);
  });

  it("treats negative and non-finite counts as unlocked", () => {
    expect(lockView(-1).locked).toBe(false);
    expect(lockView(Number.NaN).locked).toBe(false);
  });

  it("exports the cancel announcement text", () => {
    expect(CANCEL_ANNOUNCE).toBe("Embargo cancelled");
  });

  it("is locked if and only if the count is greater than zero", () => {
    fc.assert(
      fc.property(fc.integer({ min: -5, max: 1000 }), (n) => {
        const view = lockView(n);
        expect(view.locked).toBe(n > 0);
        expect(view.reason === "").toBe(!view.locked);
      }),
    );
  });
});
