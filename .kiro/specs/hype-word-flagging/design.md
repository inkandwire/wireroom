# Design Document: Hype Word Flagging Feature

## Overview

The hype word flagging feature provides non-blocking stylistic guidance to help founders write more credible wire items. The system detects predetermined hype adjectives ("revolutionary", "groundbreaking", etc.) in claim text and displays informational warnings on the compose form, aligned with AP-style wire discipline.

**Key design principle:** Warnings are purely informational. They never prevent release, never affect wire output text, never hold an embargo, and never interfere with the claim gate or embargo clock. The same draft always produces byte-identical wire text regardless of hype word presence.

### Core responsibility separation

- **Pure core (`src/core/hype.ts`)**: Hype word detection algorithm, reference list, data structures
- **UI (`src/ui/form.ts`)**: Display warnings, link to claim fields, re-computation on edit
- **Compose workflow (`src/core/compose.ts`)**: Unmodified; hype warnings are orthogonal to gate/embargo logic

---

## Architecture

### System diagram

```
Draft (headline, body, claims[], priority, embargo, city, now)
  │
  ├─→ checkClaims() [existing claim gate]
  │    └─→ ClaimFailure[] (blocking)
  │
  ├─→ detectHypeWords() [new]
  │    └─→ HypeWarnings (non-blocking, UI-only)
  │
  ├─→ isReleased() [existing embargo]
  │    └─→ HELD | RELEASED
  │
  └─→ composeWireItem()
       └─→ WireItem (text output: byte-identical regardless of hype)

UI Layer:
  ├─→ Render claim inputs
  ├─→ Display HypeWarnings (if non-empty)
  │    └─→ Links to failing claim fields
  ├─→ Enable Print button always (non-blocking)
  └─→ Re-compute HypeWarnings on any draft change
```

### Data flow

1. **Composition phase**: User types headline, body, claims, embargo time
2. **Detection phase**: On each keystroke or claim edit, UI calls `detectHypeWords(draft)` to recompute warnings
3. **Warning display**: UI renders `HypeWarnings` collection as non-blocking alerts, or hides if empty
4. **Release phase**: Print button is always enabled. `composeWireItem()` runs gate check, embargo check, and formatting—hype warnings do not enter this path
5. **Output**: Wire text is byte-identical whether hype words are present or not

---

## Components and Interfaces

### 1. Core Types and Structures

**File: `src/core/hype.ts` (new)**

```typescript
// Reference list of hype words (lowercased)
export const HYPE_WORDS: readonly string[] = [
  "revolutionary",
  "groundbreaking",
  "game-changing",
  "world-class",
  "cutting-edge",
  "unprecedented",
  "disruptive",
  "paradigm-shifting",
  "transformative",
  "next-generation",
  "bleeding-edge",
  "industry-leading",
];

/**
 * A single detected hype word instance within a claim.
 * - start: 0-indexed character offset in the claim text
 * - text: the matched text as it appears (preserves case from input)
 * - word: the canonical lowercase word from HYPE_WORDS
 */
export interface HypeMatch {
  start: number;
  text: string;
  word: string;
}

/**
 * Warning for one claim containing hype words.
 * - claimIndex: 0-indexed position in draft.claims[]
 * - claimText: the full text of the claim (for reference)
 * - matches: array of HypeMatch objects (one per hype word instance)
 */
export interface HypeWarning {
  claimIndex: number;
  claimText: string;
  matches: HypeMatch[];
}

/**
 * Collection of all hype warnings for a draft.
 * Empty array = no hype words detected.
 */
export type HypeWarnings = HypeWarning[];
```

### 2. Core Algorithm

**File: `src/core/hype.ts` (continued)**

```typescript
/**
 * Detect hype words in claim text using case-insensitive matching
 * with strict word boundaries.
 *
 * Returns all detected hype word instances in order of appearance.
 * Word boundaries: a hype word matches only when surrounded by
 * non-alphanumeric characters or string boundaries.
 *
 * Pure function: deterministic output for identical input.
 * No DOM access, clock reads, network calls, or randomness.
 */
export function detectHypeInClaim(claimText: string): HypeMatch[] {
  const matches: HypeMatch[] = [];
  const lowerText = claimText.toLowerCase();

  for (const word of HYPE_WORDS) {
    // Find all occurrences of the word with strict boundaries
    let searchStart = 0;
    while (true) {
      const pos = lowerText.indexOf(word, searchStart);
      if (pos === -1) break;

      // Check left boundary: must be start of string or non-alphanumeric
      const beforeOk =
        pos === 0 || !/[a-z0-9]/i.test(lowerText[pos - 1]);

      // Check right boundary: must be end of string or non-alphanumeric
      const afterPos = pos + word.length;
      const afterOk =
        afterPos === lowerText.length || !/[a-z0-9]/i.test(lowerText[afterPos]);

      if (beforeOk && afterOk) {
        // Extract the actual matched text from the original (preserves case)
        const matchedText = claimText.slice(pos, afterPos);
        matches.push({ start: pos, text: matchedText, word });
      }

      searchStart = pos + 1;
    }
  }

  // Sort by position to ensure deterministic output
  matches.sort((a, b) => a.start - b.start);

  return matches;
}

/**
 * Analyze all claims in a draft and return hype warnings.
 * Pure function: same input always produces identical output.
 * Returns empty array if no hype words are detected.
 */
export function detectHypeWords(draft: Readonly<Draft>): HypeWarnings {
  const warnings: HypeWarning[] = [];

  for (let i = 0; i < draft.claims.length; i++) {
    const claim = draft.claims[i];
    const matches = detectHypeInClaim(claim.text);

    if (matches.length > 0) {
      warnings.push({
        claimIndex: i,
        claimText: claim.text,
        matches,
      });
    }
  }

  return warnings;
}
```

### 3. Algorithm pseudocode

```
FUNCTION detectHypeInClaim(claimText):
  INPUT: claimText (string)
  OUTPUT: HypeMatch[] (sorted by position)

  matches ← []
  lowerText ← claimText.toLowerCase()

  FOR EACH word IN HYPE_WORDS:
    searchStart ← 0
    LOOP:
      pos ← find word in lowerText starting at searchStart
      IF pos == -1:
        BREAK
      
      beforeOk ← (pos == 0) OR (char[pos-1] is non-alphanumeric)
      afterOk ← (pos+len(word) == len(lowerText)) OR 
                (char[pos+len(word)] is non-alphanumeric)
      
      IF beforeOk AND afterOk:
        add HypeMatch{start: pos, text: claimText[pos:pos+len(word)], word}
      
      searchStart ← pos + 1
  
  SORT matches BY start position
  RETURN matches

FUNCTION detectHypeWords(draft):
  INPUT: draft (object with claims[])
  OUTPUT: HypeWarning[]

  warnings ← []
  
  FOR i FROM 0 TO len(draft.claims)-1:
    claim ← draft.claims[i]
    matches ← detectHypeInClaim(claim.text)
    
    IF len(matches) > 0:
      add HypeWarning{claimIndex: i, claimText: claim.text, matches}
  
  RETURN warnings
```

### 4. Integration with Draft Model

The `Draft` type (in `src/core/types.ts`) remains unchanged. No schema modifications are needed.

```typescript
// Existing Draft interface
export interface Draft {
  headline: string;
  body: string;
  claims: Claim[];  // ← detectHypeWords operates on this array
  priority: Priority;
  embargo?: string;
  city: string;
  now: string;
}

// Hype warnings are computed fresh, never cached or persisted
// They are passed directly to the UI layer
```

### 5. UI Integration

**File: `src/ui/form.ts` (modifications)**

```typescript
// Import hype detection
import { detectHypeWords, type HypeWarnings } from "../core/hype";
import type { Draft } from "../core/types";

// Add HypeWarnings to form state (alongside existing ClaimFailure state)
interface FormState {
  draft: Draft;
  claimFailures: ClaimFailure[];
  hypeWarnings: HypeWarnings;  // NEW
}

// On every draft change (input, edit, add claim):
function updateDraft(newDraft: Draft): void {
  const claimFailures = checkClaims(newDraft.claims);
  const hypeWarnings = detectHypeWords(newDraft);  // NEW
  
  state = { draft: newDraft, claimFailures, hypeWarnings };
  render();
}

// Render hype warnings panel (if non-empty)
function renderHypeWarnings(warnings: HypeWarnings): string {
  if (warnings.length === 0) return "";  // Hide panel
  
  const lines = warnings.map((w) => {
    const wordList = [...new Set(w.matches.map((m) => m.word))]
      .map((w) => `'${w}'`)
      .join(", ");
    return `<a href="#claim-${w.claimIndex}">Claim ${w.claimIndex} contains hype: ${wordList}</a>`;
  });
  
  return `
    <div id="hype-warnings" class="field" role="region" aria-label="Hype word warnings">
      ${lines.join("<br>")}
    </div>
  `;
}

// Print button always enabled (no conditional disable based on hype warnings)
function renderPrintButton(): string {
  return `<button id="print-btn" class="btn" type="button">Print</button>`;
  // NOT: disabled={state.hypeWarnings.length > 0}
}
```

### 6. Warning message format

For each claim with hype words, display a message like:

```
Claim 0 contains hype: 'revolutionary', 'game-changing'
```

The message:
- Uses 0-indexed claim numbering
- Lists distinct hype words in order of appearance
- Provides a clickable link to the claim field
- Does not block any action

---

## Data Models

### HypeMatch (single detection)

| Field | Type | Purpose |
|-------|------|---------|
| `start` | number | 0-indexed character offset in claim text |
| `text` | string | Matched text as it appears (case-preserved) |
| `word` | string | Canonical lowercase word from HYPE_WORDS |

### HypeWarning (per claim)

| Field | Type | Purpose |
|-------|------|---------|
| `claimIndex` | number | 0-indexed position in draft.claims[] |
| `claimText` | string | Full text of the claim (for reference/context) |
| `matches` | HypeMatch[] | All hype word instances found |

### HypeWarnings (collection)

```typescript
type HypeWarnings = HypeWarning[];
```

Empty array indicates no hype words detected.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Determinism

*For any* claim text (1–1000 characters of UTF-8), analyzing it multiple times with `detectHypeInClaim` SHALL produce byte-identical HypeMatch arrays every time.

**Validates: Requirements 1.6, 5.2, 9.1**

**Rationale:** Pure functions have no internal mutable state. The same input must always produce identical output, including match positions, matched text, and word values. Property-based testing generates random claim text variants and verifies this holds across 100+ iterations.

### Property 2: Idempotence

*For any* draft, calling `detectHypeWords(draft)` twice without modifying the draft or HYPE_WORDS list SHALL return structurally identical HypeWarnings both times, including identical match positions and claim indices.

**Validates: Requirements 5.2, 9.2**

**Rationale:** The detector has no cache, mutable state, or side effects. Two successive calls on the same input must return equal results. This ensures the detector is truly pure and can be called repeatedly during UI re-renders without fear of divergence.

### Property 3: Output Integrity

*For any* draft containing hype words, composing it to wire text AND composing an identical draft with those exact hype words removed from all claim text, using the same clock input, SHALL produce byte-identical wire text outputs (identical line endings, column wraps, character counts, and `-30-` terminator).

**Validates: Requirements 3.4, 8.1, 8.2, 9.3**

**Rationale:** Hype warnings must not affect the formatted output. The wire text formatter operates only on draft content, not on warnings. This property ensures that release output is identical whether or not hype words are present, satisfying the "non-blocking" principle.

### Property 4: Reference List Stability

*For any* claim text, the set of detected hype words returned by `detectHypeInClaim` SHALL depend only on the current value of HYPE_WORDS and not on any prior call history or external state. If HYPE_WORDS is modified, subsequent calls SHALL detect matches for the new list.

**Validates: Requirements 2.3, 9.4**

**Rationale:** The detector function must have no hidden dependencies or caches. All state comes from the input draft and the HYPE_WORDS constant. This property verifies that changing HYPE_WORDS immediately affects detection results.

### Property 5: Word Boundary Correctness

*For any* claim text containing variations like `"prerevolutionary"` or `"revolutionaryism"`, the detector SHALL NOT match the hype word as a standalone word. Matches MUST have non-alphanumeric characters or string boundaries on both sides.

**Validates: Requirements 1.2**

**Rationale:** Word boundary detection is critical for avoiding false positives. Property-based testing generates claim text with hyphens, punctuation, spaces, and embedded hype words to verify boundaries are enforced correctly.

### Property 6: Completeness

*For any* claim text, if a hype word from HYPE_WORDS appears N times (case-insensitive), the detector SHALL report all N occurrences with their exact character positions. The count of reported positions SHALL equal the count of case-insensitive matches.

**Validates: Requirements 1.1, 1.3, 9.6**

**Rationale:** Missing detections are silent failures. This property ensures all hype word instances are found and reported, preventing silent gaps in the warning system.

### Property 7: Case-Insensitive Matching

*For any* claim text where a hype word appears in different cases (e.g., `"Revolutionary"`, `"revolutionary"`, `"REVOLUTIONARY"`), the detector SHALL match all variants and report the same start position and canonical lowercase word value, but preserve the original case in the `text` field.

**Validates: Requirements 1.1**

**Rationale:** AP style is case-insensitive for hype adjectives, but the UI should show what the user actually typed. This property verifies both the matching logic (case-insensitive) and the preservation of original case in the match record.

### Property 8: Deterministic Wire Output

*For any* 100+ draft variants generated with varying claim content and hype word presence, composing each to wire text AND verifying that no hype word presence or absence causes a RELEASED item's wire text to differ beyond actual claim content differences, the wire formatter SHALL produce output identical to the same draft without hype words.

**Validates: Requirements 3.4, 8.1, 8.4, 9.7**

**Rationale:** This meta-property tests the entire compose workflow end-to-end with generated drafts. It verifies that hype detection does not leak into wire formatting or affect release behavior. Fast-check generates 100+ drafts with varying claim texts and embargo times; each is composed and outputs are compared.

---

## Error Handling

### Edge cases and behavior

| Scenario | Handling | Rationale |
|----------|----------|-----------|
| Empty claim text | Return `[]` (no matches) | No hype words to detect; normal case |
| Empty HYPE_WORDS list | Return `[]` for all claims | Still deterministic; feature can be disabled |
| Claim with only punctuation | Return `[]` | Hype words are alphanumeric; punctuation boundaries are handled |
| Unicode/emoji in claim | Process as UTF-8; treat as non-alphanumeric for boundaries | Consistent with wrap and format logic |
| Draft with no claims | Return `[]` | No warnings to generate |
| Null/undefined claim text | Reject with error (type safety) | TypeScript types prevent this; defensive if used loosely |
| HTML/XML tags in claim | Treated as literal text; `<` and `>` are boundaries | No HTML processing; claims are plain text |
| Very long claim (10,000+ chars) | Process normally; no truncation | Algorithm is O(n); performance acceptable |

### Validation

- **Input validation**: Handled by TypeScript type system; `detectHypeWords` expects `Draft` with `claims: Claim[]`
- **Output validation**: HypeMatch positions are always valid (0-indexed within claim text bounds); guaranteed by algorithm
- **Boundary conditions**: Algorithm handles empty strings, single characters, and end-of-string correctly

---

## Testing Strategy

### Unit tests (example-based)

1. **Basic detection**: Claim with single hype word → correct position and text
2. **Multiple words**: Claim with "revolutionary" and "game-changing" → both detected in order
3. **Case variations**: `"Revolutionary"`, `"REVOLUTIONARY"`, `"revolutionary"` → all matched
4. **Word boundaries**: `"prerevolutionary"` and `"revolutionaryism"` → NOT matched
5. **Empty claim**: Empty string → no matches
6. **No hype**: Claim with no hype words → empty match list
7. **Punctuation boundaries**: `"revolutionary!"`, `"(revolutionary)"`, `"revolutionary,"` → all matched
8. **Escaped/literal**: URLs, code snippets → treated as plain text, boundaries apply

### Property-based tests (100+ iterations each)

**Property 1: Determinism**
```typescript
fc.property(
  fc.string({ minLength: 1, maxLength: 1000 }),
  (claimText) => {
    const result1 = detectHypeInClaim(claimText);
    const result2 = detectHypeInClaim(claimText);
    return JSON.stringify(result1) === JSON.stringify(result2);
  }
);
// Feature: hype-word-flagging, Property 1: Determinism
```

**Property 2: Idempotence**
```typescript
fc.property(
  fastCheckDraftGenerator,
  (draft) => {
    const warnings1 = detectHypeWords(draft);
    const warnings2 = detectHypeWords(draft);
    return JSON.stringify(warnings1) === JSON.stringify(warnings2);
  }
);
// Feature: hype-word-flagging, Property 2: Idempotence
```

**Property 3: Output Integrity**
```typescript
fc.property(
  fastCheckDraftGenerator,
  (draft) => {
    const result1 = composeWireItem(draft);
    if (result1.status !== "RELEASED") return true; // Skip non-released
    
    // Remove hype words from all claims
    const draftNoHype = {
      ...draft,
      claims: draft.claims.map((c) => ({
        ...c,
        text: removeHypeWords(c.text),
      })),
    };
    
    const result2 = composeWireItem(draftNoHype);
    if (result2.status !== "RELEASED") return false; // Should still release
    
    // Compare outputs (ignoring claim content differences)
    return result1.item.text === result2.item.text ||
           onlyClaimContentDiffers(result1.item, result2.item);
  }
);
// Feature: hype-word-flagging, Property 3: Output Integrity
```

**Property 4: Word Boundary Correctness**
```typescript
fc.property(
  fc.string({ minLength: 1, maxLength: 200 }),
  (prefix) => {
    const withBoundary = `${prefix} revolutionary `;
    const withoutBoundary1 = `${prefix}prerevolutionary`;
    const withoutBoundary2 = `${prefix}revolutionaryism`;
    
    const r1 = detectHypeInClaim(withBoundary);
    const r2 = detectHypeInClaim(withoutBoundary1);
    const r3 = detectHypeInClaim(withoutBoundary2);
    
    return r1.length > 0 && r2.length === 0 && r3.length === 0;
  }
);
// Feature: hype-word-flagging, Property 5: Word Boundary Correctness
```

**Property 5: Completeness**
```typescript
fc.property(
  fc.string({ minLength: 1, maxLength: 500 }),
  (text) => {
    const matches = detectHypeInClaim(text);
    const lowerText = text.toLowerCase();
    
    // Count all actual occurrences
    let totalCount = 0;
    for (const word of HYPE_WORDS) {
      let pos = 0;
      while ((pos = lowerText.indexOf(word, pos)) !== -1) {
        const before = pos === 0 || !/[a-z0-9]/i.test(lowerText[pos - 1]);
        const after = pos + word.length === lowerText.length ||
                      !/[a-z0-9]/i.test(lowerText[pos + word.length]);
        if (before && after) totalCount++;
        pos++;
      }
    }
    
    return matches.length === totalCount;
  }
);
// Feature: hype-word-flagging, Property 6: Completeness
```

### Integration tests

1. **Draft to compose workflow**: Create a draft with claims containing hype words, call `composeWireItem`, verify release succeeds and output is unchanged
2. **UI re-render**: Edit a claim to remove hype words, verify warnings update immediately
3. **Feed generation**: Release an item with hype words, verify feed entry contains same text (no warning markers)
4. **Claim gate independence**: Draft fails gate (missing source), verify hype warnings are still computed separately

### Performance tests

- Claim text up to 10,000 characters: `detectHypeInClaim` completes in <10ms
- 100 claims in a draft: `detectHypeWords` completes in <50ms
- No memory leaks: repeated calls do not accumulate state

---

## Output Determinism

The wire text output is byte-identical for identical clock and embargo inputs, regardless of hype word presence.

**Proof sketch:**
1. `composeWireItem(draft)` calls `checkClaims()` (gate) → same result for any draft
2. Then `isReleased()` (embargo) → deterministic based on `now` and `embargo` timestamps
3. Then `wrapText()` → deterministic formatting with fixed 69-column wrap
4. Wire output contains only: slug, priority, dateline, wrapped text, sources footer, end marker
5. `detectHypeWords()` is not called in `composeWireItem()`; it is called only in the UI layer
6. Therefore: wire text is byte-identical whether hype words are present or not

---

## Security and Privacy

### Threat model

- **Input injection**: Hype word list is hardcoded and immutable; cannot be modified at runtime without code changes
- **Claim text processing**: No parsing, interpretation, or code execution; claims are treated as plain text
- **Output leakage**: Warnings are UI-only; never included in wire text, feeds, or external output
- **Performance attacks**: Algorithm is O(n × m) where n = claim text length and m = hype word list size (12 words); acceptable for interactive use

### Privacy

- No hype data is logged, stored, or sent to external services
- Warnings are computed fresh on each draft change; not cached
- Feed generation does not include hype warnings
- Static hosting with no backend or analytics

---

## Performance Considerations

### Time complexity

- `detectHypeInClaim()`: O(n × m) where n = claim length, m = hype word list size
  - For n = 1000 chars and m = 12 words: ~12 substring searches, each O(n) worst case
  - Typical: <1ms per claim
- `detectHypeWords()`: O(k × n × m) where k = number of claims
  - For k = 10 claims, n = 1000 chars, m = 12: ~120 substring searches total
  - Typical: <10ms per draft

### Space complexity

- `HypeMatch[]`: O(m) per claim (at most one match per hype word)
- `HypeWarning[]`: O(k) warnings (at most one per claim)
- Total: O(k × m) storage

### Optimization opportunities (future)

- Use a regex or trie for multi-word prefix matching
- Cache HYPE_WORDS indices (pre-compile boundaries)
- Lazy evaluation: detect only when UI re-renders, not on every keystroke
- Batch detection: defer until user pauses typing (500ms debounce)

---

## UI Display and Interaction

### Warning panel layout

```
┌─ HYP WARNINGS ─────────────────────────────────────┐
│                                                    │
│ > Claim 0 contains hype: 'revolutionary'           │
│ > Claim 2 contains hype: 'game-changing',          │
│                           'groundbreaking'         │
│                                                    │
└────────────────────────────────────────────────────┘
```

- Displayed on `--field` background (`#F8F3E3`)
- Text in `--ink` color (`#1B1915`)
- Each warning is a clickable link
- Clicking a link focuses the corresponding claim input field
- Panel is hidden/empty if no warnings

### States

1. **No hype words detected**: Warning panel is hidden; Print button fully enabled
2. **Hype words detected**: Warning panel is visible; Print button still fully enabled
3. **User edits claim**: On keystroke, re-compute warnings immediately; panel updates
4. **User removes hype word**: On next keystroke, warning for that claim disappears
5. **User dismisses panel**: No dismiss button; panel auto-hides when warnings empty

### Accessibility

- Warning panel has `role="region"` and `aria-label="Hype word warnings"`
- Each warning is a focusable link (`<a>`) with descriptive text
- Screen reader announces: "Claim 0 contains hype: revolutionary"
- Tab order includes warning links
- Focus ring is 3px `--amber` per design tokens

---

## Implementation Order

### Phase 1: Core algorithm (foundation)

1. Create `src/core/hype.ts` with:
   - `HYPE_WORDS` constant
   - `HypeMatch` interface
   - `HypeWarning` interface
   - `detectHypeInClaim()` function
   - `detectHypeWords()` function

2. Write unit tests (`src/core/hype.test.ts`):
   - Basic detection cases
   - Boundary conditions
   - Edge cases (empty, punctuation, case)

3. Write property tests (`src/core/hype.prop.test.ts`):
   - Determinism, idempotence, completeness, boundaries

### Phase 2: UI integration

1. Modify `src/ui/form.ts`:
   - Import `detectHypeWords`
   - Add `hypeWarnings` to form state
   - Call `detectHypeWords()` on each draft change
   - Render warning panel only if warnings non-empty

2. Add CSS for warning panel:
   - Use design tokens for colors, spacing, radius
   - Match rejection notice styling (same `--field` background)

3. Add integration test (`tests/hypeIntegration.test.ts`):
   - Create draft with hype words
   - Render form
   - Verify warnings display and link to claim fields

### Phase 3: Wire output verification

1. Add property test in `src/core/feed.prop.test.ts`:
   - Generate drafts with and without hype words
   - Compose both to wire text
   - Verify byte-identical output

2. Integration test:
   - Release draft with hype words
   - Verify feed entry text is unchanged

### Phase 4: Polish and accessibility

1. Keyboard navigation tests
2. Screen reader testing (manual)
3. Performance profiling
4. Documentation (comments, README update)

---

## Dependency Diagram

```
src/core/hype.ts (pure, no dependencies except types)
  │
  ├─→ src/core/types.ts (Draft, Claim interfaces)
  └─→ no DOM, clock, network, randomness
  
src/ui/form.ts (UI layer)
  ├─→ src/core/hype.ts (detectHypeWords)
  ├─→ src/core/claimGate.ts (checkClaims - existing)
  └─→ src/ui/tokens.css (design tokens)

src/core/compose.ts (existing, unchanged)
  └─→ NOT affected by hype detection

src/core/feed.ts (existing, unchanged)
  └─→ NOT affected by hype detection
```

### No breaking changes

- `Draft` interface unchanged
- `ComposeResult` unchanged
- `WireItem` unchanged
- `claimGate` logic unchanged
- `embargo` logic unchanged
- Wire text output unchanged
- Feed generation unchanged

---

## Examples

### Example 1: Single hype word in claim

```typescript
const claim = "The app is revolutionary and saves time";
const matches = detectHypeInClaim(claim);
// Result:
// [
//   {
//     start: 16,
//     text: "revolutionary",
//     word: "revolutionary"
//   }
// ]
```

### Example 2: Multiple hype words in one claim

```typescript
const claim = "Revolutionary and groundbreaking product";
const matches = detectHypeInClaim(claim);
// Result:
// [
//   { start: 0, text: "Revolutionary", word: "revolutionary" },
//   { start: 18, text: "groundbreaking", word: "groundbreaking" }
// ]
```

### Example 3: Word boundary handling

```typescript
const cases = [
  { text: "revolutionary", shouldMatch: true },      // ✓
  { text: "pre-revolutionary", shouldMatch: true },  // ✓ (hyphen is boundary)
  { text: "prerevolutionary", shouldMatch: false },  // ✗ (no boundary)
  { text: "REVOLUTIONARY!", shouldMatch: true },     // ✓ (! is boundary)
  { text: "revolutionaryism", shouldMatch: false },  // ✗ (no boundary)
];
```

### Example 4: Draft with hype warnings

```typescript
const draft: Draft = {
  headline: "Acme Launches Revolutionary Product",
  body: "This groundbreaking tool changes everything.",
  claims: [
    { text: "The app processes 1000 requests per second", sourceUrl: "..." },
    { text: "Revolutionary UI saves 30% of development time", sourceUrl: "..." }
  ],
  priority: "BULLETIN",
  city: "Austin",
  embargo: undefined,
  now: "2024-01-15T10:00:00Z"
};

const warnings = detectHypeWords(draft);
// Result:
// [
//   {
//     claimIndex: 1,
//     claimText: "Revolutionary UI saves 30% of development time",
//     matches: [
//       { start: 0, text: "Revolutionary", word: "revolutionary" }
//     ]
//   }
// ]
```

### Example 5: UI display

```
┌─ HYP WARNINGS ─────────────────────────────────────┐
│                                                    │
│ > Claim 1 contains hype: 'revolutionary'           │
│                                                    │
│ PRINT                                              │
│                                                    │
└────────────────────────────────────────────────────┘
```

The Print button is fully enabled. Clicking the warning link focuses `#claim-1-text`.

---

## Notes and Decisions

### Decision: Non-blocking by design

Hype warnings are **never** blocking. The Print button is always enabled because:
1. User may intentionally use a hype word for voice/brand reasons
2. Warnings are guidance, not rules
3. Separates stylistic guidance from correctness (claim gate)
4. Aligned with the "resurrection" theme: the machine assists but does not prevent

### Decision: No caching of warnings

Warnings are recomputed on every draft change because:
1. Draft is small (< 10KB typically)
2. Detection is fast (< 10ms)
3. No risk of stale warnings
4. Simpler code (no cache invalidation logic)

### Decision: Word list is hardcoded

`HYPE_WORDS` is a constant, not configurable, because:
1. Product rule: "no revolutionary, groundbreaking, game-changing, etc."
2. Consistency across all users and deployments
3. Prevents ads/marketing attacks (cannot add words to avoid detection)
4. Static hosting with no backend

### Decision: Warnings do not affect feeds

Feed entries do not include hype warnings because:
1. Wire text is the source of truth
2. Readers should see clean output (warnings are for the author)
3. Feeds are static files; no per-reader customization

### Decision: Pure function with no time parameter

`detectHypeWords()` takes no clock input because:
1. Hype detection is not time-dependent
2. Simplifies testing and composition
3. Mirrors `checkClaims()` pattern (time-agnostic gate)

---

## Verification Checklist

- [ ] `HYPE_WORDS` is hardcoded and exported from `src/core/hype.ts`
- [ ] `detectHypeInClaim()` uses strict word boundaries (non-alphanumeric on both sides)
- [ ] `detectHypeInClaim()` is case-insensitive but preserves original case in output
- [ ] `detectHypeWords()` returns empty array if no claims or no hype detected
- [ ] HypeWarnings are computed fresh on each call (no cache)
- [ ] `composeWireItem()` is unchanged; hype detection does not enter the compose path
- [ ] Wire text is byte-identical for identical input regardless of hype words
- [ ] Print button is always enabled (never disabled by hype warnings)
- [ ] UI warning panel provides clickable links to claim fields
- [ ] Property tests verify determinism, idempotence, completeness, and output integrity
- [ ] All unit and property tests pass
- [ ] Feed generation does not include warning markers
- [ ] Embargo clock is unaffected by hype warnings

