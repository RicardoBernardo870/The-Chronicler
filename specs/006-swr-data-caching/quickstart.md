# Quickstart: SWR Caching — Dev & QA Smoke Guide

## For developers

### Adding caching to a new fetcher

1. Add a key to `cacheKeys` in `src/composables/useCache.ts`.
2. In your store, replace the raw ref + fetch pattern with a `swr(...)` handle (see `contracts/cache-api.md § Store adoption contract`).
3. Add a row to the Mutation Registry (`data-model.md`) for every mutation that could affect this key.
4. Update the affected pages to read `isInitialLoading` instead of `loading`.

### Debugging cache behavior (dev build only)

In the browser console:

```js
window.__bookheroCache.keys()           // list all active keys
window.__bookheroCache.get('books:<uid>')  // full entry snapshot
window.__bookheroCache.stats()          // { hits, misses, revalidations }
```

## For QA — manual smoke matrix

Run each of these in order. Every row must pass before the feature is considered done.

### Smoke 1 — Instant return navigation (US1)

1. Sign in. Open Library. Wait for list to render.
2. Open any book → go back to Library.
3. **Expected**: Library renders the book list instantly. No skeleton. No spinner. (Network tab may show a background request if 60 s elapsed — that's fine.)

### Smoke 2 — Cache survives multi-hop navigation

1. Library → Book detail → Lexicon → Home → Library.
2. **Expected**: Every page that was previously visited renders instantly on re-entry.

### Smoke 3 — Add book updates Library cache (US2)

1. Open Library → note the book list.
2. Add Book → save.
3. Navigate back to Library.
4. **Expected**: New book appears immediately at the top (or in correct sort position). No manual reload needed.

### Smoke 4 — Delete lexicon word (US2)

1. Open Lexicon → note an existing word.
2. Delete that word (via its action).
3. Navigate away and back to Lexicon.
4. **Expected**: Word is gone. Count updates. No stale ghost.

### Smoke 5 — Progress optimistic update (US4)

1. Open a Book Detail page.
2. Change the current-page input to a new value, click Save.
3. **Expected**: Progress bar updates within 50 ms (before network round-trip completes). Check Network tab: the PATCH fires but the UI already reflects the change.
4. **Rollback test**: disconnect network, click Save again. Expected: UI reverts to previous value; error toast appears.

### Smoke 6 — Leitner advance optimistic (US4)

1. Open Dashboard, see Word of the Day.
2. Click the advance arrow.
3. **Expected**: Card transitions within 50 ms. If only one word, "All caught up" state appears instantly. Network request trails behind.

### Smoke 7 — User-change cache clear (Edge Case / SC-005)

1. Sign in as User A. Load Library (note specific books).
2. Sign out → sign in as User B.
3. Open Library.
4. **Expected**: Only User B's books visible. Zero User A bleed-through. Check `window.__bookheroCache.keys()` in dev → no `*:userA-id` entries remain.

### Smoke 8 — Visibility revalidation (US3 / FR-013)

1. Open Library.
2. Wait > 60 s (or shorten TTL via dev override).
3. Switch to another tab for > 5 s.
4. Return to the Library tab.
5. **Expected**: Network tab shows a background revalidation request for `books:<uid>`. UI updates silently if server data changed; otherwise no visible flicker.

### Smoke 9 — AI recap path untouched (FR-009 / SC-006)

1. Open a Book Detail page.
2. Trigger "Get Recap".
3. **Expected**: Streaming UX behaves exactly as before. Network tab shows Edge Function streaming response. No cache entries created for streaming fragments (`window.__bookheroCache.keys()` shows no `recap:*:stream*` or similar).
4. After recap completes, navigate to Recap History: the new recap appears (history list cache was invalidated).

### Smoke 10 — First-load is unchanged

1. Hard-reload the app (Ctrl+F5).
2. Open Library.
3. **Expected**: Initial skeleton/spinner appears (this is correct — first load has nothing to show). Data arrives. Feature is specifically about *return* navigation, not cold-start.

## Regression checklist (run before merging)

- [ ] All 10 smokes above pass
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all cache unit tests pass
- [ ] Bundle size delta < 5 KB gz (compare `dist/assets/*.js` sizes)
- [ ] Grep audit: `rg "useCache|swr\(|mutate\(|invalidate\(" supabase/functions/` returns zero matches
- [ ] Grep audit: `rg "useCache" src/` only matches `useCache.ts` itself and the listed stores (`books`, `progress`, `lexicon`, `bookPassport`, `upNext`, `recaps` — history only, plus `auth` for clearAll wiring)
- [ ] No console errors on navigation between any pair of pages
