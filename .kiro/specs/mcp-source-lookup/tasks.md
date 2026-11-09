# Tasks: mcp-source-lookup

Note: the agent running a task cannot run shell commands. Each task only writes files, including its own tests. Do not add install or run steps. The maintainer does the proof below outside Kiro.

Rules for every task: do not change `src/`; add no dependency; no secrets, no `env` key, no other MCP server; do not edit any existing `sourceUrl`; follow `.kiro/steering/*.md` and `design.md`.

- [ ] 1. MCP fetch server, source-check steering and README note (`.kiro/settings/mcp.json`, `.kiro/steering/source-check.md`, `README.md`)
  - `.kiro/settings/mcp.json`: one server `fetch`, command `uvx`, args `["mcp-server-fetch"]`. Nothing else.
  - `.kiro/steering/source-check.md`: front matter `inclusion: fileMatch` and `fileMatchPattern: "drafts/*.json"`; rules as in design.md (one `fetch` call per distinct `sourceUrl` with `url` and `max_length` 200; end the answer with a RESOLVES / DOES NOT RESOLVE list with the error; unsourced claims named, not fetched; `example.com` counts as resolving; never edit a `sourceUrl`, never make one up).
  - `README.md`: add a note of at most 5 lines: what the server does, needs `uvx` and network, the path in `mcp.json` is machine specific, and the non-interactive flag `--trust-tools=fs_read,fs_write,@fetch`.
  - Maintainer proof (outside Kiro): run `kiro-cli chat --v3 --no-interactive --trust-tools=fs_read,fs_write,@fetch` on kiro-b, asking it to write `drafts/probe-sources.json` with two claims, `https://example.com/` and `https://example.invalid/missing`. Check that the answer lists the first as RESOLVES and the second as DOES NOT RESOLVE. If the MCP server cannot start headless, add one line saying so to README.md instead of faking the result.
  - Requirements: 1.1 to 1.3, 2.1 to 2.3, 3.1 to 3.3, 4.1 to 4.3, 5.1, 5.2, 6.1 to 6.3.
