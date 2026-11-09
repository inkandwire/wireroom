---
inclusion: always
---

# WireRoom: Tech

## Stack

- TypeScript (strict mode).
- Vite static web app.
- WebAudio for the teletype typing sound (no audio files needed, synthesize it).
- vitest for tests, fast-check for property-based tests.

## Pure core

All logic lives in `src/core` and is pure and framework-free:

- No DOM access.
- No clock reads: never call `Date.now()`, `new Date()` with no arguments, or `performance.now()`. Time is always passed in as an argument.
- No network access (`fetch`, `XMLHttpRequest`, etc.).
- No randomness unless a seed is passed in.
- No imports from `src/ui` or `src/feeds`.

The UI and feed writers call into the core and supply the time.

## Deterministic output

The same draft and the same clock input must give byte-identical wire text. Use `\n` line endings, fixed ordering, and no locale-dependent formatting (do not use `toLocaleString` or `Intl` defaults). Test this with fast-check.

## Teletype format

Wire lines are at most 69 columns. Wrap text at word boundaries and never emit a longer line. Property tests should check that no line exceeds 69 columns and that every item ends with `-30-`.

## Static hosting

- The app must work as plain static files (`vite build` into `dist/`).
- No server, no server-side rendering, no runtime backend calls.
- Use relative asset paths so it works under any base path (for example GitHub Pages).
- RSS and JSON feeds are generated as static files from released items.
- No API keys and no secrets in the repo.

## Running tests

```
npm test
```

This runs vitest once (non-watch). Run it after every change to `src/core` or `src/feeds`.
