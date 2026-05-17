# Research: Completion Passport Session

## Decision: Start Session Must Upsert Reading Progress For Eligible Books

**Rationale**: The observed bug matches the current store behavior: `startSession(bookId)` updates `reading_progress` by `book_id,user_id`, but queued or newly selected books can have no row until the user saves a page. An update against no rows can succeed without creating session state, leaving the UI unchanged. Upserting a row with `current_page = 0` and `session_start_at = now` preserves server-confirmed session state without requiring a separate page save.

**Alternatives considered**:

- Require selecting books to create initial progress immediately: rejected because selection should remain a lightweight UI action and should not imply progress.
- Make Start Session silently set page 1: rejected because it invents reading progress and could corrupt absolute page tracking.
- Keep update-only and show an error: rejected because it preserves friction instead of fixing the normal flow.

## Decision: Completion Prompt Should Be Non-Blocking With A Passport Primary Action

**Rationale**: Completion is a celebratory moment, but the user may want to continue into the next book. A PrimeVue confirmation/dialog/toast-style prompt can show "View Journey" as the primary action and "Continue" as the secondary action without trapping the user. The prompt can route to the existing `book-passport` route and tolerate generated content still loading.

**Alternatives considered**:

- Auto-redirect to the passport on completion: rejected because it interrupts users who are saving progress as part of a session/capture flow.
- Only add a completed-list badge: rejected because it is too easy to miss and does not solve discoverability.
- Add a permanent dashboard banner: rejected for v1 because the requirement is tied to the immediate completion moment.

## Decision: Prompt Deduplication Should Be Event-Based For This Scope

**Rationale**: The app already detects first completion with `newPct >= 100 && prevPct < 100`. Using that transition as the only prompt trigger prevents routine refresh duplicates without new storage. A transient consumed/dismissed prompt state can prevent duplicate display during the same save cycle.

**Alternatives considered**:

- Store a `passport_prompt_seen_at` column: rejected because it requires a migration for a scoped UX prompt.
- Use `localStorage` for every completed book: rejected because it can hide useful prompts across accounts/devices and is unnecessary if the completion transition is reliable.

## Decision: Passport Destination Should Work Even If Generation Is Pending

**Rationale**: `BookPassportPage.vue` already handles loading, generating, and empty states. The completion prompt can link to the route immediately while the passport store fetches or generates content in the background.

**Alternatives considered**:

- Disable the prompt action until passport content exists: rejected because it teaches users the passport is unavailable at the moment it matters most.
- Poll until generation finishes before showing the prompt: rejected because it delays feedback and adds complexity.
