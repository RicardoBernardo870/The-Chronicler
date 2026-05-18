# FAQ

Last updated: 2026-05-17

## Is this app called BookHero or The Chronicler?

The README and package name identify the app as BookHero. Some older comments, prompts, IndexedDB names, and the PWA manifest still use "The Chronicler". Product naming should be normalized in a future cleanup.

## Does BookHero store captured page images?

No. The capture flow sends image data to the OCR edge function and stores reviewed text in `page_captures`. Images are not persisted by the app.

## Can the app work offline?

Partially. Reading progress updates can be queued in IndexedDB and flushed later. The app is also configured as a PWA. Full offline access for every feature is not currently documented.

## Why does the app need Supabase?

Supabase provides authentication, database tables, RLS, storage for recap images, RPC functions, and Edge Functions for AI/OCR features.

## Which AI provider is used?

Gemini is used for text generation, OCR interpretation, vocabulary extraction, lore, and Reading DNA. Recap image generation references OpenAI image generation in the edge function code.

## Are there custom user roles?

Not currently documented in the codebase. The app appears to use a single authenticated reader role with owner-scoped data access.

## How are completed books handled?

When progress reaches 100%, the book is treated as finished, removed from active reading candidates, and the user is prompted to view the Book Passport journey.

## Where do aggregate profile stats come from?

From Supabase RPC functions such as `get_reading_stats`, `get_library_breakdown`, `get_reading_velocity`, and `get_reading_quest_summary`.

## Is there seed data?

Seed data is not currently documented in the codebase.

## Is CI configured?

CI is not currently documented in the codebase, and no `.github` workflows were found during inspection.

## Is there a license?

The README says no license has been published yet.

