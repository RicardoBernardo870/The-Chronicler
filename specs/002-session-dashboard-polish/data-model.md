# Data Model: Session Persistence & Dashboard Polish

**Date**: 2026-04-16  
**Feature**: `002-session-dashboard-polish`

> No new database tables or columns are required. All changes are client-side computed views over existing entities.

---

## Existing Entities Used

### Session (Supabase Auth — client-side)

| Field | Type | Notes |
|-------|------|-------|
| `access_token` | string | JWT; stored in localStorage by Supabase JS v2 |
| `refresh_token` | string | Used to obtain a new access_token on expiry |
| `expires_at` | number | Unix timestamp; checked by `onAuthStateChange` |
| `user` | User object | `id`, `email`, auth metadata |

**State transitions**:
```
unauthenticated → [login] → authenticated → [refresh] → authenticated
authenticated → [explicit logout] → unauthenticated
authenticated → [token expiry + no refresh] → unauthenticated → redirect /auth
```

---

### Book (existing `books` table)

No schema changes. Fields consumed by this feature:

| Field | Type | Usage |
|-------|------|-------|
| `id` | uuid | Join key with reading_progress |
| `title` | string | Dashboard display |
| `author` | string | Dashboard display |
| `cover_url` | string \| null | Dashboard display |
| `total_pages` | number | Progress calculation |
| `created_at` | timestamp | Existing |

---

### ReadingProgress (existing `reading_progress` table)

No schema changes. Fields consumed by this feature:

| Field | Type | Usage |
|-------|------|-------|
| `book_id` | uuid | Join key |
| `current_page` | number | Progress base value |
| `percentage` | number (derived) | `(current_page / total_pages) * 100` — used for sorting and section assignment |
| `updated_at` | timestamp | Sort tie-breaker; "last updated" indicator |

---

## Client-Side Derived Views (Pinia computed)

These are not persisted — they are reactive computed properties derived at runtime:

### `inProgressBooks`
- **Source**: `progressStore` × `booksStore`
- **Filter**: `0 < percentage < 100`
- **Sort**: `updated_at` descending (most recently read first)
- **Used by**: `DashboardPage.vue` (in-progress list section)

### `completedBooks`
- **Source**: `progressStore` × `booksStore`
- **Filter**: `percentage === 100`
- **Sort**: `updated_at` descending (most recently completed first)
- **Used by**: `DashboardPage.vue` (completed section, capped at 2)

### `sortedLibraryBooks`
- **Source**: `booksStore` × `progressStore`
- **Sort**: `percentage` ascending, then `updated_at` descending as tie-breaker
- **Used by**: `LibraryPage.vue`
