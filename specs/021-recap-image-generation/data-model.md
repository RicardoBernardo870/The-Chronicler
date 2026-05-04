# Phase 1 Data Model — Recap Image Generation

## 1. Schema Changes

### 1.1 Migration: `supabase/migrations/20260503_recap_image_columns.sql`

```sql
-- =============================================================================
-- File   : 20260503_recap_image_columns.sql
-- Feature: 021 — Recap Image Generation
-- Purpose: Extend recaps with image metadata; create private storage bucket and
--          policies for per-user image isolation.
-- =============================================================================

-- 1. Columns on recaps (nullable, additive)
alter table public.recaps
  add column if not exists image_path          text,
  add column if not exists image_status        text,
  add column if not exists image_generated_at  timestamptz;

alter table public.recaps
  add constraint recaps_image_status_check
  check (
    image_status is null
    or image_status in (
      'pending',           -- generation in flight; client expected to subscribe and wait
      'succeeded',         -- image_path is valid
      'failed_safety',     -- safety rejection after one softer retry
      'failed_transient',  -- transient error after one auto-retry
      'skipped'            -- pre-existing recap; no image attempted
    )
  );

-- 2. Storage bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recap-images',
  'recap-images',
  false,
  524288,                                  -- 512 KB hard cap per object
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do nothing;

-- 3. Storage RLS — owner read & write only.
-- Path convention: {user_id}/{recap_id}.png
-- The first folder segment is the owner.
create policy "recap-images: owner can select"
  on storage.objects for select
  using (
    bucket_id = 'recap-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recap-images: owner can insert"
  on storage.objects for insert
  with check (
    bucket_id = 'recap-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recap-images: owner can delete"
  on storage.objects for delete
  using (
    bucket_id = 'recap-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Index: lookups by status (used by future cleanup jobs / cost dashboards)
create index if not exists recaps_image_status_idx
  on public.recaps (image_status)
  where image_status is not null;
```

### 1.2 Backfill Behavior

No backfill is required. Pre-existing recap rows have `image_status = null` which the client treats as `'skipped'` for rendering purposes. New recaps generated after the migration are inserted with `image_status = 'pending'` immediately, then transitioned by the Edge Function as the image stage progresses.

## 2. Domain Types (Frontend)

### 2.1 `src/types/index.ts` — Recap interface extension

```typescript
export type RecapImageStatus =
  | 'pending'
  | 'succeeded'
  | 'failed_safety'
  | 'failed_transient'
  | 'skipped'

export interface Recap {
  id: string
  userId: string
  bookId: string
  // existing text fields (unchanged)
  memoryJogger: string
  thematicBridge: string
  conceptWatchlist: string[]
  progressSnapshot: number
  pageSnapshot: number | null
  mode: 'standard' | 'corpus'
  confidence: number | null
  createdAt: string
  // NEW (021)
  imagePath: string | null            // bucket-relative path; null when not yet known
  imageStatus: RecapImageStatus       // 'skipped' if column is NULL on the row
  imageGeneratedAt: string | null
}
```

### 2.2 Row → Domain Mapping

`mapRecap(row: RecapRow): Recap` is updated:

```typescript
imagePath:        row.image_path ?? null,
imageStatus:      (row.image_status as RecapImageStatus) ?? 'skipped',
imageGeneratedAt: row.image_generated_at ?? null,
```

This guarantees clients written before this feature continue to work — they simply ignore the new fields — while clients written after this feature treat unknown rows as having no image attempt (`'skipped'`), which matches the desired "no placeholder UI" behavior for legacy recaps.

## 3. State Transitions

```
┌─────────┐
│ pending │  (set on insert by Edge Function before image stage starts)
└────┬────┘
     │
     ├─── transient error → silent retry → ─┐
     │                                       │
     ├─── safety reject  → softer prompt → ─┤
     │                                       │
     ├─── second transient error ────────► failed_transient (terminal)
     │                                                      
     ├─── second safety reject ───────────► failed_safety   (terminal)
     │
     └─── image bytes uploaded to Storage ─► succeeded      (terminal)
```

`pending` is the only non-terminal state. Once a recap leaves `pending`, the row is not re-attempted unless the user generates a brand-new recap (which writes a new row with its own pending state).

## 4. Storage Object Lifecycle

| Recap state | Object presence |
|---|---|
| `pending` | object may be uploading; clients should not request signed URL until status is `succeeded` |
| `succeeded` | object exists at `image_path`; signed URLs are mintable |
| `failed_*` | no object at `image_path`; `image_path` remains NULL |
| `skipped` | not applicable — pre-existing rows pre-feature |
| Recap row deleted | object should be deleted (deferred to a follow-up cleanup job — TODO) |

## 5. Validation Rules

- `image_path`, when non-null, MUST match `^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpe?g|webp)$` (user_id/recap_id.ext). Validation lives in the Edge Function, not the database (no DB regex constraint to keep migration cheap).
- `image_generated_at`, when non-null, MUST be ≥ `created_at` of the same row.
- `image_status = 'succeeded'` MUST imply `image_path is not null AND image_generated_at is not null`.
- `image_status in ('failed_safety','failed_transient','skipped','pending')` MUST imply `image_path is null`.
- These rules are enforced by the Edge Function; expressing them as SQL CHECK constraints would couple the migration to ordering of column updates and is unnecessary given the single writer (the Edge Function).

## 6. Privacy & RLS Surface

- `recaps` rows are already RLS-protected: `auth.uid() = user_id` on read and write.
- `storage.objects` rows in `recap-images` are RLS-protected by the policies in Section 1.1: only the owner whose `auth.uid()` matches the first path segment can read, write, or delete.
- Signed URLs (60s TTL) are minted by the client with its own JWT — Supabase Storage validates ownership before issuing.
- Image bytes are NEVER exposed to other users, NEVER shared via public URLs, and NEVER cached client-side beyond the rendered `<img>` element's natural browser cache.

## 7. Observability Hooks

The Edge Function logs (without persisting prompts or content):
- `recap_id`, `user_id` (hashed if needed)
- `text_stage_duration_ms`
- `image_stage_duration_ms`
- `transient_retry_used: bool`
- `safety_retry_used: bool`
- `final_image_status`

These flow into the existing Supabase Edge Function log surface; no new tables are added for telemetry.

## 8. Rollback

If the feature must be rolled back:

```sql
-- Down migration (manual, not auto-generated):
drop policy if exists "recap-images: owner can delete" on storage.objects;
drop policy if exists "recap-images: owner can insert" on storage.objects;
drop policy if exists "recap-images: owner can select" on storage.objects;
delete from storage.buckets where id = 'recap-images';

drop index if exists recaps_image_status_idx;
alter table public.recaps drop constraint if exists recaps_image_status_check;
alter table public.recaps
  drop column if exists image_generated_at,
  drop column if exists image_status,
  drop column if exists image_path;
```

Rollback is safe at any point: dropping the bucket destroys orphan images; dropping the columns on `recaps` removes the metadata. The PWA continues to function with text-only recaps.
