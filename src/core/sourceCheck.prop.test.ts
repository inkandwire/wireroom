// @ts-ignore (no @types/node in this project)
import { readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkSourcesLocal } from "./sourceCheck";

const label = fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/);
const host = fc.tuple(label, label, fc.array(label, { maxLength: 2 })).map(
  ([a, b, rest]) => [a, b, ...rest].join("."),
);
const path = fc.stringMatching(/^(\/[a-z0-9]{0,8}){0,3}$/);
const urlParts = fc.tuple(host, path);

const one = (sourceUrl: string, sources?: string[]) =>
  checkSourcesLocal([{ text: "c", sourceUrl }], sources)[0]!.status;

describe("checkSourcesLocal (properties)", () => {
  it("https URLs on dotted hosts are OK", () => {
    fc.assert(
      fc.property(urlParts, ([h, p]) => {
        expect(one(`https://${h}${p}`)).toBe("OK");
      }),
    );
  });

  it("http and other schemes are NOT_HTTPS", () => {
    fc.assert(
      fc.property(urlParts, fc.constantFrom("http", "ftp", "ws", "wss"), ([h, p], scheme) => {
        expect(one(`${scheme}://${h}${p}`)).toBe("NOT_HTTPS");
      }),
    );
  });

  it("padding, inner spaces and dotless hosts are MALFORMED", () => {
    fc.assert(
      fc.property(urlParts, label, fc.constantFrom(" ", "\t", "\n"), ([h, p], bare, ws) => {
        const url = `https://${h}${p}`;
        expect(one(ws + url)).toBe("MALFORMED");
        expect(one(url + ws)).toBe("MALFORMED");
        expect(one(`https://${h}${ws}x${p}`)).toBe("MALFORMED");
        expect(one(`https://${bare}${p}`)).toBe("MALFORMED");
      }),
    );
  });

  it("keeps claim order and count", () => {
    const claim = fc.record(
      { text: fc.string(), sourceUrl: fc.string() },
      { requiredKeys: ["text"] },
    );
    fc.assert(
      fc.property(fc.array(claim, { maxLength: 12 }), (claims) => {
        const r = checkSourcesLocal(claims);
        expect(r.length).toBe(claims.length);
        r.forEach((x, i) => {
          expect(x.index).toBe(i);
          expect(x.text).toBe(claims[i]!.text);
        });
      }),
    );
  });

  it("gives the same output for the same input", () => {
    const claim = fc.record(
      { text: fc.string(), sourceUrl: fc.string() },
      { requiredKeys: ["text"] },
    );
    fc.assert(
      fc.property(fc.array(claim), fc.option(fc.array(fc.string()), { nil: undefined }), (c, s) => {
        expect(checkSourcesLocal(c, s)).toEqual(checkSourcesLocal(c, s));
      }),
    );
  });

  it("source has no fetch, XMLHttpRequest or network import", () => {
    const raw = readFileSync(new URL("./sourceCheck.ts", import.meta.url), "utf8") as string;
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bfetch\b/);
    expect(code).not.toMatch(/XMLHttpRequest/);
    expect(code).not.toMatch(/WebSocket/);
    expect(code).not.toMatch(/node:(http|https|net|dns|tls|dgram)/);
    const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const spec of imports) {
      expect(spec!.startsWith("./")).toBe(true);
    }
  });
});
