# Legal & Compliance Review

Last updated: 2026-07-16
Scope: full app + docs review (client, edge functions, data model, third-party services).
Status: engineering-level review, **not legal advice** — consult a lawyer before commercial launch.

This document ranks where BookHero could be infringing (or drifting toward infringing) and records the invariants that keep it safe. Re-read this before shipping any feature that makes user content **public, shareable, or cross-user aggregated** — that boundary is where most of the risk lives.

---

## 1. Page captures — verbatim copyrighted text (highest stakes, currently well-contained)

`ocr-page` extracts up to 10,000 chars of a copyrighted book page per capture into `page_captures`. Accumulated over a book this is a partial verbatim copy of a protected work stored on our servers.

**What protects us today (preserve deliberately):**

- Images are never persisted (in-memory only during the edge-function request).
- Captures are private per-user under RLS; never aggregated across users.
- Deleted on book completion (completion cleanup); used only to ground that reader's own recaps, resume, quiz, and vocabulary extraction.
- Functionally equivalent to personal note-taking, which is broadly tolerated (EU private-copy exceptions point the same way).

**The line that must never be crossed:** captures (or verbatim content derived from them) becoming shareable, public, or aggregated into any cross-user corpus. That is the Books3 failure mode. The Community feature's per-surface privacy currently defaults to "nobody" — keep it that way for anything capture-derived.

**Future actions:**

- [ ] Add a ToS clause: users may only capture pages from books they lawfully own.
- [ ] If community sharing ever surfaces user text: DMCA-style notice-and-takedown + repeat-infringer policy first.
- [ ] Consider a retention cap for captures on abandoned books (today they live forever if the book is never completed).
- [ ] Never use captures as AI training data; state this in the privacy policy.

## 2. Codex quotes + community privacy surfaces

`lexicon_entries` with `entry_type = 'quote'` stores multiline verbatim passages. Private keepsakes are fine; a **public** lexicon full of long passages is *published excerpts*. Short attributed quotes are protected quotation in most jurisdictions; page-length ones are not.

**Future actions:**

- [ ] If/when the lexicon becomes publicly visible (community per-surface privacy), exclude quotes or cap their public length.
- [ ] Keep the privacy default at "nobody".

## 3. Privacy / GDPR — the most *certain* gap today

No privacy policy, no terms of service, no account-deletion flow exist. GDPR applies (EU users). Data processed: email, reading behavior (what/when/how long — can *infer* sensitive traits from book choices), transient page photos, avatar photos, follower/block graph.

**Actions (before any public launch):**

- [ ] Privacy policy page: what's collected, processors (Supabase, Google/Gemini, OpenAI, dictionaryapi.dev, Google Books, Open Library), retention, user rights. State explicitly that capture images are never stored.
- [ ] Terms of service: AI-content disclaimer (hallucination), capture-your-own-books clause, minimum age (16+ or parental consent).
- [ ] Account deletion path cascading through all tables **and Storage** (community-avatars, recap-images).
- [ ] Data Processing Agreements with processors (all offer standard DPAs; SCCs cover transfers).
- [ ] If analytics are ever added: consent banner (none needed today — localStorage auth is strictly necessary).

## 4. Gemini API tier — verify immediately

All sensitive material flows through Gemini: captured page text, reading behavior, capture images (transient). On the **free tier, Google may use prompts/outputs for training and human review** — a copyright *and* privacy problem. On the **paid tier data is not used for training**.

**Actions:**

- [ ] Confirm the `GEMINI_API_KEY` used by the edge functions belongs to a paid/billing-enabled project; switch if not.
- [x] OpenAI image API (`gpt-image-2` in `generate-recap/openaiClient.ts`): does not train on API data by default — no action.

## 5. dictionaryapi.dev — unattributed CC BY-SA content

`src/composables/useLexicon.ts` fetches definitions from dictionaryapi.dev, an unofficial wrapper around **Wiktionary (CC BY-SA)**. Definitions are stored permanently in `lexicon_entries` with no attribution — technically a license violation (attribution + share-alike). Also a reliability risk (hobby project, no SLA).

**Actions:**

- [ ] Add "Definitions from Wiktionary (CC BY-SA)" attribution in the Codex UI (one line).
- [ ] Longer term: consider a licensed dictionary API.

## 6. AI-generated recap images of book characters

The image prompt refiner (`generate-recap/prompts/imagePromptRefiner.ts`) deliberately keeps character names and canonical descriptions — the output is a derivative depiction of protected literary characters (and franchise trademarks for well-known series).

**Invariant:** these images stay private (per-user, signed URLs, 1 h TTL). Public galleries of AI-generated franchise-character art are the escalation to avoid.

## 7. Reviewed and fine (no action)

- **Book metadata storage** (title/author/ISBN/pages/genre): facts, not copyrightable.
- **Google Books usage**: user-initiated, per-user library persistence; covers are hotlinked (URL stored, image served by Google); descriptions stored per-user at small scale. The CSV bulk import deliberately writes `cover_url: null` and never harvests Google. Stay on this side of the line: no bulk pre-fetching, no public redistribution of their data, no competing catalog.
- **Open Library**: gap-fill lookups + hotlinked covers; open data. Attribution appreciated, not required.
- **AI text recaps/blurbs**: plot summaries are established non-infringing territory; prompts should continue to avoid verbatim reproduction.
- **Goodreads/StoryGraph CSV import**: user's own exported data; naming them for compatibility is nominative fair use.
- **Dependencies**: standard permissive licenses (MIT etc.).
- **Trademark note**: run an EUIPO/USPTO search for the app name before commercial launch.

## Security item with legal teeth

`manualJwtDecode` in every edge function decodes the JWT **without signature verification**. Safe only if Supabase's "Enforce JWT verification" gateway setting is ON for each function; if any function has it disabled, user IDs can be forged (quota burn + potential cross-user data access = GDPR Art. 32 security-obligation issue).

**Actions:**

- [ ] Verify "Enforce JWT verification" is enabled on all seven edge functions (`generate-recap`, `generate-lore`, `ocr-page`, `extract-vocabulary`, `generate-reading-dna`, `generate-page-resume`, `generate-book-quiz`).
- [ ] Optionally tighten CORS from `*` to the app origin.

---

## Priority order

1. **Gemini tier check** (§4) — 5 minutes, real consequences.
2. **Privacy policy + ToS + account deletion** (§3) — required before any public launch.
3. **Wiktionary attribution** (§5) — one line of UI.
4. **Write the "private forever" invariants into feature-planning practice** (§1, §2, §6) — so a future community feature doesn't cross them accidentally.
