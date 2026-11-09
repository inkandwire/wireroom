import { MAX_COLUMNS } from "./types";

/** Split a word into consecutive slices of at most `max` characters. */
export function splitLongWord(word: string, max: number): string[] {
  const size = Math.max(1, Math.floor(max));
  const pieces: string[] = [];
  for (let i = 0; i < word.length; i += size) {
    pieces.push(word.slice(i, i + size));
  }
  return pieces;
}

/** Greedy word wrap of a single paragraph. Never emits a line longer than `max`. */
export function wrapParagraph(text: string, max: number = MAX_COLUMNS): string[] {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  const lines: string[] = [];
  let current = "";

  for (const token of tokens) {
    const pieces = token.length > max ? splitLongWord(token, max) : [token];
    for (const piece of pieces) {
      if (current === "") {
        current = piece;
      } else if (current.length + 1 + piece.length <= max) {
        current = current + " " + piece;
      } else {
        lines.push(current);
        current = piece;
      }
    }
  }
  if (current !== "") {
    lines.push(current);
  }
  return lines;
}

/** Wrap text into teletype lines. Paragraphs are separated by one blank line. */
export function wrapText(text: string, max: number = MAX_COLUMNS): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const paragraphs = normalized.split(/\n\s*\n/);
  const wrapped: string[] = [];
  for (const paragraph of paragraphs) {
    const lines = wrapParagraph(paragraph, max);
    if (lines.length > 0) {
      wrapped.push(lines.join("\n"));
    }
  }
  return wrapped.join("\n\n");
}
