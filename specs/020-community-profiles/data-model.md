# Data Model: Community Reader Profiles

## Public Reader Profile

**Purpose**: One public-facing community identity per user.

| Field | Type | Rules |
|---|---|---|
| `user_id` | uuid | Primary key; references authenticated user |
| `username` | text | Required; lowercase URL-safe current username |
| `display_name` | text | Optional; shown publicly when profile is visible |
| `bio` | text | Optional; max 160 characters |
| `avatar_url` | text | Optional URL string; no upload/storage in this feature |
| `is_public` | boolean | Defaults false until user explicitly creates/enables profile |
| `created_at` | timestamptz | Server timestamp |
| `updated_at` | timestamptz | Server timestamp |

**Validation**:

- Username must match lowercase letters, numbers, hyphens, and underscores.
- Username uniqueness is case-insensitive by storing normalized lowercase and enforcing a
  unique index.
- Previous usernames are not retained as aliases and become available immediately after change.
- Bio must be at most 160 characters.

**Relationships**:

- Owns one Profile Privacy Settings row.
- Read by public profile RPCs only when visibility and blocking rules allow it.

## Profile Privacy Settings

**Purpose**: Stores section-level visibility choices for a public profile.

| Field | Type | Rules |
|---|---|---|
| `user_id` | uuid | Primary key; references Public Reader Profile |
| `progress_visibility` | enum/text | `everyone`, `followers`, `nobody`; defaults `nobody` |
| `currently_reading_visibility` | enum/text | `everyone`, `followers`, `nobody`; defaults `nobody` |
| `lexicon_visibility` | enum/text | `everyone`, `followers`, `nobody`; defaults `nobody` |
| `reader_dna_visibility` | enum/text | `everyone`, `followers`, `nobody`; defaults `nobody` |
| `created_at` | timestamptz | Server timestamp |
| `updated_at` | timestamptz | Server timestamp |

**Section semantics**:

- Progress means aggregate reading stats only.
- Currently reading means active book identity, cover, current page, total pages, and percent.
- Lexicon highlights mean recently mastered words only.
- Reader DNA means the public-safe Reader DNA summary.

## Minimal Follow Relationship

**Purpose**: Allows follower-only privacy evaluation without shipping the full follow UI.

| Field | Type | Rules |
|---|---|---|
| `follower_id` | uuid | References authenticated user |
| `following_id` | uuid | References authenticated user |
| `created_at` | timestamptz | Server timestamp |

**Constraints**:

- Primary key: `(follower_id, following_id)`.
- `follower_id` must not equal `following_id`.
- No follower count/list UI is required in this feature.

**Indexes**:

- Primary key supports "viewer follows owner" checks.
- Secondary index on `(following_id, follower_id)` supports future reverse lookup.

## Block Compatibility Record

**Purpose**: Gives public profile RPCs a durable block predicate before block UI ships.

| Field | Type | Rules |
|---|---|---|
| `blocker_id` | uuid | References authenticated user |
| `blocked_id` | uuid | References authenticated user |
| `created_at` | timestamptz | Server timestamp |

**Constraints**:

- Primary key: `(blocker_id, blocked_id)`.
- `blocker_id` must not equal `blocked_id`.
- Profile reads are unavailable if either direction exists between viewer and owner.

## Public Profile Payload

**Purpose**: Stable read model returned to PWA and future iOS.

| Section | Included when |
|---|---|
| `profile` | Profile exists, is public or viewer is owner, and pair is not blocked |
| `stats` | Progress visibility allows viewer |
| `currentlyReading` | Currently reading visibility allows viewer and user has active book data |
| `lexiconHighlights` | Lexicon visibility allows viewer and mastered words exist |
| `readerDna` | Reader DNA visibility allows viewer and Reader DNA exists |

**Privacy rule**: Hidden sections are omitted entirely with no reason codes.

## State Transitions

```text
No profile -> Profile created -> Profile public/private toggled -> Profile edited
Username current A -> Username current B; A immediately available
Section visibility nobody -> followers -> everyone, or any reverse transition
Follow absent -> Follow present -> follower-only sections visible to follower
Block absent -> Block present -> public profile unavailable in both directions
```
