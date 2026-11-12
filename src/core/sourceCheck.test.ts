import { describe, expect, it } from "vitest";
import { checkSourcesLocal } from "./sourceCheck";

const status = (sourceUrl: string | undefined, sources?: string[]) =>
  checkSourcesLocal([{ text: "c", sourceUrl }], sources)[0]!.status;

describe("checkSourcesLocal", () => {
  it("accepts an https URL on a dotted host", () => {
    expect(status("https://example.com/a")).toBe("OK");
  });

  it("reports MISSING for no URL or an empty one", () => {
    expect(status(undefined)).toBe("MISSING");
    expect(status("")).toBe("MISSING");
    expect(status("   ")).toBe("MISSING");
  });

  it("reports MALFORMED for padding, inner spaces, junk and dotless hosts", () => {
    expect(status(" https://example.com")).toBe("MALFORMED");
    expect(status("https://example.com ")).toBe("MALFORMED");
    expect(status("https://exam ple.com")).toBe("MALFORMED");
    expect(status("not a url")).toBe("MALFORMED");
    expect(status("nonsense")).toBe("MALFORMED");
    expect(status("https://localhost/x")).toBe("MALFORMED");
  });

  it("reports NOT_HTTPS for other schemes on a dotted host", () => {
    expect(status("http://example.com")).toBe("NOT_HTTPS");
    expect(status("ftp://example.com/f")).toBe("NOT_HTTPS");
  });

  it("applies the sources list only when it is an array", () => {
    const url = "https://example.com/a";
    expect(status(url, [])).toBe("UNLISTED");
    expect(status(url, ["https://example.com/b"])).toBe("UNLISTED");
    expect(status(url, [url])).toBe("OK");
    expect(status(url, undefined)).toBe("OK");
  });

  it("keeps order, index and text", () => {
    const r = checkSourcesLocal([
      { text: "one", sourceUrl: "https://example.com" },
      { text: "two" },
    ]);
    expect(r).toEqual([
      { index: 0, text: "one", status: "OK" },
      { index: 1, text: "two", status: "MISSING" },
    ]);
  });
});
