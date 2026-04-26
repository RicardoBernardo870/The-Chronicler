# Quickstart: Corpus-Grounded Delta Recaps

**Audience**: Developer or QA validating the feature post-implementation.
**Goal**: Walk through the complete user journey end-to-end and confirm both happy paths and key fallbacks behave per spec.

## Prerequisites

- Local app running against a Supabase project where the migration `20260426000000_corpus_recaps.sql` has been applied.
- A signed-in user with at least one book in `in_progress` status and a `current_page` of 50 or higher.
- A physical book (or any printed page mock) for camera capture.
- Browser with camera access (Chrome on desktop or any modern mobile browser).

---

## Scenario 1 — First Capture (US1, primary path)

1. Open the Dashboard. Confirm the **Last Session** card displays the most recent session for the active book.
2. End or fake-end a session: open the active book, increment the page input by ≥1, and tap Save.
3. **Expected**: The Last Session card refreshes and an inline panel appears below the metrics with the prompt **"📸 Capture this page"** plus secondary actions **"Add note instead"** and **"Skip"**.
4. Tap **Capture**.
5. **Expected**: The browser requests camera permission (first time) and then shows a live camera viewport with a snap button below.
6. Frame a printed page and tap **Snap**.
7. **Expected**: A spinner indicates OCR is running (~2–4s). The viewport is replaced by a **Verify** screen showing the OCR'd text in an editable textarea.
8. **Verify**:
   - Text is non-empty and roughly matches the page contents.
   - Character counter is visible.
   - **No yellow warning banner** appears (assuming a clean shot — confidence ≥0.7).
9. Tap **Save**.
10. **Expected**: The prompt panel disappears with the same animation as the existing note flow. No toast errors.

### Database assertion

```sql
select page, char_length(text), word_count, round(confidence::numeric, 2), source
from public.page_captures
where book_id = '<book_id>'
order by captured_at desc
limit 1;
```

Confirm:
- `page` matches the value in `reading_progress.current_page` for that user/book.
- `text` length > 0 and ≤ 10000.
- `confidence` is between 0 and 1.
- `source` = `'ocr'`.

---

## Scenario 2 — Low-Confidence Warning (Q4 clarification)

1. Repeat Scenario 1, but deliberately blur the page (move the phone while snapping) or photograph a low-contrast page.
2. **Expected**: On the Verify screen, a yellow `InlineMessage` appears above the textarea reading something like *"OCR confidence is low — please review carefully before saving."*
3. Edit the text to correct any obvious errors.
4. Tap **Save**.
5. **Expected**: Capture saves, prompt dismisses normally. The persisted `confidence` value reflects the low score (<0.7) but the user-edited `text` is what was committed.

---

## Scenario 3 — Skip (no capture, no note)

1. End a session as in Scenario 1.
2. When the prompt appears, tap **Skip**.
3. **Expected**: Prompt panel disappears. No row inserted into `page_captures` and no row updated in `progress_history.session_note`.

---

## Scenario 4 — Add Note Instead (fallback)

1. End a session as in Scenario 1.
2. When the prompt appears, tap **Add note instead**.
3. **Expected**: The capture prompt is replaced inline by the existing `SessionNoteField` (textarea + Save note + Skip).
4. Type a short note and tap **Save note**.
5. **Expected**: Note saves to `progress_history.session_note` for the recent row. No row inserted into `page_captures`.

---

## Scenario 5 — Camera Permission Denied

1. Revoke camera permission for the site (browser settings).
2. End a session.
3. Tap **Capture**.
4. **Expected**: A panel appears reading *"Camera access was denied. You can still leave a note for this session, or grant camera access in your browser settings and try again."* with **Add note instead** and **Cancel** buttons.
5. Tap **Cancel**.
6. **Expected**: Prompt dismisses; no capture row, no note row.

---

## Scenario 6 — Re-Capture Same Page (overwrite)

1. End a session at page X. Capture the page (Scenario 1).
2. Without changing the page, end another session at the same page X (e.g., correct progress to X again, or use a separate test path that triggers `lastSessionEnded`).
3. Capture again with different framing or text.
4. **Expected**: The `page_captures` row for `(user, book, X)` is updated in place (same `id`, refreshed `text`, `word_count`, `confidence`, `captured_at`).

```sql
select id, captured_at, char_length(text), word_count
from public.page_captures
where book_id = '<book_id>' and page = <X>;
```

Only one row exists; `captured_at` reflects the most recent capture.

---

## Scenario 7 — Inferred-Mode Recap (no captures)

1. With a book that has **zero** `page_captures` rows, navigate to its detail page and tap **Get Recap**.
2. **Expected**:
   - A streaming recap appears within ~3 seconds of the tap (Constitution Principle III).
   - The recap card does **not** show the "📸 Generated from your captures" badge.
   - The persisted recap row has `mode = 'inferred'`.

```sql
select mode, progress_snapshot, created_at
from public.recaps
where book_id = '<book_id>'
order by created_at desc
limit 1;
```

`mode` = `'inferred'`.

---

## Scenario 8 — Corpus-Mode Delta Recap (US2, primary path)

**Setup**: Build a book up to ~30%+ delta coverage. Easiest path:

- Pick a book with current_page = 100 and no prior recaps.
- Capture pages 1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 (11 captures over a 100-page delta = 11% — too low; bump to ~30 captures to clear the threshold).
- Easier: use a SQL seed to insert 30 dummy captures for a book where `current_page = 100`, distributing pages 1–100.

```sql
insert into public.page_captures (user_id, book_id, page, text, word_count, confidence)
select
  '<user_id>', '<book_id>', g, 'Lorem ipsum dolor sit amet…', 5, 0.95
from generate_series(1, 100, 3) g;     -- ~33 pages = 33% coverage of a 1–100 delta
```

1. With the book set up, tap **Get Recap** on the Book Detail page.
2. **Expected**:
   - Streaming recap appears within ~3 seconds (Constitution Principle III).
   - The recap content references events / language consistent with the seeded `text` (when seeded with real content). With Lorem ipsum, the recap will be Latin-flavored — for a real semantic check, seed with real prose.
   - The recap card displays a **"📸 Generated from your captures"** badge.
   - The persisted recap row has `mode = 'corpus'`.

```sql
select mode, progress_snapshot, created_at, char_length(content)
from public.recaps
where book_id = '<book_id>'
order by created_at desc
limit 1;
```

`mode` = `'corpus'`. `progress_snapshot_page` is set to the current page.

---

## Scenario 9 — Delta Scoping (US2 chronology)

1. Continuing from Scenario 8, advance the book's `current_page` to 200 and add ~30% capture coverage in pages 101–200.
2. Tap **Get Recap** again.
3. **Expected**:
   - The new recap covers only events appearing in pages 101–200's captures.
   - Content does NOT repeat material from the prior recap (which covered pages 1–100).
4. Open the **Recap History** page for this book.
5. **Expected**: Two corpus-mode entries appear in chronological order, each with a "Pages X–Y" indicator showing their distinct, non-overlapping ranges.

---

## Scenario 10 — Coverage Below Threshold (US3 fallback)

1. With a book whose delta range has **<30%** capture coverage, tap **Get Recap**.
2. **Expected**:
   - Recap streams normally (no error).
   - No "📸 Generated from your captures" badge appears.
   - Persisted row has `mode = 'inferred'`.

---

## Scenario 11 — Boundary at exactly 30% (Q1 clarification)

1. Construct a delta range of exactly 10 pages with exactly 3 captured pages (= 30% coverage).
2. Tap **Get Recap**.
3. **Expected**: Corpus mode triggers (`mode = 'corpus'`, badge visible).

The threshold is inclusive at 30%.

---

## Scenario 12 — Cascade Delete

1. With captures present for a book, delete the book from the Library.
2. **Expected**: All `page_captures` rows for that book are removed automatically (cascade).
3. Verify:

```sql
select count(*) from public.page_captures where book_id = '<deleted_book_id>';
-- Expected: 0
```

---

## Scenario 13 — Cross-User Isolation

1. With two test users (A and B) and one book each, confirm that User A's captures are not visible to User B.

```sql
-- As User B (with their JWT), querying via Supabase client:
select * from public.page_captures where user_id = '<user_a_id>';
-- Expected: 0 rows (RLS denies)
```

---

## Smoke Tests (post-deploy, in production)

- [ ] First capture by any user produces a row with valid `text`, `confidence`, `word_count`.
- [ ] First corpus-mode recap produces a row with `mode = 'corpus'`.
- [ ] Inferred-mode recaps continue to work (regression).
- [ ] Recap streaming begins within 3 seconds of tap (Principle III).
- [ ] OCR endpoint p95 latency ≤5s in observed metrics.
- [ ] No image bytes appear in any persisted artifact (audit Storage buckets, log payloads).

## Rollback

If a critical regression appears in corpus mode:

1. Set the `mode` selection in `generate-recap` to always return `'inferred'` (one-line edit).
2. Redeploy the edge function — historical corpus recaps remain in place; new recaps revert to inferred behavior.
3. The `page_captures` table can remain populated; no data loss for the user.

This rollback is non-destructive and reversible.
