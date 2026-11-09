# drafts

Sample WireRoom drafts as JSON, each with a `claims` list of `{ text, sourceUrl }`.
Saving a file here (or a file in `src/core`) fires the `claim-gate-on-save` Kiro hook.
The hook runs the claim gate and lists every claim that has no valid source URL.
`launch-note.json` is left with one unsourced claim on purpose, so the hook has something to report.
Add a `sourceUrl` to that claim and the gate passes.
