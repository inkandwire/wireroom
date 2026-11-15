# Requirements Document

## Introduction

WireRoom enforces AP-style wire discipline to help founders write credible news. The hype word flagging feature detects stylistically inappropriate adjectives in claims and alerts the user without blocking publication. This feature complements the existing claim gate (which requires sources) by providing non-blocking stylistic guidance aligned with the product rule: no "revolutionary", "groundbreaking", "game-changing" and the like.

WireRoom enforces AP-style wire discipline to help founders write credible news. The hype word flagging feature detects stylistically inappropriate adjectives in claims and alerts the user without blocking publication. This feature complements the existing claim gate (which requires sources) by providing non-blocking stylistic guidance aligned with the product rule: no "revolutionary", "groundbreaking", "game-changing" and the like.

Hype word warnings are informational only. They never prevent release, never affect wire output text, and never cause an item to be held. The same draft input always produces the same list of hype warnings, and the same draft and clock input always produce byte-identical wire text.

## Glossary

- **Hype_Word**: An adjective that violates AP-style wire discipline by exaggerating claims. Examples include "revolutionary", "groundbreaking", "game-changing", "world-class", "cutting-edge", "unprecedented".
- **Claim**: A factual assertion made by the user in the wire item body. Each claim occupies a full paragraph or sentence within the body text.
- **Hype_Warning**: A non-blocking alert indicating that one or more hype words were detected in a specific claim.
- **Claim_Text**: The textual content of a single claim that may contain one or more hype words.
- **Hype_Detector**: The pure function that identifies hype words within a claim text and returns their locations.
- **UI_Warning_Panel**: The visible alert region on the compose form that displays hype warnings to the user.

## Requirements

### Requirement 1: Hype Word Detection in Claims

**User Story:** As a founder writing a wire item, I want the system to identify hype words in my claims, so that I can revise them to sound more credible and professional.

#### Acceptance Criteria

1. THE Hype_Detector SHALL identify hype words from the list in claim text using case-insensitive matching: "revolutionary", "groundbreaking", "game-changing", "world-class", "cutting-edge", "unprecedented", "disruptive", "paradigm-shifting", "transformative", "next-generation", "bleeding-edge", "industry-leading".
2. THE Hype_Detector SHALL enforce strict word boundaries such that a hype word matches only when surrounded by non-alphanumeric characters or string boundaries (e.g., "revolutionary" matches as a standalone word, but "prerevolutionary" or "revolutionaryism" do not match).
3. WHEN a hype word is found in claim text, THE Hype_Detector SHALL return a structured match record containing: the character offset (0-indexed) of the match start within the claim text, the matched text as it appears in the claim, and the category of the hype word from the defined list.
4. THE Hype_Detector SHALL process multiple claims independently, such that matches in one claim do not affect detection results in another claim.
5. WHEN a Claim_Text contains no hype words from the defined list, THE Hype_Detector SHALL return an empty list.
6. THE Hype_Detector detection logic SHALL be pure and deterministic: identical input claim text SHALL always produce identical match records in the same order.

### Requirement 2: Hype Word Reference List

**User Story:** As a product owner, I want a defined and consistent list of hype words to enforce, so that the detection is predictable and aligned with wire discipline.

#### Acceptance Criteria

1. THE constant `HYPE_WORDS` SHALL be defined in `src/core/hype.ts` as an exported array of lowercase strings: `["revolutionary", "groundbreaking", "game-changing", "world-class", "cutting-edge", "unprecedented", "disruptive", "paradigm-shifting", "transformative", "next-generation", "bleeding-edge", "industry-leading"]`.
2. WHEN the Hype_Detector accesses the hype word list, THE System SHALL export `HYPE_WORDS` as a named export from `src/core/hype.ts` for use by detector modules.
3. IF the `HYPE_WORDS` list is modified, THEN the Hype_Detector SHALL immediately reflect the change on all subsequent calls without requiring modifications to other modules.
4. THE list entries SHALL contain only lowercase alphabetic characters and hyphens; each entry SHALL be a non-empty string.
5. WHERE the `HYPE_WORDS` list is empty, THE Hype_Detector SHALL return an empty list of detections and continue to function deterministically.

### Requirement 3: Non-Blocking Warning Behavior

**User Story:** As a founder, I want hype word warnings to be informational only, so that I am not blocked from publishing if I choose to keep the words.

#### Acceptance Criteria

1. IF hype word warnings are present for a draft, THEN THE System SHALL NOT disable the Print button or any other release control on the compose form.
2. WHEN a draft containing hype words is submitted to print or release, THE System SHALL execute the print or release action without throwing exceptions or returning error responses caused by hype warnings.
3. IF hype word warnings are present for a draft, THEN THE System SHALL NOT hold the draft in an embargoed state beyond the embargo time already set (embargo clock behavior is unaffected by hype warnings).
4. WHEN the same draft is formatted into wire text with hype words present versus with those hype words removed from the body and claims, THE wire text output SHALL be byte-identical, verified through exact byte-for-byte comparison of the complete text strings.
5. WHEN a draft with hype words is released and included in an RSS or JSON feed, THE feed entry text and metadata SHALL NOT include any hype word warnings or indications that hype words were detected.
6. WHEN testing draft release behavior with and without hype words, drafts with hype warnings SHALL complete their release action in the same logical time window (within the same embargo interval) as equivalent drafts without hype warnings.

### Requirement 4: Hype Warning Reporting

**User Story:** As a founder, I want clear, actionable warnings that tell me which claim contains hype and what words to fix, so that I can improve my copy.

#### Acceptance Criteria

1. WHEN a draft is composed with claims containing hype words, THE System SHALL generate a HypeWarning collection containing one entry per affected claim.
2. FOR each HypeWarning entry, THE System SHALL include: the claim index (0-indexed in draft order), the list of detected hype words, and the character position of each hype word instance within the claim text.
3. WHERE multiple instances of the same hype word appear in a single claim, THE System SHALL report each instance separately with its character position (for example, claim 2 contains "revolutionary" at positions 5 and 47).
4. WHEN a claim contains hype words from the reference list, THE HypeWarning message SHALL state: "Claim N contains hype: 'word1', 'word2'" (using plain language, exact hype word values, and the 0-indexed claim number).
5. WHEN multiple different hype words appear in a single claim, THE System SHALL list all distinct hype words in one HypeWarning entry for that claim, grouped by their order of appearance in the claim text.
6. WHEN a draft contains no hype words in any claim, THE System SHALL return an empty HypeWarning collection.
7. WHEN hype words are detected, THE System SHALL NOT prevent release, NOT modify the wire text output, and NOT hold the draft beyond any embargo time already set.
8. WHEN a UI_Warning_Panel displays hype warnings, each warning entry SHALL provide a clickable link to the corresponding claim input field; activating the link SHALL focus the field for editing.
9. WHEN a claim is edited and hype words are removed, the HypeWarning for that claim SHALL be removed from the collection on the next draft re-analysis (no cached warnings).
10. THE HypeWarning data structure SHALL be independent of the source check failures; a claim may appear in both collections simultaneously (hype warnings and missing/invalid source statuses are separate concerns).

### Requirement 5: Pure and Deterministic Core Logic

**User Story:** As a developer, I want the hype detection logic to be pure and deterministic, so that I can test it with property-based tests and integrate it without side effects.

#### Acceptance Criteria

1. THE Hype_Detector function SHALL be a pure function: no DOM access, no clock reads, no network calls, no randomness.
2. WHEN the same Claim_Text and clock input are provided multiple times, THE Hype_Detector SHALL return byte-identical results every time.
3. WHERE time-dependent logic is needed (for example, expiring the detection), time SHALL be passed in as an argument, never read from the system clock.
4. THE Hype_Detector SHALL use UTF-8 line endings (`\n`) and standard string operations that produce consistent output regardless of locale or system configuration.

### Requirement 6: Integration with Draft Model

**User Story:** As a developer, I want the hype warning system to integrate cleanly with the existing draft model, so that warnings are associated with the correct draft and claims.

#### Acceptance Criteria

1. WHEN a Draft is composed (body text plus claims are provided), THE System SHALL detect hype words in each Claim and return a HypeWarnings collection.
2. WHERE the Draft model already contains Claim structures with body text, THE Hype_Detector SHALL operate on this existing Claim structure without requiring schema changes.
3. WHEN a Draft is saved, the hype warnings SHALL be re-computed deterministically from the current Draft state (not cached or persisted).
4. WHEN a Draft is loaded from storage, the hype warnings SHALL be computed fresh from the stored Draft text (no warning state is persisted).

### Requirement 7: UI Warning Display (Non-Blocking)

**User Story:** As a founder, I want hype warnings displayed clearly on the compose form, so that I can see and address them before printing.

#### Acceptance Criteria

1. WHEN a draft contains hype words, THE UI_Warning_Panel SHALL display a visible alert that identifies the affected claims and the hype words found.
2. WHERE hype words are detected, THE warning SHALL NOT disable the Print button or any other controls.
3. WHEN a user clicks Print while hype warnings are visible, THE System SHALL print the draft without blocking, acknowledging that hype warnings are informational only.
4. WHEN a user dismisses or edits a claim to remove hype words, THE UI_Warning_Panel SHALL update immediately to reflect the new state (no hype warning for the corrected claim).
5. WHEN a draft has no hype words, THE UI_Warning_Panel SHALL be hidden or empty.

### Requirement 8: Output Text Determinism

**User Story:** As a developer, I want to ensure that the same draft and clock input always produce byte-identical wire text, regardless of hype word warnings.

#### Acceptance Criteria

1. WHEN a draft with hype words is formatted into wire text, THE output SHALL be byte-identical to the same draft without hype words (hype warnings do not alter formatting or line breaks).
2. WHEN the same draft is formatted multiple times, THE output SHALL be identical (line endings, column wrapping, and all formatting must match exactly).
3. THE wire text output SHALL never include hype word warnings or any indication that hype words were detected (warnings are UI-only, not part of wire output).
4. WHERE determinism is critical for property-based testing, THE wire text formatter SHALL use only deterministic operations: fixed-order processing, no locale-dependent formatting, UTF-8 line endings, and pre-determined column width (69 columns).

### Requirement 9: Property-Based Testing Correctness

**User Story:** As a developer, I want to verify that hype detection is consistent and never interferes with release, so that I can be confident in the feature's correctness.

#### Acceptance Criteria

1. WHEN a Claim_Text of 1 to 1000 characters is analyzed with the detector repeatedly (minimum 10 runs), THE detector SHALL return the same list of detected hype word positions in byte-identical representation on every run (determinism property: same input → identical byte-level output).
2. WHEN a Claim_Text is passed to the detector function twice without modifying the Claim_Text or the reference HYPE_WORDS list between calls, THE function SHALL return structurally identical results with the same hype word positions and character locations on both invocations (idempotence property: the pure function has no internal mutable state).
3. WHEN a Draft containing hype words is composed into wire text AND an identical Draft without the same hype words is composed into wire text AND both use the same clock input, THE two wire outputs SHALL be byte-identical including all line endings, column widths, line breaks, and character counts; hype warnings SHALL NOT affect wire formatting or output structure (output integrity property).
4. WHERE the reference HYPE_WORDS list in `src/core/hype.ts` is NOT modified between two detector runs on the same Claim_Text, THE detector SHALL return identical detected positions for all hype word instances; IF the HYPE_WORDS list is modified (by adding, removing, or changing words), the detector SHALL produce different results reflecting the new list (reference list stability property).
5. WHEN a property-based test generates a Claim_Text by selecting characters from the UTF-8 range [0-127] (ASCII, 1-1000 characters), THE hype detector SHALL produce deterministic, reproducible output that is independent of test execution order, system time, or environment variables.
6. IF a Claim_Text contains the same hype word multiple times (for example, "revolutionary" twice), THE detector SHALL report every occurrence with its exact character position; the count of reported positions SHALL equal the count of case-insensitive matches of hype words from the HYPE_WORDS list within the Claim_Text (completeness property).
7. WHEN a property-based test runs the complete compose workflow (from Draft to WireItem) using fast-check generators that create 100+ Draft variants with varying claim texts and hype word content, THE test SHALL verify that no hype word presence or absence causes a RELEASED item's wire text to differ from another RELEASED item's wire text beyond the actual claim content differences (deterministic wire output regardless of hype detection state).

