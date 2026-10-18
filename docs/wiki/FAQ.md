# FAQ

Last updated: 2026-10-18

Short answers. The authoritative detail is in the [business-rules catalog](../business-rules/README.md) and the [backend contract](../backend-contract.md).

## Product & project

### Is the app called BookHero or The Chronicler?

**The Chronicler** is the product and App Store name, and every user-facing surface already says it: page title, manifest, sign-in screen, AI prompts. **BookHero** stays the internal code name for the repository, the Supabase project, code identifiers and storage keys (`bookhero_*`), and the iOS repo name `bookhero-ios`. Identifiers will not be renamed (D-03).

### Where do I find how a feature is supposed to work?

1. [Features](Features.md) gives the overview.
2. The numbered rules live in [`docs/business-rules/`](../business-rules/README.md). Rule IDs such as `REC-04` are stable; each file also lists known defects (`-Dnn`) and open decisions (`-Qnn`).
3. Backend shapes are in the [backend contract](../backend-contract.md).

When an older wiki page or a `specs/` folder disagrees with these, the catalog and the contract win. They were verified against the code and the live database on 2026-10-18.

### Is `supabase/migrations/` the source of truth for the database?

No. The **live database** is canonical. The migrations folder has drifted: most live functions, including the whole community / circles layer, have no local migration, and replaying the folder would regress some RPCs. A read-only snapshot of the live schema is committed at [`supabase/reference/`](../../supabase/reference/README.md). Fixing the drift is work package BC-03 in the [consolidation plan](../backend-consolidation-plan.md).

### Is there a native iOS app?

Not yet, and the PWA stays live (D-05).

- **First:** the Phase 0 backend work in the [consolidation plan](../backend-consolidation-plan.md).
- **Then:** the iOS app. It targets iOS 26+, iPhone first, with native Liquid Glass and no pre-iOS-26 fallback (D-04). It is built with Claude Code (Opus 5.5, ultracode mode) from kickoff briefs, not with Spec Kit (D-02).
- **Later:** Android, on the same backend.

See the [iOS implementation plan](../ios-implementation-plan.md).

### Will there be a subscription or paywall?

Undecided (D-14). Phase 0 builds a server-side entitlement and AI-usage check (BC-12) that allows everything until tiers and prices are decided.

## Reading & progress

### Can the app work offline?

Partly.

- **Works offline.** The app shell is precached by the service worker, and a signed-in reader can open the app offline: session restore falls back to a stored snapshot after 3 s.
- **Saved offline.** Only page saves, and only when the browser reports itself offline at save time. A save that fails while "online" is rolled back with an error.
- **What an offline save does today.**
  - It writes **no history row**, so those pages don't count toward streaks, the calendar or session XP.
  - It does not end the session.
  - It skips the capture prompt, the passport and Insights.
- **Replay.** On reconnect the queue replays a bare page update. Background Sync is Chromium-only, so Safari replays on the next `online` event or progress fetch.
- **Online only.** Starting, pausing or resuming a session, and every library change.

**Planned:** offline saves replay through an atomic `save_progress` RPC with their original timestamp and count normally (D-08 · BC-04). See [Features § Offline progress queue](Features.md#offline-progress-queue).

### How are completed books handled?

A book is complete when its page reaches the total page count.

**On an online in-app save that crosses 100 %:**

- the reader sees "Finished: {title}" with **View Journey** / **Continue**;
- the Book Passport summary is generated once;
- the book leaves the hero and In Progress;
- a database trigger deletes its page captures, their resumes and its Memory Check quiz.

**Other paths** fire only some of these effects and never generate a passport: adding a book as "Already finished", importing a "read" book, completing offline, or editing the page count. The "View Reading Journey" button exists only for manually added books. See [Features § Completion](Features.md#4-completion--book-passport).

### Why is "Get Recap" locked?

The lock is evaluated on the device today (REC-03…REC-08). Get Recap unlocks only when **all** of these hold:

- you have read at least **5 % of the book** since the last recap ("N more pages");
- **6 hours** have passed since the later of your last recap and your last page save ("Recap in N hours").

A **72-hour idle grant** overrides both locks: 72 h with no write to your progress (starting or pausing a session counts as a write) and at least 6 h since the last recap. The label does not count down live.

**Planned:** `generate-recap` enforces the same rules on the server clock (BC-07).

### Why didn't I get an Insight?

Today an Insight unlocks at a 10 % milestone (10–90 %) only when **all** of these hold:

- you saved the page **online**;
- the book already has at least one **mid-book recap** at or below your page.

Some milestones are lost:

- A milestone crossed without a qualifying recap is **skipped for good**.
- A jump across several milestones attempts only the latest one.
- Failures are silent.

Because Get Recap is itself locked, the 10 % Insight is the rarest.

**Planned (D-12 · BC-08):** Insights fall back to your page captures or spoiler-guarded metadata, and skipped milestones are back-filled.

### Why do I see different "today" or streak numbers on different screens?

Time zones are mixed today.

- **Device time zone:** the reading calendar, the monthly chart, personal records and passport stats.
- **UTC:** streaks, "this month", the yearly quest and the Word of the Day's cached day.
- **Any page save counts:** even a backward correction marks a streak day.

**Planned:** every day / week / month / year boundary uses your IANA time zone, stored server-side (D-07 · BC-06).

## Library & import

### Why can't I edit or delete a book?

Edit and Delete are reached only by **swiping a card left on a touch device**, in the Library list view or in search results. There is no edit or delete in the grid view, on Book Detail, on the DNF list or on desktop. Delete is permanent and cascades all of the book's data (LIB-102, LIB-88).

### Why don't my imported books count toward my yearly goal or XP?

Imported books (Goodreads / StoryGraph CSV) are created **quietly**, so a large import doesn't inflate the current year.

- **Excluded:** XP pages and completion XP, the yearly quest, and the "books finished" achievements.
- **Included:** the library breakdown, the Profile "Books" pill, Book Lengths and Reading DNA.

If you later read an imported book in the app, its sessions count for streaks, charts and session XP, but its pages and completion still don't (LIB-85, PRO-97).

### Is re-importing the same CSV safe?

Usually, but not always.

- **Dedupe source.** De-duplication compares against the library **loaded in the app**. Opening the import directly after a refresh of `/books/add` can duplicate every book.
- **Partial failure.** An import that fails midway keeps the books already inserted, but skips the status writes, so finished and DNF books stay in "Want to read".

**Planned:** an atomic, idempotent import RPC (BC-15, recommended). See [Features § Library import](Features.md#library-import-spec-034).

## Capture & AI

### Does the app store captured page images?

No. The image goes to the `ocr-page` edge function, and only the text is stored, in `page_captures`. The text and the "Previously" resume derived from it are deleted when the book is completed. A capture saved on an already-completed book is deleted immediately, though its +5 XP still counts.

The app does store two kinds of image:

- **recap illustrations**, generated by AI, in the private `recap-images` bucket;
- **profile avatars**, in the public `community-avatars` bucket.

### Which AI providers are used?

| Use | Provider |
|---|---|
| OCR, recap composer, blurb, passport summary, Insights (`generate-lore` v18), "Previously" resume, Memory Check, vocabulary extraction, recap image prompt refiner | Gemini 2.5 Flash |
| Reading DNA (`generate-reading-dna` v8) | Gemini 2.5 Flash with Google Search grounding |
| Inferred-recap extraction | Gemini 2.5 Pro with Google Search grounding |
| Recap images | OpenAI `gpt-image-2` (1024×1024) |

The deployed versions of `generate-lore` and `generate-reading-dna` are canonical, and the repo sources are being synced to them (D-09). On iOS, OCR runs on-device with Apple Vision first and falls back to `ocr-page` (D-15). There is no consent screen yet before personal data reaches these providers (PLT-81; see the [legal & compliance review](../legal-compliance-review.md)).

## Account & security

### Can I reset my password, delete my account or sign in with Apple?

Not yet.

- **Today:** email + password and email magic links only. A magic link for an unknown email creates an account.
- **Missing:** password reset, password or email change, in-app account deletion and data export.

**Planned:**

- Sign in with Apple, plus Apple-ID linking for existing email users, and password reset on web and iOS through universal links (D-11).
- Immediate, permanent account deletion with re-authentication, through a `delete-account` edge function that also purges your Storage files (D-10).

### Are there user roles?

Readers have no role tiers. Every table uses row-level security scoped to the owner (`auth.uid() = user_id`).

Known gaps, fixed before the iOS launch:

- Four read RPCs accept any user id (BC-01).
- Three AI edge functions decode the JWT without verifying it (BC-02).

Details: [backend contract §12 Security status](../backend-contract.md#12-security-status).

### Does sign-out sign me out everywhere?

Yes. Sign-out revokes sessions on **every device**. It clears little local state in the browser, and it fails silently when offline (PLT-14, PLT-15).

### Can I follow other readers or join a reading circle?

Not in any client. Follows, blocks, discovery, "also reading" and Reading Circles exist in the backend but stay dormant until a much later Community phase (D-13). The only community feature in use is profile customization (username, display name, avatar, and on the web also bio and privacy).

## Development

### Where do aggregate profile stats come from?

| Source | Stats |
|---|---|
| RPCs | `get_reading_quest_summary` (XP, level, yearly quest), `get_reading_stats` (lifetime grid, streaks), `get_library_breakdown`, `get_reading_calendar`, `get_monthly_reading`, `get_reading_records` |
| Client-side | "Books finished" and Book Lengths (from the progress store); achievements (evaluated on Trophy Room visits) |

See [07 · Profile, Stats & Goals](../business-rules/07-profile-stats-goals.md).

### Is there seed data?

No. The repository has no seed file.

### Is CI configured?

No. There is no `.github` workflow. Run `pnpm test` (Vitest) and `pnpm build` locally. The project uses **pnpm**, and there is no lint script.

### Is there a license?

The README says no license has been published yet.
