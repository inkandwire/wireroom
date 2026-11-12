import { checkClaims, checkSourcesLocal, type Claim } from "../core/index";

export interface ReportFile {
  name: string;
  json: unknown;
}

export interface Report {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** Returns the claims if `json` is a Draft-like object with a well-formed claims array, else null. */
function readClaims(json: unknown): Claim[] | null {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return null;
  }
  const claims = (json as { claims?: unknown }).claims;
  if (!Array.isArray(claims)) {
    return null;
  }
  const out: Claim[] = [];
  for (const entry of claims) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return null;
    }
    const { text, sourceUrl } = entry as { text?: unknown; sourceUrl?: unknown };
    if (typeof text !== "string") {
      return null;
    }
    if (sourceUrl === undefined || sourceUrl === null) {
      out.push({ text });
    } else if (typeof sourceUrl === "string") {
      out.push({ text, sourceUrl });
    } else {
      return null;
    }
  }
  return out;
}

/**
 * Reads the optional `sources` string array of a draft.
 * Returns `undefined` when absent, `null` when present but not an array of strings.
 */
function readSources(json: unknown): string[] | undefined | null {
  const sources = (json as { sources?: unknown }).sources;
  if (sources === undefined || sources === null) {
    return undefined;
  }
  if (!Array.isArray(sources) || sources.some((s) => typeof s !== "string")) {
    return null;
  }
  return sources as string[];
}

/** Keeps each failure on one line: whitespace runs (including newlines) become one space. */
function oneLine(s: string): string {
  return s.replace(/\s+/g, " ");
}

/**
 * Pure report for the claim gate over already-parsed draft files.
 * A file whose `json` is not a draft (use `undefined` for unparseable JSON) is a failure.
 * Files are reported in the order given.
 */
export function formatReport(files: ReportFile[]): Report {
  const lines: string[] = [];
  for (const file of files) {
    const claims = readClaims(file.json);
    if (claims === null) {
      lines.push(`${file.name}: not a draft`);
      continue;
    }
    for (const failure of checkClaims(claims)) {
      lines.push(
        `${file.name}: claim ${failure.index + 1} "${oneLine(failure.text)}" ${failure.reason}`,
      );
    }
  }
  if (lines.length === 0) {
    const stdout =
      files.length === 0
        ? "claim gate: 0 draft file(s)\n"
        : `claim gate: ${files.length} draft file(s), all claims sourced\n`;
    return { ok: true, stdout, stderr: "" };
  }
  lines.push(`claim gate: ${lines.length} unsourced claim(s)`);
  return { ok: false, stdout: "", stderr: lines.join("\n") + "\n" };
}

/**
 * Pure offline source report: one line per claim with its status, then a summary line.
 * `ok` is false when any claim is not OK or any file is not a draft. When ok, the text
 * is in `stdout`; otherwise it is in `stderr`.
 */
export function formatSourceReport(files: ReportFile[]): Report {
  const lines: string[] = [];
  let bad = 0;
  let checked = 0;
  for (const file of files) {
    const claims = readClaims(file.json);
    const sources = claims === null ? undefined : readSources(file.json);
    if (claims === null || sources === null) {
      lines.push(`${file.name}: not a draft`);
      bad += 1;
      continue;
    }
    for (const r of checkSourcesLocal(claims, sources)) {
      checked += 1;
      if (r.status !== "OK") {
        bad += 1;
      }
      lines.push(`${file.name}: claim ${r.index + 1} "${oneLine(r.text)}" ${r.status}`);
    }
  }
  if (files.length === 0) {
    return { ok: true, stdout: "source check: 0 draft file(s)\n", stderr: "" };
  }
  if (bad === 0) {
    lines.push(`source check: ${checked} claim(s), all OK`);
    return { ok: true, stdout: lines.join("\n") + "\n", stderr: "" };
  }
  lines.push(`source check: ${bad} problem(s) in ${checked} claim(s)`);
  return { ok: false, stdout: "", stderr: lines.join("\n") + "\n" };
}
