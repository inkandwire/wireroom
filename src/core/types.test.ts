import { describe, expect, it } from "vitest";
import {
  END_MARKER,
  MAX_COLUMNS,
  MAX_SLUG_LENGTH,
  type ComposeResult,
  type Draft,
} from "./types";

describe("constants", () => {
  it("has the required values", () => {
    expect(MAX_COLUMNS).toBe(69);
    expect(END_MARKER).toBe("-30-");
    expect(MAX_SLUG_LENGTH).toBe(24);
  });
});

describe("types", () => {
  it("accepts a sample Draft", () => {
    const draft: Draft = {
      headline: "Acme launch",
      body: "Acme released its app.\n\nIt has 500 users.",
      claims: [{ text: "It has 500 users.", sourceUrl: "https://example.com/a" }],
      priority: "ROUTINE",
      embargo: "2026-03-04T12:00:00Z",
      city: "Austin",
      now: "2026-03-04T11:00:00Z",
    };
    expect(draft.claims).toHaveLength(1);
  });

  it("accepts a sample ComposeResult", () => {
    const result: ComposeResult = { status: "HELD", releaseAt: "2026-03-04T12:00:00Z" };
    expect(result.status).toBe("HELD");
  });
});
