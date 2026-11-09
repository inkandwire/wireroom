# Requirements: mcp-source-lookup

## Introduction

The claim gate checks that a claim has a source URL, not that the URL resolves. This feature adds one Model Context Protocol server, the official `fetch` server, so Kiro can check each claim's source URL while it authors a draft in `drafts/` and say what it found. It is authoring help only. It does not change `src/`, the claim gate or the embargo rules, and it adds no runtime network call to the app.

## Requirements

### Requirement 1: One MCP server

**User Story:** As a founder, I want Kiro to be able to fetch a URL, so that it can check my sources.

1. THE file `.kiro/settings/mcp.json` SHALL define exactly one server, named `fetch`.
2. THE `fetch` server SHALL start with command `uvx` and args `["mcp-server-fetch"]`.
3. THE file SHALL contain no `env` key, no credential and no API key.

### Requirement 2: Check every source

**User Story:** As a founder, I want each source URL tested, so that I do not publish a dead link.

1. WHEN Kiro writes or edits a file matching `drafts/*.json`, THE steering file `.kiro/steering/source-check.md` SHALL make Kiro call the `fetch` tool once per distinct claim `sourceUrl`.
2. WHEN Kiro calls the `fetch` tool, THE call SHALL pass the URL as `url` and `max_length` of 200.
3. THE steering file SHALL have front matter `inclusion: fileMatch` and `fileMatchPattern: "drafts/*.json"`.

### Requirement 3: Report the result

**User Story:** As a founder, I want a plain list of results, so that I can fix a bad link.

1. WHEN Kiro has checked the URLs, THE answer SHALL end with a short list giving each URL as `RESOLVES` or `DOES NOT RESOLVE`.
2. IF a fetch fails, THEN THE list entry SHALL include the error text.
3. THE steering file SHALL state that a URL on `example.com` counts as resolving.

### Requirement 4: Never invent a source

**User Story:** As a founder, I want my sources left alone, so that no link is made up for me.

1. THE steering file SHALL forbid Kiro from editing a `sourceUrl` on its own.
2. THE steering file SHALL forbid Kiro from making up a URL.
3. WHEN a claim has no `sourceUrl`, THE answer SHALL name the claim as unsourced and SHALL NOT fetch anything for it.

### Requirement 5: Documented

**User Story:** As a maintainer, I want a short note, so that I can run it on my machine.

1. THE README SHALL have a note of at most 5 lines saying what the server does, that it needs `uvx` and network, and that the path in `mcp.json` is machine specific.
2. THE note SHALL give the non-interactive flag `--trust-tools=fs_read,fs_write,@fetch`.

### Requirement 6: Proof, not faked

**User Story:** As a maintainer, I want a real run as proof, so that the feature is known to work.

1. THE maintainer proof SHALL be a real `kiro-cli chat --v3 --no-interactive` run on kiro-b that writes `drafts/probe-sources.json` with two claims, `https://example.com/` and `https://example.invalid/missing`.
2. WHEN the proof run finishes, THE answer SHALL list the first URL as `RESOLVES` and the second as `DOES NOT RESOLVE`.
3. IF the server cannot start headless, THEN README.md SHALL record that in one line and the result SHALL NOT be faked.
