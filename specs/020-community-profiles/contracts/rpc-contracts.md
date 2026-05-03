# RPC Contracts: Community Reader Profiles

All RPCs are stable contracts for both the PWA and future native iOS app. They must enforce
privacy and blocking server-side. Hidden sections are omitted without reason codes.

## `get_my_community_profile()`

Returns the signed-in user's editable public profile settings.

**Auth**: signed-in user only.

**Request**: no arguments.

**Response**:

```json
{
  "profile": {
    "userId": "uuid",
    "username": "reader_name",
    "displayName": "Ricardo",
    "bio": "Short reader bio",
    "avatarUrl": "https://example.com/avatar.jpg",
    "isPublic": true,
    "createdAt": "2026-05-02T10:00:00Z",
    "updatedAt": "2026-05-02T10:00:00Z"
  },
  "privacy": {
    "progress": "nobody",
    "currentlyReading": "followers",
    "lexicon": "everyone",
    "readerDna": "nobody"
  }
}
```

Returns `null` when the signed-in user has not created a profile.

## `upsert_my_community_profile(payload jsonb)`

Creates or updates the signed-in user's profile and privacy settings atomically.

**Auth**: signed-in user only.

**Request**:

```json
{
  "username": "reader_name",
  "displayName": "Ricardo",
  "bio": "Short reader bio",
  "avatarUrl": "https://example.com/avatar.jpg",
  "isPublic": true,
  "privacy": {
    "progress": "nobody",
    "currentlyReading": "followers",
    "lexicon": "everyone",
    "readerDna": "nobody"
  }
}
```

**Validation errors**:

| Code | Meaning |
|---|---|
| `username_invalid` | Username is not URL-safe lowercase format |
| `username_taken` | Username already belongs to another user |
| `bio_too_long` | Bio exceeds 160 characters |
| `visibility_invalid` | One or more visibility values are invalid |

**Response**: same shape as `get_my_community_profile()`.

## `is_username_available(p_username text)`

Checks whether a normalized username can be claimed by the signed-in user.

**Auth**: signed-in user only.

**Response**:

```json
{
  "available": true,
  "normalizedUsername": "reader_name"
}
```

If the current user already owns the username, `available` is `true`.

## `get_public_profile_by_username(p_username text)`

Returns the public profile payload visible to the signed-in viewer.

**Auth**: signed-in user only.

**Response when visible**:

```json
{
  "profile": {
    "userId": "uuid",
    "username": "reader_name",
    "displayName": "Ricardo",
    "bio": "Short reader bio",
    "avatarUrl": "https://example.com/avatar.jpg"
  },
  "stats": {
    "booksRead": 34,
    "totalPagesRead": 850,
    "currentStreakDays": 5,
    "longestStreakDays": 12
  },
  "currentlyReading": {
    "bookId": "uuid",
    "title": "The Master and Margarita",
    "author": "Mikhail Bulgakov",
    "coverUrl": "https://example.com/cover.jpg",
    "currentPage": 312,
    "totalPages": 480,
    "percentage": 65
  },
  "lexiconHighlights": [
    {
      "term": "susurrus",
      "bookTitle": "Book title",
      "masteredAt": "2026-05-02T10:00:00Z"
    }
  ],
  "readerDna": {
    "personality": "Gothic - Philosophical - Existentialist",
    "moodTone": "Dark Romantic",
    "moodEmojis": ["..."]
  }
}
```

**Omission rules**:

- Sections the viewer cannot see are omitted.
- Sections with no data are omitted.
- No `hiddenSections`, `visible: false`, or reason-code fields are returned.
- `lexiconHighlights.masteredAt` currently uses the lexicon row's `created_at` timestamp
  because the existing Leitner schema does not persist a separate mastered timestamp. The
  mastered filter is `leitner_box >= 5`.

**Response when unavailable**:

```json
null
```

Unavailable covers missing username, non-public profile, unsigned access, and either-direction
blocking. The client renders one generic unavailable state.
