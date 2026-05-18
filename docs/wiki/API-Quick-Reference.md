# API Quick Reference

Last updated: 2026-05-17

This page is optional support material for [[API Documentation]].

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

