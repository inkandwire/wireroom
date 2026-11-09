# Design: hook-node

## Approach

Move the "find node and run the gate" logic out of the hook JSON into one small committed POSIX sh script. The hook then only calls `sh scripts/run-claimgate.sh`. No dependency, no code in `src/`, no network. The user changes nothing.

## Files

| File | Change |
|---|---|
| `scripts/run-claimgate.sh` | new, executable, POSIX sh (no bashisms) |
| `.kiro/hooks/claim-gate-on-save.json` | only `action.command` changes |
| `.gitignore` | add `.kiro/hook-logs/` |
| `README.md` | 3-line note |

## Wrapper flow

1. `cd "$(dirname "$0")/.."` to reach the repo root. Use `sh scripts/run-claimgate.sh` as the call form, so `$0` is a relative path; resolve it with `cd` before any other step.
2. Find node, first hit wins:
   1. `command -v node`
   2. `$NODE` when set and `-x`
   3. `/usr/local/bin/node`, `/opt/homebrew/bin/node`
   4. globs for mise, nvm, volta and `$HOME` mise. For each glob, list matches, sort by version (`sort -V`, with a fallback to plain `sort` when `-V` is missing) and take the last (newest). Skip non-executable matches. If a glob has no match, the shell leaves it literal, so test `-x` on every candidate.
3. `PATH="$(dirname "$NODE_BIN"):$PATH"; export PATH`.
4. If none: `echo "claim gate: node not found" >&2; exit 127`. This case is also logged (step 5).
5. Run `node_modules/.bin/vite-node src/cli/claimgate.ts drafts` with stdout and stderr captured to a temp file made by `mktemp`. Then `mkdir -p .kiro/hook-logs`, append one line `claim-gate <UTC ISO time>` (`date -u +%Y-%m-%dT%H:%M:%SZ`) and the captured text to `.kiro/hook-logs/claim-gate.log`, print the captured text to stdout, remove the temp file, and `exit` with the saved gate code.

## Decisions

- The timestamp lives in the wrapper only. It is not in `src/core`, so the core rules on clock reads do not apply.
- The log is in `.kiro/hook-logs/` and is git-ignored, so a run leaves a trace without dirtying the tree.
- The hook keeps its matcher, so `notes/other.txt` does not match and never reaches the wrapper.
- Windows is out of scope (POSIX sh only).

## Testing

The agent running the task cannot run shell commands. The wrapper has no unit test. The maintainer runs the two checks in `tasks.md` in a real `kiro-cli` run, and also runs `env -i PATH=/usr/bin:/bin sh scripts/run-claimgate.sh` by hand.

## Risks

- A node install in a path not listed: the wrapper exits 127 with the one-line message; `$NODE` is the escape hatch.
- Hook output is hidden in non-interactive chat: the Log is the proof, not the console.
