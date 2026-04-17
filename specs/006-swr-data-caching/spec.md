# Feature Specification: SWR Data Caching & Instant Navigation

**Feature Branch**: `006-swr-data-caching`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: "Refactor to eliminate redundant loading states on back-navigation via a Stale-While-Revalidate caching pattern across all list/detail reads, with explicit invalidation after mutations. Excludes AI endpoints."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant return to previously visited pages (Priority: P1)

A reader who has already loaded the Library returns to it (e.g., after visiting a book detail, lexicon, or dashboard). Instead of seeing a spinner or empty state while data refetches, the reader sees the previously loaded list instantly, with a subtle background refresh reconciling any changes.

**Why this priority**: This is the single largest source of perceived sluggishness in the app today. Every list view (library, lexicon, recap history, progress, etc.) currently re-triggers a full loading state on navigation. Fixing this materially improves every flow in the product.

**Independent Test**: Can be fully tested by loading the Library, navigating to a book detail, and returning to Library — the list must appear with zero perceived delay and no skeleton/spinner. A background network request may fire, but the UI never blanks.

**Acceptance Scenarios**:

1. **Given** the user has previously loaded the Library in this session, **When** they navigate away and back within the cache freshness window, **Then** the list renders immediately from cache with no loading indicator and no network request is issued.
2. **Given** the user has previously loaded the Library and the cached data is older than the freshness window (stale), **When** they return to the page, **Then** the cached list renders immediately AND a background refresh is triggered; the UI updates silently when new data arrives.
3. **Given** the user has never loaded a given list in this session, **When** they visit it for the first time, **Then** the existing loading state is shown until data arrives (first-load behavior is unchanged).

---

### User Story 2 - List stays in sync after create/update/delete (Priority: P1)

After a reader adds a book, updates reading progress, deletes a lexicon word, or performs any other mutation, every affected list/detail view must reflect the change immediately — without the reader having to manually refresh or without stale cached data being shown.

**Why this priority**: Caching is only valuable if correctness is preserved. Without invalidation, users will see ghost entries, missing entries, or outdated progress after their own actions — a worse experience than no caching at all.

**Independent Test**: Add a book on the Add Book page, navigate to Library — the newly added book must appear at the top (or in its sorted position) immediately. Delete a lexicon word, return to Lexicon — the word must be gone. Update reading progress on Book Detail, return to Library — the progress bar/indicator on the affected card must reflect the new value.

**Acceptance Scenarios**:

1. **Given** the Library has cached list data, **When** the user successfully adds a new book, **Then** the Library cache is updated so the next visit (and any currently mounted Library view) shows the new book without a manual reload.
2. **Given** a lexicon entry exists in a cached list, **When** the user deletes it, **Then** the entry disappears from every cached view that included it.
3. **Given** a book's progress is cached, **When** the user saves a new current-page value, **Then** the cached progress for that book is updated and any list that displays progress reflects the new value.
4. **Given** a mutation fails (server error), **When** the system has applied an optimistic update to the cache, **Then** the cache is rolled back to its previous state and the user is shown an error.

---

### User Story 3 - Data freshness guarantees (Priority: P2)

A reader who has the app open across multiple devices or sessions can trust that the data shown is reasonably current. When cached data is older than its freshness window, it is transparently refreshed in the background on next access, and forced refresh is available on demand.

**Why this priority**: Important for multi-device scenarios and long-lived sessions, but the P1 stories already cover the common case. This story adds the safety net.

**Independent Test**: Load Library, leave the tab open for longer than the freshness window, switch tabs and back (or trigger a visibility event) — a background refresh must occur; the UI updates silently if server data has changed. A pull-to-refresh or manual refresh gesture forces revalidation regardless of age.

**Acceptance Scenarios**:

1. **Given** cached data is older than the freshness window, **When** the user refocuses the app window or returns to a cached page, **Then** a background revalidation fetch is issued and the UI reconciles on response.
2. **Given** the user explicitly triggers a refresh (e.g., pull-to-refresh or a refresh control), **When** the gesture completes, **Then** cached data is invalidated and refetched regardless of age.
3. **Given** a background revalidation request fails, **When** the user is already viewing cached data, **Then** the cached data remains visible and the failure is logged silently (no error toast unless the user explicitly triggered the refresh).

---

### User Story 4 - Optimistic updates for snappy interactions (Priority: P3)

For high-frequency, low-risk mutations (updating reading progress, advancing a Leitner word, marking a word reviewed), the UI reflects the change instantly while the server request runs in the background. If the server rejects the change, the UI rolls back.

**Why this priority**: Nice-to-have polish. Core correctness is covered by P1/P2. Without this, the app is still fast; with it, it feels effortless.

**Independent Test**: Click the "advance word" arrow on a lexicon card — the card must visually update (move to next box / disappear from due list) before the network request completes. If the server returns an error, the card reverts to its previous state and an error toast appears.

**Acceptance Scenarios**:

1. **Given** the user clicks a mutation control with optimistic-update support, **When** the click is registered, **Then** the UI reflects the new state immediately (within 50ms) without waiting for the server.
2. **Given** an optimistic update has been applied, **When** the server confirms success, **Then** the UI state is reconciled with the server response (typically a no-op).
3. **Given** an optimistic update has been applied, **When** the server returns an error, **Then** the UI rolls back to the previous state and the user sees an error message.

---

### Edge Cases

- **Auth change (sign out / sign in as different user)**: All cached data must be cleared when the authenticated user changes — a new user must NEVER see a previous user's cached books/words/progress.
- **Network offline on revalidation**: Cached data continues to display; revalidation silently fails and retries when online.
- **Mutation while revalidation in flight**: The mutation's cache update must win (not be overwritten by the older in-flight fetch). The system must handle out-of-order responses safely.
- **First navigation within a session to a page never visited**: The loading state still appears (there is nothing to show instantly) — behavior is unchanged for first-load.
- **Hard reload of the browser**: In-memory cache is lost. The first visit after reload behaves as a first-load. (Persistent cache across reloads is OUT OF SCOPE for this feature.)
- **AI streaming endpoints (recap generation)**: EXCLUDED — no caching, no invalidation, no modification of this code path.
- **Rapidly switching filters on a list (e.g., Lexicon book filter)**: Each distinct filter combination gets its own cache key; switching must render instantly if that combination was previously fetched in-session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST serve cached list/detail data immediately when the user navigates back to a page that was previously loaded in the current session, without displaying a loading state.
- **FR-002**: System MUST track a "last fetched" timestamp per cache entry and consider data "fresh" for a defined freshness window (default: 60 seconds for lists, 30 seconds for volatile counts/progress).
- **FR-003**: When cached data is older than its freshness window and is accessed, System MUST (a) render the cached data immediately, AND (b) trigger a background revalidation fetch.
- **FR-004**: When a background revalidation returns data that differs from the cache, System MUST update the cache and cause any currently mounted views to re-render with the new data.
- **FR-005**: When a background revalidation fails, System MUST leave cached data in place and MUST NOT show an error to the user unless they explicitly triggered the refresh.
- **FR-006**: System MUST use unique, deterministic cache keys that include all relevant query parameters (user id, book id, filter values, sort order, pagination) so that different filter/sort combinations do not collide.
- **FR-007**: After any successful create/update/delete mutation, System MUST invalidate or update every cache entry whose data is affected by that mutation. Supported strategies: (a) direct cache mutation (update the cached value to match the server response), or (b) key invalidation (mark the cache stale so the next access refetches).
- **FR-008**: System MUST clear all cached data when the authenticated user changes (sign-in, sign-out, or user id change).
- **FR-009**: System MUST NOT cache data related to AI recap generation (streams, fragments, generation status). The existing AI pipeline is out of scope and must remain untouched.
- **FR-010**: System MUST NOT cache authentication tokens, session objects, or any other security-sensitive credential-like data.
- **FR-011**: System MUST support optimistic updates for progress saves and Leitner advance/reset actions: apply the change to the cache immediately, fire the request, and roll back on failure with a user-visible error.
- **FR-012**: System MUST provide a mechanism to force-invalidate a cache key (bypassing freshness) for future support of pull-to-refresh, error-recovery retries, and manual refresh controls.
- **FR-013**: System MUST revalidate stale caches on window refocus (when the browser tab becomes visible again after being backgrounded) — limited to keys the user is currently viewing.
- **FR-014**: System MUST emit appropriate `Cache-Control` headers for static/semi-static frontend assets (bundled JS/CSS, images, icons, fonts) to reduce repeat-download bandwidth; dynamic API responses MUST NOT be browser-cached (use `no-store` or rely on application-level cache only).
- **FR-015**: System MUST be observable enough in development for a developer to see, for any given page, which cache keys were hit, missed, revalidated, or invalidated.

### Key Entities

- **Cache Entry**: A snapshot of server data keyed by a deterministic identifier. Attributes: cache key, data payload, last-fetched timestamp, freshness window, status (fresh | stale | revalidating | error).
- **Cache Key**: A deterministic string (or structured identifier) derived from the resource type + user id + all query parameters. Two requests with identical parameters MUST produce identical keys.
- **Mutation**: A create/update/delete operation on server state. Each mutation declares a set of cache keys it affects, so invalidation is explicit and predictable.
- **Cached Resources (in-scope)**: library (book list), individual book detail, reading progress (per-book and aggregate), lexicon entries (per-book and all-books), recap history list (metadata only — NOT streaming content), book passport, progress history, reading velocity/pulse data.
- **Excluded Resources**: recap streaming content, recap fragments, AI generation status, authentication tokens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On return visits to a previously loaded list page (Library, Lexicon, Recap History, Dashboard), the page renders visible content in under 100ms perceived time (no visible skeleton, spinner, or blank state).
- **SC-002**: After a user adds, edits, or deletes a record, every list/detail view affected by that change reflects the new state within 500ms, with no manual reload.
- **SC-003**: At least 80% of navigation events between already-visited pages result in zero new network requests (cache hit within freshness window).
- **SC-004**: When a mutation is optimistically applied, the UI visually reflects the change within 50ms of the user's action (before the network round-trip completes).
- **SC-005**: Zero observed cases of a user seeing another user's data after signing out and signing back in as a different account.
- **SC-006**: Zero regressions to AI recap generation flows (streaming, history display, generation state). AI code paths MUST have zero diffs attributable to this feature.
- **SC-007**: Developers can, in under one minute, identify every cache key associated with a given list endpoint by reading the code — keys are co-located with their fetchers and centrally registered.

## Assumptions

- The cache is in-memory (process-lifetime) for v1. Persistence across full page reloads via localStorage/IndexedDB is OUT OF SCOPE and can be added later without changing the public API.
- Freshness windows are global defaults (60s lists, 30s counts) and tunable per cache key; no per-user configuration is exposed.
- The app is single-tab for v1. Cross-tab cache synchronization (e.g., via BroadcastChannel) is OUT OF SCOPE.
- Pull-to-refresh UI is not part of this feature's delivery — FR-012 just exposes the mechanism. A refresh control can be added later as a pure UI change.
- Existing Pinia stores will be the cache substrate (augmented with metadata), rather than introducing a new library-level dependency, to minimize bundle size and keep the architecture coherent. If adopting a dedicated library (TanStack Query / SWR) proves materially simpler during planning, that choice will be revisited in the plan phase — but this spec does not mandate either approach.
- All mutations in the app route through Pinia store actions (no ad-hoc fetch calls from components); this is already the case and is relied upon for invalidation correctness.
- The auth store emits a reliable signal on user change that the cache layer can subscribe to.
- Static-asset `Cache-Control` headers are enforced at the deployment/CDN layer (Vercel/Netlify-style config), not in application code.

## Out of Scope

- Persistent cache across hard reloads (IndexedDB/localStorage).
- Cross-tab cache synchronization.
- Caching, invalidation, or modification of any AI recap generation endpoint, Edge Function, or stream.
- Offline-first behavior (existing IndexedDB queue for Leitner is unchanged).
- Real-time / websocket-driven cache updates.
- Server-side caching or CDN edge caching of API responses.
