import { describe, expect, it } from "vitest";
import {
  composeWireItem,
  slugFromHeadline,
  type ClaimFailure,
} from "../core/index";
import {
  EXAMPLE_SOURCED,
  EXAMPLE_UNSOURCED,
  claimSentence,
  formToDraft,
  formatReleaseTime,
  heldProof,
  rejectionNotice,
  timeErrorNotice,
} from "./form";

const NOW = "2026-03-04T12:00:00Z";

describe("rejection text", () => {
  it("uses the exact MISSING_SOURCE sentence", () => {
    const f: ClaimFailure = {
      index: 0,
      text: "The app has 500 users",
      reason: "MISSING_SOURCE",
    };
    expect(claimSentence(f)).toBe(
      'Claim "The app has 500 users" has no source URL. Add a link that backs it up.',
    );
  });

  it("uses the singular heading for one failure", () => {
    const n = rejectionNotice(
      [{ index: 0, text: "A", reason: "MISSING_SOURCE" }],
      [3],
    );
    expect(n.heading).toBe("NOT RELEASED: 1 claim has no source.");
    expect(n.items[0].rowIndex).toBe(3);
  });

  it("uses the plural heading", () => {
    const n = rejectionNotice(
      [
        { index: 0, text: "A", reason: "MISSING_SOURCE" },
        { index: 1, text: "B", reason: "INVALID_SOURCE" },
      ],
      [0, 1],
    );
    expect(n.heading).toBe("NOT RELEASED: 2 claims have no source.");
  });

  it("describes time errors", () => {
    expect(timeErrorNotice(["embargo"])).toBe(
      "NOT RELEASED: the embargo date and time are not valid.",
    );
    expect(timeErrorNotice(["now", "embargo"])).toContain("clock value");
  });
});

describe("held proof", () => {
  it("formats the release time", () => {
    expect(formatReleaseTime("2026-03-04T09:05:00Z")).toBe(
      "2026-03-04 09:05 UTC",
    );
  });

  it("has a stamp, no body text and no end marker", () => {
    const { draft } = formToDraft(
      { ...EXAMPLE_SOURCED, embargoDate: "2026-12-01", embargoTime: "09:00" },
      NOW,
    );
    const proof = heldProof(draft, "2026-12-01T09:00:00Z");
    expect(proof.stamp).toBe("HOLD UNTIL 2026-12-01 09:00 UTC");
    expect(proof.text).not.toContain("-30-");
    expect(proof.text).not.toContain("Ledgerly,");
    expect(proof.text).not.toContain("beta users");
    expect(proof.text).toContain(slugFromHeadline(draft.headline));
    expect(proof.text).toContain("BULLETIN");
  });
});

describe("examples", () => {
  it("sourced example is released", () => {
    const { draft } = formToDraft(EXAMPLE_SOURCED, NOW);
    const result = composeWireItem(draft);
    expect(result.status).toBe("RELEASED");
  });

  it("unsourced example is rejected and names the second claim", () => {
    const { draft, rowIndexes } = formToDraft(EXAMPLE_UNSOURCED, NOW);
    const result = composeWireItem(draft);
    expect(result.status).toBe("REJECTED");
    if (result.status !== "REJECTED") return;
    expect(result.failures.length).toBe(1);
    expect(result.failures[0].index).toBe(1);
    expect(result.failures[0].text).toBe(EXAMPLE_SOURCED.claims[1].text);
    expect(rowIndexes[1]).toBe(1);
  });

  it("unsourced example with the URL filled in is released", () => {
    const filled = {
      ...EXAMPLE_UNSOURCED,
      claims: [
        EXAMPLE_UNSOURCED.claims[0],
        {
          ...EXAMPLE_UNSOURCED.claims[1],
          sourceUrl: EXAMPLE_SOURCED.claims[1].sourceUrl,
        },
      ],
    };
    const { draft } = formToDraft(filled, NOW);
    expect(composeWireItem(draft).status).toBe("RELEASED");
  });

  it("the two examples differ only in the one URL", () => {
    expect({
      ...EXAMPLE_UNSOURCED,
      claims: [
        EXAMPLE_UNSOURCED.claims[0],
        {
          ...EXAMPLE_UNSOURCED.claims[1],
          sourceUrl: EXAMPLE_SOURCED.claims[1].sourceUrl,
        },
      ],
    }).toEqual(EXAMPLE_SOURCED);
    expect(EXAMPLE_UNSOURCED.claims[1].sourceUrl).toBe("");
  });
});
