---
inclusion: always
---

# WireRoom: Product

## Purpose

WireRoom is the 1970s newswire teletype, brought back from the dead as a launch wire for founders. The founder types their news and it prints in wire style: a slug line, a priority line (FLASH / BULLETIN / URGENT, plus a routine level), a dateline, paper feed, and a typing sound.

Output goes to static RSS and JSON feeds. Email comes later.

## Audience

Small founders who cannot write a credible release. They have real news (a launch, a milestone, a price change) but no PR person. WireRoom gives them a strict, familiar form that makes the news read as credible, and it refuses to release claims that have no evidence.

## The two product rules

1. **Claim gate.** Every factual claim must carry a source URL before release. An item with an unsourced claim cannot be released. The gate reports which claim is missing a source. It never guesses or invents a source.
2. **Embargo clock.** An item is held until its release time. Before that time it is not published to any feed. The current time is always passed in as an argument, so the hold is deterministic and testable.

Any change that weakens either rule needs an explicit product decision.

## Theme: Resurrection

The teletype is the dead machine returned to life. The UI should feel like an old newsroom wire room: monospace type, paper feed, a typing sound, a printed end marker. Keep the theme in presentation only. It must never get in the way of the two rules.

## Core is deterministic and free

There is no LLM at runtime and no per-visitor cost. The app must stay free to test and free to host. The same draft and the same clock input always give the same wire text.

## Non-goals

- No accounts or sign-in.
- No backend or server-side storage.
- No runtime LLM or any paid per-visitor API.
- No email sending yet (later).

## Wire style rules

These are AP-style wire rules. The core enforces them and the tests check them.

- Slug lines are short, uppercase and hyphenated (for example `ACME-LAUNCH`).
- Priority words are uppercase: FLASH, BULLETIN, URGENT, and the routine level.
- The dateline has the form `CITY, Mon. D (WireRoom) --` (for example `AUSTIN, Mar. 4 (WireRoom) --`).
- One idea per paragraph.
- Attribution comes after the claim ("The app has 500 users, the company said.").
- Numbers and dates follow AP style: spell out one through nine, use numerals for 10 and up, and use AP month abbreviations in datelines.
- No hype adjectives (no "revolutionary", "groundbreaking", "game-changing" and the like).
- Teletype lines never exceed 69 columns.
- Every item ends with the end marker `-30-`.
