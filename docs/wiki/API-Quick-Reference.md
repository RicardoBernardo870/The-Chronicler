# API Quick Reference

Last updated: 2026-06-20

This page is optional support material for [[API Documentation]]. Full inventory: [`docs/backend-contract.md`](../backend-contract.md).

## Edge Function Summary

| Function | Purpose | Auth | Main caller |
| --- | --- | --- | --- |
| `generate-recap` | Blurbs, recaps, passport summaries, recap images | Supabase JWT | `src/services/recapService.ts`, `src/stores/bookPassport.ts` |
| `generate-lore` | Milestone lore cards | Supabase JWT | `src/services/loreService.ts` |
| `ocr-page` | Page OCR from camera image payload | Supabase JWT | `src/composables/useCapture.ts` |
| `extract-vocabulary` | Vocabulary candidates from OCR text | Supabase JWT | `src/composables/useVocabularyExtraction.ts` |
| `generate-reading-dna` | Reader identity profile | Supabase JWT | `src/stores/readingDna.ts` |

## RPC Summary

| RPC | Main caller |
| --- | --- |
| `get_library_with_progress` | `src/stores/books.ts` |
| `get_reading_stats` | `src/composables/useReadingProfile.ts` |
| `get_last_session` | `src/composables/useLastSession.ts` |
| `get_library_breakdown` | `src/composables/useLibraryBreakdown.ts` |
| `get_reading_velocity` | `src/composables/useReadingVelocity.ts` |
| `get_reading_quest_summary` | `src/stores/readingQuest.ts` |
| `get_book_passport_stats` | `src/stores/bookPassport.ts` |
| `get_retention_summary` | Profile retention rollup |
| `upsert_weekly_goal` | Settings (weekly goal) |

> **034:** `get_reading_quest_summary` and `get_reading_stats` exclude imported books (`source <> 'manual'`); `get_library_with_progress` now also returns `source` + `pageCountEstimated`. No new RPCs — library import (`src/composables/useLibraryImport.ts` + `booksStore.importBooks`) writes directly to `books`/`reading_progress` via `supabase-js`.

> Plus ~40 **Community + Reading Circles** RPCs (PWA-only today) — see [`backend-contract.md`](../backend-contract.md) §6.

> Edge-function auth nuance: `generate-recap` / `generate-lore` / `ocr-page` run `verify_jwt: false` and self-validate; `extract-vocabulary` / `generate-reading-dna` use platform JWT.

