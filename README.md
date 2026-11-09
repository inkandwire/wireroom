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
Every run appends a UTC-stamped report to `.kiro/hook-logs/claim-gate.log` (git-ignored).
