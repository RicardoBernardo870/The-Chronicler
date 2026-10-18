# 05 · Codex — Lexicon, Word of the Day & Review — Business Rules
> **Prefix:** LEX · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Legend & glossary:** [README](README.md)

Last updated: 2026-10-19 (BC-01 and BC-02 shipped)

`D-xx` are the 2026-10-18 owner decisions (decisions log in the [README](README.md)). `BC-xx` are the Phase 0 work packages in [backend-consolidation-plan](../backend-consolidation-plan.md). Column types, policies, RPC bodies and edge-function contracts are in [backend-contract](../backend-contract.md). Live definitions of every object named here are in `supabase/reference/live-baseline-2026-10-18.sql`.

Code and the live database are the source of truth. The web specs `specs/005-lexicon-nav-ux`, `016-reader-profile-page`, `018-great-library`, `024-anki-flashcard-review`, `031-vocab-graduation` and `032-daily-review-limit` describe intent only; where they differ from shipped behaviour, the rule says so. (`specs/031-vocab-mastery/` is an empty stray directory.)

**Numbering.**
- LEX-01…LEX-101 are stable IDs referenced by other documents. LEX-102 and LEX-103 are new.
- A known defect keeps its tracking number: LEX-Dnn.
- Open decisions keep their original numbers. The gaps are questions that the 2026-10-18 decisions answered, or that were merged; they are listed under [Open decisions](#open-decisions).

---

## Overview

The **Codex** is the reader's personal vocabulary vault. It is the bottom-nav tab "Codex" (`pi-language`, route `/lexicon`, page component `GreatLibraryPage`). It holds two kinds of entry, each tied to one book:
- **words** (`entry_type = 'dictionary'`), added by hand or extracted automatically;
- **quotes** (`entry_type = 'quote'`), added by hand.

**Review.** Words move through a 5-box **Leitner** schedule. They are reviewed on two surfaces that share **one daily allotment of 20 words**:
- **Word of the Day** (WotD), a dashboard card: one word at a time. Its only action is "advance". It never masters a word.
- **Vocabulary Review** (`/anki-review`), a flashcard session that is offered from the WotD slot every ≥ 3 days. "Knew it" **masters** the word permanently. "Didn't know" resets it to box 1.

Quotes are keepsakes and are never reviewed.

**Auto-extraction.** After every page capture, the `extract-vocabulary` edge function (Gemini 2.5 Flash) picks up to 5 advanced words from the captured text. The client de-duplicates them and inserts them as `source = 'auto'`.

**Where the logic lives.** Today every piece of logic in this domain runs on the client: scheduling, eligibility, the daily cap, WotD selection, mastery, the session aggregate and the whole extraction pipeline. The database stores the results, enforces CHECK constraints and owner RLS, and runs no trigger or RPC for this domain.

**Terms used in this file** (the full glossary is in the [README](README.md)):

| Term | Meaning |
|---|---|
| Reviewable | `entry_type = 'dictionary'` (quotes are never reviewable) |
| Due | `next_review_at ≤ today` (a `date` compared with today's date) |
| Reviewed today | `last_reviewed_at ≥` the start of today |
| Eligible | Reviewable ∧ not mastered ∧ due ∧ not reviewed today |
| Tally | Number of entries reviewed today (any type, any mastery state) |
| Today's set | The first `max(0, 20 + extra − tally)` eligible words. WotD and the Anki deck share this one pool |
| Preview | The WotD state when today's set is empty: it shows the soonest upcoming word as "caught up" |
| Advance / reset / master | The three review writes (LEX-25 / LEX-26 / LEX-29) |

### Screens and entry points

| Web route / surface | Entry point | Purpose |
|---|---|---|
| `/lexicon` (route `lexicon`), tab **Lexicon** | Bottom-nav "Codex" | Paginated list: search, type filter, book filter, sort, infinite scroll, flip cards, header "N words · M mastered", "Add to Codex" |
| `/lexicon`, tab **Insights** | Same page; `?tab=lore` | Lore cards — owned by [06 · Insights](06-insights.md) |
| `/lexicon?bookId=<id>` | WotD card tap; Book Detail "Words N" chip | Opens the Codex. Today `bookId` filters **only the Insights tab** (LEX-51, ⚠ LEX-D06) |
| `/lexicon?bookId=<id>&tab=lore` | Lore Chronoscope card on Book Detail | Insights for one book (06) |
| Add to Codex dialog (`AddWordDialog`) | Codex "Add to Codex"; Book Detail "Codex" (`pi-plus`) chip | Add a word (auto-definition lookup) or a quote |
| `/` Dashboard, WotD slot (`WordOfTheDay`) | Dashboard, only in the `standard` / `oneInProgress` onboarding states | WotD card (5 states) or the **Vocabulary Review** prompt |
| `/anki-review` (route `anki-review`) | Only in-app entry: the Vocabulary Review prompt. Also reachable by URL / reload | Flashcard session: flip, swipe or buttons, undo, pronunciation, summary, missed list, "Review more" |
| Background job after a capture save | `capturesStore.saveCapture` | Vocabulary auto-extraction; silent; never shown to the reader |
| Book Passport page (`book-passport`) | "View Journey" | Consumer: "words learned" = `vocabularyCount` (LEX-99) |
| None in the web client | RPC only | Community "lexicon highlights" on public profiles (LEX-100); dormant (D-13) |

**Not available anywhere.** There is no way to:
- edit, delete, un-master or move an entry to another book;
- get a duplicate warning on a manual add;
- start a review session from the Codex;
- export entries.

The only writes after an insert are the review writes and Undo (LEX-23).

**Dead code** (⚠ LEX-D29): `src/pages/LexiconPage.vue` (not routed), `useLeitner().getDueWord`, `lexiconStore.dueTodayCount`, `lexiconStore.invalidateAll`.

### Owning objects (names only)

- **Tables:** `lexicon_entries`, `vocabulary_extractions` (extraction ledger), `anki_review_sessions` (one aggregate row per user).
- **RPCs:**
  - None is called by this domain.
  - Consumers that read lexicon data: `get_book_passport_stats` (`vocabularyCount`), `get_public_profile_by_username` (`lexiconHighlights`, dormant), and `get_my_community_profile` / `upsert_my_community_profile` (`privacy.lexicon`).
  - `get_retention_summary` is **not** vocabulary-related, although older docs say so (LEX-101).
- **Triggers:** none on any of the three tables. The capture-side triggers that delete captures are owned by [04 · Capture](04-capture-resume-quiz.md) (CAP-42/43).
- **Edge function:** `extract-vocabulary` v2 (`verify_jwt: true`; the repo source is byte-identical to the deployed one).
- **External APIs (client-side):** Free Dictionary API (`api.dictionaryapi.dev`) and the Web Speech API (`speechSynthesis`).
- **Browser storage:** `localStorage["bookhero_wotd_{userId}"]`.
- **Web code:**
  - `src/stores/{lexicon,ankiSession}.ts`
  - `src/composables/{useLeitner,useAnkiSession,useGreatLibrarySearch,useVocabularyExtraction,useLexicon}.ts`
  - `src/pages/{GreatLibraryPage,AnkiReviewPage}.vue`
  - `src/components/lexicon/{AddWordDialog,LexiconCard}.vue`
  - `src/components/dashboard/WordOfTheDay.vue`
  - `src/components/anki/SwipeableFlashcard.vue`
  - `src/components/book/BookProgressPanel.vue` (chips)

**Related rules elsewhere:**

- [04 · Capture](04-capture-resume-quiz.md):
  - the capture save that starts extraction: CAP-36;
  - a re-capture never re-extracts: CAP-31, CAP-D04, CAP-Q04;
  - a capture saved on a completed book is purged at once: CAP-43, CAP-Q02.
- [02 · Reading Sessions](02-reading-sessions.md):
  - the dashboard mount sequence: SES-53;
  - the onboarding states that hide the WotD slot: SES-55;
  - passport stats: SES-45…SES-48.
- [06 · Insights](06-insights.md): the Codex Insights tab.
- [08 · Platform, Auth & Account](08-platform-auth-account.md):
  - sign-out leaves in-memory state: PLT-15;
  - mixed UTC / local "today": PLT-65;
  - account-delete cascade: PLT-73.
- [09 · Database Invariants](09-database-invariants.md): table constraints BE-25…BE-27; the passport `vocabularyCount` BE-46.
- [10 · Community & Circles](10-community-circles.md): the lexicon privacy setting and public highlights.
- [11 · Cross-Domain](11-cross-domain.md): the book-delete, completion, DNF and sign-out matrices.

---

## Rules

### A. Entry model and validation

#### LEX-01 · Two entry types: words and quotes
Every entry is either `dictionary` or `quote`.
- `dictionary` is labelled "Word" in the add form and "Dictionary" in filters and badges.
- `quote` is labelled "Quote" / "Quotes", but the card badge says "Lore" ⚠ LEX-D27.

The default is `dictionary`. The legacy `lore` type no longer exists: the live-only migration `lexicon_quote_entry_type` (20260703151513) deleted every `lore` row.
- **Enforced:** `server:db` (`lexicon_entries_entry_type_check`: `entry_type IN ('dictionary','quote')`; default `'dictionary'`).
- **Source:** `src/types/index.ts:466`; live constraint.

#### LEX-02 · Source: manual or auto
`source ∈ {manual, auto}`, default `manual`.
- Manual inserts never send `source`, so the default applies.
- Auto-extraction sends `'auto'`.
- The client mapper turns a null source into `'manual'`.

`source` is not shown anywhere in the UI.
- **Enforced:** `server:db` (`lexicon_entries_source_check`, default); `client` (mapper).
- **Source:** `src/stores/lexicon.ts:103-115`; `src/composables/useVocabularyExtraction.ts:164`; `src/types/index.ts:518`.

#### LEX-03 · Term: 1–200 characters, quotes included
`term` is NOT NULL and 1–200 characters long (`char_length`, i.e. code points).
- A quote's passage is stored in `term`, so **a quote can never exceed 200 characters** ⚠ LEX-D02.
- The client only trims the value and requires it to be non-empty. A longer term fails the insert with no feedback ⚠ LEX-D03.
- **Enforced:** `server:db` (`lexicon_entries_term_check`); `client` (trim and required only).
- **Source:** `src/components/lexicon/AddWordDialog.vue:96,104`.

#### LEX-04 · Definition: at least 1 character, quote notes included
`definition` is NOT NULL and at least 1 character long. A quote's "Note (optional)" is stored in `definition`. The UI sends `''` when the note is empty, and the database rejects it, so **a quote without a note cannot be saved** ⚠ LEX-D01.

Live: the database holds zero `quote` rows.
- **Enforced:** `server:db` (`lexicon_entries_definition_check`).
- **Source:** `AddWordDialog.vue:105,181-182`.
- **Note:** what to do with quote notes is decision LEX-Q01.

#### LEX-05 · Context sentence
`context_sentence` is nullable, unbounded text.
- **Manual:** the trimmed field value, or `null` when empty.
- **Auto:** the first sentence of the captured text that contains the word, ≤ 280 chars (LEX-89).
- **Enforced:** `client`.
- **Source:** `AddWordDialog.vue:107`; `useVocabularyExtraction.ts:31-39`.

#### LEX-06 · Page found: ≥ 1 or null, no upper bound
`page_found` is a nullable integer ≥ 1. Neither the client nor the database checks it against `books.total_pages`.

The add form's `InputNumber :min="1"` does not protect the pre-filled value. PrimeVue 4.5.5 clamps only on blur, spin or key input (`onInputBlur` → `validateValue`). The Book Detail pre-fill is `progress.currentPage`, which can be `0`; if the reader never focuses the field, `0` is sent and the CHECK rejects it ⚠ LEX-D04.
- **Enforced:** `server:db` (`lexicon_entries_page_found_check`); `client` (`:min`, applied on blur only).
- **Source:** `AddWordDialog.vue:34,214`; `src/pages/BookDetailPage.vue:351`; `node_modules/primevue/inputnumber/index.mjs` (`onInputBlur`, `validateValue`).
- **Note:** validating against the book length is decision LEX-Q25.

#### LEX-07 · Column defaults
| Column | Default / constraint |
|---|---|
| `id` | `gen_random_uuid()` |
| `leitner_box` | `1`, NOT NULL, CHECK 1–5 (`lexicon_entries_leitner_box_check`) |
| `next_review_at` | **`date`** NOT NULL `DEFAULT CURRENT_DATE`. The server TimeZone is UTC, so this is the **UTC calendar date** |
| `created_at` | `timestamptz` NOT NULL `DEFAULT now()`. Auto rows send the client time instead (LEX-89) |
| `mastered` | `false`, NOT NULL |
| `last_reviewed_at` | `timestamptz`, nullable, no default |
- **Enforced:** `server:db`.
- **Source:** live `information_schema.columns`.
- **Target:** a new entry's first due date is a date in the reader's IANA time zone (D-07 · BC-06). A column default cannot know that zone, so one of two things must happen:
  - every client sends `next_review_at` as the reader's local date; or
  - a BEFORE INSERT trigger derives it from the stored reader time zone when the column is omitted, falling back to UTC.

  Either way, current PWA inserts keep working (D-05). Whether a new entry is first due "today" or "tomorrow" is decision LEX-Q04.

#### LEX-08 · Owner-only access; book ownership is not checked
Since 2026-10-19 (BC-01) four per-command policies (`lexicon_entries_select_own`, `_insert_own`, `_update_own`, `_delete_own`, role `authenticated`) check `user_id = (select auth.uid())`. INSERT and UPDATE also require `book_id` to belong to the caller; otherwise the write fails with `42501` (LEX-D31, fixed). `anon` has no table privileges.

Foreign keys: `book_id → books(id) ON DELETE CASCADE`, `user_id → auth.users(id) ON DELETE CASCADE`.
- **Enforced:** `server:db` (RLS policies, FKs).
- **Source:** migration `20261018120000_bc01_security_hardening.sql`; live `pg_constraint`.

#### LEX-09 · No uniqueness, no triggers
There is no unique constraint on `(user_id, term)` or `(user_id, book_id, term)`, and no trigger on `lexicon_entries`.
- **Manual adds** perform no duplicate check: the same word can be saved any number of times.
- **Auto-extraction** is the only path that de-duplicates (LEX-88).
- **Enforced:** none, apart from the client-side dedupe for auto entries.
- **Source:** live `pg_constraint`, `pg_trigger` (empty for this table).
- **Note:** de-duplicating manual adds is decision LEX-Q09.

### B. Add Word

#### LEX-10 · Book association
The dialog receives a `bookId` in two cases, and then the book is **fixed** and no selector is shown:
- it was opened from Book Detail;
- it was opened from the Codex while the Lexicon book filter is set (the Codex passes `bookFilter ?? undefined`).

Otherwise a searchable, required `Select` lists **all** library books (`booksStore.books`), including completed and DNF books (⚠ LEX-D37). The error copy is "Please select a book".

Spec 005 FR-002 asked for a **visible, pre-filled** selector. Instead the code hides the selector, so the reader can change the book only by clearing the Codex book filter first.
- **Enforced:** `client`.
- **Source:** `AddWordDialog.vue:49-54,95,129-145`; `GreatLibraryPage.vue:351`.

#### LEX-11 · Type toggle
A `SelectButton` offers "Word" / "Quote" and defaults to `dictionary`. The dialog header reads "Add Word" or "Add Quote".
- **Enforced:** `client`.
- **Source:** `AddWordDialog.vue:32,41-44,122,150`.

#### LEX-12 · Auto-definition lookup on blur
**When it runs:** on blur of the Word field, when `term.trim()` is non-empty and the type is `dictionary`.

**Sequence:**
1. Clear `definition` and `phonetic`.
2. Call `lookupWord(term.trim())`, which sends `GET https://api.dictionaryapi.dev/api/v2/entries/en/{encodeURIComponent(term)}`.
3. On success, take:
   - `definition` = `data[0].meanings[0].definitions[0].definition`;
   - `phonetic` = `data[0].phonetic`, else the first `data[0].phonetics[].text` that is set, else null.
4. Return `null` on a non-2xx response, a network error, a JSON error or a missing definition. On `null` the definition stays empty and the reader must type one; no message is shown.

Because the field is cleared first, **every blur of the Word field wipes a definition the reader typed** ⚠ LEX-D05.
- **Enforced:** `client`.
- **Source:** `AddWordDialog.vue:57-68`; `src/composables/useLexicon.ts:2-14`.
- **Note:** English only (`/en/`, decision LEX-Q11). There is no fallback provider. Multi-word phrases are accepted; the API simply returns 404 for them.

#### LEX-13 · Lookup re-runs when switching back to Word
Switching the type back to `dictionary` re-runs the lookup when a term is present and the definition is empty.
- **Enforced:** `client`.
- **Source:** `AddWordDialog.vue:71-75`.

#### LEX-14 · The phonetic is display-only
`phonetic` is shown in italics in the Definition label. It is **never persisted** — there is no column for it — and never shown again.
- **Enforced:** `client`.
- **Source:** `AddWordDialog.vue:183-186`.
- **Note:** storing it is decision LEX-Q10.

#### LEX-103 · Dictionary content is CC BY-SA and shown without attribution
Free Dictionary API entries are Wiktionary-derived. Each response carries `license: {name: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0"}` and `sourceUrls: ["https://en.wiktionary.org/wiki/<word>"]` (observed 2026-10-18).

The client ignores both fields and shows no attribution anywhere. Looked-up definitions are stored verbatim in `lexicon_entries.definition` ⚠ LEX-D51.
- **Enforced:** `client`.
- **Source:** `src/composables/useLexicon.ts:4-10`; the repo has no "Wiktionary" or licence string.
- **Note:** decision LEX-Q26.

#### LEX-15 · Save validation
On Save, every failing check is collected and shown inline, and nothing is sent while any error exists:

| Check | Error copy |
|---|---|
| A book is selected (only when there is no `bookId` prop) | "Please select a book" |
| The term is non-empty after trimming | "Word is required" / "Quote is required" |
| The definition is non-empty after trimming — dictionary only | "Definition is required" |

The checks have these gaps:
- **Blur-then-Save race ⚠ LEX-D40.** Tapping Save straight from the Word field fires the field's blur first. The blur handler clears `definition` synchronously and starts the async lookup. Then `onSave` runs with an empty definition and shows "Definition is required". A moment later the lookup fills the field, and the reader must tap Save again.
- **Missing limits.**
  - The client has no maximum term length; the database caps it at 200 and fails silently (LEX-03).
  - Quotes have no note check (LEX-04).
  - `page_found` has no upper bound (LEX-06).
- **No lookup gate.** Save is not blocked while a lookup is in flight.
- **Double submit is prevented.** The Save button shows `:loading` and is disabled while saving.
- **Enforced:** `client`.
- **Source:** `AddWordDialog.vue:57-62,93-98,161,219`.

#### LEX-16 · Manual insert payload
`INSERT lexicon_entries {user_id, book_id, term: trimmed, definition: trimmed, entry_type, context_sentence: trimmed || null, page_found}` with `.select().single()`.

`leitner_box`, `next_review_at`, `mastered` and `source` come from the column defaults. A new manual word is therefore **box 1, due on the server's UTC date** — reviewable immediately, as long as the UTC date ≤ the local date.
- **Enforced:** `client` (payload); `server:db` (defaults).
- **Source:** `src/stores/lexicon.ts:92-128`.
- **Target:** the entry is due on the reader's local date (D-07 · BC-06; see LEX-07). Due today versus tomorrow is decision LEX-Q04.

#### LEX-17 · After a successful add
1. The store prepends the entry to `entriesByBook[bookId]` and marks the SWR keys `lexicon:{uid}:{bookId}` and `lexicon:{uid}:all` fresh.
2. The dialog emits `saved`, resets and closes.
3. **Codex only:** it then calls `search({force: true})`, which re-fetches page 0 and the book-filter options. That refreshes only the **active** results-cache key ⚠ LEX-D18.
4. **Book Detail:** it only closes the dialog. Its "Words N" chip updates from the store.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:118-127`; `AddWordDialog.vue:110-111`; `GreatLibraryPage.vue:94-98`; `BookDetailPage.vue:347-354`.

#### LEX-18 · A failed add is silent
`addEntry` throws, but `onSave` has `try/finally` with **no `catch`**, so:
- no toast or inline error is shown;
- the dialog stays open with the values;
- the spinner stops;
- the promise rejection is unhandled.

The causes include network errors, RLS denials, CHECK violations (a quote without a note, a quote over 200 chars, page 0) and being offline. ⚠ LEX-D03
- **Enforced:** `client`.
- **Source:** `AddWordDialog.vue:100-114`.

#### LEX-19 · A hidden context value is submitted with a quote
The Context field is shown only for words. Its value is kept when the reader switches to Quote, and it is still submitted as `context_sentence` ⚠ LEX-D39.
- **Enforced:** `client`.
- **Source:** `AddWordDialog.vue:33,107,200`.

### C. Quotes

#### LEX-20 · Quote form
The quote form has four fields:
- **"Quote *"** — a multi-line passage stored in `term` (3 rows, auto-resize, sample placeholder `"Not all those who wander are lost."`);
- **"Note (optional)"** — stored in `definition` (placeholder "Why this passage stayed with you");
- no Context field;
- an optional Page.

There is no dictionary lookup for quotes. Despite the "optional" label, an empty note cannot be saved (LEX-04).
- **Enforced:** `client`; `server:db` (LEX-03/04).
- **Source:** `AddWordDialog.vue:165-215`.

#### LEX-21 · Quotes are keepsakes
Quotes are kept out of review but counted in some totals:

| Excluded from | Included in |
|---|---|
| WotD normal selection | Codex list (type filter "Quotes") |
| The Anki deck | Book Detail "Words N" chip count (LEX-102) |
| Eligibility and today's set | Book Passport `vocabularyCount` (LEX-99) |
| Due counts | Community highlights — dormant (LEX-100) |
| Mastery | The **tally**, if ever reviewed (they cannot be) |
| The Codex header "N words" (LEX-82) | The WotD **preview** fallback — a mistake ⚠ LEX-D14 |
- **Enforced:** `client` (`reviewableEntries`).
- **Source:** `lexicon.ts:326-331`; `BookDetailPage.vue:84`.

#### LEX-22 · Quote badge says "Lore"
`LexiconCard` renders the badge "Lore" (amber) for quotes. Filters and the add form say "Quote" ⚠ LEX-D27.
- **Enforced:** `client`.
- **Source:** `src/components/lexicon/LexiconCard.vue:48`.

### D. Edit and delete

#### LEX-23 · No edit, delete, un-master or re-assign
The client offers no way to edit, delete, un-master or move an entry. After the insert, the only writes are:
- the review writes (LEX-27, LEX-29);
- Undo (LEX-63).

Entries disappear only through the book-delete and account-delete cascades (LEX-93, LEX-96). Live cross-check: the ledger reports 616 auto words added, and exactly 616 `source = 'auto'` rows exist, so nothing has ever been deleted.
- **Enforced:** `client` (absence of UI). RLS would allow an owner `DELETE` / `UPDATE`.
- **Source:** grep — no `.delete()` and no non-review `.update()` on `lexicon_entries` in `src/`.
- **Note:** decision LEX-Q02.

### E. Leitner scheduling and review outcomes

The three surfaces write different outcomes:

| Surface → action | `leitner_box` | `next_review_at` | `mastered` | `last_reviewed_at` |
|---|---|---|---|---|
| WotD arrow ("Mark as reviewed") = **advance** | `min(box + 1, 5)` | local today + `INTERVALS[newBox − 1]` | unchanged | device now |
| Anki "Knew it" = **master** | unchanged | unchanged | `true` | device now |
| Anki "Didn't know" = **reset** | `1` | local today | unchanged | device now |
| Anki **Undo** (last answer only) | snapshot | snapshot | snapshot | snapshot (may be `null`) |

There is no "didn't know" on the WotD, and no advance in Anki.

#### LEX-24 · Five boxes and the interval table
There are 5 boxes. `INTERVALS = [1, 2, 4, 8, 16]` days, indexed by `box − 1`.
- **Enforced:** `client`; `server:db` (only the box range 1–5).
- **Source:** `src/composables/useLeitner.ts:5`.
- **Target (recommended — BC-10):** the interval table and every transition live in one server function, `review_lexicon_entry(entry_id, outcome, surface)`. It returns `{leitner_box, next_review_at, mastered}`, so every client and future widget or notification surface agrees by construction (D-06). Until the PWA migrates, direct table updates stay allowed (D-05).

#### LEX-25 · Advance (WotD only)
`newBox = min(box + 1, 5)` and `next_review_at = localToday + INTERVALS[newBox − 1]`. So:
- moving to box 2 schedules +2 days, box 3 +4 days, box 4 +8 days, box 5 +16 days;
- a box-5 word stays in box 5 and is re-scheduled +16 days on every advance — **the WotD never masters**;
- the 1-day interval of box 1 is **never used**, although the interval table lists it.
- **Enforced:** `client`.
- **Source:** `useLeitner.ts:16-19`.
- **Target (recommended — BC-10):** `review_lexicon_entry(…, outcome = known, surface = wotd)` performs the advance, computing "today" in the reader's time zone (D-07). Whether the WotD should ever master is decision LEX-Q03.

#### LEX-26 · Reset (Anki "Didn't know" only)
`box = 1`, `next_review_at = localToday`. The same write stamps `last_reviewed_at`, so the word is excluded for the rest of the local day and **comes back tomorrow** (LEX-34).
- **Enforced:** `client`.
- **Source:** `useLeitner.ts:21-24`.
- **Target (recommended — BC-10):** `outcome = unknown` (any surface) resets, using the reader's time zone (D-07).

#### LEX-27 · Review write mechanics (advance and reset)
`updateLeitner(entryId, action)`:
1. Find the entry in the in-memory store. If it is not loaded, return silently without writing ⚠ LEX-D48.
2. Compute the update. Take `nowIso = new Date().toISOString()` from the device clock.
3. Apply the change optimistically in the store.
4. `UPDATE lexicon_entries SET leitner_box, next_review_at ('yyyy-MM-dd'), last_reviewed_at = nowIso WHERE id = :id`.
5. **On success:** mark both lexicon SWR keys fresh.
6. **On error:** restore the snapshot and **rethrow**. No caller shows the error (⚠ LEX-D11, LEX-D12).
7. If the entry was the current WotD: remove the WotD `localStorage` cache and re-resolve the WotD.
- **Enforced:** `client`; `server:db` (RLS, box CHECK).
- **Source:** `lexicon.ts:184-233`.
- **Target (recommended — BC-10):**
  - one RPC call per answer, with `last_reviewed_at = now()` on the **server clock**;
  - it returns the new state, which the client applies;
  - it is idempotent per answer.

#### LEX-28 · Review dates are device-local
- `formatISODate` = date-fns `format(date, 'yyyy-MM-dd')` in the device's local time.
- `addDays` uses `Date.setDate(getDate() + n)`: calendar days, safe across DST.
- `last_reviewed_at` is a UTC instant from the **client** clock, not the server's `now()`.
- **Enforced:** `client`.
- **Source:** `useLeitner.ts:7-13`; `src/utils/date.ts:36-37`.
- **Target:** every day computation uses the reader's IANA time zone, and the server stamps review instants (D-07 · BC-06 / BC-10).

### F. Mastery

#### LEX-29 · Only Anki "Knew it" masters
A word becomes **Mastered** only when it is answered "Knew it" in the Anki session, **whatever its box**. Live data has mastered words in every box from 1 to 5.

`masterWord(entryId)` writes:
1. optimistically `{mastered: true, lastReviewedAt: now}`;
2. `UPDATE lexicon_entries SET mastered = true, last_reviewed_at = nowIso WHERE id`.

`leitner_box` and `next_review_at` are **left unchanged**. On error the change is rolled back and rethrown. If the word was the WotD, the WotD cache is cleared and re-resolved. Like LEX-27, the write is silently skipped when the entry is not loaded.
- **Enforced:** `client`.
- **Source:** `src/composables/useAnkiSession.ts:57-65`; `lexicon.ts:238-283`.
- **Note:** spec 024 FR-010 ("Knew it advances the box") is superseded by spec 031.
- **Target (recommended — BC-10):** `review_lexicon_entry(…, outcome = known, surface = anki)` masters, and returns `mastered = true`.

#### LEX-30 · Mastery is terminal
No UI un-masters a word. The only reversal is **Undo of the last Anki answer** while the reader is still on the review page (LEX-63).
- **Enforced:** `client`.
- **Note:** decision LEX-Q02.

#### LEX-31 · What mastery removes a word from
A mastered word is **excluded from**:
- the eligible set and today's set;
- WotD normal and preview picks;
- the Anki deck;
- `dueTodayCount`.

It **stays** in the Codex list with a "✓ Mastered" badge and is counted in the header "M mastered".
- **Enforced:** `client`.
- **Source:** `lexicon.ts:159-168,333-336,377-383`; `LexiconCard.vue:50-52`.

#### LEX-32 · Mastery has no other effect
Mastering awards no XP or achievements and changes no statistics: no other client code reads `mastered`. The community RPC defines "mastered" as `leitner_box >= 5` instead (LEX-100, ⚠ LEX-D25).
- **Enforced:** `client`.
- **Note:** the BC-09 server-side achievement catalogue has no lexicon key today.

### G. Due set and eligibility

#### LEX-33 · Reviewable means not a quote
Reviewable = `entry_type !== 'quote'`.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:329-331`.

#### LEX-34 · Eligibility and order
`eligibleReviewWords` keeps every entry that meets all four conditions:
1. it is reviewable;
2. it is not mastered;
3. `next_review_at <= localToday` — a lexicographic `yyyy-MM-dd` comparison, with `localToday = formatISODate(new Date())`;
4. it has **not** been reviewed today (`last_reviewed_at >= ` local midnight).

It is sorted by `leitner_box` ascending ("most fragile first"), then by `next_review_at` ascending ("most overdue first"). Remaining ties keep store order — book-group insertion order, then `created_at` desc — so the order is **not deterministic across devices**. Spec 005 FR-008 asked for a `createdAt` tie-break.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:354-361,377-383`.
- **Target (recommended — BC-10):**
  - a server due-set query in the reader's time zone (D-07 · BC-06);
  - a deterministic tie-break (`next_review_at`, then `created_at`, then `id`);
  - it returns today's set, the tally and `extraAvailable`.

#### LEX-35 · `dueTodayCount` is dead and uses UTC
`dueTodayCount` uses the **UTC** date (`toISOString().slice(0, 10)`) and ignores the reviewed-today filter. It is exported, but no UI uses it; only tests do ⚠ LEX-D29.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:333-336`.

### H. Daily review limit

#### LEX-36 · The limit is 20
`DAILY_REVIEW_LIMIT = 20`. It is not user-configurable.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:19`.
- **Note:** making it configurable is decision LEX-Q18.

#### LEX-37 · The tally
`reviewedTodayCount` counts the **loaded** entries, of any type and mastery state, whose `last_reviewed_at >=` local midnight on the viewing device.
- **Once per word:** a word counts once per day, however many actions touched it.
- **What stamps it:** advance, reset and master all stamp `last_reviewed_at`.
- **Shared across devices:** the tally is account-wide because the column is persisted. The day boundary, however, is each device's own local midnight.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:364-367`.
- **Target (recommended — BC-10):** the tally is computed server-side from the start of today in the reader's IANA time zone (D-07 · BC-06).

#### LEX-38 · Remaining allotment
`dailyRemaining = max(0, 20 + extraAllotment − reviewedTodayCount)`.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:371-373`.

#### LEX-39 · Today's set is one shared pool
`todaysReviewSet` (alias `activeReviewWords`) = `eligibleReviewWords.slice(0, dailyRemaining)`.
- It is the **single shared pool** for both WotD and Anki (spec 032 FR-003).
- A partial session never re-expands it, because remaining = 20 − tally.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:385-388`.

#### LEX-40 · Extra words are waiting
`extraAvailable = eligibleReviewWords.length > todaysReviewSet.length`. It drives every "Review more" control.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:390`.

#### LEX-41 · "Review more" adds 20, in memory only
`enableReviewMore()`:
1. `extraAllotment += 20` per tap;
2. removes the WotD cache;
3. re-resolves the WotD.

`extraAllotment` is an **in-memory ref**:
- it is lost on reload or relaunch;
- it is not synced across devices;
- it is **not reset at local midnight** while the app stays open ⚠ LEX-D17.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:342-352`.
- **Note:** whether the allotment should persist is decision LEX-Q05.

#### LEX-42 · The cap is soft
No due date changes for words beyond the cap (spec 032 FR-006). They simply wait.
- **Enforced:** `client`.

#### LEX-43 · Undo restores the tally
Undo writes back the previous `last_reviewed_at`, which may be `null`, so the tally goes down accordingly (LEX-63).
- **Enforced:** `client`.

### I. Word of the Day

#### LEX-44 · When the WotD is resolved
`resolveWordOfTheDay(userId)` runs:
- on Dashboard mount, after `fetchEntriesForAllBooks()`;
- when the `WordOfTheDay` component mounts;
- after advancing or mastering the current WotD entry;
- after `enableReviewMore`.
- **Enforced:** `client`.
- **Source:** `DashboardPage.vue:170-174`; `WordOfTheDay.vue:62-66`; `lexicon.ts:227-232,277-282,347-351`.

#### LEX-45 · The daily cache is keyed by the UTC date
The cache is `localStorage["bookhero_wotd_" + userId] = {date: "YYYY-MM-DD", entryId, isPreview}`, where `date` is the **UTC** date (`new Date().toISOString().split('T')[0]`).
- **Cache hit:** if `cache.date` equals today's UTC date, the cached `entryId` / `isPreview` are used **without re-validation**. The entry may since have been reviewed, mastered or deleted on another device or tab ⚠ LEX-D16.
- **Errors:** malformed JSON is ignored. Storage errors are swallowed.
- **Writes:** the cache is written only when a pick exists.
- **Sign-out:** the key is never removed.
- **Stale pick across the local day boundary ⚠ LEX-D42:**
  - *East of UTC*, local midnight comes before the UTC date changes (at UTC+9, 00:00–08:59 local is still "yesterday" in UTC). In that window the tally has already reset, but the cache is still valid. A cached preview from the previous evening ("Daily review done!" / "All caught up!") keeps showing although a fresh allotment of 20 is due. When `extraAvailable` is now false, the card even reads "All caught up! Next word due …" while words are due. The stale pick clears only at UTC midnight or on a cache-clearing action.
  - *West of UTC*, the cache rolls over mid-evening (21:00 at UTC−3) and re-picks against the same local day's tally. That is harmless.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:22,132-148,173-179`.
- **Target:** the cache is keyed by the reader's **local** date (D-07 · BC-06). Native clients re-validate the cached id against the current eligible set on every resolve. Under BC-10 (recommended) the pick can come from the server's due-set query.

#### LEX-46 · Nothing loaded means no pick
If no entries are loaded at resolve time, the result is `entryId = null` and `isPreview = false`, and nothing is cached.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:150-155`.

#### LEX-47 · The pick
- **Normal pick:** `activeReviewWords[0]` — the lowest box, the most overdue, not reviewed today, within today's cap. Then `isPreview = false`.
- **Preview pick:** when today's set is empty, take **all loaded entries, quotes included** (⚠ LEX-D14), keep the ones that are not mastered, and pick the one with the smallest `next_review_at`. Then `isPreview = true`.
- **All mastered:** `entryId = null` with `isPreview = true`, not cached.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:157-171`.

#### LEX-48 · Resolving the id
`wordOfTheDay` looks the id up among the loaded entries. A missing id resolves to `null`.
- **Enforced:** `client`.
- **Source:** `lexicon.ts:317-320`.

#### LEX-49 · Card state precedence
The first matching state wins:

| # | Condition | Label / title / hint | Interaction |
|---|---|---|---|
| 1 | `showAnkiPrompt` (LEX-54) | "Vocabulary Review" / "Ready for review" / "Tap to start your flashcard session." | Whole card is a button: tap or Enter → `/anki-review` |
| 2 | `isPreview && extraAvailable` | "Word of the Day" / "Daily review done!" / "You've cleared today's words. More are waiting." | "Review more" button; the card itself is not clickable |
| 3 | `entry && isPreview` | "Word of the Day" / "All caught up!" / "Next word due {label}." (LEX-50) | Card → Codex (LEX-51) |
| 4 | `entry` | "Word of the Day" + a "{N} left" pill (N = `activeReviewWords.length`, only when > 0); the term; the definition; "from: *{book title}*" — or "(removed book)" when the book no longer resolves — plus " · p.{page}" when present; a round arrow button (title "Mark as reviewed") = **advance** | Card → Codex; the arrow advances (LEX-52) |
| 5 | otherwise | renders **nothing** — all words mastered, no entries, or a stale cached id ⚠ LEX-D15 | — |
- **Enforced:** `client`.
- **Source:** `WordOfTheDay.vue:16-28,70-179`.

#### LEX-50 · "Next word due" label
The label is computed as `diff = diffInDays(new Date(nextReviewAt), new Date())`:
- `nextReviewAt` is a date-only string, so `new Date()` parses it as **UTC midnight**;
- `diffInDays` wraps date-fns 4.1 `differenceInDays`, which counts **full local days and drops the partial day**.

Copy: `diff <= 1` → "tomorrow"; `diff <= 6` → "in {diff} days"; otherwise "on {MMM d, yyyy}".

The label **under-reports by one day in practically every time zone** ⚠ LEX-D49:
- a word due in 2 calendar days reads "tomorrow" at 10:00 local in UTC, UTC−3 and UTC+9 alike;
- a word due in 7 days reads "in 6 days";
- it is correct only in the first |offset| hours after local midnight east of UTC.

A word due today or overdue gives `diff <= 0` → "tomorrow".
- **Enforced:** `client`.
- **Source:** `WordOfTheDay.vue:31-38`; `src/utils/date.ts:58-61`. Verified by executing date-fns 4.1.0 under UTC, America/Sao_Paulo and Asia/Tokyo.
- **Target:** a calendar-day difference between today and the due date in the reader's IANA time zone (D-07).

#### LEX-51 · Tapping the card opens the Codex unfiltered
A tap on the normal or caught-up card navigates to `/lexicon?bookId={entry.bookId}`. The Codex applies `bookId` only to the **Insights** tab filter, so the Lexicon tab opens **unfiltered** ⚠ LEX-D06.
- **Enforced:** `client`.
- **Source:** `WordOfTheDay.vue:40-42`; `GreatLibraryPage.vue:63,133-135`.
- **Note:** decision LEX-Q08.

#### LEX-52 · Advance button
- The button is disabled and shows a spinner while the write is in flight.
- It calls `updateLeitner(id, 'advance')`.
- A failure is not caught, so the reader gets no feedback ⚠ LEX-D12.
- **Enforced:** `client`.
- **Source:** `WordOfTheDay.vue:44-54`.

#### LEX-53 · When the WotD slot is visible
The WotD slot, and therefore the Anki prompt, renders only when the dashboard onboarding state is `standard` or `oneInProgress`. It is **hidden** in three states:
- `empty` — no books;
- `oneQueued` — exactly one unread book, nothing in progress, nothing completed;
- `completedOnly` — nothing in progress, nothing unread, at least one completed book.

Readers in those states have no in-app path to review ⚠ LEX-D36.

A reader with two or more unread books and nothing else, or with only DNF books, falls through to `standard` and **does** see the WotD. (DNF books are excluded from the queued books.)

**Load-failure path ⚠ LEX-D46.** The Dashboard mount awaits library → progress + up-next → `fetchEntriesForAllBooks()` inside one `try`. If progress, up-next or the lexicon fetch throws, `resolveWordOfTheDay` **and** `ankiSessionStore.fetchSession` are skipped. (Library failures are recorded in the store, not thrown.) The WotD component still resolves on its own mount, but the Anki session store stays unloaded, so the Anki prompt cannot appear on that visit.
- **Enforced:** `client`.
- **Source:** `DashboardPage.vue:156-189,224-228,401-407`; `src/composables/useDashboardOnboardingState.ts:21-26,36-94`.
- **Note:** onboarding states are SES-55. Whether readers in these states should still see the slot is decision LEX-Q06.

### J. Vocabulary Review (Anki) prompt

#### LEX-54 · Prompt condition
`showAnkiPrompt = isDueForReview && activeReviewWords.length >= 5`. Spec 024 FR-002 said "≥ 5 lexicon entries"; the code gates on today's **capped** set.

Today's set is `min(eligible, 20 + extra − tally)`. So once **16 or more** words have been reviewed today (for example with the WotD arrow), the set has at most 4 words, and the prompt **cannot appear for the rest of the local day** even after ≥ 72 h. The only way round is "Review more", which shows only once the set is empty.
- **Enforced:** `client`.
- **Source:** `WordOfTheDay.vue:16-20`.

#### LEX-55 · Session cadence (≥ 3 days)
`isDueForReview` is:
- `false` until the store has loaded;
- `true` when no `anki_review_sessions` row exists;
- otherwise `differenceInDays(now, last_reviewed_at) >= 3` (`REVIEW_INTERVAL_DAYS = 3`).

That counts full local days — the same wall-clock time 3 days later — so it is ≈ 72 h, and 71 h or 73 h across a DST change.

A fetch **error** marks the store loaded with no row, which makes the prompt eligible ⚠ LEX-D32.
- **Enforced:** `client`.
- **Source:** `src/stores/ankiSession.ts:6,15-31`; `src/utils/date.ts:58-61`.
- **Note:** this is elapsed time, not a day boundary, so D-07 does not change it. The cadence itself is decision LEX-Q06.

#### LEX-56 · The session row is fetched only on the Dashboard
`fetchSession` runs only on Dashboard mount. The Anki page never calls it ⚠ LEX-D09.
- **Enforced:** `client`.
- **Source:** `DashboardPage.vue:173`.

#### LEX-57 · Prompt navigation and direct access
- The prompt replaces the WotD card entirely. Tap or Enter → `router.push({name: 'anki-review'})`.
- The Codex has no entry point to the review page.
- `/anki-review` is reachable directly by URL or reload; it requires auth only, and it highlights no bottom-nav tab. Spec 024 FR-003 said it should not be directly reachable, but the page was deliberately made deep-link safe (LEX-58).
- **Enforced:** `client`.
- **Source:** `WordOfTheDay.vue:72-80`; `src/router/index.ts:82-86`.

### K. Anki session

#### LEX-58 · Mount
The page runs `Promise.all([lexiconStore.fetchEntriesForAllBooks(), booksStore.fetchLibrary()])`, swallows errors, then sets `ready = true`. While `!ready` and the deck is empty, it shows a blank deck area with no spinner.
- **Enforced:** `client`.
- **Source:** `src/pages/AnkiReviewPage.vue:40-54`.

#### LEX-59 · The deck
The deck is `[...activeReviewWords].sort((a, b) => b.leitnerBox − a.leitnerBox).slice(0, 20)`. Its words are **chosen** lowest-box-first (today's set), but **presented highest box first** (spec 031 FR-010).
- **Same box:** the deck keeps today's-set order (most overdue first, then store order), because the sort is stable.
- **Snapshot:** the deck is snapshotted, and it is rebuilt on changes to `activeReviewWords` **only while nothing has been answered** (index 0 and both counters 0).
- **Rebuild under the reader ⚠ LEX-D47 (plausible, not reproduced):** any store change while the reader is still on the *first* card can replace the deck — and so the visible card. Examples are a tab-refocus SWR revalidation and an extraction refresh. The same condition becomes true again right after undoing the very first answer.
- **Enforced:** `client`.
- **Source:** `useAnkiSession.ts:12-31`.

#### LEX-60 · Card faces
- **Front:** the term, a speaker button when supported (LEX-69), and "tap to reveal".
- **Back:** the definition; the context in quotes, if any; and the source "*{book title}* · p.{page}". The book title is `''` when the book is not found.

A tap toggles the flip; taps are ignored while the card is exiting.
- **Enforced:** `client`.
- **Source:** `src/components/anki/SwipeableFlashcard.vue:84-120`; `AnkiReviewPage.vue:32-33`.

#### LEX-61 · Answer gating and gestures
**Gating.** "Didn't know" / "Knew it" appear **only after the card is flipped**. A swipe (VueUse `useSwipe`, threshold 60 px) commits only when the card is flipped and `|Δx| > 80 px`: right = Knew it, left = Didn't know.

**Exit.** An exit animation runs, and the answer event is emitted after **230 ms**.

**Behaviour while dragging and exiting:**
- The drag transform — `translateX` plus a 0.04°/px tilt — applies even **before** the flip. An unflipped card follows the finger and snaps back without answering.
- The buttons are hidden while exiting (`v-if="isFlipped && !exiting"`), so a double tap cannot answer twice.
- There are no keyboard shortcuts. The card is a non-focusable `div` with a click handler.
- The answer handler acts on `currentCard` **at emit time**, not on the card that was swiped.
- **Enforced:** `client`.
- **Source:** `SwipeableFlashcard.vue:18-50,86-91,122-139`; `useAnkiSession.ts:58-60,67-69`; `AnkiReviewPage.vue:163-169`.

#### LEX-62 · What each answer does
- **"Knew it":** snapshot the card → `masterWord` → `sessionKnown++` → next card.
- **"Didn't know":** snapshot → `updateLeitner(id, 'reset')` → `sessionUnknown++` → add the card to `missedCards` → next card.

Each answer is persisted immediately (spec 024 FR-012). If a write fails, the exception propagates; the card stays invisible in the exiting state with no buttons, while the undo slot already holds the snapshot ⚠ LEX-D11.
- **Enforced:** `client`.
- **Source:** `useAnkiSession.ts:57-75`.
- **Target (recommended — BC-10):**
  - each answer is one `review_lexicon_entry(entry_id, outcome, surface = 'anki')` call;
  - the client sends the **entry id**, never the "current index";
  - the client advances only after success.

#### LEX-63 · Undo (one level)
**When it shows.** The header pill "Undo" is visible whenever an answer is held, including on the summary screen.

**What it does:**
1. `restoreEntryState(snapshot)` writes `leitner_box`, `next_review_at`, `mastered` and `last_reviewed_at` back from the snapshot (optimistic; rolled back and rethrown on error).
2. It decrements the matching counter (floored at 0) and removes the card from the missed list.
3. It sets `currentIndex − 1` and clears the undo slot.

The snapshot is `{...card}` taken from the deck array, i.e. the state when the deck was built. That equals the pre-answer state only because each card is answered at most once per batch.

**Undo race ⚠ LEX-D41 (plausible, not reproduced):**
- The Undo pill for the previous answer stays visible during the next card's 230 ms exit animation. Tapping it moves `currentIndex` back to the previous card. The pending event then fires (the `setTimeout` is not cancelled on unmount), so the handlers answer **the previous card again**, and the swiped card is never answered.
- `undoLast` awaits the database write before decrementing, with no in-flight guard. A fast double tap therefore issues two restores of the same snapshot and **steps back two cards**, although only one answer was undone.
- **Enforced:** `client`.
- **Source:** `useAnkiSession.ts:39-55`; `lexicon.ts:287-313`; `AnkiReviewPage.vue:70-77`.
- **Target (recommended — BC-10):** "undo support" is part of the review RPC — e.g. it returns the prior state or a review id, which a restore call reverts only while it is still that entry's latest review. Clients keep the single-level semantics.

#### LEX-64 · Progress indicator
The header shows "{min(index + 1, n)} / {n}", with a 4-px bar of width `min(index, n) / n`.
- The counter is always rendered, so the empty and loading states show "0 / 0".
- The bar is hidden when `n = 0`.

Spec 031 FR-005 asked for "5 of 15" wording; the code uses "5 / 15".
- **Enforced:** `client`.
- **Source:** `AnkiReviewPage.vue:78-94`.

#### LEX-65 · Summary
The summary shows when `index >= n`:
- **Title:** "Great session!" if `sessionKnown / n >= 0.7`, otherwise "Keep practising!".
- **Stats:** Reviewed = n, "Knew it", "Didn't know".
- **"Worth another look":** the missed words, each with a one-line definition.
- **Buttons:** "Review more" (when `extraAvailable`) and "Back to dashboard".
- **Enforced:** `client`.
- **Source:** `AnkiReviewPage.vue:117-158`.

#### LEX-66 · Empty deck
The icon is a check in both cases, and "Back to dashboard" is always shown:
- if `extraAvailable`: "Daily review done!" / "You've cleared today's words — more are waiting." plus "Review more";
- otherwise: "You're all caught up!" / "No words due for review today."

The punctuation differs from the WotD copy (a period there, a dash here).
- **Enforced:** `client`.
- **Source:** `AnkiReviewPage.vue:100-114`.

#### LEX-67 · "Review more" on the Anki page
`reviewMore()` runs `enableReviewMore()`, rebuilds the deck, and resets the index, counters, missed list, undo slot and `_saved = false`. The finished batch's counters are **not saved first** ⚠ LEX-D07.
- **Enforced:** `client`.
- **Source:** `useAnkiSession.ts:77-87`.
- **Note:** whether each batch is a separate session is decision LEX-Q07.

#### LEX-68 · The session record
`onExit(userId)` saves at most once per batch (the `_saved` guard), and only when `known + unknown >= 1`. It sends:

`UPSERT anki_review_sessions {user_id, last_reviewed_at: client now, total_sessions: storeTotal + 1, known_count: storeKnown + known, unknown_count: storeUnknown + unknown} ON CONFLICT (user_id)`.

- **Local refs:** updated only on success. Errors are ignored silently.
- **Meaning of the counts:** `known_count` is the lifetime number of words mastered through Anki, net of undo within a batch. `total_sessions` is the number of saved batches.

**Callers of `onExit`:**
- the header back arrow and "Back to dashboard" (`handleDone` → then `router.push({name: 'dashboard'})`);
- `onBeforeUnmount`, **but only when the deck is not complete** ⚠ LEX-D08.

**Defects:**
- A finished session left via the bottom nav or browser back is never recorded.
- The totals are a client read-modify-write ⚠ LEX-D10.
- They start from zero, or from stale or another user's values, when the Dashboard did not load them first ⚠ LEX-D09.
- **Enforced:** `client`; `server:db` (`anki_review_sessions_user_id_key`, owner RLS).
- **Source:** `useAnkiSession.ts:89-98`; `ankiSession.ts:47-69`; `AnkiReviewPage.vue:35-38,56-61`.
- **Target (recommended — BC-10):**
  - an atomic server increment on the server clock, with an idempotency key per batch;
  - recording on every exit path.

#### LEX-69 · Pronunciation
The speaker button is shown only when `window.speechSynthesis` exists. On tap:
1. `speechSynthesis.cancel()`;
2. `new SpeechSynthesisUtterance(term)` with `lang = 'en-US'`;
3. voice = the first voice whose `lang === 'en-US'`, else the first whose lang (`_` → `-`) starts with `en`, else the engine default.

Voices are pre-warmed at setup. Quotes never reach this screen.
- **Enforced:** `client`.
- **Source:** `SwipeableFlashcard.vue:56-81,97-105`.

### L. Codex browse, search and counts

#### LEX-70 · Server-side pagination, page size 10
`PAGE_SIZE = 10`. The query is:

`from('lexicon_entries').select('*, books(title)').eq('user_id', uid)…range(page*10, page*10+9)`

`CLAUDE.md` and spec 018 both say 20, which is stale.
- **Enforced:** `client` (query); `server:db` (RLS).
- **Source:** `src/composables/useGreatLibrarySearch.ts:16,106-142`.

#### LEX-71 · Sort
- **`newest`** (default) = `created_at DESC`.
- **`alpha`** = `term ASC`, using the database collation `en_US.UTF-8`.

The sort is toggled by a pill labelled "Newest" (clock icon) / "A–Z". There is **no secondary sort key** ⚠ LEX-D19.
- **Enforced:** `client`.
- **Source:** `useGreatLibrarySearch.ts:118-121`; `GreatLibraryPage.vue:41-43,194-205`.

#### LEX-72 · Search
`q = query.trim()`. When it is non-empty, the query adds `.or('term.ilike.%q%,definition.ilike.%q%')`: a case-insensitive substring match over **term and definition only** — not context, not book title.

`q` is interpolated **unescaped** ⚠ LEX-D20. The placeholder is "Search terms or definitions…".
- **Enforced:** `client`.
- **Source:** `useGreatLibrarySearch.ts:123-126`.

#### LEX-73 · Debounce
- Query changes are debounced **300 ms** (maxWait 1 000 ms).
- Type, sort and book changes re-search immediately.
- Every change restarts from page 0, unless the results cache restores it (LEX-77).
- **Enforced:** `client`.
- **Source:** `useGreatLibrarySearch.ts:226-233`.

#### LEX-74 · Type filter
"All | Dictionary | Quotes" → `eq('entry_type', …)` when the value is not `all`.
- **Enforced:** `client`.
- **Source:** `useGreatLibrarySearch.ts:127-129`; `GreatLibraryPage.vue:80-84`.

#### LEX-75 · Book filter options
The options are the distinct `book_id`s found in the user's lexicon rows, joined to `books(title)` (fallback "Unknown Book"), with "All Books" first.
- They are fetched **once per user per app session**, and refetched only on a forced search.
- A failed fetch silently keeps the previous (or empty) options without marking them fetched, so the next search retries.
- A book that gains its first entries later (for example through auto-extraction) does not appear until a forced search.
- **Enforced:** `client`.
- **Source:** `useGreatLibrarySearch.ts:80-104`; `GreatLibraryPage.vue:86-89,176-185`.

#### LEX-76 · Infinite scroll
- `hasMore = (rows returned == PAGE_SIZE)`.
- An `IntersectionObserver` sentinel (threshold 0.1) calls `loadNextPage`.
- The guard `!hasMore || loadingMore || loading` prevents parallel or extra loads.
- "All entries loaded" shows when `!hasMore && entries > 0`.
- **Enforced:** `client`.
- **Source:** `GreatLibraryPage.vue:100-109,310-314`; `useGreatLibrarySearch.ts:183-199`.

#### LEX-77 · Results cache
A module-level `Map` is keyed `"{uid}:{lower(trim(query))}:{type}:{sort}:{bookId|'all'}"` and stores `{entries, currentPage, hasMore}`.
- `search()` without `force` restores a cached key instantly, with no network.
- The cache is cleared only when the signed-in user id changes.
- It is **not** invalidated by mastering, review writes, auto-extraction or book deletion ⚠ LEX-D18.
- **Enforced:** `client`.
- **Source:** `useGreatLibrarySearch.ts:42,50-78,148-161`.

#### LEX-78 · Errors
- **Page-0 error:** the list is cleared, and an error `Message` with "Retry" (a forced search) is shown.
- **Next-page error:** the loaded entries are kept, and "Retry" re-fetches the failed page.

The raw PostgREST error message is shown to the reader.
- **Enforced:** `client`.
- **Source:** `useGreatLibrarySearch.ts:174-219`; `GreatLibraryPage.vue:220-231`.

#### LEX-79 · Empty and loading states
- **A filter is active** (query non-empty, type ≠ all, or a book set): "No results found." / "Try a different search term or filter." plus "Clear filters". Clearing resets the query, type and book — **not** the sort.
- **No filter:** "No words saved yet." / "Add a word while reading to build your vocabulary vault."
- **Loading:** 3 × 90-px skeletons for the first page; 2 skeletons while loading more.
- **Enforced:** `client`.
- **Source:** `GreatLibraryPage.vue:112-123,249-277`.

#### LEX-80 · Lexicon card
- **Front:** a badge — "Dictionary" (teal) or "Lore" (amber, for quotes, ⚠ LEX-D27); an optional "✓ Mastered"; an optional "p.{page}"; the term; an optional book title; the hint "tap to see definition".
- **Back:** the definition (the note, for quotes) and the context in quotes.

Tapping anywhere flips the card, and the container height animates to the active face.
- **Enforced:** `client`.
- **Source:** `src/components/lexicon/LexiconCard.vue`.

#### LEX-81 · Codex URL state
- `?tab=lore` selects Insights.
- `?bookId=` pre-sets the **Insights** book filter.
- Both are mirrored back into the URL with `router.replace`, which adds no history entries.
- The Lexicon tab's search and filter state is **not** in the URL. It is a module singleton, so it survives navigation within the session.
- **Enforced:** `client`.
- **Source:** `GreatLibraryPage.vue:45-71,133-138`.

#### LEX-82 · Header counts
The header reads "N word(s) · M mastered":
- N = loaded entries with `entry_type !== 'quote'`;
- M = loaded entries with `mastered`, of any type (⚠ LEX-D28, harmless today).

Both come from the lexicon **store** — a full-lexicon fetch on mount that does not block the page — and are independent of the search filters. The header is hidden while N = 0. N uses `toLocaleString()`, and the copy says "word" when N = 1.

Because the store and the results cache refresh differently, the header and the list can disagree within a session.
- **Enforced:** `client`.
- **Source:** `GreatLibraryPage.vue:53-60,126-128,151-154`.

#### LEX-102 · Book Detail Codex chips
The Book Detail progress panel shows two chips, both **hidden for DNF books**:
- **"Codex" (`pi-plus`):** shown for every non-DNF book, including unread and completed ones. It opens the add dialog with the book fixed and `page_found` pre-filled from `progress.currentPage` (LEX-06).
- **"Words N":** shown only when N > 0, where N = **all** entries for the book (quotes included) from the per-book store fetch. It navigates to `/lexicon?bookId=<id>` (⚠ LEX-D06).
- **Enforced:** `client`.
- **Source:** `src/components/book/BookProgressPanel.vue:154-168`; `BookDetailPage.vue:84,92,272-278,347-354`.
- **Note:** if the Book Detail recap fetch throws, the per-book lexicon load is skipped on that visit, so the "Words N" chip is missing (REC-D29 in [03 · Recaps](03-recaps.md)).

### M. Vocabulary auto-extraction

#### LEX-83 · Trigger
After a successful `page_captures` upsert in `capturesStore.saveCapture`, the client fires `triggerExtraction({captureId, bookId, page, ocrText: capture.text})` through a dynamic import, without awaiting it.
- The capture page is the reader's current progress page.
- Any error is caught and logged. The capture save is never affected.
- **Enforced:** `client`.
- **Source:** `src/stores/captures.ts:115-130`; `src/components/session/SessionCaptureField.vue:132-138`; `useVocabularyExtraction.ts:192-198`.
- **Note:** the text may come from `ocr-page` (Gemini) or, on iOS, from Apple Vision (D-15). The pipeline is the same either way.

#### LEX-84 · Step 1 — ledger row (idempotency)
The client inserts `vocabulary_extractions {user_id, capture_id, book_id, page, status: 'pending'}` and gets the `id` back.

| Insert result | Effect |
|---|---|
| Success | Continue to Step 2 |
| Unique violation `23505` on `capture_id` | Stop silently — treated as "already processed" |
| Any other error, e.g. FK `23503` when the capture is already gone (LEX-94) | `console.warn`, stop, **no ledger row** |

`page_captures` is upserted on `(user_id, book_id, page)` without an `id`, so re-capturing a page keeps the same capture id. As a result **a page is extracted at most once while its capture row exists**, even if it is re-captured with different text (CAP-31, CAP-Q04).

The guarantee is not absolute:
1. A completion purge deletes the captures. The ledger keeps the row with `capture_id = NULL`, and the UNIQUE index allows many NULLs.
2. If the reader later lowers progress below the total and re-captures that page, a new capture id is minted.
3. The page is then extracted again. The dedupe (LEX-88) still prevents duplicate terms.
- **Enforced:** `client`; `server:db` (`vocabulary_extractions_capture_id_key`).
- **Source:** `useVocabularyExtraction.ts:58-77`; `captures.ts:84-97`.

#### LEX-85 · Step 2 — the edge function call
The client calls `supabase.functions.invoke('extract-vocabulary', {body: {ocrText}})`.
- **Error** (non-2xx or network): ledger `status = 'failed'`, `error_message = String(err.message)`; stop.
- **Non-array `words`:** treated as `[]`.

The function turns every Gemini-side problem into `200 {"words": []}`: a missing `GEMINI_API_KEY`, a model or network error, no JSON, invalid JSON. Those runs are therefore recorded as **`skipped`**, indistinguishable from "no qualifying words" ⚠ LEX-D43. `failed` records only invocation errors (401 / 400 / 5xx from the platform, network) and lexicon insert errors.
- **Enforced:** `client`; `server:edge`.
- **Source:** `useVocabularyExtraction.ts:79-94`; `supabase/functions/extract-vocabulary/index.ts:90-97,112-134`.

#### LEX-86 · `extract-vocabulary` contract
The function is stateless. It never writes to the database and never checks the user's lexicon.
- **Request:** `POST {SUPABASE_URL}/functions/v1/extract-vocabulary`.
  - Headers: `Authorization: Bearer <user access token>`, `apikey`, `Content-Type: application/json`.
  - Body: `{"ocrText": string}`. It must be a string with non-whitespace content. The function sets no length cap; captures are ≤ 10 000 chars.
- **Responses:**

| Status / body | When |
|---|---|
| `200 {"words":[{"word","definition"}]}` | 0–5 items. `word` is trimmed and longer than 1 char; `definition` is trimmed and non-empty |
| `200 {"words":[]}` | No qualifying words, **or** a missing `GEMINI_API_KEY`, no or invalid JSON from the model, or any thrown error |
| Gateway 401 | Missing, invalid or expired JWT. `verify_jwt: true` rejects it before the function runs. [UNVERIFIED: exact gateway 401 body not observed] |
| `401 {"error":"unauthorized"}` | A valid JWT with no `sub` claim (e.g. the anon key) |
| `400 {"error":"invalid_input"}` | Body is not JSON, or `ocrText` is missing or blank |
| `405 {"error":"Method not allowed"}` | Any method other than POST / OPTIONS |
| `OPTIONS` → CORS preflight | `Access-Control-Allow-Origin: *` |
- **Auth inside the function:** a hand-rolled base64url `decodeJwt` reads `sub` without checking the signature. It is safe only because `verify_jwt: true` ⚠ LEX-D30.
- **Model:**
  - `gemini-2.5-flash` via `npm:@google/genai`, **unpinned**;
  - `temperature 0.4`, `maxOutputTokens 1024`, `thinkingBudget 0`.
- **Prompt:**
  - *System prompt:* pick up to 5 uncommon, advanced or literary words for an educated adult reader; exclude proper nouns and common words; give a one-sentence definition reflecting the usage **in this passage**; output strict JSON `{"words": [...]}`.
  - *User message:* `PASSAGE:\n\n{ocrText}\n\nGenerate the JSON now.`
- **Logging:** when the model returns no JSON, the first 300 chars of its raw output are logged.
- **Secret:** `GEMINI_API_KEY`.
- **Enforced:** `server:edge`.
- **Source:** `supabase/functions/extract-vocabulary/index.ts:1-136`; deployed v2.
- **Target:**
  - Drop the hand-rolled decoding in favour of verified claims; record `verify_jwt` in a committed `supabase/config.toml` (BC-02).
  - Pin the SDK in `deno.json`, and keep repo == deployed (BC-03).
  - Run the shared entitlement + `ai_usage` check, allow-all until tiers are decided (D-14 · BC-12).
  - Moving the ledger, dedupe and insert into the function is decision LEX-Q12.

#### LEX-87 · Step 3a — empty results and the proper-noun filter
1. **Empty `words`:** ledger `skipped`, `words_added = 0`.
2. **Proper-noun filter (client).** A word is dropped when all three hold:
   - it starts with an ASCII capital (`/^[A-Z]/`);
   - its first **case-sensitive** occurrence in the text is at index > 0;
   - the preceding non-space character is not `.`, `!` or `?`.
3. If nothing survives, the ledger is set to `skipped` (⚠ LEX-D38).
- **Enforced:** `client`.
- **Source:** `useVocabularyExtraction.ts:29,41-51,96-115`.

#### LEX-88 · Step 3b — dedupe against the whole lexicon
The dedupe is case-insensitive against **every existing term of the user**: any book, any type, mastered or not.

**How it is built.** Two queries are unioned and lower-cased into a Set:
- an exact-case `.in('term', words)` query;
- a full `select term where user_id` scan, subject to the PostgREST row cap ⚠ LEX-D22.

**What it does not do:**
- It does not dedupe within the returned batch.
- It matches by exact string equality after `toLowerCase()`: no trimming of stored terms, and no lemmatisation or plural folding. So "obfuscate", "obfuscated" and "obfuscates" are different words. Spec 016 FR-018 asked for "lemma-aware where reasonable". (Manual and auto terms are both stored trimmed.)

**Outcome.** If no word is left, the ledger is set to `skipped`.

**Soft failure ⚠ LEX-D44.** An error on the exact-case query is only logged; an error on the full scan is ignored. If both fail, the Set is empty and **every candidate is inserted without dedupe**.
- **Enforced:** `client`.
- **Source:** `useVocabularyExtraction.ts:117-148`.

#### LEX-89 · Step 4 — bulk insert of auto words
The client inserts one row per surviving word:

| Column | Value |
|---|---|
| `user_id`, `book_id` | the capture's |
| `term` | the word, with the casing the model returned |
| `definition` | the model's in-context definition |
| `entry_type` | `'dictionary'` |
| `context_sentence` | the first sentence (split on whitespace after `.` `!` `?`) containing the word case-insensitively, trimmed, ≤ 280 chars; else `null` |
| `page_found` | the capture page |
| `leitner_box` | `1` |
| `next_review_at` | `new Date(now + 86 400 000 ms).toISOString()` sent into a `date` column; Postgres keeps the **UTC calendar date of now + 24 h** |
| `created_at` | client now — **identical for the whole batch** |
| `source` | `'auto'` |

**First review, in local terms:**
- near UTC±0 — reliably tomorrow;
- east of UTC in the local morning — the **same** local day (UTC+10 at 08:00 gives today's local date), so the word is immediately in today's set;
- west of UTC in the evening — **two** local days later (UTC−5 at 21:00 gives local day + 2).

**All or nothing.** One invalid row fails the whole batch → ledger `failed` with the message ⚠ LEX-D45 (plausible). There are two reachable causes:
- a model `word` longer than 200 chars;
- a capture saved at **page 0**. `page_captures_page_check` and `vocabulary_extractions_page_check` allow `page ≥ 0`, but `lexicon_entries_page_found_check` requires `≥ 1`, and the capture page is `progress.currentPage ?? 0`.

Live: 0 captures at page 0 today, but 4 `reading_progress` rows sit at `current_page = 0`.
- **Enforced:** `client`; `server:db` (CHECKs).
- **Source:** `useVocabularyExtraction.ts:150-175`; `SessionCaptureField.vue:101-102,134`.
- **Target:** the first review date is computed in the reader's IANA time zone (D-07 · BC-06). Whether that is "tomorrow" is decision LEX-Q04.

#### LEX-90 · Step 5 — success and refresh
1. The ledger is set to `succeeded` with `words_added = rows.length` (CHECK 0–5).
2. The client calls `lexiconStore.fetchEntriesForAllBooks()`. This is a no-op when the store cache is less than 60 s old, so new words can appear late ⚠ LEX-D18.
- **Enforced:** `client`.
- **Source:** `useVocabularyExtraction.ts:177-189`.

#### LEX-91 · No retry and no sweeper
- A run interrupted after Step 1 leaves a permanent `pending` row. The unique `capture_id` then blocks any re-run ⚠ LEX-D24.
- `failed` runs are never retried.
- Errors on ledger updates are ignored.

Live distribution: 165 ledger rows, all `succeeded` or `skipped` (none `pending` or `failed`); 120 have `capture_id = NULL` after completion purges.
- **Enforced:** `client` (absence of retry).
- **Note:** decisions LEX-Q12 and LEX-Q22.

#### LEX-92 · Ledger schema and RLS
`vocabulary_extractions` has these columns and checks:

| Column | Constraint |
|---|---|
| `capture_id` | nullable, `UNIQUE`, FK `page_captures ON DELETE SET NULL` |
| `book_id` | FK `ON DELETE CASCADE` |
| `user_id` | FK `auth.users ON DELETE CASCADE` |
| `page` | `≥ 0` |
| `words_added` | 0–5, default 0 |
| `status` | `IN ('pending','succeeded','failed','skipped')` |
| `error_message` | nullable |
| `created_at` | `now()` |

RLS: `vocabulary_extractions_select` (USING owner), `_insert` (WITH CHECK owner), `_update` (USING owner — Postgres reuses USING as the check). There is **no DELETE** policy. No client reads the ledger: it is write-only.
- **Enforced:** `server:db`.
- **Source:** live `pg_constraint`, `pg_policies`.

### N. Cascades and lifecycle

#### LEX-93 · Book delete
**Database.** The cascades delete the book's `lexicon_entries` — mastered ones included — and its `vocabulary_extractions` (`lexicon_entries_book_id_fkey`, `vocabulary_extractions_book_id_fkey`). `anki_review_sessions` has no book FK and is unchanged.

**Client.** `removeBook` only marks the `lexicon:{uid}*` SWR keys stale. As a result:
- the in-memory `entriesByBook` keeps the deleted book's entries until the next fetch;
- the WotD can show "(removed book)";
- an advance silently updates 0 rows but reports success locally;
- the Codex results cache keeps the entries for the session ⚠ LEX-D18.
- **Enforced:** `server:db` (FKs); `client` (stale state).
- **Source:** `src/stores/books.ts:427-434`.
- **Note:** keeping a deleted book's words is decision LEX-Q20. The full delete matrix is in [11 · Cross-Domain](11-cross-domain.md).

#### LEX-94 · Book completion leaves lexicon entries alone, but kills extraction for completion captures
Completion does not touch lexicon entries: they stay in review and in the WotD.

The book's captures, however, are deleted by two live triggers:
- `page_captures_delete_on_completion` (AFTER INSERT OR UPDATE OF `current_page` on `reading_progress`);
- `record_page_capture_quest_event` (trigger `page_capture_quest_event_after_save`, AFTER INSERT OR UPDATE on `page_captures`, SECURITY DEFINER). It first upserts the `reading_quest_events` row (+5 XP, which survives), then deletes all of the book's captures when `total_pages > 0 AND current_page >= total_pages`.

The ledger survives with `capture_id = NULL`.

**A capture saved while progress ≥ total pages is deleted in the same statement:**
1. The upsert's `RETURNING` still hands the client the deleted row's id.
2. The ledger insert violates `vocabulary_extractions_capture_id_fkey` (23503).
3. The client logs it and stops: **no ledger row, no auto words** ⚠ LEX-D23.

This path is reachable: the post-session capture prompt on Book Detail is not gated on completion (CAP-D06).
- **Enforced:** `server:db` (triggers, FK); `client`.
- **Source:** live trigger and function bodies; `BookDetailPage.vue:55-61,293-294`; `useVocabularyExtraction.ts:70-75`.
- **Target:**
  - One server owner handles completion effects on every path (D-06 · BC-05); lexicon entries remain untouched by completion.
  - The order of the purge versus any server-side extraction follows CAP-Q03.
  - Hiding the prompt for complete books is CAP-Q02.

#### LEX-95 · DNF has no effect on entries or review
DNF changes nothing for entries or review: the words stay in the review pool and can be the WotD. Book Detail hides both the "Codex" add chip and the "Words N" chip for DNF books, but the Codex add dialog still offers DNF books in its selector ⚠ LEX-D37.
- **Enforced:** `client`.
- **Source:** `BookProgressPanel.vue:155`; `AddWordDialog.vue:52-54`.
- **Note:** decision LEX-Q19.

#### LEX-96 · Account deletion and sign-out
**Account deletion.** The `user_id` FKs cascade on `lexicon_entries`, `vocabulary_extractions` and `anki_review_sessions`. The web client has **no in-app account deletion**, so today the cascade runs only when an admin deletes the `auth.users` row. This domain owns no Storage objects.

**Sign-out.** It does not reload the page. The in-memory lexicon and Anki Pinia state survives into the next sign-in on the same tab until it is refetched, and the WotD `localStorage` key is not removed ⚠ LEX-D33.
- **Enforced:** `server:db` (FKs).
- **Source:** live FKs; `src/stores/auth.ts:89,139-148`; `src/components/shared/AppBottomNav.vue:35-40`.
- **Target:** immediate hard delete through a new `delete-account` edge function, on web and iOS, with confirmation and re-authentication; the FK cascades remove all three tables (D-10 · BC-11). Clients wipe all per-user lexicon state on sign-out or account switch ([08 · Platform](08-platform-auth-account.md)).

#### LEX-97 · Book edit
No book data is copied onto entries. Titles are resolved at read time through the `books(title)` join or `booksStore.bookById`, so a renamed book shows its new title everywhere.
- **Enforced:** `client` / `server:db` (join).

### O. Time zones

#### LEX-98 · Day boundaries per concern
Each concern computes "today" its own way today:

| Concern | Day boundary today | Source | Target (D-07) |
|---|---|---|---|
| Due check `next_review_at <= today` | Device local date | `lexicon.ts:378` | Reader's IANA zone (BC-06; server-side under BC-10) |
| Review `next_review_at` (advance / reset) | Device local date + N calendar days | `useLeitner.ts:7-13` | Reader's zone |
| Tally / reviewed-today exclusion | Device local midnight vs the UTC instant `last_reviewed_at` | `lexicon.ts:354-367` | Start of today in the reader's zone; server clock for the instant |
| WotD cache `date` | **UTC** date | `lexicon.ts:133` | Reader's local date (BC-06 lists the WotD day) |
| `dueTodayCount` (unused) | **UTC** date | `lexicon.ts:334` | Remove |
| Manual add, default `next_review_at` | **Server UTC** `CURRENT_DATE` | DB default | Reader's local date (LEX-07) |
| Auto-word `next_review_at` | **UTC** date of now + 24 h — locally the same day east of UTC in the morning, +2 days west of UTC in the evening | `useVocabularyExtraction.ts:152,162` | Reader's local "tomorrow" (LEX-Q04) |
| WotD "next due" label | Date parsed as **UTC** midnight vs local now, then full-local-day truncation — under-reports by 1 in every zone | `WordOfTheDay.vue:33-34`; `src/utils/date.ts:58-61` | Calendar-day difference in the reader's zone |
| Anki prompt cadence | Elapsed full local days (≈ 72 h, ± 1 h across DST) since a UTC instant | `ankiSession.ts:18` | Unchanged — elapsed time, not a day boundary |
| `extraAllotment` ("Review more") | **Never** reset by day; only on reload / relaunch | `lexicon.ts:342-344` | Resets at the reader's local midnight (LEX-Q05) |
| Codex "Newest" sort, passport counts | n/a (instant ordering; no day buckets) | `useGreatLibrarySearch.ts:118-121` | n/a |
- **Enforced:** `client` (all rows except the DB default).
- **Note:** this mixed UTC / local behaviour ⚠ LEX-D13 is also PLT-65. The stored reader time zone (e.g. `user_settings.time_zone`) is defined by BC-06.

### P. Cross-domain consumers

#### LEX-99 · Book Passport "words learned"
`vocabularyCount` = `count(lexicon_entries)` for the book and user — **every type, source and mastery state**. It comes from RPC `get_book_passport_stats` (CTE `vocabulary`; requires `p_user_id = auth.uid()` and book ownership).

It is labelled "words learned" and snapshotted into `book_passports.vocabulary_count` ⚠ LEX-D26.
- **Enforced:** `server:rpc` (`get_book_passport_stats`).
- **Source:** `src/stores/bookPassport.ts:33-47,55-80,165-177`; `src/pages/BookPassportPage.vue:114-115`.
- **Note:** what to count is decision LEX-Q14. Passport generation is SES-45…SES-48.

#### LEX-100 · Community lexicon highlights (dormant)
`get_public_profile_by_username(p_username)` returns `lexiconHighlights`: up to **6** entries with `leitner_box >= 5` — not `mastered`, any type, newest first. Each has `{term, bookTitle, masteredAt: created_at}` ⚠ LEX-D25.

**Visibility.** The key is included for the owner; when `community_profile_privacy.lexicon_visibility = 'everyone'`; or when it is `'followers'` and the viewer follows the owner.

**Further gates** in the live body — it returns `null` when:
- the viewer is anonymous;
- the username is unknown;
- the owner has no privacy row;
- either side has blocked the other;
- the viewer is not the owner and `community_profiles.is_public` is false.

The key is **omitted** (not `[]`) when no entry qualifies. The default is `'nobody'`. `upsert_my_community_profile` reads it from `payload.privacy.lexicon` (default `'nobody'`).

The PWA never calls the RPC, although its Profile Edit page has a lexicon privacy toggle (default `nobody`).
- **Enforced:** `server:rpc`.
- **Source:** live function bodies; `src/pages/ProfileEditPage.vue:73`; `src/composables/useCommunityIdentity.ts:31`.
- **Target:**
  - The community backend stays dormant (D-13).
  - iOS v1 has no lexicon privacy setting and no public lexicon view.
  - The highlight definition is fixed when the Community phase is revived.

#### LEX-101 · `get_retention_summary` is not about vocabulary
Older documentation described it as a vocabulary-retention rollup, but `get_retention_summary(p_timezone)` is a weekly **reading-session** goal summary. It returns `weekStart`, `weekEnd`, `timezone`, `sessionsThisWeek`, `weeklyGoal` (default 3), `goalProgressPct`, `activeDaysThisWeek`, `lastSessionAt`, `daysSinceLastSession` and `nudgeCode` (initially `'start_week'`). Its body never references `lexicon_entries`, and no client calls it.
- **Enforced:** `server:rpc` (unused).
- **Source:** live function body; grep (no caller).
- **Note:** owned by [09 · Database Invariants](09-database-invariants.md). Its EXECUTE grants fall under BC-01.

---

## Flows

### F1 · Review state machine of one entry

```
          (manual insert)  box=1, next=UTC CURRENT_DATE, mastered=false, last_reviewed=null
          (auto insert)    box=1, next=UTC date(now+24h), source=auto
                                     │
                                     ▼
     ┌────────────── SCHEDULED (next_review_at > local today) ◄─────────────────┐
     │                               │ local date reaches next_review_at         │
     │                               ▼                                           │
     │                  DUE → ELIGIBLE (not reviewed today, not mastered)        │
     │                  └─ enters TODAY'S SET if within 20 + extra − tally       │
     │        ┌──────────────────────┼──────────────────────────┐                │
     │   WotD advance          Anki "Didn't know"           Anki "Knew it"       │
     │   box=min(b+1,5)        box=1, next=today            mastered=true        │
     │   next=today+I[box'-1]  last_reviewed=now            last_reviewed=now    │
     │   last_reviewed=now            │                     (box/next unchanged) │
     │        │                       ▼                            │             │
     │        └──► SCHEDULED    DUE but suppressed today           ▼             │
     │                         (back tomorrow)              MASTERED (terminal)  │
     │                                                             │ Undo (same  │
     └─────────────────────────────────────────────────────────────┘ page, last  │
                                     Undo restores the full snapshot ────────────┘
  Quotes never become DUE (keepsakes).    Book delete / account delete → row deleted.
```

Every transition is persisted at once by its own `UPDATE lexicon_entries`. There is no batching and no offline queue.

### F2 · Add Word

1. **Open** the dialog (Codex button or Book Detail chip). It is `v-if`-mounted. Initial state: type `dictionary`; page = `defaultPageFound ?? null`.
2. **Book.** If there is no `bookId`, choose a book in the searchable select.
3. **Term and lookup.** Type the word → blur → the definition and phonetic are cleared → `GET dictionaryapi.dev`.
   - Success fills the definition and shows the phonetic in the label.
   - Failure leaves the field empty, with no message.
4. **Optional fields.** Edit the definition; add a context and a page.
5. **Save** → client validation (LEX-15) → `INSERT`.
   - **Success:** the store prepends the entry and touches the SWR keys → `saved` → the dialog resets and closes → the Codex runs a forced re-search.
   - **Failure** (network, RLS, CHECK such as page 0, offline): the exception propagates, the reader gets **no feedback**, and the dialog stays open with the values (LEX-18).
6. **Cancel / mask click** closes the dialog and discards its state.

Nothing is persisted before step 5. There is no draft.

### F3 · Add Quote
Same as F2 with type `quote`: the passage textarea fills `term`, the optional note fills `definition`, and the page is optional.
- An empty note fails the DB CHECK, silently (LEX-D01).
- A passage over 200 chars fails the DB CHECK, silently (LEX-D02).

### F4 · Word of the Day resolution

1. **Dashboard mount:** library + progress → `fetchEntriesForAllBooks()` (awaited) → `resolveWordOfTheDay(uid)`; `fetchSession(uid)` is not awaited. If an earlier awaited step throws, both are skipped (LEX-53).
2. **Component mount.** If the onboarding state is `standard` or `oneInProgress`, `<WordOfTheDay>` mounts and resolves again — normally a cache hit.
3. **Resolve.** If the cache's UTC date matches today, done. Otherwise compute the pick (LEX-47), and write the cache only when a pick exists.
4. **Render** the state per LEX-49.
5. **Advance tap** → `updateLeitner(advance)`: optimistic → `UPDATE`.
   - If it was the WotD, delete the cache and re-resolve, giving the next `activeReviewWords[0]` or the preview.
   - On error, roll back; the rejection is unhandled and the card is unchanged.
6. **Review more** → `extraAllotment += 20` → delete the cache → re-resolve.

### F5 · Anki session state machine

```
mount ─► LOADING (!ready & deck empty) ─► EMPTY (deck = 0) ──Review more──► rebuild ─► REVIEWING | EMPTY
                    │                       └─ Back to dashboard (onExit: no-op, 0 answers) ─► /
                    ▼
            REVIEWING[i]: FRONT ─tap─► BACK ─(swipe > 80 px | button)─► EXITING (230 ms)
                    ▲                                                      │ emit known/unknown
                    │ Undo (i−1, restore snapshot)                         ▼
                    └──────────────── write (master | reset) ─► i+1 ─► (i < n ? REVIEWING : SUMMARY)
SUMMARY ─Review more─► counters reset (batch NOT saved, LEX-D07) ─► REVIEWING | EMPTY
SUMMARY ─Back to dashboard / header back─► onExit (save once) ─► /
SUMMARY ─bottom nav / browser back─► onBeforeUnmount skips (isComplete) ─► NOTHING SAVED (LEX-D08)
REVIEWING ─any navigation away─► onBeforeUnmount → onExit (save if ≥ 1 answer)
REVIEWING ─answer write fails─► card stuck in EXITING (invisible, no buttons); Undo shown (LEX-D11)
```

What is persisted:
- each answer → one `lexicon_entries` UPDATE, immediately;
- the batch aggregate → one `anki_review_sessions` UPSERT on exit (LEX-68).

### F6 · Daily limit — worked example

| Step | Tally | Today's set | What the reader sees |
|---|---|---|---|
| Morning: 147 eligible | 0 | 20 (lowest boxes first) | WotD "20 left" |
| Advances 3 on the WotD | 3 | 17 | WotD "17 left" |
| ≥ 72 h since the last session; 17 ≥ 5 | 3 | 17 | Prompt "Vocabulary Review"; the deck = those 17, highest box first |
| Answers all 17 | 20 | 0, `extraAvailable` true | WotD "Daily review done!" + Review more; the Anki summary shows Review more |
| Review more | 20 | 20 more | Allotment 40 − tally 20 |
| Reload | 20+ | 0 | Allotment back to 20 → "Daily review done!" again |
| Local midnight | 0 | refills | Only on recompute — the computeds are not time-reactive (LEX-D17) |

### F7 · Codex search

1. **Mount:**
   - start the store fetch for the header (not awaited);
   - `await booksStore.fetchLibrary()`;
   - honour `?bookId` / `?tab` for **Insights**;
   - `await search()`.
2. **`search()`:**
   - user-switch check, which clears the cache;
   - build the cache key, then restore it, or fetch: loading → page 0 → book options (first time per user) → page-0 rows → remember.
3. **Scroll:** the sentinel triggers `loadNextPage` (append, remember).
4. **Typing:** debounce 300 ms → `search()`.
5. **Filter or sort change:** `search()` immediately.

Requests are never cancelled (LEX-D21). After an add, `search({force: true})` refreshes only the active key.

### F8 · Vocabulary extraction — persisted at each step

| Step | Action | Persisted |
|---|---|---|
| 0 | Capture upsert succeeds (CAP-36) | `page_captures` row; `reading_quest_events` (+5 XP, trigger); possibly the completion purge (LEX-94) |
| 1 | Ledger insert `pending` | `vocabulary_extractions` row — or none (23505 = already done; 23503 = capture gone) |
| 2 | `extract-vocabulary` | nothing server-side; on error the ledger becomes `failed` |
| 3 | Proper-noun filter + dedupe | if nothing is left, the ledger becomes `skipped` |
| 4 | Bulk insert | `lexicon_entries` rows (`source = 'auto'`) — or the ledger becomes `failed` |
| 5 | Ledger `succeeded` | `words_added = n` (≤ 5); store refresh unless fresh |

```
(no row) ──insert pending──► PENDING ──function error──────────────► FAILED (error_message)
   │ 23505 → stop (already processed)     ├─ words=[] / all proper nouns / all dupes ─► SKIPPED (0)
   │ other error → stop (no row)          ├─ lexicon insert error ──► FAILED
                                          ├─ success ──► SUCCEEDED (words_added = n ≤ 5)
                                          └─ app killed / tab closed ─► stays PENDING forever (LEX-D24)
```

### F9 · Target review flow (recommended — BC-10)

1. **Load.** The client asks the server for the review queue: today's set, tally, `extraAvailable`, the WotD pick and prompt eligibility. Every day boundary is in the reader's time zone (D-07 · BC-06). The name of this call is not fixed by BC-10.
2. **Answer.** Each answer calls `review_lexicon_entry(entry_id, outcome, surface)`, which:
   - checks ownership and that the entry is reviewable;
   - applies the transition for `surface × outcome` (table in §E);
   - stamps `last_reviewed_at = now()` on the server clock;
   - returns `{leitner_box, next_review_at, mastered}` plus undo data.
3. **Undo** reverts the last review of that entry. A second undo, or an undo after another review of the same entry, is rejected.
4. **Session aggregate.** It is incremented atomically on every exit path, with an idempotency key per batch.
5. **Web during the transition.** The PWA keeps its direct table writes until it migrates (D-05), and both paths must produce identical results.

### Edge cases and user-visible copy

**No entries, or nothing to review**
- **No entries at all:** the WotD slot renders nothing; the Codex shows "No words saved yet." / "Add a word while reading to build your vocabulary vault."; the header is hidden; the Anki page (if reached) shows "You're all caught up!" / "No words due for review today."
- **All words mastered:** the WotD renders nothing (spec 031 expected "caught up"); the Anki page shows "You're all caught up!".
- **Only quotes:** the WotD preview picks a quote → "All caught up! Next word due …" using the quote's date (LEX-D14).
- **Daily cap reached with a backlog:**
  - WotD: "Daily review done!" / "You've cleared today's words. More are waiting." + "Review more";
  - Anki: "Daily review done!" / "You've cleared today's words — more are waiting." + "Review more".

**Word of the Day**
- **WotD entry's book deleted:** "from: (removed book)"; an advance updates 0 rows but reports success locally.
- **Stale WotD cache** (reviewed on another device): the normal card still shows the word, and advancing again double-advances it the same day.
- **New word added after a preview was cached:** it stays hidden on the WotD until the next UTC day or a cache-clearing action.
- **East of UTC, just after local midnight:** yesterday's cached preview persists until UTC midnight, although a fresh allotment is due (LEX-D42).
- **≥ 16 words reviewed today:** the Anki prompt cannot appear today.
- **Dashboard data load throws:** no Anki prompt on that visit (LEX-D46).

**Add Word / Add Quote**
- **Dictionary miss, or offline:** the definition stays empty with no message; "Definition is required" on Save if the reader does not type one.
- **Lookup after the reader edited the definition:** the reader's text is wiped on blur.
- **Save tapped straight from the Word field:** "Definition is required" flashes, then the lookup fills the field; a second tap saves (LEX-D40).
- **Save failure** (a quote without a note, a quote over 200 chars, page 0, offline): the dialog stays open with no message.

**Codex**
- **Search containing `,` `(` `)`:** the raw PostgREST parse error appears in the error banner with "Retry", and the retry fails the same way.
- **Scrolling near batch-inserted auto words, or A–Z ties:** cards can be duplicated or skipped across page boundaries (duplicate `:key` warnings).

**Anki session**
- **Answer write fails:** the card stays invisible with no buttons; the Undo pill is shown; tapping it moves back one card.
- **Undo during the next card's exit animation:** the previous card is re-shown and then answered again (LEX-D41). A double tap on Undo steps back two cards.
- **Undo after the summary:** allowed; it returns to the last card.
- **Session finished, then the bottom nav is tapped:** the session is not recorded, and the prompt reappears on the Dashboard.
- **"Review more" after a batch:** the previous batch's stats are not recorded.
- **Anki page reload or deep link:** the session aggregate is saved from zeroed counters, overwriting the lifetime totals.
- **Empty or loading state:** the header counter shows "0 / 0".
- **Card whose entry vanished from the store** (deleted on another device, then a background refetch): the answer is counted but not persisted (LEX-D48).
- **Speech unsupported:** the speaker button is hidden.

**Day rollover and scale**
- **Day rollover with the app open:** today's set and the tally do not recompute until entries change, and `extraAllotment` persists.
- **Large lexicon beyond the API row cap:** the store fetch is truncated, so the review pool, tally, header counts, dedupe term list and book options are silently incomplete (LEX-D22).

**Extraction**
- **Capture on a completed book:** FK failure — no words and no ledger row.
- **Extraction interrupted:** a permanent `pending` row; the page is never re-extracted.
- **Gemini key missing, model error, malformed JSON:** the ledger records `skipped`, not `failed` (LEX-D43).
- **Both dedupe queries fail:** the words are inserted without dedupe (LEX-D44).
- **Capture at page 0, or a model term over 200 chars:** the whole batch is rejected and the ledger records `failed` (LEX-D45).
- **Re-capture after the book was completed and progress lowered:** a new capture id, so the page is extracted again (the dedupe still applies).
- **Capitalised common word mid-sentence:** dropped as a "proper noun"; a lowercase proper noun is kept.
- **Model returns the same word twice in one batch:** both copies are inserted.

---

## Constants

| Name | Value | Meaning | Source |
|---|---|---|---|
| Lexicon SWR `TTL` | 60 000 ms | Freshness window for the `lexicon:*` keys | `src/stores/lexicon.ts:16` |
| `DAILY_REVIEW_LIMIT` | 20 | Words surfaced per local day (shared by WotD and Anki) | `lexicon.ts:19` |
| Review-more batch | +20 | `extraAllotment` increment per tap | `lexicon.ts:344` |
| WotD cache key | `bookhero_wotd_{userId}` | `localStorage`; value `{date (UTC), entryId, isPreview}` | `lexicon.ts:22,175` |
| `INTERVALS` | [1, 2, 4, 8, 16] days | Review interval by box 1…5 (box 1 is never applied) | `src/composables/useLeitner.ts:5` |
| Max box | 5 | `min(box + 1, 5)`; DB CHECK 1–5 | `useLeitner.ts:17`; `lexicon_entries_leitner_box_check` |
| `REVIEW_INTERVAL_DAYS` | 3 | Minimum full days between Anki sessions before the prompt | `src/stores/ankiSession.ts:6` |
| Anki prompt minimum | 5 | Today's-set size needed to show the prompt | `src/components/dashboard/WordOfTheDay.vue:19` |
| Effective Anki prompt ceiling | tally ≤ 15 | The prompt needs ≥ 5 left of the 20-word set | Derived: `WordOfTheDay.vue:19`; `lexicon.ts:371-373,387` |
| Anki deck cap | 20 | Cards per batch | `src/composables/useAnkiSession.ts:13` |
| "Great session" ratio | 0.7 | known / total threshold for the summary title | `src/pages/AnkiReviewPage.vue:122` |
| Swipe recognition | 60 px | `useSwipe` threshold | `src/components/anki/SwipeableFlashcard.vue:19` |
| Swipe commit | > 80 px | Horizontal swipe distance needed to answer (only after the flip) | `SwipeableFlashcard.vue:22-23` |
| Exit delay | 230 ms (CSS 0.22 s) | Delay before the answer is emitted | `SwipeableFlashcard.vue:37-38,46-49` |
| Drag rotation | 0.04°/px | Card tilt while dragging | `SwipeableFlashcard.vue:31` |
| Speech locale | `en-US` | Pronunciation (fallback: any `en*` voice) | `SwipeableFlashcard.vue:60` |
| Codex `PAGE_SIZE` | 10 | Server page size (`CLAUDE.md` / spec 018 say 20 — stale) | `src/composables/useGreatLibrarySearch.ts:16` |
| Search debounce | 300 ms (maxWait 1 000 ms) | Query debounce | `useGreatLibrarySearch.ts:229` |
| Sentinel threshold | 0.1 | `IntersectionObserver` threshold | `src/pages/GreatLibraryPage.vue:108` |
| WotD label thresholds | ≤ 1 → "tomorrow"; ≤ 6 → "in N days"; else a date | "Next word due" copy | `WordOfTheDay.vue:35-37` |
| Term length | 1–200 chars | DB CHECK (words and quotes) | `lexicon_entries_term_check` |
| Definition length | ≥ 1 char | DB CHECK (quote notes too) | `lexicon_entries_definition_check` |
| `page_found` | ≥ 1 or null | DB CHECK; no upper bound | `lexicon_entries_page_found_check` |
| Capture / ledger page | ≥ 0 | vs `page_found ≥ 1` (page-0 mismatch, LEX-D45) | `page_captures_page_check`; `vocabulary_extractions_page_check` |
| Capture text | 1–10 000 chars | Upper bound of the `ocrText` sent to extraction | `page_captures_text_check` |
| Max words per extraction | 5 | Prompt + server `slice(0, 5)` + DB CHECK on `words_added` | `supabase/functions/extract-vocabulary/index.ts:25,57`; `vocabulary_extractions_words_added_check` |
| Edge output normalisation | `word.length > 1`, `definition.length > 0` | Server-side filter after trimming | `extract-vocabulary/index.ts:51-58` |
| Extraction model | `gemini-2.5-flash`, temp 0.4, max 1 024 tokens, thinking budget 0 | Model config (SDK unpinned) | `extract-vocabulary/index.ts:7,101-108` |
| Context sentence cap | 280 chars | Auto context truncation | `src/composables/useVocabularyExtraction.ts:36` |
| Auto first review | now + 86 400 000 ms → UTC date | Auto-word `next_review_at` | `useVocabularyExtraction.ts:152,162` |
| Proper-noun regex | `/^[A-Z]/` | ASCII capital heuristic | `useVocabularyExtraction.ts:29` |
| Dictionary API | `https://api.dictionaryapi.dev/api/v2/entries/en/{term}` | Manual-add auto-definition (no key, English, CC BY-SA 3.0 content) | `src/composables/useLexicon.ts:4` |
| Community highlights | ≤ 6, `leitner_box >= 5` | Public-profile lexicon highlights (dormant) | RPC `get_public_profile_by_username` |
| PostgREST row cap | [UNVERIFIED: project `max_rows`; the Supabase default is 1 000; not visible from SQL] | Caps unbounded selects (current max is 357 entries per user) | Project API settings |
| DB statement timeout (`authenticated`) | 8 s | Upper bound for any query from a signed-in client | live `pg_roles.rolconfig` |

---

## Data touchpoints

Shapes are in [backend-contract](../backend-contract.md): §3 Tables, §4 Cascades & lifecycle effects, §5 Row-level security, §8 RPC catalogue, §10 Edge functions, §11 External APIs.

| Object | Read / write | By whom |
|---|---|---|
| `lexicon_entries` | R `select *` by `book_id`, `order created_at desc` (per-book store; Book Detail chip) | Web `lexicon.fetchEntriesForBook` |
| `lexicon_entries` | R `select *` by `user_id`, `order created_at desc`, **no range** (subject to the row cap) — Dashboard, Codex header, Anki, extraction refresh | Web `lexicon.fetchEntriesForAllBooks` |
| `lexicon_entries` | R `select *, books(title)`, paged; `select book_id, books(title)` for every row (book options) | Web `useGreatLibrarySearch` |
| `lexicon_entries` | R `select term` (`in` + full scan) for dedupe | Web `useVocabularyExtraction` |
| `lexicon_entries` | W single INSERT (manual); bulk INSERT (auto) | Web `lexicon.addEntry`; `useVocabularyExtraction` |
| `lexicon_entries` | W UPDATE `leitner_box, next_review_at, last_reviewed_at` / `mastered, last_reviewed_at` / all four (undo) by `id` | Web `lexicon.updateLeitner` / `masterWord` / `restoreEntryState` |
| `lexicon_entries` | D FK cascade on book or user delete | DB FKs (LEX-93/96) |
| `lexicon_entries` | R count | RPC `get_book_passport_stats`; `get_public_profile_by_username` (dormant) |
| `vocabulary_extractions` | W INSERT `pending`; UPDATE status / `words_added` / `error_message` by `id`; never read | Web `useVocabularyExtraction` |
| `anki_review_sessions` | R `last_reviewed_at, total_sessions, known_count, unknown_count` `maybeSingle`; W UPSERT `onConflict user_id` | Web `ankiSession` store |
| `page_captures` | R (side effect source: `capture.text`, `id`, `page`) | Web `captures.saveCapture` → extraction (CAP-36) |
| `community_profile_privacy.lexicon_visibility` | R / W through the community RPCs | Web Profile Edit (privacy toggle); RPCs (dormant reader) |
| `extract-vocabulary` | Called with `{ocrText}` → `{words}` | Web `useVocabularyExtraction` (`functions.invoke`) |
| Free Dictionary API | `GET /api/v2/entries/en/{term}` | Web `useLexicon.lookupWord` |
| `speechSynthesis` | Speaks the term (`en-US`) | Web `SwipeableFlashcard` |
| `localStorage bookhero_wotd_{uid}` | R / W the daily pick | Web `lexicon.resolveWordOfTheDay` |

---

## Client-side logic & server migration

Under D-06, native clients stay thin. Today **none** of this domain's logic is on the server, apart from CHECK constraints, owner RLS and the stateless `extract-vocabulary`. BC-10 (Recommended) is the work package that would move the review core.

| # | Logic (rules) | Today | Phase 0 / decision | Native clients |
|---|---|---|---|---|
| 1 | Review transitions, interval table, box cap, date math (LEX-24…28) | Client; device clock and zone | Recommended BC-10 `review_lexicon_entry`; reader's zone (D-07 · BC-06) | Until BC-10: replicate exactly, in the reader's zone. After: call the RPC |
| 2 | Mastery semantics (LEX-29…31) | Client | Recommended BC-10 (`surface = anki`, `outcome = known`) | Same |
| 3 | Eligibility, ordering, cap, tally, today's set (LEX-33…40) | Client, over a full fetch | Recommended BC-10 due-set / tally query in the reader's zone; deterministic tie-break | Same; one shared module for app, widget and notifications |
| 4 | "Review more" allotment (LEX-41) | Client, in memory | LEX-Q05; can be carried by the BC-10 queue call | Reset at local midnight |
| 5 | Anki deck order and snapshot (LEX-59) | Client | Stays client (presentation) | Implement; freeze on appear |
| 6 | WotD pick and per-day cache (LEX-45…48) | Client; UTC-dated cache | Local date (D-07 · BC-06); pick can come from the BC-10 queue | Key by local date; revalidate the cached id |
| 7 | Anki prompt gating (LEX-54/55) | Client | Stays client, or returned by the BC-10 queue | Implement; also on the native entry point (LEX-Q06) |
| 8 | Session aggregate (LEX-68) | Client read-modify-write upsert | Recommended BC-10: atomic increment on the server clock | Never read-modify-write; record on every exit path |
| 9 | Undo (LEX-63) | Client snapshot | Recommended BC-10 undo support | Single level, keyed by entry id |
| 10 | Add-form validation (LEX-15) | Client (partial) + DB CHECK backstop | Stays client; DB stays the backstop | Validate every CHECK up front; surface errors |
| 11 | Extraction pipeline: ledger, filter, dedupe, defaults, insert (LEX-83…92) | Client | BC-12 entitlement + usage check in the function (D-14); BC-02 auth; BC-03 pin; server-owned writes = LEX-Q12 | Until decided: replicate, detached from the view |
| 12 | Codex search composition (LEX-70…79) | Client → PostgREST | Stays client; escape input (LEX-D20); keyset pagination (LEX-D19) | Implement with escaping and a stable order |
| 13 | Header counts (LEX-82) | Client, over a full fetch | Stays client; prefer `count` queries | Use `head`/`count` queries, not a full fetch |
| 14 | Dashboard visibility of the WotD / prompt (LEX-53) | Client | LEX-Q06 | Follow the decision |
| 15 | "Next due" label (LEX-50) | Client (buggy) | Calendar-day difference in the reader's zone (D-07) | Implement the intent, not the bug |
| 16 | Pronunciation (LEX-69) | Client | Stays client | Platform TTS |
| 17 | Dictionary lookup (LEX-12, LEX-103) | Client → third-party API | Stays client; attribution / provider = LEX-Q26 | Implement; show attribution |
| 18 | Entitlement limits (lexicon size, auto-extract tiers) | None | D-14 undecided; BC-12 hook only (allow-all) | Handle a denial; never gate client-side only |
| 19 | Book ownership of `book_id` (LEX-08) | Not enforced | BC-01 RLS check | Only ever reference your own book ids |

---

## Caching & offline

| Cache | Key / shape | TTL / behaviour | Invalidated by | Source |
|---|---|---|---|---|
| SWR, per book | `lexicon:{uid}:{bookId}` → `entriesByBook[bookId]` | 60 s. `loading` → await; `fresh` → skip; `background` → serve stale and refetch | `swrTouch` (marks **fresh**) after add / review / master / undo; `invalidate('lexicon:{uid}', prefix)` on book delete; `clearAll()` on user change; tab refocus revalidates stale keys that have a revalidator | `lexicon.ts:61-73`; `src/composables/useCache.ts` |
| SWR, all books | `lexicon:{uid}:all` → replaces the whole `entriesByBook` | Same | Same | `lexicon.ts:75-88` |
| Pinia, in memory | `entriesByBook`, `_wotdEntryId`, `_wotdIsPreview`, `extraAllotment`; `ankiSession` refs | Until reload; **not reset on sign-out** | — | `lexicon.ts:25-29,342`; `ankiSession.ts:9-13` |
| Codex results cache | Module `Map` `{uid}:{q}:{type}:{sort}:{book}` → `{entries, currentPage, hasMore}` | Session lifetime | Cleared only on a user switch; bypassed by `search({force: true})` (after an add; Retry on page 0) | `useGreatLibrarySearch.ts:42-78,148-161` |
| Codex book options | `_bookOptions` + `_bookOptionsFetchedForUser` | Once per user per session | Forced search | `useGreatLibrarySearch.ts:80-104` |
| Codex search state | Module refs: query, type, sort, book | Session lifetime; survives navigation | Never (not in the URL) | `useGreatLibrarySearch.ts:22-34` |
| WotD daily pick | `localStorage bookhero_wotd_{uid}` = `{date (UTC), entryId, isPreview}` | Until the UTC date changes | Removed when the WotD entry is advanced or mastered, and on Review more; never on sign-out | `lexicon.ts:22,132-180,229,279,349` |
| IndexedDB / service worker | None for this domain | — | — | `src/composables/useOfflineSync.ts:12-13`; `src/sw.ts` |

Notes:
- **`invalidateAll()`** calls `swrTouch`, which marks the key **fresh** — the opposite of its comment — and it has no callers (LEX-D29).
- **Refresh after extraction** is skipped while the all-books key is fresh, so auto words can appear 60 s or more later (at the next stale access or tab refocus).
- **`invalidate()`** sets `fetchedAt = 0`, so the next access awaits a full refetch. The refocus revalidator fires only for keys with `fetchedAt > 0` that are past their TTL, so **invalidated keys are not refreshed on refocus**.
- **After a manual add**, `search({force: true})` refreshes only the **active** results-cache key. Every other cached combination stays stale for the session.
- **`clearSearch`** resets both a non-empty query and a filter in one tick. The filter watcher fires an immediate `search()`, and the debounced query watcher fires another 300 ms later, usually served from the cache.
- **Header vs list.** The header counts (store) and the Codex list (results cache) can disagree within a session.
- **Cross-device.** A review on another device is seen only after the 60 s TTL and a refocus. The WotD cache never re-validates.
- **`CLAUDE.md` is wrong** about "IndexedDB (offline queue + Leitner state)": there is **no Leitner state in IndexedDB**.

**Offline.** This domain has no offline support.
- **Reads** rely on in-memory Pinia state, which is lost on reload.
- **Writes** — add, advance, reset, master, undo, session save, extraction — fail. The optimistic review writes roll back.
- The IndexedDB queue (`chronicler-offline/progress_queue`) holds progress saves only.
- The service worker caches neither Supabase nor `dictionaryapi.dev` requests.
- Speech synthesis works offline with system voices.

**Target:**
- Refresh-on-foreground, or Realtime, is defined for all clients (BC-14), so reviews made on one device show up on the others.
- Clients wipe all lexicon state on sign-out or user switch ([08 · Platform](08-platform-auth-account.md)).
- Offline review on native is decision LEX-Q28.

---

## Known defects

Each defect keeps its original tracking number. "Plausible" means the code path exists but was not reproduced.

| ID | Defect | Impact | Fix |
|---|---|---|---|
| LEX-D01 | A quote without a note cannot be saved: the UI marks the note optional and sends `definition: ''`, but `lexicon_entries_definition_check` requires ≥ 1 char (LEX-04) | Quotes are effectively broken; the live DB holds zero quotes | LEX-Q01. Minimum: require a note in the UI, or relax the CHECK for quotes (`entry_type = 'quote' OR char_length(definition) >= 1`), which is backward compatible (D-05) |
| LEX-D02 | Quotes over 200 chars violate `lexicon_entries_term_check`; there is no client limit or counter (LEX-03) | Long passages fail silently | LEX-Q01. Minimum: counter + limit in every client |
| LEX-D03 | `AddWordDialog.onSave` has no `catch`, so every insert failure is silent (LEX-18) | Reader thinks Save is broken; unhandled rejection | Catch, show inline error; map CHECK `23514` / RLS `42501` / network to copy |
| LEX-D04 | Book Detail pre-fills `page_found = progress.currentPage`, which can be 0. `InputNumber :min` clamps only on blur, so an untouched 0 is sent and violates `page_found ≥ 1` (LEX-06) | Silent failure when adding a word to an unread book (or at page 0) | Pre-fill `currentPage > 0 ? currentPage : null`; validate before insert |
| LEX-D05 | Blurring the Word field clears and overwrites the definition; an in-flight lookup can overwrite edits; Save is not blocked during the lookup (LEX-12) | Reader-typed definitions are lost | Look up on an explicit action or debounce; never overwrite a non-empty reader definition; Save waits for or ignores an in-flight lookup |
| LEX-D06 | `/lexicon?bookId=` from the WotD card and the Book Detail "Words N" chip sets only the **Insights** book filter; the Lexicon tab opens unfiltered (LEX-51) | Regression against spec 005 FR-006; the chip leads to a generic list | LEX-Q08 (recommended: also apply it to the Lexicon book filter) |
| LEX-D07 | Anki "Review more" resets the counters without saving the finished batch (LEX-67) | Batch stats and `last_reviewed_at` lost; the prompt cadence restarts wrongly | Save the batch before resetting (LEX-Q07) |
| LEX-D08 | A completed Anki session is saved only by the header back and "Back to dashboard"; the bottom nav or browser back skips the save (`onBeforeUnmount` guards `!isComplete`) (LEX-68) | `anki_review_sessions` not updated; the prompt reappears | Save on every exit path with the `_saved` guard; recommended BC-10 atomic record |
| LEX-D09 | The Anki page never calls `fetchSession`. After a reload, deep link, account switch or failed fetch, `saveSession` computes totals from 0, stale or another user's values and overwrites the lifetime row (LEX-56/68) | Lifetime totals overwritten; possible cross-user value leak into a row | Recommended BC-10 atomic increment; minimum: fetch before save, and reset the store on a user switch |
| LEX-D10 | Session aggregates are a client read-modify-write, not atomic across devices or tabs (LEX-68) | Lost increments | Atomic server increment (recommended BC-10) |
| LEX-D11 | A failed answer write leaves the flashcard in the `exiting` state (invisible, no buttons) with the undo slot already set; Undo then steps back a card (LEX-62) | Stuck review UI | Set the undo slot only after success; reset the card's exit state and show an error |
| LEX-D12 | A WotD advance failure gives no feedback (LEX-52) | Silent no-op | Toast + rollback (already rolled back) |
| LEX-D13 | Mixed day boundaries (LEX-98): WotD cache in UTC, tally in local time, manual default in server UTC, auto words as the UTC date of now + 24 h, a label off by one | Inconsistent "today" across features and devices | D-07 · BC-06 (+ recommended BC-10) |
| LEX-D14 | The WotD preview fallback filters only `!mastered` over all entries, so a quote can be picked (LEX-47) | Contradicts "quotes excluded from review" | Filter `reviewableEntries` |
| LEX-D15 | When every word is mastered, or the cached id no longer resolves, the WotD slot renders nothing (LEX-49) | The section disappears; spec 031 expected "caught up" | Render an "All mastered" / caught-up state; re-resolve on a missing id |
| LEX-D16 | The WotD cache is trusted without validation (LEX-45) | Cross-device double advance; same-day new words hidden behind a cached preview | Re-validate the cached id against the eligible set; server-provided pick (recommended BC-10); refresh on foreground (BC-14) |
| LEX-D17 | `eligibleReviewWords` / `reviewedTodayCount` read `new Date()` inside computeds that are not time-reactive; `extraAllotment` never resets at midnight (LEX-41) | No rollover while the app stays open | Day-change tick (local midnight in the reader's zone) that recomputes and resets the allotment |
| LEX-D18 | Cache invalidation gaps: `invalidateAll` marks keys fresh and is dead; the extraction refresh is skipped when fresh; the Codex results cache is never invalidated by mastering, reviews, extraction or book deletion; a manual add refreshes only the active key (LEX-17/77/90/93) | Stale Mastered badges, missing auto words, deleted-book entries | Invalidate (not touch) after extraction; clear the results cache on any lexicon mutation or book delete |
| LEX-D19 | Offset pagination over non-unique sort keys: auto-extraction writes one `created_at` per batch; `term` ties under A–Z (LEX-71) | Duplicate or skipped cards across pages | Add `id` as the secondary order, or use keyset pagination `(created_at, id)` / `(term, id)` |
| LEX-D20 | Search text is interpolated into `.or()` unescaped: `,` `(` `)` break the filter; `%` and `_` act as wildcards (LEX-72) | A raw PostgREST error is shown; wrong matches | Escape / quote the value, or move search to an RPC with parameters |
| LEX-D21 | No cancellation or generation token for searches (plausible) | A slow stale response can overwrite or append to newer results; `_hasMore` is mutated by any response | Generation counter or `AbortController` per search |
| LEX-D22 | Unbounded selects — the full store fetch, the dedupe term scan, the book options — are capped by the PostgREST row cap [UNVERIFIED: project `max_rows`, default 1 000] (plausible) | Silent truncation of the review pool, tally, counts and dedupe once a reader passes the cap (current max 357) | Explicit paging; server-side counts and dedupe (recommended BC-10 / LEX-Q12) |
| LEX-D23 | A capture saved when progress ≥ total pages is deleted inside its own INSERT by `record_page_capture_quest_event`; the ledger insert fails with FK 23503, so no extraction happens for the final page(s) (LEX-94) | Lost words; wasted OCR; misleading capture success | CAP-Q02 (hide the prompt for complete books) and CAP-Q03 / BC-05 ordering |
| LEX-D24 | An interrupted extraction leaves a permanent `pending` ledger row; there is no retry or sweeper (LEX-91) | The page is never extracted | Sweep `pending` older than ~15 min to `failed`; retry policy LEX-Q12 (server-side, like the BC-13 stale-job timeout) |
| LEX-D25 | Community `lexiconHighlights` uses `leitner_box >= 5` instead of `mastered`, ignores `entry_type`, and returns `created_at` as `masteredAt` (LEX-100) | Wrong "mastered" words (and quotes) on public profiles | Deferred: the community backend is dormant (D-13). On revival: use `mastered`, exclude quotes, add a real `mastered_at` |
| LEX-D26 | Book Passport "words learned" counts every entry: unreviewed auto words and quotes (LEX-99) | Inflated passport stat | LEX-Q14 |
| LEX-D27 | `LexiconCard` badge says "Lore" for quotes, while filters say "Quotes" (LEX-22/80) | Confusing copy; stale term | Rename the badge to "Quote" on every client |
| LEX-D28 | Header N excludes quotes, but M counts mastered entries of any type (LEX-82) | Harmless today (quotes cannot be mastered) | Count M over reviewable entries |
| LEX-D29 | Dead code: `src/pages/LexiconPage.vue` (not routed), `useLeitner().getDueWord`, `dueTodayCount` (UTC), `invalidateAll`; the stale "Vocabulary Garden" comment | Misleading to implementers | Remove |
| LEX-D30 | `extract-vocabulary` decodes the JWT without verification (safe only while `verify_jwt: true`); `npm:@google/genai` is unpinned; no input-length cap (LEX-86) | Defence in depth; non-reproducible deploys; token cost | BC-02 (drop hand-rolled decoding; `config.toml`), BC-03 (pin), cap `ocrText` at 10 000 chars |
| LEX-D31 | RLS does not check that `book_id` belongs to the caller (LEX-08) | Rows against another user's book, invisible to the RPCs and cascade-deleted by the other user | BC-01 **Fixed 2026-10-19 (BC-01).** |
| LEX-D32 | A `fetchSession` error sets `isDueForReview` true, so the prompt shows on transient errors (LEX-55) | Spurious prompt; leads into LEX-D09 | Treat an error as "not due"; retry |
| LEX-D33 | The `lexicon` and `ankiSession` Pinia stores are not reset on sign-out or user switch (only SWR is cleared); the WotD key is not removed (LEX-96) | Previous user's words and totals in memory; LEX-D09 overwrite | Reset all per-user stores on a user change ([08 · Platform](08-platform-auth-account.md)) |
| LEX-D34 | Migration drift. `create_lexicon_entries` (20260416212019), `create_anki_review_sessions` (20260506141628) and `lexicon_quote_entry_type` (20260703151513) exist only in the live history. The repo files `20260428_reader_profile.sql`, `20260617_lexicon_mastered.sql` and `20260618_lexicon_last_reviewed.sql` were applied out of band and are not recorded | A replay does not reproduce the live schema | BC-03 (baseline migration from the live snapshot) |
| LEX-D35 | Redundant index `idx_anki_review_sessions_user` duplicates the unique `anki_review_sessions_user_id_key`; `book_id` is unindexed on `lexicon_entries` and `vocabulary_extractions` | Write overhead; slow cascades | BC-01 (advisor cleanup) **Fixed 2026-10-19 (BC-01):** redundant index dropped; `book_id` indexes added. |
| LEX-D36 | The WotD and Anki prompt are hidden in the `completedOnly` / `oneQueued` / `empty` dashboard states (LEX-53) | Those readers have no in-app path to review | LEX-Q06 |
| LEX-D37 | The add-word book selector offers DNF books, while Book Detail hides add-word for DNF (LEX-10/95) | Inconsistent | LEX-Q19 |
| LEX-D38 | The proper-noun heuristic is ASCII-only and checks only the first case-sensitive occurrence; no in-batch dedupe; the term keeps the model's casing, e.g. "Ephemeral" (LEX-87/88) | Real words dropped; names kept; duplicate auto words | Unicode-aware heuristic, in-batch dedupe, normalised casing (best done server-side, LEX-Q12) |
| LEX-D39 | A hidden context value is submitted with a quote (LEX-19) | Junk `context_sentence` on quotes | Clear `context_sentence` when the type is `quote` |
| LEX-D40 | The blur-triggered lookup clears the definition when Save is tapped straight from the Word field, so "Definition is required" appears while the lookup is in flight (LEX-15) | Two taps needed; confusion | Same fix as LEX-D05 |
| LEX-D41 | Anki Undo race (plausible): Undo during the next card's 230 ms exit re-answers the previous card (handlers read `currentCard` at emit time; the exit timer is never cancelled); a double tap on Undo steps back two cards (no in-flight guard) (LEX-63) | Wrong card answered; counters off | Emit the entry id with the answer; disable Undo while a write or animation is pending; cancel the timer on unmount |
| LEX-D42 | The UTC-dated WotD cache vs the local-day tally: east of UTC, the previous day's cached preview survives local midnight until UTC midnight (LEX-45) | "All caught up!" while words are due | Local-date cache key (D-07 · BC-06) + revalidation |
| LEX-D43 | Gemini failures return `200 {"words": []}` and are ledgered as `skipped`, so outages are indistinguishable from "no words" (LEX-85) | Invisible outages; no retry | Return a distinguishable flag (e.g. `{words: [], degraded: true}`) and ledger it as `failed` (LEX-Q22) |
| LEX-D44 | Dedupe query errors are swallowed; if both lookups fail, the candidates are inserted without dedupe (LEX-88) | Duplicate auto words | Abort as `failed` on any dedupe error; or dedupe server-side |
| LEX-D45 | A page-0 capture (or a model term over 200 chars) makes the all-or-nothing auto insert fail, so the ledger records `failed` and no words are added (LEX-89) (plausible) | Lost words | Map page 0 → `page_found = null`; drop words over 200 chars before the insert (LEX-Q25) |
| LEX-D46 | Any Dashboard load error before or during the lexicon fetch skips `resolveWordOfTheDay` and `fetchSession` (LEX-53) | No Anki prompt on that visit | Run the lexicon and session loads independently of the other awaited steps |
| LEX-D47 | The Anki deck can be rebuilt (first card swapped) by any store change while index = 0 and nothing is answered, including right after undoing the first answer (LEX-59) (plausible) | The card changes under the reader | Freeze the deck once the view has appeared or the first card was shown |
| LEX-D48 | Answers on a card whose entry has left the store (deleted elsewhere, then a refetch) are counted in the session but not persisted (LEX-27/29) | Inflated session counts | Return "not found" from the write and skip counting; or let the server reject it (BC-10) |
| LEX-D49 | The WotD "next due" label under-reports by one day in practically every time zone (LEX-50) | Wrong copy ("tomorrow" for 2 days away) | Calendar-day difference in the reader's zone (D-07). Web: `differenceInCalendarDays(parseISO(nextReviewAt), new Date())` — `parseISO` reads a date-only string as **local** midnight |
| LEX-D50 | Spec 016's Profile "Vocabulary Garden" was removed, but the extraction code comment still refers to it; spec 016 FR-018 lemma-aware dedupe was never implemented | Spec / doc drift | LEX-Q22 / LEX-Q23; remove the comment |
| LEX-D51 | Wiktionary-derived definitions (CC BY-SA 3.0) are shown and stored with no attribution (LEX-103) | Licence-compliance risk, especially for an App Store release | LEX-Q26 (attribution, or a licensed provider) |

---

## Open decisions

| ID | Question | Current behaviour | Recommendation |
|---|---|---|---|
| LEX-Q01 | **Quotes.** Should a quote's note be truly optional, and may passages exceed 200 chars? | Neither works: an empty note and a long passage both fail silently (LEX-D01/D02) | Make the note optional: relax `definition_check` for quotes, or store `''`-allowed / `NULL` notes (additive, D-05). Allow quotes up to ~1 000 chars via a type-specific CHECK; keep words ≤ 200 |
| LEX-Q02 | Should iOS v1 offer **edit / delete / un-master**? Is delete soft or hard? | None exist anywhere (LEX-23/30) | v1: edit the definition / context / page, delete (hard), and un-master (reset to box 1, due today). Ship on web too for parity. Hard delete keeps the passport counts honest |
| LEX-Q03 | Should the **WotD be able to master** a word, or should box 5 auto-graduate? | A box-5 word recurs every 16 days forever unless reviewed in Anki (LEX-25) | Keep the WotD as advance-only, but auto-graduate after an advance **from** box 5 (i.e. the 5th consecutive success) — or keep as is if mastery must stay an explicit Anki act |
| LEX-Q04 | **First review of a new entry** (in the reader's zone, D-07): is a manual word due **today**, and an auto word **tomorrow**? | Manual: server UTC date (today-ish). Auto: UTC date of now + 24 h (same day to +2 days locally) | Manual: due today (local). Auto: due tomorrow (local). Computed server-side (trigger or BC-10) |
| LEX-Q05 | Should **"Review more"** persist across relaunch and devices for the rest of the day, and reset at local midnight? | In memory; lost on reload; never reset while open (LEX-41) | Persist per reader per local day on the server (carried by BC-10); reset at local midnight |
| LEX-Q06 | **Anki cadence and access.** Keep "≥ 3 days and ≥ 5 words in today's set"? Add a permanent entry point (e.g. the Codex)? Show the WotD / prompt to `completedOnly` / `oneQueued` readers? | Prompt only from the WotD slot; hidden in 3 onboarding states (LEX-53/54/55) | Keep the prompt cadence, but add a permanent "Review" entry in the Codex (no cadence gate). Show the WotD slot whenever the reader has reviewable words, regardless of onboarding state |
| LEX-Q07 | Is each **"Review more" batch a separate session** in `anki_review_sessions`? | The batch is lost (LEX-D07) | Yes: record each batch (simplest; matches `total_sessions` semantics) |
| LEX-Q08 | Should the **Codex deep link** (WotD, "Words N") pre-filter the Lexicon tab to that book? | Only Insights is filtered (LEX-D06) | Yes (spec 005 FR-006): `?bookId` applies to the active tab's book filter |
| LEX-Q09 | Should **manual adds be de-duplicated** (case-insensitive, per user or per book)? | No check (LEX-09) | Per user, case-insensitive; offer "already in your Codex — add anyway?"; no DB unique constraint (quotes may repeat) |
| LEX-Q10 | **Persist the phonetic** and show it on flashcards? | Display-only in the add form (LEX-14) | Add a nullable `phonetic` column (additive); show it on the card back |
| LEX-Q11 | **Language.** Is the product English-only, or should the book / reader language drive lookup, extraction and pronunciation? | English only (`/en/`, `en-US`, English prompts) | English-only for v1; store a nullable `language` on entries for later |
| LEX-Q12 | **Auto-extraction ownership.** Should `extract-vocabulary` own the ledger, dedupe and insert (with the caller's JWT)? Retry failures? Let readers approve auto words before they enter review? | The client owns every write; no retry; auto words enter review immediately (LEX-83…91) | Yes, server-owned (D-06 spirit; also the single place for the BC-12 check): the function writes ledger + entries and returns them; retry `failed` / stale `pending` server-side once; no approval step in v1 (add "remove" via LEX-Q02). PWA migrates afterwards (D-05) |
| LEX-Q14 | **Book Passport "words learned":** count all entries, dictionary words only, or mastered words only? | All entries, quotes and unreviewed auto words included (LEX-D26) | Dictionary words only; optionally show "M mastered" separately |
| LEX-Q17 | **Notifications and widgets.** May the word and definition appear on the Lock Screen? Does the notification's "I know this" **advance** (WotD semantics) or **master** (Anki semantics)? What does "Still learning" do? | Not built. The iOS notification brief asks for "word + definition" in the body, while its privacy section forbids lexicon words in the body when previews are shown | Show the word only when previews are allowed (otherwise a generic "Your word of the day is ready"); "I know this" = advance (`surface = notification`); "Still learning" = reset; both count toward the tally; route through BC-10 |
| LEX-Q18 | Make the daily limit (20) and deck size (20) user-configurable? | Fixed (LEX-36/59) | Not in v1; if added, store in settings and keep the deck ≤ the limit |
| LEX-Q19 | **DNF books:** keep their words in review? Allow adding words to DNF books from Book Detail? | Words stay in review; Book Detail hides add-word but the Codex allows it (LEX-95) | Keep them in review; hide DNF books in the Codex selector too (consistency) |
| LEX-Q20 | On **book delete**, keep the book's words (especially mastered ones) instead of cascading? | Cascade deletes them (LEX-93) | Keep the cascade (the confirm says "all its data"); warn in the confirm when the book has N words |
| LEX-Q22 | Record Gemini outages as **`failed`** (and retry)? Make the dedupe **lemma-aware** (spec 016 FR-018)? | Outages → `skipped`; exact lower-case match (LEX-D43, LEX-88) | Yes to `failed` + retry (with LEX-Q12). Lemma-aware: light suffix folding server-side (`-s`, `-es`, `-ed`, `-ing`) only if false positives stay rare |
| LEX-Q23 | Bring back spec 016's Profile **"Vocabulary Garden"** (box distribution, recently learned)? | Removed (LEX-D50) | Not in v1 |
| LEX-Q25 | Validate `page_found` against `total_pages`? Map a page-0 capture to `page_found = null` for auto words? | Neither (LEX-06, LEX-D45) | Client validation `1 ≤ page ≤ total_pages` (soft warning, since editions differ); page 0 → `null` |
| LEX-Q26 | **Dictionary provider and attribution.** Add CC BY-SA / Wiktionary attribution, or switch to a licensed provider before the App Store launch? | No attribution (LEX-103, LEX-D51) | Add attribution ("Definitions from Wiktionary, CC BY-SA 3.0", linking `sourceUrls`) on the add form and an About screen on all clients; reconsider a provider with an SLA later |
| LEX-Q27 | **Adopt BC-10 before iOS v1?** It is only "Recommended" today | Review logic is client-side on the web (LEX-24…43, LEX-68) | Yes: iOS, widgets and notification actions all write reviews, and only a server RPC keeps their semantics, time zone and tally identical (D-06/D-07). The PWA migrates afterwards (D-05) |
| LEX-Q28 | Allow **offline review** on native clients (queued answers)? | Every review write needs the network on the web | Not in v1. If added later: replay each answer with its original timestamp and an idempotency key through BC-10, last-writer-wins on `last_reviewed_at` |

**Dropped or merged questions:**

| Question | Answered by | Recorded in |
|---|---|---|
| Q04 (part): one day-boundary rule for everything — device local? | D-07 (reader's IANA zone) | Targets on LEX-07/16/25/26/28/34/37/45/50/89/98 |
| Q12 (part): should auto-extraction be a paid feature? | D-14 (undecided) + BC-12 (allow-all hook) | Target on LEX-86 |
| Q12 (part): should re-capturing a page re-extract? | Owned by CAP | [04 · Capture](04-capture-resume-quiz.md) CAP-Q04 |
| Q13: community highlights — `mastered` instead of `leitner_box >= 5`? | D-13 (community backend dormant) | Target on LEX-100; LEX-D25 |
| Q15: rename the "Lore" badge to "Quote"? | Not a decision — a defect | LEX-D27 |
| Q16: a lexicon-size limit ("20 entries") from a non-binding draft tier table — scope and enforcement? | D-14 (tiers undecided) + BC-12 (server-side entitlement hook) | Client-logic table row 18 |
| Q21: "Next due" label and WotD cache on local calendar dates? | D-07 · BC-06 | Targets on LEX-45/50; LEX-D42/D49 |
| Q24: lookup on an explicit action instead of blur; should Save wait? | Not a decision — a defect fix | LEX-D05 / LEX-D40 |
| In-app account deletion | D-10 · BC-11 | Target on LEX-96 |

---

## Notes for native clients

### Platform-agnostic (iOS now, Android later)

**Data and dates**
- **`next_review_at`** is a **floating calendar date** (`yyyy-MM-dd`). It is never a timestamp: never convert it through UTC.
- **`last_reviewed_at`** is an ISO-8601 UTC instant.
- **Day boundaries** — due, tally, the WotD day, interval math and the label — all use the reader's IANA time zone (D-07). Do **not** copy the web's UTC WotD cache (LEX-D42), the UTC defaults (LEX-07/89) or the truncating label (LEX-D49).
- **Lengths** follow Postgres `char_length`, which counts code points: count Unicode scalars, not UTF-16 units or grapheme clusters.

**Review core**
- **Before BC-10 lands** (LEX-Q27), implement the review core once, as pure functions over `(entries, now, timeZone, extraAllotment)`:
  - transitions (§E);
  - eligibility and order (LEX-34), with a deterministic tie-break `next_review_at → created_at → id`;
  - the cap and tally (LEX-37…40);
  - the WotD pick (LEX-47, excluding quotes);
  - prompt gating (LEX-54/55).

  The app, widgets and notification actions must all call it.
- **After BC-10,** call `review_lexicon_entry` for every answer and apply the returned state.
- **Semantics that must not be lost:**
  - quotes are never reviewed;
  - only Anki "Knew it" masters a word, and the WotD advance never does;
  - box-5 words recur every 16 days;
  - a word reviewed today never resurfaces the same day;
  - one shared 20-per-day cap covers both surfaces;
  - the selection is most-fragile-first, but the deck shows the highest box first;
  - Undo restores the full snapshot, including `last_reviewed_at`.
- **Answers:**
  - each answer carries its **entry id**;
  - one in-flight guard covers the answer, its animation and Undo (fixes LEX-D41);
  - freeze the deck once the review view appears (LEX-D47);
  - advance to the next card only after the write succeeds (LEX-D11).
- **Session aggregate:** record it on **every** exit path — Done, back, tab switch, backgrounding, "Review more" — with a per-batch idempotency guard. Never read-modify-write the totals without loading them first. Prefer the atomic RPC (LEX-D07/D08/D09/D10).

**Codex**
- **Full lexicon:** fetch it with explicit `range` paging, never one unbounded select (LEX-D22). Cache it locally keyed by `id`. When two writes conflict, keep the one with the later `last_reviewed_at`.
- **Codex list:**
  - keyset pagination `(created_at desc, id desc)` / `(term asc, id asc)` (LEX-D19);
  - escape search input (LEX-D20);
  - keep the server-side semantics: term + definition substring, type filter, book filter.
  - A larger page size (20–30) is fine.
- **Header counts:** use count queries.
- **Deep links:** `?bookId` should filter the Lexicon list (LEX-Q08).

**Add form**
- **Validation:** enforce every CHECK up front, with inline errors and surfaced insert errors (do not copy LEX-D03):
  - term 1–200 (quotes per LEX-Q01);
  - a non-empty definition, or a note until LEX-Q01 is resolved;
  - page ≥ 1 or empty, and never pre-fill 0 (LEX-D04).
- **Lookup:** run it on an explicit action or on submit of the term field. Never overwrite a non-empty definition the reader typed, and do not block Save on a lookup (LEX-D05/D40).
- **Attribution:** show dictionary attribution (LEX-Q26).

**Extraction**
- **Running it:** run it as a **detached** task after a successful capture save, idempotent by `capture_id`. Never surface its errors, and let it finish when the app goes to the background.
- **Completed books:** skip it when the capture's book was just completed, because the server has already purged the capture (LEX-94).
- **401:** treat any 401 as "refresh the session and retry once".
- **Entitlements:** expect a BC-12 entitlement / usage denial once it ships (allow-all today).
- **If LEX-Q12 lands,** the function writes everything, and the client just refreshes.

**Lifecycle and privacy**
- **Book delete:** purge the book's entries, the WotD pick if it points to them, and any cached Codex pages.
- **Sign-out / account switch:** wipe every lexicon, WotD and session state (LEX-D33).
- **Account deletion:** follow D-10. The cascades remove the three tables, and this domain has no Storage to purge.
- **Privacy disclosures:**
  - entries are user content;
  - looked-up terms go to `dictionaryapi.dev`;
  - captured page text goes to Google Gemini through `extract-vocabulary`.

### iOS-specific (iOS 26+, iPhone first — D-04, D-15)

**Codex**
- **Layout:** `NavigationStack` + `List` with `.searchable` (debounced ~300 ms with `task(id:)`); a segmented `Picker` for All / Dictionary / Quotes; a `Menu` for book filter and sort; `.refreshable`; infinite scroll from the last row's `onAppear`.
- **Glass:** system Liquid Glass comes for free on toolbars and search. Respect Reduce Transparency and Increase Contrast (D-04).
- **Optional:** Spotlight indexing of entries (`CSSearchableItem`).

**Add to Codex**
- **Sheet:** a `.sheet` with a `Picker` (Word / Quote) and inline validation.
- **Lookup:** "Look up" uses `URLSession` against `dictionaryapi.dev` (HTTPS, ATS-compliant). `UIReferenceLibraryViewController` can offer Apple's dictionary as an extra "Define" affordance, but it returns no text and cannot be the data source.

**Word of the Day card**
- **States:** reproduce the 5-state precedence (LEX-49), including the prompt takeover and "Review more".
- **Material:** native `.glassEffect` (no pre-iOS-26 fallback), with an opaque fallback under Reduce Transparency.
- **Day change:** recompute on `.NSCalendarDayChanged` and on `scenePhase == .active`.

**Review view**
- **Flip:** `rotation3DEffect`, with a cross-fade under Reduce Motion.
- **Swipe:** `DragGesture` with an 80-pt commit, active only after the flip.
- **Buttons:** always visible after the flip — never gesture-only (HIG).
- **Feedback:** `.sensoryFeedback` on each answer.
- **Text size:** Dynamic Type, with a scrollable back face for long definitions.
- **Undo:** a toolbar Undo button (single level).
- **Progress:** `ProgressView(value:)` + "i / n".
- **VoiceOver:** custom actions "Knew it", "Didn't know" and "Pronounce"; announce the flip; 44-pt targets.

**Pronunciation**
- **Speech:** `AVSpeechSynthesizer` with `AVSpeechSynthesisVoice(language: "en-US")`, falling back to any `en-*` voice; call `stopSpeaking(at: .immediate)` before speaking. No permission prompt is needed.
- **Audio session:** `.playback` + `.duckOthers`, or `.ambient` to respect the silent switch. Choose one deliberately.

**Background**
- **Extraction:** run it in a detached `Task` wrapped in `beginBackgroundTask`, so a quick app switch does not kill it.
- **OCR source:** the text may come from Apple Vision (D-15). Vision output is not stripped of headers and page numbers the way `ocr-page` output is (CAP-Q07), which can affect the context sentences and the proper-noun heuristic.

**Widgets and notifications**
- **Widget:** a WotD widget reads the pick from an App Group cache, never the network with the user token. Reload its timeline after every review and pick change.
- **Notification:** an interactive notification follows LEX-Q17: "I know this" = advance, "Still learning" = reset, both through the same review core or RPC and counted in the tally. Hide the word when previews are off.

**App Store**
- **Guideline 5.1.1(v):** in-app account deletion is required (D-10).
- **Guideline 5.1.2(i):** disclose third-party AI processing of captured text (Gemini).
- **Privacy labels:** User Content for words and quotes.
- **Name:** user-facing copy uses "The Chronicler" (D-03).
