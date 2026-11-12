---
inclusion: fileMatch
fileMatchPattern: "drafts/*.json"
---

# WireRoom: Source check

When a draft in `drafts/` is in context, run the offline source checker and report its output. It reads the URL text only and makes no network call.

- Run `npm run sourcecheck` (or `node_modules/.bin/vite-node src/cli/claimgate.ts drafts`).
- Read the output. It has one line per claim: `<file>: claim N "<text>" STATUS`, then a summary line. Exit code 1 means at least one claim is not `OK`.
- Statuses: `OK`, `MISSING` (no URL), `MALFORMED` (unparseable, spaces, padding, or a host with no dot), `NOT_HTTPS` (any scheme other than https), `UNLISTED` (the draft has a `sources` array and the URL is not in it).
- Name every non-`OK` claim in the answer with its status, and say what is wrong in plain words.
- `OK` means the URL is well formed. It does not mean the link resolves, and say so if asked.
- Never edit a `sourceUrl`. Never make up a URL or suggest one. Never fetch a URL.
- The MCP `fetch` tool is optional, works in the IDE only, and is never required. Never run it headless or in a hook.
- This check does not change the claim gate (`checkClaims`) or the embargo clock.
