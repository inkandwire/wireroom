import { describe, expect, it } from "vitest";
import { formatReport } from "./report";

const GOOD = "https://example.com/proof";

describe("formatReport", () => {
  it("passes when every claim is sourced", () => {
    const r = formatReport([
      { name: "a.json", json: { claims: [{ text: "x", sourceUrl: GOOD }] } },
      { name: "b.json", json: { claims: [] } },
    ]);
    expect(r).toEqual({
      ok: true,
      stdout: "claim gate: 2 draft file(s), all claims sourced\n",
      stderr: "",
    });
  });

  it("reports MISSING_SOURCE with a 1-based claim number", () => {
    const r = formatReport([
      {
        name: "d/a.json",
        json: { claims: [{ text: "ok", sourceUrl: GOOD }, { text: "App has 500 users" }] },
      },
    ]);
    expect(r.ok).toBe(false);
    expect(r.stdout).toBe("");
    expect(r.stderr).toBe(
      'd/a.json: claim 2 "App has 500 users" MISSING_SOURCE\nclaim gate: 1 unsourced claim(s)\n',
    );
  });

  it("reports INVALID_SOURCE", () => {
    const r = formatReport([
      { name: "a.json", json: { claims: [{ text: "x", sourceUrl: "not a url" }] } },
    ]);
    expect(r.stderr).toBe(
      'a.json: claim 1 "x" INVALID_SOURCE\nclaim gate: 1 unsourced claim(s)\n',
    );
  });

  it("reports unparseable JSON as not a draft", () => {
    const r = formatReport([{ name: "bad.json", json: undefined }]);
    expect(r.ok).toBe(false);
    expect(r.stderr).toBe("bad.json: not a draft\nclaim gate: 1 unsourced claim(s)\n");
  });

  it("reports a missing claims array as not a draft", () => {
    const r = formatReport([
      { name: "a.json", json: { headline: "x" } },
      { name: "b.json", json: [1, 2] },
      { name: "c.json", json: null },
    ]);
    expect(r.stderr).toBe(
      "a.json: not a draft\nb.json: not a draft\nc.json: not a draft\nclaim gate: 3 unsourced claim(s)\n",
    );
  });

  it("handles an empty list", () => {
    expect(formatReport([])).toEqual({
      ok: true,
      stdout: "claim gate: 0 draft file(s)\n",
      stderr: "",
    });
  });
});
