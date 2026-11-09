import { describe, expect, it } from "vitest";
import { composeWireItem } from "./compose";
import type { Draft, WireItem } from "./types";
import { wireItemToJson } from "./wireJson";

const LONG_URL = `https://example.com/${"a".repeat(100)}`;

function release(): WireItem {
  const draft: Draft = {
    headline: "Acme launch",
    body: "Acme released its app.",
    claims: [{ text: "500 users", sourceUrl: LONG_URL }],
    priority: "BULLETIN",
    city: "Austin",
    now: "2026-03-04T12:00:00Z",
  };
  const result = composeWireItem(draft);
  if (result.status !== "RELEASED") throw new Error("expected RELEASED");
  return result.item;
}

describe("wireItemToJson", () => {
  it("emits keys in the fixed order", () => {
    const json = wireItemToJson(release());
    const order = ["slug", "priority", "dateline", "text", "claims", "sources"].map(
      (k) => json.indexOf(`\n  "${k}":`),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("keeps the long URL whole in JSON and in the text", () => {
    const item = release();
    const parsed = JSON.parse(wireItemToJson(item)) as {
      claims: { text: string; sourceUrl: string }[];
      sources: string[];
      text: string;
    };
    expect(parsed.claims).toEqual([{ text: "500 users", sourceUrl: LONG_URL }]);
    expect(parsed.sources).toEqual([LONG_URL]);
    expect(parsed.text.split("\n")).toContain(`   ${LONG_URL}`);
  });

  it("is deterministic", () => {
    const item = release();
    expect(wireItemToJson(item)).toBe(wireItemToJson(item));
  });

  it("has no trailing newline", () => {
    expect(wireItemToJson(release()).endsWith("\n")).toBe(false);
  });
});
