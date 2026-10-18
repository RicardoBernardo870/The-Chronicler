# The Chronicler — Business-Rules Catalog
> **Index of 12 domain files** · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Owner decisions:** D-01 … D-17 · **Phase 0:** BC-01 … BC-15

Last updated: 2026-10-19 (BC-01 and BC-02 shipped)

This catalog is the numbered, testable statement of how **The Chronicler** behaves: every business rule, its known defects and its open decisions. "BookHero" is the internal code name for the repo, the Supabase project and code identifiers (D-03). Each rule has a stable ID (for example [LIB-04](01-library.md#lib-04--isbn-storage-format)). Tests, work packages, kickoff briefs and code reviews cite rules by these IDs.

## Contents

1. [What this catalog is](#what-this-catalog-is)
2. [Sources of truth](#sources-of-truth)
3. [Index](#index)
4. [Legend](#legend): how to read a rule
5. [How to change a rule](#how-to-change-a-rule)
6. [Glossary](#glossary)
7. [Decisions log](#decisions-log) (D-01 … D-17)
8. [Phase 0 work packages](#phase-0-work-packages) (BC-01 … BC-15)
9. [Top open decisions](#top-open-decisions)

---

## What this catalog is

**A client-agnostic contract.** The web PWA is live and stays live (D-05). A native iOS app (iOS 26+, iPhone first, D-04) comes next, and Android later. All of them use **one** shared Supabase backend. Each rule states the behaviour every client must produce, or the guarantee the backend gives whatever the client does. A web file path in a rule is evidence of where the rule lives today. It does not make the rule web-only.

| Reader | Use the catalog to | Start with |
|---|---|---|
| Web (PWA) developer | Check current behaviour and its edge cases before changing code; find the defect ID a fix closes | The domain file, then [12 · Client logic register](12-client-logic-register.md) |
| iOS developer, or a Claude Code ultracode session building the native app (D-02) | Implement exactly what the server does not enforce, and nothing it does | [12 · Client logic register](12-client-logic-register.md), [11 · Cross-domain](11-cross-domain.md), then each file's *Notes for native clients* |
| Future Android developer | Same as iOS | Same as iOS |
| Backend / Phase 0 author | Know what the database guarantees today and what each BC package must change | [09 · Database invariants](09-database-invariants.md), the [backend consolidation plan](../backend-consolidation-plan.md) |
| Product owner | Settle open decisions; check that a decision has been applied everywhere | [Top open decisions](#top-open-decisions), each file's *Open decisions*, the [decisions log](#decisions-log) |

**How it relates to the other documents**

| Document | Role | Relationship to this catalog |
|---|---|---|
| [`docs/wiki/Features.md`](../wiki/Features.md) | Plain-language overview of every feature (D-01) | Summarises behaviour and links into the catalog. The catalog wins where they differ. |
| [`docs/backend-contract.md`](../backend-contract.md) | API and schema contract: tables, columns, RLS, enums, Storage, RPC signatures and payloads, edge-function contracts, security status, planned changes (§16) | Holds the **shapes**. The catalog holds the **rules** those shapes enforce, and links to the contract instead of repeating it. |
| [`docs/backend-consolidation-plan.md`](../backend-consolidation-plan.md) | Phase 0: the backend work packages BC-01 … BC-15 that must land before the native iOS build | Every acceptance criterion cites catalog rule IDs. Rules cite BC packages in their *Target* lines. |
| [`supabase/reference/`](../../supabase/reference/README.md) | Read-only live-schema snapshot (D-16) | Evidence for every `server:db` and `server:rpc` statement. |
| [`docs/legal-compliance-review.md`](../legal-compliance-review.md) | Privacy and copyright invariants | Platform rules ([08](08-platform-auth-account.md)) cite it. |
| [`docs/ios-implementation-plan.md`](../ios-implementation-plan.md), [`docs/ios-phase-prompts.md`](../ios-phase-prompts.md), [`docs/ios-foundation/`](../ios-foundation/README.md) | iOS plan, ultracode kickoff briefs (D-02) and design foundation | They consume the catalog by rule ID. |

**What the catalog does not contain**

- Payload and column shapes: these are in the backend contract.
- The activity-log feature, which is out of scope for all documentation (D-17).
- Secret values. Environment-variable **names** may appear.
- Real users' row data. Live figures are aggregates only (counts, percentiles).

---

## Sources of truth

| Evidence | What was checked | Notes |
|---|---|---|
| Web code, `master` @ `8d8701c` | Every `client` statement and every `Source:` file and line reference | Line numbers refer to this commit. |
| Live Supabase project `zlndhygpqacygceivuvk`, 2026-10-18 | Constraints, defaults, triggers, RLS policies, function bodies, grants, indexes, Storage buckets and policies, runtime settings. Checked with read-only catalog queries only. | The live database is canonical. `supabase/migrations/` has drifted: 55 of the 69 live functions have no local migration (BC-03). |
| [`supabase/reference/live-baseline-2026-10-18.sql`](../../supabase/reference/live-baseline-2026-10-18.sql) | The committed snapshot of the live schema at the verification date | Not a migration. Regenerate it whenever the live backend changes. |
| Deployed edge functions | `generate-recap` v84, `generate-lore` v18, `generate-reading-dna` v8, plus `ocr-page`, `extract-vocabulary`, `generate-page-resume` and `generate-book-quiz` | The deployed versions are canonical. Repo sources are synced to them (D-09, BC-03). |
| `specs/NNN-*` (web feature specs) | Intent only | Where a spec differs from shipped behaviour, the rule says so and describes what ships. |

**Precedence**

1. **Current behaviour.** The live backend and the deployed edge functions come first, then the web code at the verified commit. The catalog records both. Where a spec, a wiki page or an older document disagrees, the catalog wins.
2. **Target behaviour.** The [decisions log](#decisions-log) and the BC packages in the [consolidation plan](../backend-consolidation-plan.md) win over any older document, including the older `ios-foundation/` files.
3. **Open questions.** Until the owner decides, a question stays in its file's *Open decisions* table. Its recommendation is not binding.

**Where the logic lives today.** Of the 1,022 rules in files 01–11, the *Enforced* lines tag:
- 544 as enforced **only** by the web client;
- 455 as having at least one server layer (119 of these also have a client layer);
- 23 as enforced by nothing, or by configuration only.

The 114 rows of the client logic register are client-only by definition. D-06 moves the core of this logic server-side before the iOS build.

---

## Index

| File | Prefix | Scope | Rules | Known defects | Open decisions | Flows |
|---|---|---|---:|---:|---:|---:|
| [01 · Library & Books](01-library.md) | LIB | Book record and validation; add paths (Google Books search, ISBN scan or typed ISBN, manual form, Goodreads/StoryGraph CSV import); initial status; metadata edit; hard delete; Up Next queue order; DNF shelf; library list, grid and search; ebooks; finish-date forecast | 119 | 38 | 17 | 10 |
| [02 · Reading Sessions, Progress, Completion, Passport & Dashboard](02-reading-sessions.md) | SES | Timed sessions; page saves and `progress_history`; what counts as completion and what it triggers; Book Passport; Dashboard composition and the hero book; forecast, Insight nudge, Last Session card; Focus mode; offline progress queue | 97 | 44 | 19 | 7 |
| [03 · Recaps](03-recaps.md) | REC | Mid-book recaps (corpus and inferred); pre-start blurb; passport summary; recap images; recap lock (+5 %, 6 h, 72 h); recap history; recaps as context for Insights, quiz and resume | 78 | 32 | 17 | 8 |
| [04 · Page Capture, Session Resume & Memory Check](04-capture-resume-quiz.md) | CAP | Capture prompt, camera and upload, OCR (`ocr-page`, Apple Vision on iOS), review, storage, capture XP and the completion purge; the "Previously" resume; the Memory Check quiz | 105 | 32 | 16 | 7 |
| [05 · Codex — Lexicon, Word of the Day & Review](05-codex-lexicon.md) | LEX | Words and quotes; the Leitner schedule; Word of the Day; Vocabulary Review (Anki); the daily allotment; Codex search; automatic vocabulary extraction | 103 | 51 | 23 | 9 |
| [06 · Insights (Lore cards)](06-insights.md) | INS | Milestone detection; Master Recap context; `generate-lore`; card storage and display; seen state; Insight XP | 62 | 32 | 13 | 8 |
| [07 · Profile, Reading Quest, Goals, Achievements, Stats & Reading DNA](07-profile-stats-goals.md) | PRO | XP and levels; the yearly quest and goals; the 17 achievements; stats RPC formulas; Reading DNA and recommendations; profile customisation | 106 | 47 | 21 | 11 |
| [08 · Platform — Auth, Account, Navigation, Caching & Offline](08-platform-auth-account.md) | PLT | Sign-in and session lifecycle; account lifecycle; routing and navigation; SWR cache, retries, errors and toasts; service worker; configuration; time zones and formatting; theme; security posture; legal and compliance | 89 | 47 | 16 | 12 |
| [09 · Database-Enforced Invariants](09-database-invariants.md) | BE | What the shared backend guarantees for any client: constraints, defaults, triggers, RLS, cascades, RPC guards, edge-function validation, runtime limits | 96 | 53 | 11 | 10 |
| [10 · Community & Reading Circles (backend dormant)](10-community-circles.md) | COM | Community identity (the only live slice); follow graph; blocks; discovery; "also reading"; Reading Circles and spoiler-gated reactions | 110 | 41 | 20 | 12 |
| [11 · Cross-Domain Interactions](11-cross-domain.md) | XD | Effect matrices for: deleting a book, the six completion paths, DNF and resume, CSV import, sign-out and account switch, page-count edits, account deletion | 57 | 26 | 5 | 8 |
| [12 · Client Logic Register](12-client-logic-register.md) | CL | Every rule that only a client enforces today, deduplicated, with where it is specified, where it lives in the PWA and its home after Phase 0 | 114 | 23 | 6 | 7 |
| **Total** | | | **1,136** | **466** | **184** | **109** |

How the counts were made (2026-10-18):
- **Rules:** rule headings (`#### <PREFIX>-NN · …`) in files 01–11, and rule rows (`CL-NN`) in file 12.
- **Known defects and Open decisions:** the rows of each file's *Known defects* and *Open decisions* tables.
- **Not counted:** rows that list questions answered by D-01 … D-17 ("dropped or merged"), and the cross-reference tables in XD and CL. XD lists 17 decisions owned elsewhere and CL lists 14.
- A few questions are deliberately mirrored in two files, and each mirror is counted: PRO-Q17 mirrors CAP-Q02, PRO-Q18 mirrors LIB-Q15, and XD-Q02 mirrors PLT-Q12 and BE-Q06.

---

## Legend

### File anatomy

Every domain file has the same sections, in this order:

| Section | Contents |
|---|---|
| Header | Title, prefix, verification line (`web master @ 8d8701c + live Supabase, 2026-10-18`), *Last updated* |
| **Overview** | Scope; web routes and surfaces; owning backend objects (names only; shapes are in the contract); related domains; file-specific terms |
| **Rules** | Numbered rules, grouped by sub-topic |
| **Flows** | State machines and step sequences (`F1 …` or `F-1 …`), plus edge cases and user-visible copy |
| **Constants** | Every number, threshold, limit, TTL and model setting, with its source |
| **Data touchpoints** | Tables, RPCs, edge functions and Storage, read and written, per action |
| **Client-side logic & server migration** | What only the client does today, and where it moves in Phase 0 |
| **Caching & offline** | Cache keys, TTLs, invalidation, offline behaviour |
| **Known defects** | `<PREFIX>-Dnn` rows: Defect · Impact · Fix |
| **Open decisions** | `<PREFIX>-Qnn` rows: Question · Current behaviour · Recommendation |
| **Notes for native clients** | Platform-agnostic guidance (iOS now, Android later), then iOS-specific notes |

### IDs

| Pattern | Meaning | Example |
|---|---|---|
| `<PREFIX>-NN` | A rule. Prefixes are listed in the [index](#index). | [SES-04](02-reading-sessions.md#ses-04--completion-means-current_page--total_pages) |
| `<PREFIX>-NNa` | A rule inserted next to a related rule after numbering. It is as stable as any other ID. | LIB-74a, REC-05b, INS-12a, PLT-17a |
| `CL-NN` | A row of the client logic register. CL-01 … CL-90 keep the original native replication checklist numbering (groups A–K); CL-91 onwards were added later. | [CL-01](12-client-logic-register.md#cl-01) |
| `<PREFIX>-Dnn` | A known defect in that file's *Known defects* table | LIB-D02 |
| `<PREFIX>-Qnn` | An open decision in that file's *Open decisions* table | SES-Q18 |
| `D-NN` | An owner decision, recorded in the [decisions log](#decisions-log) | D-08 |
| `BC-NN` | A Phase 0 work package in the [consolidation plan](../backend-consolidation-plan.md). Sub-items are written `BC-01.3`. | BC-04 |
| `OP-<bc>.<n>` | An open point raised in the consolidation plan. Each names its matching catalog question. | OP-04.2 (SES-Q18) |
| `F1`, `F-1`, `E1` | A flow, or a numbered effect inside a flow, local to one file | XD F-2, effects E1–E19 |
| Range `A…B` | Every rule from A to B, inclusive, in that file's numbering | LIB-66…LIB-86 |

IDs are **stable** and never reused. A gap means the ID was merged into another, or (for questions) answered by a decision. The file records which. For example, SES-23 was merged into [SES-06](02-reading-sessions.md#ses-06--updated_at-moves-on-every-update), and the missing LEX-Q numbers are listed in 05's "Dropped or merged questions".

### Rule anatomy

```
#### LIB-04 · ISBN storage format
<Current behaviour as short, testable statements. Exact values, copy, formulas, precedence. ⚠ LIB-D02>
- **Enforced:** server:db (books_isbn_check)
- **Source:** live constraint; no checksum or conversion code anywhere in src/
- **Target:** <decided future behaviour> (D-05 · BC-15, recommended)
- **Note:** <caveats, worked examples, guidance for other clients, links>
```

| Line | Meaning |
|---|---|
| Heading | `<ID> · <short title>`. Link to it with its GitHub anchor (see [Linking](#linking)). |
| Body | What happens **today**, including defective behaviour. A rule never describes the intended behaviour as if it shipped. |
| **Enforced:** | Which layer enforces the rule today. Uses the tags below, names the object (constraint, policy, trigger, function, file) and may combine several tags. |
| **Source:** | The evidence: `file:line` at the verified commit, a live catalog query (`pg_constraint`, `pg_policies`, `pg_get_functiondef` …), a section of the live baseline, or a deployed edge-function version. |
| **Target:** | The decided future behaviour, tied to its decision and package (`D-06 · BC-04`). Present only when something will change. A Target that depends on a *Recommended* package says so, for example `Target (recommended — BC-10)` or `(BC-15, recommended)`. [09](09-database-invariants.md) keeps its Target lines for Required and Decided work only, and records Recommended work as notes. |
| **Note:** | Caveats, examples, live aggregates, cross-references, and what other clients must do. |
| **Merged:** | IDs folded into this rule. Other labelled lines (*Offline:*, *Glass:*, *App Store:* …) appear where a rule needs them. |

### Enforced tags

| Tag | Layer | What it guarantees |
|---|---|---|
| `server:db` | PostgreSQL schema: NOT NULL, CHECK, UNIQUE, FK and cascade, default, trigger, RLS policy, Storage policy | Holds for **every** write by **every** client, even a raw `curl` with a valid token. |
| `server:rpc` | A PostgreSQL function called through PostgREST (`/rest/v1/rpc/…`) | Holds only for callers that go through that RPC. Unless RLS forbids it, a direct table write can bypass it (see BE-Q02). |
| `server:edge` | A Supabase edge function (Deno) | Holds only for requests to that function. All seven run with `verify_jwt = true`; since BC-02 (2026-10-19) `generate-recap`, `generate-lore` and `ocr-page` also verify the caller with `supabase.auth.getUser`. |
| `client` | Enforced only by the web PWA today | Every other client must implement it identically, or wait for the BC package named in *Target*. Registered in [12](12-client-logic-register.md). |
| `none`, `by absence`, `—` | Nothing enforces it | The rule describes a gap, often linked to a defect or an open decision. |
| Configuration | Supabase Auth project settings, hosting, PostgREST or tooling | Applies to the project, not to code. Named in words. |

### Markers and conventions

| Marker | Meaning |
|---|---|
| ⚠ `<PREFIX>-Dnn` | The statement it follows describes **defective current behaviour**. The defect row gives its impact and fix (usually a BC package). |
| `[UNVERIFIED: …]` | Could not be read through SQL or MCP. Stated from Supabase defaults or from reading code. |
| *dormant* | A backend feature with no client: the follow graph, discovery, circles, the weekly goal (D-13). |
| Required · Decided · Recommended | The status of a BC package. Required and Decided work is committed; Recommended work is not yet decided. |
| `D-xx · BC-xx` | The decision and package that justify a *Target* |
| "Today" / "Target" | Shipped behaviour at the verification date / decided behaviour after Phase 0 |
| *Live snapshot* | Aggregate counts from the live database at the verification date; never individual rows |

### Linking

- **To a rule**, use its heading's GitHub anchor: the heading in lower case, punctuation (including `·`, backticks, `%`, `≥`) removed, and each space turned into `-`. For example, `#### LIB-04 · ISBN storage format` → [`01-library.md#lib-04--isbn-storage-format`](01-library.md#lib-04--isbn-storage-format).
- **To a CL row or CL defect**, use its explicit anchor: [`#cl-01`](12-client-logic-register.md#cl-01), `#cl-d01`, `#cl-q01`.
- **To a defect or an open decision** in files 01–11, link the section: `#known-defects` or `#open-decisions`.
- Use relative links between docs. Never cite line numbers of other documents. Line numbers are used only for code at the verified commit.

---

## How to change a rule

1. **Change the code and the catalog together.**
   - Any change to a behaviour a rule describes updates that rule in the same change: body, *Enforced*, *Source* and *Target*.
   - A backend change also ships its migration, an update to the [backend contract](../backend-contract.md) and a regenerated live baseline in the same change (BC-03, consolidation plan principle P7).
2. **When a BC package lands**, the rules it covers move from `client` to `server:*` in the same PR. Their *Target* lines become the body, and the client register row (CL) changes its target home to "server". Tests are named after the rule IDs they prove: pgTAP for the database, plus the edge-function test suites (plan principle P5).
3. **Never reuse an ID.**
   - A new rule takes the next free number in its file, or a letter suffix (`LIB-74a`) to sit beside a related rule.
   - New defects take the next `Dnn`, and new questions the next `Qnn`.
   - A rule never moves to another prefix. If ownership moves, the old rule keeps its ID and points to the new one.
4. **Retire, don't delete.**
   - *Merged rule:* keep the surviving rule and add a `**Merged:** <old ID> (<what it said>)` line to it, as SES-06 does for SES-23.
   - *Obsolete rule:* keep the heading, replace the body with "Retired YYYY-MM-DD: <reason> → <replacement ID>", and keep the anchor.
   - *Fixed defect:* keep the row and mark it "Fixed YYYY-MM-DD (<migration / PR / BC-xx>)". Update the rule body and remove its ⚠ marker.
   - *Answered question:* remove the row from *Open decisions* and list it under the file's answered or dropped questions, naming the decision. Turn the recommendation, as decided, into *Target* lines. Add an owner decision to the [decisions log](#decisions-log) (next number: D-18), and cite it in the plan where an OP point matched.
5. **Write client-agnostically** (D-05). State the behaviour every client must produce. Cite a web file only as *Source*. Put platform-specific guidance in *Notes for native clients*.
6. **Re-verify, then re-stamp.** When a file is re-checked against code and the live database, update its verification line and *Last updated*. Update the counts in the [index](#index) and the [top open decisions](#top-open-decisions) when they change.
7. **Keep it clean.**
   - Facts only: no audit or review annotations.
   - No secret values; environment-variable names are fine.
   - No real users' rows; aggregates are fine.
   - Never document the activity-log feature (D-17).

---

## Glossary

Terms used across files. Each file also defines its local terms in its *Overview*.

| Term | Meaning | Defined in |
|---|---|---|
| Achievement | One of the 17 Trophy Room badges. Earned once per reader and key into the insert-only `achievements` ledger, and never revoked, even when its condition later becomes false. Today the web evaluates achievements when the Trophy Room mounts. BC-09 moves evaluation server-side. | [PRO-50](07-profile-stats-goals.md#pro-50--ledger-is-insert-only), [PRO-51](07-profile-stats-goals.md#pro-51--achievement-sync-runs-only-on-trophy-room-mount) |
| Active session | A book whose `reading_progress.session_start_at` is set. It is *paused* while `session_paused_at` is also set. There is no session table, and sessions are per book: several books can have a running session today (SES-Q02). | [SES-08](02-reading-sessions.md#ses-08--a-session-is-two-columns-on-the-progress-row-per-book) |
| Also reading *(dormant)* | People the reader follows who are mid-way through the same book, matched by normalised ISBN. Backend only. | [COM-57](10-community-circles.md#com-57--population--people-the-viewer-follows) |
| Away (Memory Check) | At least 48 h, rolling, since the book's last page save (the latest `progress_history.recorded_at`). | [CAP-61](04-capture-resume-quiz.md#cap-61--away-means-at-least-48-h-since-the-last-page-save) |
| Backfill | Two meanings. (1) Progress or a completion that was not read in the app: an "Already finished" or "in progress at page P" add, or a CSV import. How these count for XP and the quest is open (PRO-Q02). (2) *Insight backfill*: generating milestone cards that were skipped, crossed offline or failed (D-12 · BC-08). | [LIB-17](01-library.md#lib-17--initial-progress-write-is-quiet), [06 · Insights](06-insights.md#open-decisions) |
| Baseline history row | Planned with BC-04 (recommended part): a marked history row written when a book is added mid-way, so the starting page is not counted as read. How it is represented is open (SES-Q17). | [SES-33](02-reading-sessions.md#ses-33--initial-status-on-add-book-and-import-is-a-quiet-write) |
| Blurb (pre-start) | The recap path taken at `currentPage = 0`. Today it is stored as an ordinary recap row, with XP and an image. | [REC-32](03-recaps.md#rec-32--blurb-page-0), [REC-33](03-recaps.md#rec-33--blurbs-persist-as-recaps) |
| Book Passport | The completion summary of one book: total days, peak day and its pages, words learned, and the AI summary "Your Story So Far" (`ai_summary`). One `book_passports` row per book, opened from "View Reading Journey". Under BC-05 its stats are frozen at completion. | [SES-44](02-reading-sessions.md#ses-44--one-passport-per-book), [SES-45](02-reading-sessions.md#ses-45--passport-stat-definitions), [REC-35](03-recaps.md#rec-35--passport-trigger--persistence) |
| Book status | Derived, never stored. First match wins: `dnf` if `dnf_at` is set; `unread` if there is no progress row or `current_page = 0`; `finished` if `current_page ≥ total_pages` with `total_pages > 0`; otherwise `reading`. | [LIB-44](01-library.md#lib-44--server-status-derivation), [LIB-46](01-library.md#lib-46--client-status-for-optimistic-snapshots) |
| Capture prompt | "Capture this page", offered after an online page save that wrote a history row. Which saves should raise it is open (XD-Q01). | [CAP-01](04-capture-resume-quiz.md#cap-01--the-prompt-is-raised-by-a-save-that-produced-a-history-row) |
| Codex | The bottom-nav tab (route `/lexicon`) that holds the reader's Lexicon (words and quotes) and an Insights tab. | [05 · Overview](05-codex-lexicon.md#overview) |
| Community profile | The reader's identity: username, display name and avatar. The web also has a bio, a public toggle and four privacy settings. The profile is created on first save, not at sign-up. iOS v1 builds only username, display name and avatar (D-13). | [COM-01](10-community-circles.md#com-01--no-profile-row-at-sign-up) |
| Completion (complete book) | **State:** `total_pages > 0` and `current_page ≥ total_pages`. **Event** ("completed now"): today only the web client detects it, during an online save, and the six completion paths fire different effect subsets. **Target:** `save_progress` detects the first crossing and stamps `reading_progress.completed_at`. That timestamp is never cleared and drives "finished this year" (BC-04). BC-05 owns every completion effect. | [SES-04](02-reading-sessions.md#ses-04--completion-means-current_page--total_pages), [XD-13](11-cross-domain.md#xd-13--completion-state-vs-event), [XD-14](11-cross-domain.md#xd-14--six-completion-paths-fire-six-different-effect-subsets) |
| Cooldown (recap) | The 6 h after the newest recap or the last page save, during which Get Recap is locked. | [REC-04](03-recaps.md#rec-04--cooldown-6-h-option-b-anchor) |
| Corpus recap / inferred recap | A mid-book recap is **corpus** when it is grounded on up to 3 of the reader's page captures. It is **inferred** when it is built from model knowledge: a Gemini 2.5 Pro extraction with Google Search grounding, then a Flash composer. Today corpus is chosen when at least 1 capture qualifies and `currentPage > fromPage`. The window rule is open (REC-Q02). | [REC-14](03-recaps.md#rec-14--corpus-window--two-recaps-back-option-a), [REC-16](03-recaps.md#rec-16--corpus-decision) |
| Daily allotment | 20 words per day: one pool shared by the Word of the Day and Vocabulary Review. "Review more" adds 20 (held in memory only today). | [LEX-36](05-codex-lexicon.md#lex-36--the-limit-is-20), [LEX-39](05-codex-lexicon.md#lex-39--todays-set-is-one-shared-pool), [LEX-41](05-codex-lexicon.md#lex-41--review-more-adds-20-in-memory-only) |
| DNF (Did Not Finish) | A shelved book: `reading_progress.dnf_at` is set. Its progress and words are kept. Sessions, recaps and Insights pause until the reader resumes, which clears `dnf_at`. Today only `get_library_with_progress` knows DNF; every other aggregate ignores it (BE-Q04). | [LIB-90](01-library.md#lib-90--who-can-be-shelved), [LIB-91](01-library.md#lib-91--shelving-write), [LIB-92](01-library.md#lib-92--resume) |
| Due / eligible word | A word is **due** when `next_review_at ≤ today`. It is **eligible** when it is a word (not a quote), not mastered, due, and not yet reviewed today. | [LEX-34](05-codex-lexicon.md#lex-34--eligibility-and-order) |
| Focus mode | A full-screen session timer with wake lock, auto-dim and reading-goal chips. Available only while a session runs. | [SES-79](02-reading-sessions.md#ses-79--focus-mode-exists-only-during-a-session) |
| Forecast (finish date) | The days-left estimate from `get_reading_velocity`, shown as "finish by ~date" on reading cards and the hero. Its meaning is open (SES-Q08). | [LIB-101](01-library.md#lib-101--days-left-forecast-get_reading_velocity), [SES-70](02-reading-sessions.md#ses-70--velocity-rpc) |
| Hero book | The one book on the Dashboard hero card (the "active book"). It is either chosen explicitly, by tapping a cover, or inferred. An inferred hero is unfinished, not DNF, and either started or in a session; queued books come first by queue position, then the most recently updated. Held in memory only today (SES-Q01). | [SES-58](02-reading-sessions.md#ses-58--the-hero-lives-in-memory-only), [SES-59](02-reading-sessions.md#ses-59--hero-inference), [SES-61](02-reading-sessions.md#ses-61--explicit-selection) |
| History row | A `progress_history` row: page, `recorded_at`, an optional `session_start_at` and an optional note. Today every online page save writes one. | [SES-32](02-reading-sessions.md#ses-32--every-online-save-writes-a-history-row) |
| Idle grant | When at least 72 h have passed since the book's last `reading_progress` update, and at least 6 h since the newest recap, Get Recap unlocks regardless of the page lock and the cooldown. | [REC-06](03-recaps.md#rec-06--idle-unlock-72-h) |
| Imported book / manual book | **Imported:** `books.source` is `goodreads` or `storygraph` (CSV import). **Manual:** `source` is `manual` (every interactive add path) or NULL. `source` never changes after insert. Imported books are excluded from the quest, XP and page totals (LIB-Q16, PRO-Q02). | [LIB-08](01-library.md#lib-08--source), [LIB-85](01-library.md#lib-85--imported-books-in-stats) |
| Insight (lore card) | A short AI-written background entry: a title, a 90–160-word body, a type and up to 5 named entities. It unlocks at a 10 % reading milestone. "Insights" is the user-facing name; tables, functions and most copy still say "lore" (`lore_cards`, `generate-lore`). | [06 · Overview](06-insights.md#overview), [INS-01](06-insights.md#ins-01--milestone-set) |
| Last Session card | The Dashboard card that summarises the most recent timed session (`get_last_session`). Under D-08 it requires a real timed session. | [SES-72](02-reading-sessions.md#ses-72--get_last_session) |
| Leitner box | The review stage of a word, 1–5. The interval for each box is 1, 2, 4, 8 and 16 days. **Advance** moves the word to `min(box + 1, 5)` and schedules it for today plus the new box's interval. **Reset** returns it to box 1, due again the next day. | [LEX-24](05-codex-lexicon.md#lex-24--five-boxes-and-the-interval-table), [LEX-25](05-codex-lexicon.md#lex-25--advance-wotd-only), [LEX-26](05-codex-lexicon.md#lex-26--reset-anki-didnt-know-only) |
| Level | Reader level 0–6, from lifetime XP floors 0 / 1,500 / 4,000 / 8,000 / 14,000 / 22,000 / 34,000. The titles are Page Turner, Chapter Seeker, Margin Walker, Lore Keeper, Archive Runner, Chapter Sage and Library Legend. Levels are 0-based today; how to display them is open (PRO-Q04). | [PRO-07](07-profile-stats-goals.md#pro-07--level-thresholds-and-titles-0-based) |
| Lexicon entry | A Codex item tied to one book. A **word** (`entry_type = 'dictionary'`) is reviewable. A **quote** (`'quote'`) is a keepsake and never reviewed. `source` is `manual`, or `auto` for words auto-extracted from a page capture (at most 5 per capture). | [LEX-01](05-codex-lexicon.md#lex-01--two-entry-types-words-and-quotes), [LEX-02](05-codex-lexicon.md#lex-02--source-manual-or-auto), [LEX-83](05-codex-lexicon.md#lex-83--trigger) |
| Master Recap | The spoiler-safe context for Insights. It joins, in page order, the book's recaps that have `progress_snapshot > 0` and `page_snapshot ≤ current page`. It is empty when no recap qualifies. | [REC-58](03-recaps.md#rec-58--master-recap), [INS-13](06-insights.md#ins-13--master-recap-derivation) |
| Mastered | The terminal state of a word (`mastered = true`). Only "Knew it" in Vocabulary Review sets it, whatever the box, and a mastered word leaves review for good. The Word of the Day never masters a word. | [LEX-29](05-codex-lexicon.md#lex-29--only-anki-knew-it-masters), [LEX-30](05-codex-lexicon.md#lex-30--mastery-is-terminal) |
| Meaningful (valid) session | A timed history row with a duration of at least 60 s and a page delta of at least 1. Used for session counts, hours, velocity and pace. | [PRO-22](07-profile-stats-goals.md#pro-22--meaningful-session) |
| Memory Check | A recall quiz of 1–3 multiple-choice questions built from the reader's page captures. It is offered at Start Session when the reader is away ≥ 48 h, has capture material, has no fresh recap, and has no answered quiz covering the current position. It is also available on demand from the "Memory check" chip. | [CAP-64](04-capture-resume-quiz.md#cap-64--session-start-eligibility), [CAP-66](04-capture-resume-quiz.md#cap-66--on-demand-mode-bypasses-every-gate) |
| Milestone (Insight) | 10, 20 … 90 % of the book. There is no 0 % or 100 % milestone, so a book has at most 9 Insights. A save that crosses buckets unlocks the highest bucket crossed (today, only that one). | [INS-01](06-insights.md#ins-01--milestone-set), [INS-03](06-insights.md#ins-03--crossing-rule) |
| Offline queue | Page saves made without a connection are queued on the device and replayed later. Today the web replays them as bare progress upserts with no history row. Under D-08 · BC-04 they replay through `save_progress`, with their original time and an idempotency key. | [SES-76](02-reading-sessions.md#ses-76--the-queue-decision-is-made-before-any-network-attempt), [SES-77](02-reading-sessions.md#ses-77--what-an-offline-save-does-and-skips), [SES-78](02-reading-sessions.md#ses-78--replay-is-a-bare-progress-upsert) |
| Page capture | The text of one page, photographed or uploaded (for example an ebook screenshot) and recognised by `ocr-page` (on iOS, Apple Vision first, D-15). Stored once per (reader, book, page); the images are never stored. Each unique page earns +5 XP, and every capture is purged when the book completes. Captures feed corpus recaps, auto-vocabulary, "Previously" and Memory Check. | [CAP-30](04-capture-resume-quiz.md#cap-30--one-capture-per-page-upsert), [CAP-20](04-capture-resume-quiz.md#cap-20--auto-save-for-high-confidence), [CAP-42](04-capture-resume-quiz.md#cap-42--completion-purge-from-the-progress-side) |
| Page delta | The pages credited to one history row: the advance beyond the highest earlier page (a high-water mark), so backward edits never count twice. | [PRO-21](07-profile-stats-goals.md#pro-21--page-delta-definition-lifetime-stats) |
| "Previously" (session resume) | Up to 3 bullets and a tension line. Generated from a page capture when the capture is saved, and shown when a session starts. | [CAP-48](04-capture-resume-quiz.md#cap-48--the-resume-is-generated-at-capture-time-and-shown-at-session-start) |
| Quiet write | A `reading_progress` write that produces no history row and no client-side effects (database triggers still fire): the initial status on add, CSV import, offline replay, and session or DNF column writes. | [SES-33](02-reading-sessions.md#ses-33--initial-status-on-add-book-and-import-is-a-quiet-write), [LIB-17](01-library.md#lib-17--initial-progress-write-is-quiet) |
| Reaction / Reading Circle *(dormant)* | A circle is an invite-only group of up to 10 readers of one book, whose title, author, cover and ISBN are snapshotted at creation. Members post reactions gated by position, measured as a percentage of the book so that editions line up. A reaction can be posted only at or behind the author's own position, and is visible only to members at or past it. | [COM-66](10-community-circles.md#com-66--create_reading_circle-input), [COM-67](10-community-circles.md#com-67--snapshot-at-creation), [COM-86](10-community-circles.md#com-86--location-math-post-only-at-or-behind-your-saved-position) |
| Reader zone | The reader's IANA time zone. Under D-07 it sets every day, week, month and year boundary, and BC-06 stores it server-side (`user_settings.time_zone`). Today it is not stored, and most RPCs compute in UTC. | [PLT-62](08-platform-auth-account.md#plt-62--device-iana-zone-is-passed-to-four-rpcs-two-spellings), [PLT-83](08-platform-auth-account.md#plt-83--the-readers-timezone-is-not-stored-server-side) |
| Reading DNA | An AI reader-personality profile: personality text, mood tone, emojis and 3–5 book suggestions, one `reading_dna` row per reader. First generated at 2 finished books; regenerated after 2 more finished books or after 90 days. The deployed `generate-reading-dna` v8, with Google Search grounding, is canonical (D-09). | [PRO-52](07-profile-stats-goals.md#pro-52--dna-storage), [PRO-55](07-profile-stats-goals.md#pro-55--first-generation-needs-2-finished-books), [PRO-56](07-profile-stats-goals.md#pro-56--regeneration-rule) |
| Recap | A three-part AI briefing (memory jogger, concept watchlist, thematic bridge) on the stretch read since the previous recap. Each recap earns +20 XP and gets one 1024×1024 illustration (the *recap image*), made by a background job. | [03 · Overview](03-recaps.md#overview), [03 · Recap images](03-recaps.md#recap-images) |
| Recap lock | Get Recap stays locked until both hold: the reader is 5 % of the book past the newest recap's position, and 6 h have passed since the newest recap or page save. The 72 h idle grant overrides both. Today the client computes the lock; BC-07 enforces it in `generate-recap` on the server clock. | [REC-03](03-recaps.md#rec-03--page-threshold-5-), [REC-04](03-recaps.md#rec-04--cooldown-6-h-option-b-anchor), [REC-06](03-recaps.md#rec-06--idle-unlock-72-h), [REC-08](03-recaps.md#rec-08--final-lock) |
| Session lifecycle | Start → pause / resume (the start shifts forward by the paused span) → **end** with a page save, or **cancel**, which ends the session with no record. | [SES-18](02-reading-sessions.md#ses-18--resume-shifts-the-start-forward-by-the-paused-span), [SES-22](02-reading-sessions.md#ses-22--cancel-ends-the-session-with-no-record) |
| Spoiler wall | AI context and community reactions never include material beyond the reader's own current page or position. | [REC-58](03-recaps.md#rec-58--master-recap), [INS-12](06-insights.md#ins-12--recap-prerequisite-spoiler-wall), [COM-86](10-community-circles.md#com-86--location-math-post-only-at-or-behind-your-saved-position) |
| Streak | Consecutive days with at least one history row. Today the days are UTC dates; under D-07 they move to the reader zone. | [PRO-24](07-profile-stats-goals.md#pro-24--a-streak-day-is-a-utc-date-and-any-history-row-marks-one) |
| The Chronicler / BookHero | Product and App Store name / internal code name (repo, Supabase project, identifiers, the iOS repo `bookhero-ios`) (D-03) | [Decisions log](#decisions-log) |
| Timed session / untimed update | A **timed** history row has `session_start_at` set: the save that ended a running session. An **untimed update** has it null: a pencil correction outside a session. Under D-08 both count for pages, streaks and charts, but only real timed sessions count for session XP, session-count badges and the Last Session card. | [SES-08](02-reading-sessions.md#ses-08--a-session-is-two-columns-on-the-progress-row-per-book), [SES-32](02-reading-sessions.md#ses-32--every-online-save-writes-a-history-row) |
| Trophy Room | `/profile/trophy-room`: the quest ring and goal dialog, the reader level strip and the 17-badge achievements wall. | [07 · Overview](07-profile-stats-goals.md#overview) |
| Up Next | The reading queue: books at exactly 0 % that are not DNF. Ordered by `up_next_order.sort_position`, which the reader sets by dragging on the Library page. Books without a position, which includes every new book, follow. | [LIB-55](01-library.md#lib-55--queue-order), [LIB-56](01-library.md#lib-56--new-books-are-unordered), [SES-64](02-reading-sessions.md#ses-64--up-next-shelf) |
| Vocabulary Review (Anki) | The `/anki-review` flashcard session: up to 20 cards from today's set. It is prompted from the Word of the Day slot when ≥ 3 days have passed since the last session and ≥ 5 words remain in today's set. "Knew it" masters a word; "Didn't know" resets it to box 1. | [LEX-54](05-codex-lexicon.md#lex-54--prompt-condition), [LEX-55](05-codex-lexicon.md#lex-55--session-cadence--3-days), [LEX-29](05-codex-lexicon.md#lex-29--only-anki-knew-it-masters) |
| Word of the Day (WotD) | The Dashboard card that shows one word at a time from today's set, lowest box and most overdue first. Its only action is advance, so it never masters a word. | [LEX-44](05-codex-lexicon.md#lex-44--when-the-wotd-is-resolved), [LEX-47](05-codex-lexicon.md#lex-47--the-pick), [LEX-25](05-codex-lexicon.md#lex-25--advance-wotd-only) |
| XP | A lifetime integer recomputed on every read: pages × 1 + completed books × 25 + history rows × 10 + captured pages × 5 + recaps × 20 + Insights × 15. Pages and completions count manual books only. XP can drop when rows are deleted. | [PRO-01](07-profile-stats-goals.md#pro-01--xp-formula) |
| Yearly quest (Reading Quest) | The reader's book-count goal for a calendar year (one `reading_goals` row per year), with pace and a status: no goal, complete, no projection, ahead, on track, behind or comeback. Today a book counts toward the UTC year of its last `reading_progress.updated_at`. **Target:** the year of `completed_at`, in the reader zone (BC-04 · BC-06). | [PRO-09](07-profile-stats-goals.md#pro-09--the-quest-year-is-a-utc-window-and-membership-is-decided-by-updated_at), [PRO-14](07-profile-stats-goals.md#pro-14--quest-status-ordered-first-match-wins), [PRO-18](07-profile-stats-goals.md#pro-18--one-goal-per-user-per-year) |
| Zombie session | A session left running on a completed book. Sessions never expire today (SES-Q16). | [SES-89](02-reading-sessions.md#ses-89--a-zombie-session-can-survive-on-a-completed-book) |
| Expand → migrate → contract | The Phase 0 rollout rule. *Expand* adds new columns, RPCs and versioned edge modes while legacy paths keep working. *Migrate* moves the PWA and iOS to the new paths. *Contract* revokes legacy writes once the legacy-write counters read zero for 14 days. | [Plan §1.2 (P2)](../backend-consolidation-plan.md#12-principles) |

---

## Decisions log

The owner made these decisions on **2026-10-18**. They are authoritative, and every catalog file applies them, mostly as *Target* lines. A decision changes only through a new, numbered entry that names the entry it supersedes. When an open question (`<PREFIX>-Qnn`) or a plan open point (`OP-xx.n`) is decided, it is recorded here as D-18 onwards, and the owning file and the plan are updated in the same change.

| ID | Decision | Where it lands |
|---|---|---|
| **D-01** | **Docs layout.** A numbered business-rules catalog lives in `docs/business-rules/`: this README as the index, plus one file per domain. `docs/wiki/Features.md` becomes an overview that links into the catalog. | This catalog; [Features](../wiki/Features.md) |
| **D-02** | **No Spec Kit.** The native app, and future features, are built with Claude Code using Opus 5.5 in ultracode mode. The iOS phase prompts become ultracode kickoff briefs. The iOS repo gets a `CLAUDE.md`, derived from `docs/ios-foundation/ios-constitution.md`, instead of a `.specify` constitution. Every `/speckit-*` step is removed, and so is every reference to `specs/1xx-ios-*` or `docs/wiki/Planned-*.md` (those never existed). | [iOS phase prompts](../ios-phase-prompts.md), [iOS implementation plan](../ios-implementation-plan.md), [iOS foundation](../ios-foundation/README.md) |
| **D-03** | **Names.** The product and App Store name is **"The Chronicler"**. "BookHero" stays the internal code name: the repo, the Supabase project and code identifiers. The iOS repo name `bookhero-ios` is fine. | All files; [PLT](08-platform-auth-account.md) (user-facing name), PRO-Q21 and COM-Q14 (reserved usernames) |
| **D-04** | **iOS platform.** iOS 26+ minimum, iPhone first. Native Liquid Glass (`.glassEffect` / `GlassEffectContainer`) is **the** glass implementation, with no pre-iOS-26 fallback branch. Reduce Transparency and Increase Contrast are respected. | *Notes for native clients* in every file |
| **D-05** | **One backend, the PWA stays live.** The long-term goal is iOS, Android and web on **one** shared Supabase backend. Every backend change is client-agnostic and backward compatible: the PWA keeps working during transitions, and it migrates to the new RPCs too. Rules are written client-agnostically. | Every *Target*; plan principles P1–P3 |
| **D-06** | **Core logic moves server-side before the iOS build.** This covers: an atomic save-progress RPC (page, history, session end and completion side effects, on the server clock); recap eligibility enforced in `generate-recap`; and server-side achievements and Insight generation. Native clients stay thin. | BC-04, BC-05, BC-07, BC-08, BC-09; [02](02-reading-sessions.md), [03](03-recaps.md), [06](06-insights.md), [07](07-profile-stats-goals.md), [11](11-cross-domain.md), [12](12-client-logic-register.md) |
| **D-07** | **Time zones.** Every day, week, month and year boundary uses the reader's IANA time zone. Stats RPCs take a time-zone parameter, and the reader's zone is stored server-side for jobs. | BC-06; [07](07-profile-stats-goals.md), [08](08-platform-auth-account.md) (PLT-62…PLT-65, PLT-83), [05](05-codex-lexicon.md) |
| **D-08** | **Activity counting.** Any forward page change counts for pages, streaks and charts, including offline saves, which are replayed with their original timestamp. Session XP, session-count badges and the Last Session card require a real timed session. | BC-04, BC-06; [02](02-reading-sessions.md), [07](07-profile-stats-goals.md), [11](11-cross-domain.md) |
| **D-09** | **Edge-function drift.** The **deployed** versions are canonical: `generate-lore` v18 (accuracy-first, temperature 0.35) and `generate-reading-dna` v8 (with Google Search grounding). Repo sources are synced to the deployed versions. | BC-03; [06](06-insights.md), [07](07-profile-stats-goals.md), [09](09-database-invariants.md) |
| **D-10** | **Account deletion.** Immediate hard delete through a new `delete-account` edge function. It purges Storage `recap-images/{uid}/` and `community-avatars/{uid}/`, revokes the Sign in with Apple token and calls `auth.admin.deleteUser`; FK cascades remove the rows. It requires a confirm and re-authentication, and ships on web **and** iOS. | BC-11; [08](08-platform-auth-account.md) (PLT-72…PLT-74), [11](11-cross-domain.md) (XD-54…XD-57) |
| **D-11** | **Auth.** Sign in with Apple plus email and password. Password reset on both clients. Magic links and reset links travel as universal links. Existing email users can link an Apple ID from settings, which avoids duplicate empty accounts created through Hide My Email. | BC-11; [08](08-platform-auth-account.md) |
| **D-12** | **Insights without recaps.** When no qualifying recap exists, the Insight is generated from the reader's page captures, or from spoiler-guarded book metadata. Milestones that were skipped, crossed offline or failed are backfilled. | BC-08; [06](06-insights.md), [04](04-capture-resume-quiz.md) (purge timing, CAP-Q03) |
| **D-13** | **iOS v1 profile scope.** The iOS v1 profile is username, display name and avatar **only**: no bio, no privacy settings, no public toggle. The follow graph, discovery and circles belong to a much later Community phase, and their backend stays dormant until then. | [10](10-community-circles.md), [07](07-profile-stats-goals.md) |
| **D-14** | **Subscriptions and paywall: undecided.** Any tier table is a non-binding draft. Server-side entitlement and AI-usage checks are designed without fixing tiers or prices. | BC-12; every AI-feature file |
| **D-15** | **iOS OCR.** On-device Apple Vision text recognition first, falling back to the `ocr-page` (Gemini) edge function on low confidence. The 0.90 auto-save and 0.70 warning thresholds are calibrated for Gemini and must be recalibrated for Vision. | [04](04-capture-resume-quiz.md) (CAP-20, CAP-24, CAP-Q07) |
| **D-16** | **Live-schema snapshot and full disclosure.** A read-only live-schema snapshot is committed at `supabase/reference/live-baseline-2026-10-18.sql`, with a README. The repo will be made private, so security findings may be documented in full. | [Sources of truth](#sources-of-truth); [09](09-database-invariants.md); BC-01, BC-02 |
| **D-17** | **Activity log out of scope.** The activity-log feature is out of scope for all documentation. It is never documented, and existing mentions are removed only where they describe it. | Every document |

---

## Phase 0 work packages

Phase 0 is the backend work that lands **before the native iOS build**. The IDs are fixed and every document uses exactly these. Details (why, scope, rollout, acceptance criteria, open points): [backend consolidation plan](../backend-consolidation-plan.md). Order:
- Waves 1–3 must be done before the iOS build starts.
- Wave 4 must be done before the first external TestFlight build.
- BC-11 blocks App Store submission, and can start as soon as BC-02 lands ([plan §2.1](../backend-consolidation-plan.md#21-waves)).

| ID | Package | Status | Wave | Delivers | Main catalog files |
|---|---|---|---|---|---|
| [BC-01](../backend-consolidation-plan.md#bc-01--security-hardening) | Security hardening | **Required** (shipped 2026-10-19) | 1 | Owner checks (assert `p_user_id = auth.uid()`, keeping the parameter for the PWA) in `get_library_with_progress`, `get_library_breakdown`, `get_last_session` and `get_reading_velocity`. A NULL-safe guard in `get_reading_quest_summary`. Anon/PUBLIC `EXECUTE` revoked across `public` functions, and `pg_default_acl` fixed. Dead `after_page_capture_saved` dropped; `prune_page_captures_for_book` dropped or locked. Leaking helpers (`community_remove_pair_follows`, `circle_progress_location`, …) locked. Child-table RLS checks book ownership (`lore_cards` and others). The direct follows-insert bypass closed. Advisor debt cleared: `auth_rls_initplan`, unindexed FKs, a duplicate index. | [09](09-database-invariants.md), [08](08-platform-auth-account.md), [10](10-community-circles.md), [01](01-library.md), [07](07-profile-stats-goals.md) |
| [BC-02](../backend-consolidation-plan.md#bc-02--edge-function-auth) | Edge-function auth | **Required** (shipped 2026-10-19 for `generate-recap`, `generate-lore`, `ocr-page`) | 1 | Real JWT verification (`verify_jwt = true`, or `supabase.auth.getUser`) for `generate-recap`, `generate-lore` and `ocr-page`. Hand-rolled base64 JWT decoding removed. No internal error text in 500 responses. `supabase/config.toml` committed with per-function settings. | [08](08-platform-auth-account.md), [03](03-recaps.md), [06](06-insights.md), [04](04-capture-resume-quiz.md), [09](09-database-invariants.md) |
| [BC-03](../backend-consolidation-plan.md#bc-03--source-of-truth--drift) | Source of truth & drift | **Decided** (in progress: live snapshot committed 2026-10-18) | 1 | The live baseline is kept, squashed into a baseline migration, and migration discipline is enforced. Repo edge-function sources are synced to deployed (`generate-lore` v18, `generate-reading-dna` v8), and the misplaced thinking config is fixed. `backend-contract.md` is kept in sync. | [09](09-database-invariants.md), [06](06-insights.md), [07](07-profile-stats-goals.md), [08](08-platform-auth-account.md) |
| [BC-04](../backend-consolidation-plan.md#bc-04--atomic-progress--session-rpcs) | Atomic progress & session RPCs | **Decided** | 2 | `start_session`, `pause_session`, `resume_session` and `cancel_session`, plus `save_progress(book, page, note, client_occurred_at, idempotency_key)`, all on the server clock (client time only for offline replays). One atomic write of `reading_progress` and `progress_history` that also ends the session. Completion detection, with a new first-completion timestamp `reading_progress.completed_at` that drives "finished this year". DNF and resume RPCs that never send `current_page`. Implements D-08 (timed vs untimed history; offline replays keep their original time). Recommended: a baseline history row when a book is added mid-way. | [02](02-reading-sessions.md), [01](01-library.md), [11](11-cross-domain.md), [07](07-profile-stats-goals.md) |
| [BC-05](../backend-consolidation-plan.md#bc-05--server-owned-completion--lifecycle-effects) | Server-owned completion & lifecycle effects | **Decided** | 2 | One server owner for completion effects, whatever the client or path: passport stats frozen at completion, the passport AI-summary job, the capture/quiz purge (existing triggers), Insight milestone evaluation, achievements evaluation and DNA eligibility. | [02](02-reading-sessions.md), [04](04-capture-resume-quiz.md), [06](06-insights.md), [07](07-profile-stats-goals.md), [11](11-cross-domain.md) |
| [BC-06](../backend-consolidation-plan.md#bc-06--timezone-standardisation) | Timezone standardisation | **Decided** | 2 | Every stats RPC takes `p_timezone`: streaks, this week and month, the quest year, sessions this month, the review daily tally and the Word-of-the-Day day. The reader zone is persisted (for example `user_settings.time_zone`). | [07](07-profile-stats-goals.md), [08](08-platform-auth-account.md), [05](05-codex-lexicon.md) |
| [BC-07](../backend-consolidation-plan.md#bc-07--recap-eligibility--persistence-server-side) | Recap eligibility & persistence server-side | **Decided** | 3 | `generate-recap` enforces the lock (+5 %, 6 h cooldown, 72 h idle) on the server clock, selects the corpus window, persists the validated `recaps` row and returns it. Abort and background semantics are defined: once paid, finish and save. | [03](03-recaps.md) |
| [BC-08](../backend-consolidation-plan.md#bc-08--insights-orchestration-server-side--fallback) | Insights orchestration server-side + fallback | **Decided** | 3 | Milestone detection on save (from BC-04). Generation from a recap, then captures, then spoiler-guarded metadata. Backfill of skipped and failed milestones. Inserts use `ON CONFLICT DO NOTHING`. Clients only list cards and mark them seen. | [06](06-insights.md) |
| [BC-09](../backend-consolidation-plan.md#bc-09--achievements-server-side) | Achievements server-side | **Decided** | 3 | The achievements catalog and its evaluation in SQL or an RPC (`sync_achievements`, or trigger-driven), with a server-authoritative `earned_at`. Clients render. | [07](07-profile-stats-goals.md) |
| [BC-10](../backend-consolidation-plan.md#bc-10--review-leitner-rpc) | Review (Leitner) RPC | **Recommended** | 3 | `review_lexicon_entry(entry_id, outcome, surface)`, returning box, `next_review_at` and mastered. The daily tally and the due set come from an RPC in the reader zone. Undo support. | [05](05-codex-lexicon.md) |
| [BC-11](../backend-consolidation-plan.md#bc-11--account-lifecycle--auth) | Account lifecycle & auth | **Decided** | 4 (can start after BC-02) | The `delete-account` edge function (D-10). Password reset. The Sign in with Apple provider, with identity linking. Universal-link redirect URLs. Custom SMTP. A decision on email confirmation. Optional data export. | [08](08-platform-auth-account.md), [11](11-cross-domain.md), [10](10-community-circles.md) |
| [BC-12](../backend-consolidation-plan.md#bc-12--entitlements--ai-usage-foundation) | Entitlements & AI-usage foundation | **Decided in principle; tiers undecided** (D-14) | 4 | An `entitlements` table (fed by App Store Server Notifications v2 or RevenueCat), an `ai_usage` ledger, and one shared check in every AI edge function (allow-all until tiers are decided). | [08](08-platform-auth-account.md), [09](09-database-invariants.md), [03](03-recaps.md), [05](05-codex-lexicon.md), [06](06-insights.md) |
| [BC-13](../backend-consolidation-plan.md#bc-13--storage-hygiene--ai-job-robustness) | Storage hygiene & AI-job robustness | **Recommended** | 4 | Recap images deleted when their recap or book is deleted, through an edge function (`storage.protect_delete` blocks SQL deletes). An orphan sweep. A stale `pending` image becomes `failed_transient` after a timeout. Error handling in the recap-image job. | [03](03-recaps.md), [01](01-library.md), [09](09-database-invariants.md), [11](11-cross-domain.md) |
| [BC-14](../backend-consolidation-plan.md#bc-14--sync--realtime-readiness) | Sync & realtime readiness | **Recommended** | 4 | Either add `recaps` (image status) and `reading_progress` to the `supabase_realtime` publication, or define refresh-on-foreground. A delta and paginated library RPC (`changed_since`). `device_tokens` for APNs later. | [08](08-platform-auth-account.md), [09](09-database-invariants.md), [11](11-cross-domain.md) |
| [BC-15](../backend-consolidation-plan.md#bc-15--book-data-hygiene) | Book data hygiene | **Recommended** | 4 | ISBN normalisation before insert: strip hyphens and spaces, uppercase X, validate the checksum, convert 10 → 13. A server-side book-search proxy for multi-client traffic, which hides the Google key, caches and rate-limits. An atomic, idempotent import RPC. | [01](01-library.md) |

---

## Top open decisions

These are the 15 still-open questions with the most impact across the catalog, ranked by what they block:
1. Wave 2 RPC semantics (BC-04 / BC-05);
2. Wave 3 server features;
3. App Store and security prerequisites.

Each row names the question that owns the decision and the related questions it would also settle. The recommendation is the owning file's recommendation. None of these are decided until they appear in the [decisions log](#decisions-log).

| # | Decision | Question | Recommendation | Also settles |
|---|---|---|---|---|
| 1 | [XD-Q01](11-cross-domain.md#open-decisions) | One "reading event" rule for the side effects D-08 does not settle. Which saves raise the capture prompt, anchor the 6 h recap cooldown and reset the 48 h Memory Check away clock? Which writes move the 72 h idle clock and "last read"? | Use the BC-04 history `kind`. Only a forward page change raises the prompt, anchors the cooldown and resets the away clock. Backward and zero-delta corrections, session-only writes and DNF writes do none of these. Anchor the idle clock and "last read" on the last forward page change (a dedicated column), not on `updated_at`. | [CAP-Q01](04-capture-resume-quiz.md#open-decisions), [REC-Q01](03-recaps.md#open-decisions), [REC-Q04](03-recaps.md#open-decisions), [SES-Q11](02-reading-sessions.md#open-decisions), [SES-Q15](02-reading-sessions.md#open-decisions). CAP-Q01 (away clock on any history row) and REC-Q04 (idle anchor on the newest history row) recommend slightly different anchors; deciding XD-Q01 settles them. |
| 2 | [SES-Q02](02-reading-sessions.md#open-decisions) | May several books have running sessions at once? | One active session per user. `start_session` returns a conflict naming the other book, and the client offers end or cancel. This also simplifies the Live Activity. | [SES-Q19](02-reading-sessions.md#open-decisions) (Live Activity in iOS v1) |
| 3 | [SES-Q18](02-reading-sessions.md#open-decisions) | How is an offline replay that is older than the server's latest change applied? | Always record the history row at `client_occurred_at` (D-08). Update `current_page` only when the replay is newer than the server's last page change. The idempotency key removes duplicates. | [CL-Q04](12-client-logic-register.md#cl-q04) (v1 native offline scope: page saves, including session end, via `save_progress`; everything else online-only) |
| 4 | [PRO-Q01](07-profile-stats-goals.md#open-decisions) | One canonical "books finished" and "in progress" for the Profile, Book Lengths, DNA, breakdown, badges, XP and quest. Do DNF books at 100 % count? | Finished = `completed_at IS NOT NULL` (BC-04) and not currently DNF, as one server definition exposed by the stats RPCs. Add a DNF bucket to the breakdown. | [XD-Q04](11-cross-domain.md#open-decisions) (DNF wins: completion and `completed_at` run only while `dnf_at` is null; `resume_dnf` re-evaluates completion), [BE-Q04](09-database-invariants.md#open-decisions), [LIB-Q11](01-library.md#open-decisions). BE-Q04 instead recommends that `save_progress` clear `dnf_at` when a DNF book reaches its last page, which conflicts with XD-Q04; the decision must pick one. |
| 5 | [PRO-Q02](07-profile-stats-goals.md#open-decisions) | Do backfills earn XP and quest credit? Covers manual "already finished" and "in progress at P" adds, imports, and imports later read in-app. | Treat them all as backfill: they count in "books finished" but earn no XP. In-app progress above a BC-04 baseline earns XP. The quest counts a backfill only when it carries a real completion date in that year (import "Date Read"); manual adds stamped at add time do not count. | [LIB-Q01](01-library.md#open-decisions) (no passport and no journey button for "already finished" adds), [LIB-Q16](01-library.md#open-decisions), [LIB-Q08](01-library.md#open-decisions), [SES-Q06](02-reading-sessions.md#open-decisions) (a passport for any completion with ≥ 1 history row, including offline; the button shows whenever a passport row exists), [SES-Q17](02-reading-sessions.md#open-decisions) (baseline = a marked row, excluded from XP, streaks, charts, Last Session and velocity) |
| 6 | [LIB-Q04](01-library.md#open-decisions) | Editing `total_pages` to ≤ `current_page`, or above it on a finished book: complete with full effects, clamp, or block? | Allow it with a confirm. Lowering is a real completion through the BC-05 server path. Raising it on a finished book keeps `completed_at` and asks whether to resume. | [SES-Q05](02-reading-sessions.md#open-decisions) (a book with `completed_at` stays complete by setting `current_page = total_pages`) |
| 7 | [CAP-Q03](04-capture-resume-quiz.md#open-decisions) | Should captures and the quiz be purged at the completion write (today) or as the last step of the server-owned completion job? | Purge as the last step of the BC-05 job, so the D-12 / BC-08 capture fallback and backfill can still read them. DNF never purges. | [CAP-Q02](04-capture-resume-quiz.md#open-decisions) / [PRO-Q17](07-profile-stats-goals.md#open-decisions) (hide the capture prompt for complete books; no +5 XP for a capture purged at once) |
| 8 | [INS-Q01](06-insights.md#open-decisions) | Backfill policy under D-12: generation order, a per-save cap, the context window of backfilled cards, which milestones are eligible. | Generate the newest due milestone first, then missing lower ones oldest-first. One job in flight per book, and at most 3 AI calls per book per save. Context runs up to the milestone's page when available. `unlocked_at_page` keeps meaning the page saved. Only milestones above the BC-04 baseline page are eligible. | [INS-Q02](06-insights.md#open-decisions) (fallback context: up to 5 newest captures at or below the window page, about 8,000 characters, snapshotted before the purge; premise-only metadata prompt; nullable source column), [INS-Q03](06-insights.md#open-decisions) (job ledger, 3 transient retries), [INS-Q13](06-insights.md#open-decisions) (`save_progress` returns pending milestones) |
| 9 | [REC-Q02](03-recaps.md#open-decisions) | Corpus vs inferred: decided on the current delta `(fromPage, currentPage]` or two recaps back? Should the warning and the mode use one rule? | Decide on the delta window, optionally passing earlier captures as labelled context. One server decision under BC-07 drives both the warning and `mode`. | [REC-Q12](03-recaps.md#open-decisions) (`get_recap_eligibility(p_book_id)` on the server clock, returning locked, reason, pages to unlock, `unlock_at` and the would-be mode), [REC-Q11](03-recaps.md#open-decisions) (return the persisted row as JSON; keep the legacy stream until the PWA migrates), [REC-Q03](03-recaps.md#open-decisions) |
| 10 | [LEX-Q27](05-codex-lexicon.md#open-decisions) | Adopt BC-10 (only *Recommended*) before iOS v1? | Yes. The app, widgets and notification actions all write reviews, and only a server function keeps their semantics, time zone and tally identical (D-06, D-07). The PWA migrates afterwards (D-05). | [LEX-Q17](05-codex-lexicon.md#open-decisions) (notification: show the word only when previews are allowed; "I know this" = advance, "Still learning" = reset, both through BC-10), [LEX-Q05](05-codex-lexicon.md#open-decisions) |
| 11 | [BE-Q02](09-database-invariants.md#open-decisions) | Once the BC-04/BC-05 RPCs exist and the PWA has migrated, should direct client writes to server-owned tables (`reading_progress`, `progress_history`, `recaps`, `lore_cards`, `book_passports`, `achievements`) be locked down? | Yes, in stages: ship the RPCs, migrate the PWA, then make those policies SELECT-only, with writes through SECURITY DEFINER RPCs. Books, lexicon and Up Next stay client-writable. | Plan principle P2 (contract only after legacy-write counters read zero for 14 days) |
| 12 | [PLT-Q02](08-platform-auth-account.md#open-decisions) | Turn on "Confirm email" in Supabase Auth? | Yes, before Sign in with Apple ships. Automatic identity linking is only safe for verified emails; otherwise someone could pre-register a victim's email and later be linked to the victim's Apple sign-in. Add a "Check your inbox" screen with resend. Needs custom SMTP (BC-11). | BC-11 email-confirmation item |
| 13 | [PLT-Q03](08-platform-auth-account.md#open-decisions) | Where is third-party AI consent (App Store Guideline 5.1.2(i)) shown and stored? | A one-time consent sheet on each client before the first AI feature. Store it server-side (for example `user_settings.ai_consent_at` plus a version), and enforce it in the shared BC-12 edge check. Non-AI features stay usable without consent. | [PLT-Q04](08-platform-auth-account.md#open-decisions) (privacy policy and ToS on the canonical domain, a 16+ self-declaration, the Wiktionary attribution line) |
| 14 | [COM-Q01](10-community-circles.md#open-decisions) | Default discoverability of new profiles, including those created from iOS (no public toggle, D-13). | Private by default: a profile created without `isPublic` (as iOS sends it) gets `is_public = false`, and the PWA first-run toggle defaults OFF to match its "private until you say otherwise" copy. Backward compatible. | [PRO-Q08](07-profile-stats-goals.md#open-decisions), [BE-Q09](09-database-invariants.md#open-decisions) (RPC default `false`), [PRO-Q20](07-profile-stats-goals.md#open-decisions) (partial-update RPC), [COM-Q20](10-community-circles.md#open-decisions) (revoke EXECUTE on the 21 unconsumed social and circle RPCs until the Community phase; this conflicts with the BC-01 allowlist) |
| 15 | [CL-Q01](12-client-logic-register.md#cl-q01) | Is the BC-15 book-search proxy a prerequisite for the first iOS TestFlight, or does iOS re-implement [LIB-27](01-library.md#lib-27--search-endpoint)…[LIB-43](01-library.md#lib-43--rate-limiting-and-key-exposure) with a bundle-restricted key? | Make the proxy a prerequisite, so the merge rules are never ported twice and the Google key never ships in a binary. This makes that part of the *Recommended* BC-15 effectively required before TestFlight. | [LIB-Q02](01-library.md#open-decisions) (duplicate checks via the same server path) |

**Next in line** (high impact, outside the top 15):
- [LIB-Q12](01-library.md#open-decisions): delete safeguards and Storage purge.
- [PLT-Q01](08-platform-auth-account.md#open-decisions): sign-out scope and unsynced saves.
- [CAP-Q16](04-capture-resume-quiz.md#open-decisions): server-side resume, quiz and `get_session_warmup`. No BC package covers it.
- [CAP-Q07](04-capture-resume-quiz.md#open-decisions): Apple Vision calibration (D-15).
- [CL-Q02](12-client-logic-register.md#cl-q02): RPC responses carry derived state and invalidation hints.
- [BE-Q05](09-database-invariants.md#open-decisions): where Storage clean-up runs.
- [XD-Q02](11-cross-domain.md#open-decisions): Realtime vs refresh-on-foreground.
- [PRO-Q19](07-profile-stats-goals.md#open-decisions): which timed sessions are "real" under D-08.
