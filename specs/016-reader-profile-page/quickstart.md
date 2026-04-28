# Quickstart — Verifying Feature 016

End-to-end verification flow once tasks land. All paths are user-visible behaviors mapped to the spec's acceptance scenarios.

## Prerequisites
- Local dev: `npm run dev` + `supabase start` + Supabase functions running locally.
- Apply migration `supabase/migrations/20260428_reader_profile.sql`.
- Deploy edge functions `generate-reading-dna` and `extract-vocabulary` (or run locally with `supabase functions serve`).
- A test user with at least 4 books in the library (3 finished + 1 in progress) and at least 1 captured page.

## Scenario A — Profile page renders for an established reader (US1)

1. Sign in as the test user.
2. Tap the new **Profile** tab in bottom navigation.
3. **Expect**: page route is `/profile`, all sections render within ~2 s (SC-001):
   - Lifetime Stats Grid populated with 7 numeric tiles.
   - Library Breakdown shows genre Tags, author count, pace bars.
   - Top Themes shows ≥ 5 chips.
4. Acceptance: matches Story 1 scenarios 1, 2, 4.

## Scenario B — Empty state for a brand-new user (US1)

1. Sign in as a user with zero books / sessions.
2. Open Profile.
3. **Expect**: each section shows its empty placeholder; no errors; DNA card shows "0 of 3 books finished" progress.
4. Acceptance: Story 1 scenario 4 + edge case "zero books finished" + SC-007.

## Scenario C — Reading DNA generates on first eligible visit (US2)

1. Use a user who has just finished their 3rd book and has no `reading_dna` row.
2. Open Profile.
3. **Expect**: Reading DNA card shows a Skeleton briefly, then displays personality (2-3 sentences), mood signature (chip + emoji row), and 3-5 book suggestions with reasons.
4. Open the page again.
5. **Expect**: DNA renders instantly from the persisted row — verify in Network tab that `generate-reading-dna` is NOT called (SC-005).
6. Acceptance: Story 2 scenarios 1, 2, 5.

## Scenario D — DNA regenerates on threshold (US2)

1. Manually update the test user's `reading_dna.generated_at` to 91 days ago in the DB.
2. Open Profile.
3. **Expect**: DNA card refreshes — call to `generate-reading-dna` happens, new content replaces previous, persisted row is updated.
4. Reset `generated_at` to today; finish 3 more books.
5. Open Profile again.
6. **Expect**: another regeneration — `books_finished_at_generation` updates.
7. Acceptance: Story 2 scenario 3 + FR-011 + FR-028.

## Scenario E — Auto-vocabulary extraction (US3)

1. Open a book on the BookDetail page; start a session; make progress; save.
2. After saving, the SessionCaptureField appears (per the bugfix shipped earlier this session).
3. Capture a page that contains uncommon vocabulary (e.g., a Cormac McCarthy passage).
4. **Expect immediately**: capture confirmation in < 1 s, no perceptible regression vs prior baseline (SC-004).
5. Wait up to 30 s; navigate to **Profile → Vocabulary Garden**.
6. **Expect**: 1–5 new entries appear in "Recently Learned", each with a contextual definition and a `<Tag>` reading "from *Book Title*, p. {N}" (FR-022a).
7. Open `/lexicon` and verify the same entries are listed with `source = 'auto'` (visible in the existing detail card UX) and `leitner_box = 1`.
8. Acceptance: Story 3 scenarios 1, 2, 5, 6.

## Scenario F — Vocabulary dedup (US3)

1. As the same user, add the word "perspicacious" manually via the existing AddWordDialog.
2. Capture a passage that contains "perspicacious".
3. Wait 30 s.
4. **Expect**: no duplicate entry created; `vocabulary_extractions` ledger row shows `status = 'skipped'` or `words_added < total candidates` (SC-006).
5. Acceptance: Story 3 scenario 3 + FR-018.

## Scenario G — Vocabulary failure is silent (US3)

1. Temporarily disable the Gemini key on the edge function (or kill the function process locally).
2. Capture a page.
3. **Expect**: capture itself succeeds; no toast, no banner, no UI error (FR-021).
4. Restore the function. Re-capture or capture a different page.
5. **Expect**: subsequent captures resume normal extraction.
6. Acceptance: Story 3 scenario 4 + FR-014's spirit applied to vocab.

## Scenario H — DNA failure preserves previous (US2)

1. With a working DNA already in the DB, disable the Gemini key.
2. Cross the threshold (e.g. set `generated_at` to 91 days ago).
3. Open Profile.
4. **Expect**: DNA card still shows the *previous* DNA; no error toast; in DevTools Network, the function call shows 502 but the UI is stable.
5. Acceptance: FR-014 + edge case "DNA generation fails partway".

## Scenario I — Page capture redo is idempotent

1. Capture a page (extraction runs).
2. Re-capture the SAME page (overwriting the existing `page_captures` row, OR producing a new one — depends on existing capture flow).
3. If the OCR text is unchanged → expect no new lexicon entries; ledger `vocabulary_extractions` has only one row for that capture_id (unique constraint).
4. If OCR text differs → a new ledger row may exist (different `capture_id`); dedup against existing lexicon entries still prevents word duplication.
5. Acceptance: edge case "page capture is redone for the same page".

## Verification of Constitution Principle VI compliance

- Open `src/components/profile/` and confirm every file ≤ 250 lines.
- Confirm every UI element is a PrimeVue component (no custom components introduced).
- Confirm `ProfilePage.vue` template contains no large blocks of presentational logic — only `<section>` + child component tags.

## Lighthouse PWA score

After build:
```sh
npm run build && npx serve dist
```
Run Lighthouse on `/profile`. Expect PWA ≥ 90 (Constitution V). Profile is lazy-loaded so initial bundle is unaffected.
