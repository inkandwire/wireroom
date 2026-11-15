# WireRoom

The 1970s newswire teletype, back from the dead as a launch wire for founders.
Type your news; it prints in wire style, and every claim needs a source before release.
Built with Kiro (see `.kiro/`). Licence: MIT.

## Agent hook

Saving `drafts/*.json` or any `src/core/*.ts` file fires `.kiro/hooks/claim-gate-on-save.json`.
It runs the claim gate over `drafts/`. If all claims are sourced it prints `claim gate: N draft file(s), all claims sourced`.
Otherwise it lists each failing claim on stderr (`MISSING_SOURCE` or `INVALID_SOURCE`) and exits 1.
Run it by hand: `npx vite-node src/cli/claimgate.ts drafts`

The hook calls `sh scripts/run-claimgate.sh`, which finds node even under a clean PATH, runs the gate from the repo root and keeps its exit code.
If node is in an unusual place, set `NODE=/path/to/node`; with no node it prints `claim gate: node not found` and exits 127.
Every run appends a UTC-stamped report to `.kiro/hook-logs/claim-gate.log` (kept out of the repo; delete it any time).

## Source check (MCP)

`.kiro/settings/mcp.json` adds the MCP `fetch` server, so Kiro can check that each `sourceUrl` in a draft resolves (rules in `.kiro/steering/source-check.md`).
Interactive use works: Kiro asks once to approve the `fetch` tool and you approve it.
Non-interactive runs cannot trust the tool without `--trust-all-tools` (which also trusts shell), so the check is NOT run headless.

## Try it

- Live app: {LIVE_URL}
- Demo video: {VIDEO_URL}
- Run it yourself: `npm install`, then `npm test` (249 tests), `npm run build`, and open `dist/index.html` through any static server. It is fully static (Vite, base `./`), makes no network calls and needs no account or key. The `fetch` MCP server is a Kiro dev tool only; the app never uses it.

## How Kiro was used

- Steering: `.kiro/steering/` (product, tech, structure, design, source-check).
- Specs (requirements, design, tasks) that Kiro implemented: `.kiro/specs/` (wire-composer, wire-fixes, teletype-ui, teletype-polish, embargo-clock, feeds, hook-node, mcp-source-lookup, wireroom-ink, design-pass-2).
- Agent hook: `.kiro/hooks/claim-gate-on-save.json`.
- MCP: `.kiro/settings/mcp.json` (`fetch` server).
- Kiro wrote the application code under `src/` from those specs, except the one change below.
- Hype-word flag (`src/core/hype.ts`, `src/core/hype.test.ts`): its requirements and design were written with Kiro CLI in spec mode during the hackathon (`.kiro/specs/hype-word-flagging/`). The Kiro CLI session was stopped after the design step to stay within a small credit budget set for it, so there is no `tasks.md`. The detector (the design's Phase 1) and its tests were written by hand. The UI warning panel (the design's Phase 2) is not built yet.

## New work and third-party code

All code in this repo was written during the Kiroween submission period (first commit 9 Nov 2026). There is no pre-existing code. Dependencies are standard open-source packages (Vite, Vitest, TypeScript, fast-check) under their own licences; see `package.json`.
