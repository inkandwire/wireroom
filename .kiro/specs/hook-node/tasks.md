# Tasks: hook-node

Note: the agent running a task cannot run shell commands. Each task only writes files, including its own tests. Do not add install or run steps. The maintainer sets the executable bit (`chmod +x scripts/run-claimgate.sh`), runs `npm test`, and does the proof below outside Kiro.

Rules for every task: add no dependency; POSIX sh only; do not change `src/`; follow `.kiro/steering/*.md` and `design.md`; keep the hook name, trigger, matcher and timeout.

- [ ] 1. Node-finding claim gate wrapper
  - Write `scripts/run-claimgate.sh` as in `design.md`: find node, prepend its directory to PATH, run the gate from the repo root, append a UTC-stamped report to `.kiro/hook-logs/claim-gate.log`, keep the gate exit code, print `claim gate: node not found` to stderr and exit 127 when there is no node.
  - Change only `action.command` in `.kiro/hooks/claim-gate-on-save.json` to `sh scripts/run-claimgate.sh`.
  - Add `.kiro/hook-logs/` to `.gitignore`.
  - Add a 3-line note to `README.md`: what the wrapper does, the `$NODE` override, and where the log is.
  - _Requirements: 1.1-1.5, 2.1-2.2, 3.1-3.3, 4.1-4.3_
  - Maintainer will check, in a real `kiro-cli chat --v3 --no-interactive` run with a clean environment (`env -i ... PATH=/usr/bin:/bin`) and the unmodified committed hook:
    1. After Kiro writes `drafts/probe-claims.json`, `.kiro/hook-logs/claim-gate.log` has a new timestamped entry. _Requirements: 5.1_
    2. After Kiro writes `notes/other.txt`, the log has no new entry. _Requirements: 5.2_
