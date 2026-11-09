---
inclusion: fileMatch
fileMatchPattern: "drafts/*.json"
---

# WireRoom: Source check

When a draft in `drafts/` is in context, check that its source links resolve, using the `fetch` tool from the MCP `fetch` server.

- Collect the distinct `sourceUrl` values of all claims in the draft.
- Call `fetch` once per distinct URL, with `url` set to that URL and `max_length` set to 200.
- End the answer with a short list, one line per URL: `<url>: RESOLVES` or `<url>: DOES NOT RESOLVE (<error>)`.
- A claim with no `sourceUrl` is named as unsourced in the answer and is not fetched.
- `example.com` links count as resolving, as in the examples.
- If the fetch server cannot start, say the check could not run and list no URL as resolving.
- Never edit a `sourceUrl`. Never make up a URL or suggest one.
- This check runs in Kiro only. It does not change the claim gate, which still only checks that a URL is present.
