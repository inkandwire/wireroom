# Design: mcp-source-lookup

## Overview

Kiro gets one extra tool, `fetch`, from the official MCP fetch server. A steering file tells Kiro when and how to use it. Nothing in `src/` changes. The claim gate still only checks that a URL is present; this feature checks reachability at authoring time only.

## Files

```
.kiro/settings/mcp.json        one server, "fetch"
.kiro/steering/source-check.md fileMatch steering for drafts/*.json
README.md                      note, at most 5 lines
```

## mcp.json

```json
{
  "mcpServers": {
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"]
    }
  }
}
```

No `env`, no secrets, no paid service. The package is on PyPI and free. The absolute path is machine specific; another machine edits `command`.

## source-check.md

Front matter: `inclusion: fileMatch`, `fileMatchPattern: "drafts/*.json"`. It is loaded only when a draft is in context. Rules it states:

- Collect the distinct `sourceUrl` values of all claims in the draft.
- Call `fetch` once per distinct URL with `url` and `max_length: 200`.
- End the answer with a short list: `<url>: RESOLVES` or `<url>: DOES NOT RESOLVE (<error>)`.
- A claim with no `sourceUrl` is named as unsourced and is not fetched.
- `example.com` links count as resolving, as in the examples.
- Never edit a `sourceUrl`. Never make up a URL.

## Boundaries

- Core stays pure: no network from `src/core`. The app does no runtime fetch (`tech.md`).
- The check runs in Kiro, not in the app, so the app stays static and free.
- Result wording uses the same uppercase style as the wire priorities.

## Failure handling

- Server cannot start (no `uvx`, no network, headless trust): Kiro reports that it could not check and lists nothing as resolving.
- Fetch error: reported as DOES NOT RESOLVE with the error text.

## Proof

A real headless run writes `drafts/probe-sources.json` with `https://example.com/` and `https://example.invalid/missing`. Expected: first RESOLVES, second DOES NOT RESOLVE. If the server cannot start headless, README.md records that in one line.
