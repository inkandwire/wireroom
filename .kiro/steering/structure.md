---
inclusion: always
---

# WireRoom: Structure

## Folder layout

```
src/
  core/    pure logic: draft model, claim gate, embargo, wire formatter
  ui/      browser UI: DOM, paper feed, WebAudio teletype sound
  feeds/   RSS and JSON writers (pure functions from released items to text)
tests/     cross-module and property tests (optional)
.kiro/
  specs/     Kiro specs (requirements, design, tasks)
  steering/  steering files (product.md, tech.md, structure.md)
  hooks/     Kiro hooks (JSON files)
```

Tests live next to the code (`src/core/claimGate.test.ts`) or in `tests/` when they cover more than one module.

## Dependency direction

`ui` and `feeds` may import from `core`. `core` imports from neither. `ui` and `feeds` do not import from each other.

## Naming rules

- Files and folders: `camelCase.ts` for modules, lowercase folder names.
- Test files: `<module>.test.ts`. Property tests may use `<module>.prop.test.ts`.
- Types and interfaces: `PascalCase`. Functions and variables: `camelCase`. Constants: `UPPER_SNAKE_CASE` (for example `MAX_COLUMNS = 69`).
- Priority levels are an uppercase string union: `FLASH`, `BULLETIN`, `URGENT`, and the routine level.
- Slug lines are uppercase and hyphenated, as in the wire style rules in `product.md`.
- Prefer named exports. No default exports.

## Where things go

- A new rule about wire text or claims goes in `src/core` with a test.
- Anything that touches the DOM, audio or `Date.now()` goes in `src/ui`, and it passes time into the core as an argument.
- A new output format goes in `src/feeds`.
- Specs go in `.kiro/specs/<feature-name>/`, steering in `.kiro/steering/`, hooks in `.kiro/hooks/`.
