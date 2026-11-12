// Thin fs and exit-code wrapper around formatSourceReport. Run with:
//   node_modules/.bin/vite-node src/cli/claimgate.ts drafts
// The project has no @types/node, so the Node imports are untyped on purpose.
// @ts-ignore
import { existsSync, readdirSync, readFileSync } from "node:fs";
// @ts-ignore
import { join } from "node:path";
import { formatSourceReport, type ReportFile } from "./report";

const proc = (globalThis as unknown as {
  process: {
    argv: string[];
    exitCode?: number;
    stdout: { write(s: string): void };
    stderr: { write(s: string): void };
  };
}).process;

function readDrafts(dir: string): ReportFile[] {
  if (!existsSync(dir)) {
    return [];
  }
  const names: string[] = (readdirSync(dir) as string[])
    .filter((n) => n.endsWith(".json"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const files: ReportFile[] = [];
  for (const name of names) {
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(join(dir, name), "utf8") as string);
    } catch {
      json = undefined; // unreadable or not JSON: reported as "not a draft"
    }
    files.push({ name: join(dir, name), json });
  }
  return files;
}

const dir = proc.argv[2] ?? "drafts";
const report = formatSourceReport(readDrafts(dir));
if (report.stdout !== "") {
  proc.stdout.write(report.stdout);
}
if (report.stderr !== "") {
  proc.stderr.write(report.stderr);
}
proc.exitCode = report.ok ? 0 : 1;
