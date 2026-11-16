// @ts-ignore (no @types/node in this project)
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// main.ts needs a real DOM (the suite runs in node, no jsdom), so this reads
// the source: after a release the ticker title ("RELEASE IN") must go, or the
// held area reads "RELEASE IN RELEASED". Regression guard, not a DOM test.
const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8") as string;
const printer = readFileSync(new URL("./printer.ts", import.meta.url), "utf8") as string;

function body(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  expect(start, `function ${name} not found`).toBeGreaterThan(-1);
  const end = src.indexOf("\n}\n", start);
  return src.slice(start, end);
}

describe("held ticker after release", () => {
  const release = body(main, "onClockRelease");

  it("printer builds the title with the class main.ts removes", () => {
    expect(printer).toContain('title.className = "ticker-title"');
    expect(printer).toContain("title.textContent = TICKER_TITLE");
  });

  it("onClockRelease sets RELEASED and removes .ticker-title", () => {
    expect(release).toContain('label.textContent = "RELEASED"');
    expect(release).toMatch(/querySelector\(["']\.ticker-title["']\)\??\.remove\(\)/);
  });

  it("Release now goes through onClockRelease (same fix covers both paths)", () => {
    const now = body(main, "releaseNow");
    expect(now).toContain("onClockRelease(");
    expect(now).not.toContain('"RELEASED"');
  });
});
