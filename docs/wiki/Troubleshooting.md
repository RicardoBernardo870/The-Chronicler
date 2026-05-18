# Troubleshooting

Last updated: 2026-05-17

## App Fails on Startup

Possible cause: missing Supabase frontend variables.

Fix:

```text
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Then restart the dev server.

## Redirected to Login After Refresh

The router waits for `authStore.initialize()` before evaluating protected routes. If redirects still fail:

- Confirm Supabase URL and anon key are correct.
- Check browser storage for a persisted Supabase session.
- Check Supabase Auth settings for the project.

## Supabase Query Fails with RLS Error

Possible causes:

- User is not authenticated.
- Table is missing an owner policy.
- Row `user_id` does not match the authenticated user.

Fix:

- Verify the active user in the browser.
- Inspect policies in Supabase.
- Confirm inserts include `user_id`.

## Edge Function Returns `401`

Possible cause: missing or invalid `Authorization` header.

Fix:

- Confirm the client has a current Supabase session.
- Confirm the request includes `Authorization: Bearer <access-token>`.

## AI Feature Fails

Possible causes:

- `GEMINI_API_KEY` is missing from Supabase secrets.
- Function was not deployed.
- Provider returned a safety or quota error.

Fix:

```bash
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
supabase functions deploy generate-recap
supabase functions deploy generate-lore
supabase functions deploy ocr-page
supabase functions deploy extract-vocabulary
supabase functions deploy generate-reading-dna
```

Then inspect Supabase function logs.

## Recap Image Stays Pending

Possible causes:

- Image-generation provider secret is missing.
- `recap-images` storage bucket or policies are missing.
- Edge Function failed after the recap row was created.

Fix:

- Inspect `recaps.image_status`.
- Check Supabase function logs.
- Confirm storage policies from the recap image migration are applied.

## Start Session Does Not Work

Expected behavior: selecting a new book and clicking Start Session should create or update `reading_progress` and set `session_start_at`.

If it fails:

- Confirm the book exists and belongs to the current user.
- Confirm `reading_progress.session_start_at` migration is applied.
- Check browser console and Supabase logs for upsert errors.

## Offline Progress Does Not Sync

Possible causes:

- Browser does not support Background Sync.
- Service worker is stale.
- IndexedDB queue contains failed records.

Fix:

- Reload the app.
- Clear site data during local development if the service worker is stale.
- Confirm `src/App.vue` receives the `FLUSH_PROGRESS_QUEUE` message.

## Build Fails

Run:

```bash
pnpm build
```

Common checks:

- TypeScript errors from changed domain types.
- Missing imports after moving components.
- Environment access that assumes a variable exists at build time.

## Tests Fail

Run the exact failing file:

```bash
pnpm exec vitest run tests/unit/<file>.spec.ts
```

Check whether store tests need Supabase mocks updated after API changes.

