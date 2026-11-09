# Requirements: hook-node

## Introduction

The committed hook `.kiro/hooks/claim-gate-on-save.json` runs `node_modules/.bin/vite-node src/cli/claimgate.ts drafts`. Under `kiro-cli` started with a clean environment (`env -i ... PATH=/usr/bin:/bin`) there is no `node` on PATH, and `vite-node` starts with `#!/usr/bin/env node`, so the hook fails silently. Hook output is also not shown in non-interactive chat, so nothing proves the hook ran. This spec fixes both inside the committed hook, with no change by the user. It does not change the claim gate itself, the embargo rules or `src/core`.

## Glossary

- **Wrapper**: the POSIX sh script `scripts/run-claimgate.sh`.
- **Hook**: `.kiro/hooks/claim-gate-on-save.json`.
- **Gate command**: `node_modules/.bin/vite-node src/cli/claimgate.ts drafts`, run from the repo root.
- **Log**: `.kiro/hook-logs/claim-gate.log`.

## Requirements

### Requirement 1: Find node

**User Story:** As a maintainer, I want the hook to find node itself, so that it works under a clean PATH.

#### Acceptance Criteria

1. THE Wrapper SHALL look for node in this order and use the first hit: `command -v node` on the current PATH; `$NODE` if set and executable; `/usr/local/bin/node`; `/opt/homebrew/bin/node`; the globs `/home/*/.local/share/mise/installs/node/*/bin/node`, `/home/*/.nvm/versions/node/*/bin/node`, `/home/*/.volta/bin/node`, `$HOME/.local/share/mise/installs/node/*/bin/node`.
2. WHERE several files match one glob, THE Wrapper SHALL take the newest by version sort.
3. WHEN it has found node, THE Wrapper SHALL prepend the directory of that node to PATH.
4. IF no node is found, THEN THE Wrapper SHALL print the single line `claim gate: node not found` to stderr and exit with code 127.
5. THE Wrapper SHALL need no network.

### Requirement 2: Run the gate from the repo root

**User Story:** As a maintainer, I want the same gate result as before, so that the hook keeps its meaning.

#### Acceptance Criteria

1. THE Wrapper SHALL change to the parent directory of its own directory (the repo root) before it runs the Gate command.
2. THE Wrapper SHALL exit with the exit code of the Gate command.

### Requirement 3: Leave a trace

**User Story:** As a maintainer, I want a log of each run, so that I can prove the hook fired.

#### Acceptance Criteria

1. WHEN the Wrapper runs, THE Wrapper SHALL create `.kiro/hook-logs/` if missing and append to the Log a line with a UTC timestamp, followed by the stdout and stderr of the run.
2. THE Wrapper SHALL also pass the report to its own stdout and stderr.
3. THE `.gitignore` SHALL list `.kiro/hook-logs/`.

### Requirement 4: Hook definition

**User Story:** As a maintainer, I want the hook to stay the same except for its command, so that nothing else changes.

#### Acceptance Criteria

1. THE Hook SHALL keep its name, trigger `PostFileSave`, matcher and timeout unchanged.
2. THE Hook command SHALL be `sh scripts/run-claimgate.sh`.
3. THE Wrapper SHALL be committed with the executable bit set.

### Requirement 5: Maintainer proof

**User Story:** As a maintainer, I want to see the unmodified committed hook fire in a real run, so that I trust it.

#### Acceptance Criteria

1. WHEN Kiro writes `drafts/probe-claims.json` in a `kiro-cli chat --v3 --no-interactive` run, THE Hook SHALL fire and add a new entry to the Log.
2. WHEN Kiro writes a non-matching file such as `notes/other.txt` in that run, THE Hook SHALL NOT fire and the Log SHALL get no new entry.
