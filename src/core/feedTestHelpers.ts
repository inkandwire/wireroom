// Test-only helpers shared by feed.test.ts and feed.prop.test.ts.
// Not imported by any runtime code.

/** Test-only strict XML well-formedness checker. */
export const PROLOG = '<?xml version="1.0" encoding="UTF-8"?>\n';
const NAME = "[A-Za-z_][A-Za-z0-9_.:-]*";
const ATTR = `\\s+${NAME}="(?:[^"<&]|&(?:amp|lt|gt|quot|apos);)*"`;
const TAG_RE = new RegExp(`<(/?)(${NAME})((?:${ATTR})*)\\s*(/?)>`, "y");
const TEXT_RE = /^(?:[^<>&]|&(?:amp|lt|gt|quot|apos);)*$/;

function hasForbiddenChar(s: string): boolean {
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    const ok =
      cp === 0x9 ||
      cp === 0xa ||
      cp === 0xd ||
      (cp >= 0x20 && cp <= 0xd7ff) ||
      (cp >= 0xe000 && cp <= 0xfffd) ||
      (cp >= 0x10000 && cp <= 0x10ffff);
    if (!ok) return true;
  }
  return false;
}

/** Returns null when the document is well-formed, else a message. */
export function xmlProblem(xml: string): string | null {
  if (!xml.startsWith(PROLOG)) return "declaration must come first";
  if (hasForbiddenChar(xml)) return "forbidden character";
  const stack: string[] = [];
  let roots = 0;
  let pos = PROLOG.length;
  while (pos < xml.length) {
    if (xml[pos] === "<") {
      TAG_RE.lastIndex = pos;
      const m = TAG_RE.exec(xml);
      if (m === null) return `bad tag at ${pos}`;
      const closing = m[1] === "/";
      const name = m[2];
      const selfClosing = m[4] === "/";
      if (closing) {
        if (selfClosing || m[3] !== "") return `bad closing tag at ${pos}`;
        if (stack.pop() !== name) return `mismatched </${name}> at ${pos}`;
      } else {
        if (stack.length === 0) {
          roots += 1;
          if (roots > 1) return "more than one root";
        }
        if (!selfClosing) stack.push(name);
      }
      pos = TAG_RE.lastIndex;
    } else {
      const next = xml.indexOf("<", pos);
      const end = next === -1 ? xml.length : next;
      const text = xml.slice(pos, end);
      if (!TEXT_RE.test(text)) return `bad text at ${pos}`;
      if (stack.length === 0 && text.trim() !== "") return "text outside root";
      pos = end;
    }
  }
  if (stack.length > 0) return `unclosed <${stack[stack.length - 1]}>`;
  if (roots !== 1) return "need exactly one root";
  return null;
}

/** Reverses the five XML entities (`&amp;` last). */
export function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
