# Quickstart — Recap Image Generation (Feature 021)

A minimal manual-test runbook for verifying the feature end-to-end against a Supabase staging project.

## Prerequisites

- Supabase CLI ≥ 1.190 installed
- Local clone of the repo on a feature branch (e.g., `021-recap-image-generation`)
- Access to the staging Supabase project
- A `GEMINI_API_KEY` with access to the `gemini-2.5-flash-image` model (set as an Edge Function secret)
- A test user account with at least one book at ≥ 30% progress

## 1. Apply the Migration

```bash
supabase db push
```

Verify in Supabase Studio:

- `recaps` table now has columns `image_path`, `image_status`, `image_generated_at` — all nullable.
- A new bucket `recap-images` exists, marked private.
- Three storage policies exist on `storage.objects` scoped to bucket `recap-images`.

## 2. Deploy the Updated Edge Function

```bash
supabase functions deploy generate-recap
```

If this is the first time deploying after this feature, set the secret:

```bash
supabase secrets set GEMINI_API_KEY=<key-with-image-access>
```

## 3. Sanity-Check the Refiner in Isolation

```bash
cd supabase/functions/generate-recap
deno test prompts/imagePromptRefiner.test.ts
```

All assertions in the test file must pass — most importantly the static lint that scans for hardcoded book-specific literals (Tolkien-family names, etc.). If that test fails, do NOT deploy.

## 4. Generate a Recap from the App

1. Open the PWA (staging URL).
2. Sign in with the test account.
3. Open a book at ≥ 30% progress.
4. Tap **Get Recap**.
5. Observe:
   - Text fields stream in within ~2 seconds.
   - The image area shows a **PrimeVue Skeleton** at 1:1 aspect ratio immediately.
   - Within ~10 seconds the skeleton fades to the generated image.
6. Open browser DevTools → Network → filter by `recap-images`. You should see exactly one signed-URL fetch returning the PNG.
7. Open the recap row in Supabase Studio → confirm `image_status = 'succeeded'`, `image_path` is non-null, `image_generated_at` is recent.

## 5. Verify Spoiler Safety

For a curated test set:
- Pick a book where the `memory_jogger` references specific proper nouns (character X meets character Y at location Z).
- Generate a recap.
- Visually inspect: the image should depict named entities matching the memory jogger, not generic substitutes.
- Inspect: nothing in the image visually represents content from beyond the user's current page (e.g., a character who is introduced 50 pages later).

## 6. Verify Failure Paths

### 6a. Transient failure path

Temporarily set the Edge Function's image-call timeout very short (or use a network-mock harness):

```typescript
// In handlers/image.ts (testing branch)
const TIMEOUT_MS = 1   // forced failure
```

Generate a recap. Expected:
- One silent retry (visible in Edge Function logs).
- After retry fails, recap settles with `image_status = 'failed_transient'`.
- UI shows the gradient placeholder — no retry button visible.
- Generating a NEW recap on the same book starts a fresh attempt.

### 6b. Safety failure path

Force-feed a memory jogger likely to trigger safety (e.g., explicit violence in the source text). Expected:
- One softer-prompt retry (visible in Edge Function logs).
- If still rejected, recap settles with `image_status = 'failed_safety'`.
- UI shows placeholder, no retry button.

## 7. Verify Privacy

1. As user A, generate a recap. Note `recaps.image_path = 'A_uid/recap_id.png'`.
2. Sign in as user B in another browser.
3. Open Supabase Studio as user B's role and attempt to read `storage.objects` rows where path starts with `A_uid/` — should return zero rows.
4. Attempt to mint a signed URL for A's path as B — should fail with permission error.

## 8. Verify Backwards Compatibility

1. Inspect any pre-existing recap row (created before this migration). Its `image_status` should be NULL.
2. Open the book detail page that surfaces that recap. The UI should render normally (no skeleton, no placeholder, no broken state) — the legacy recap is treated as `'skipped'`.

## 9. Smoke Performance Check

1. With DevTools Performance recording, generate 5 recaps in succession.
2. Expected (per SC-005, SC-008):
   - Time-to-first-text-token unchanged from pre-feature baseline.
   - Image visible at p90 ≤ 2× the time to text-recap visible.
   - No layout shift in the recap card during image arrival (skeleton matches final size).

## 10. Rollback Drill (Optional)

To prove the rollback is safe:

```bash
psql $DATABASE_URL -f specs/021-recap-image-generation/contracts/recap-storage.bucket-policy.sql
# (then run the down-migration in data-model.md §8)
```

After rollback, the PWA continues to function with text-only recaps; pre-existing recap rows are untouched; no PWA rebuild is required.

## Acceptance

The feature is ready to merge when all of the following pass:

- [ ] Sections 1–4 succeed end-to-end on staging
- [ ] Section 5 visually confirms name preservation and spoiler safety on at least 5 distinct books across at least 3 genres
- [ ] Section 6 (both failure paths) produces the documented terminal states
- [ ] Section 7 confirms cross-user isolation
- [ ] Section 8 confirms legacy-recap rendering is unaffected
- [ ] Section 9 confirms no regression in time-to-first-text-token
- [ ] All Constitution VI items hold: PrimeVue `Image` + `Skeleton` used; new `RecapImagePanel.vue` is single-responsibility ≤ 250 lines

When all boxes check, the feature is ready for `/speckit-tasks` to break it down into ordered implementation tasks.
