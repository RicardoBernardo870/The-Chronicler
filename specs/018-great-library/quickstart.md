# Quickstart & Verification: The Great Library

**Feature**: 018-great-library | **Date**: 2026-04-30

---

## Prerequisites

- BookHero running locally (`npm run dev`)
- Supabase project accessible
- At least **2 books** added to your library
- At least **5 lexicon entries** spread across those books (mix of `dictionary` and `lore` types)
- Some entries should have `context_sentence` and `page_found` populated, some should not

---

## Step 1 — Navigate to the Great Library

1. Open BookHero in the browser
2. Tap the **Library** icon in the bottom navigation (or navigate directly to `/lexicon`)
3. **Expected**: Page loads showing the Lexicon tab with an entry list
4. **Expected**: Entries are sorted newest-first (most recently added at the top)
5. **Expected**: Each entry card shows: term, definition, type badge (Dictionary/Lore), book title
6. **Expected**: Page/context sentence appear only when the entry has them

---

## Step 2 — Infinite scroll / pagination

1. Add more than 20 lexicon entries to the database (or verify you already have > 20)
2. Navigate to the Great Library
3. **Expected**: First 20 entries load; a loading spinner appears at the bottom
4. Scroll to the bottom of the list
5. **Expected**: Next 20 entries load and are appended below (no page reload, no flicker)
6. Continue scrolling until all entries are loaded
7. **Expected**: Sentinel disappears; no further fetch is triggered
8. **Verify `hasMore`**: After the last page returns < 20 rows, the sentinel element should be hidden

---

## Step 3 — Search

1. Type a partial term in the search bar (e.g., first 3 letters of a known word)
2. **Expected**: After ~300ms debounce, results refresh showing only entries whose `term` or `definition` contains the query (case-insensitive)
3. **Expected**: The entry list resets to page 1 (no carryover from previous results)
4. **Expected**: The total count in the list reflects only matching entries
5. Clear the search bar
6. **Expected**: Full unfiltered list reloads from page 1

---

## Step 4 — Type filter

1. Click the **Dictionary** toggle button
2. **Expected**: Only entries with `entry_type = 'dictionary'` are shown
3. Click **Lore**
4. **Expected**: Only entries with `entry_type = 'lore'` are shown
5. Click **All**
6. **Expected**: All entries return; pagination resets to page 1

---

## Step 5 — Book filter

1. Open the book dropdown
2. **Expected**: Only books that have at least one lexicon entry appear (no books with 0 entries)
3. Select a specific book
4. **Expected**: Only entries from that book are shown
5. **Expected**: Pagination resets to page 1
6. Select "All Books" (null option)
7. **Expected**: Full cross-book list reloads

---

## Step 6 — Combined filters

1. Set the type filter to **Lore** and select a specific book in the dropdown
2. Type a partial search term
3. **Expected**: Only lore entries from that book matching the search term appear
4. **Expected**: Results update within 300ms after debounce (search) or immediately (dropdown/toggle changes)

---

## Step 7 — Empty state

1. Set the search bar to a query that matches no entries (e.g., `zzznotaword`)
2. **Expected**: Empty state message is shown (no entries, no error)
3. Clear the search
4. **Expected**: Entry list reloads

---

## Step 8 — Error state

1. Temporarily disable network or set Supabase URL to an invalid value
2. Navigate to the Great Library
3. **Expected**: Error message shown with a **Retry** button
4. Restore network and press **Retry**
5. **Expected**: Entries load successfully

---

## Step 9 — Loading state (skeletons)

1. Enable browser network throttling (Slow 3G)
2. Navigate to the Great Library
3. **Expected**: Skeleton placeholders shown while first page loads
4. **Expected**: `loadingMore` spinner shown at bottom while subsequent pages load

---

## Step 10 — Performance

1. With > 20 entries, measure time from navigation to first 20 entries rendered
2. **Target**: < 2 seconds on a mobile-class device or throttled connection
3. Measure time from finishing typing a search query to results appearing
4. **Target**: Results visible within 1 second after the 300ms debounce fires

---

## What NOT to test (out of scope for v1)

- Editing or deleting entries from this page (read-only)
- Leitner review from this page (no flashcard interaction)
- Sorting by fields other than `created_at`
- Persisting filter state across navigation (filter resets on leave)
