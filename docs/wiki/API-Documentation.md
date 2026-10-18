# API Documentation

Last updated: 2026-10-18 · Verified against the live Supabase project `zlndhygpqacygceivuvk` and web `master` @ `8d8701c`.

> **Scope.** How clients talk to the one shared Supabase backend behind **The Chronicler**: the web PWA (live), the iOS app (next) and Android (later). "BookHero" is the internal code name (repo, Supabase project, identifiers). This page is the developer summary: what each endpoint takes and returns, how auth really works today, and which failures are soft.
>
> **Authoritative detail** lives in the [backend contract](../backend-contract.md). If this page and the contract disagree, the contract wins. Rules with stable IDs (REC-21, BE-75, …) are in the [business-rules catalog](../business-rules/README.md). Planned backend work is BC-01 … BC-15 in the [backend consolidation plan](../backend-consolidation-plan.md).
>
> **Related pages:** [API Quick Reference](API-Quick-Reference.md) (one-table lookup) · [Database Data Model](Database-Data-Model.md) (tables, relationships, RLS, drift) · [Authentication & Authorization](Authentication-Authorization.md).

## Contents

1. [Surfaces](#1-surfaces)
2. [Authentication and calling conventions](#2-authentication-and-calling-conventions)
3. [Edge functions](#3-edge-functions)
4. [RPC overview](#4-rpc-overview)
5. [Direct table writes](#5-direct-table-writes)
6. [Storage](#6-storage)
7. [External client-side APIs](#7-external-client-side-apis)
8. [Realtime, push and background work](#8-realtime-push-and-background-work)
9. [Planned API changes](#9-planned-api-changes)

---

## 1. Surfaces

There is no custom REST server. Every client uses the Supabase APIs directly.

| Surface | Endpoint | Used for | Contract section |
|---|---|---|---|
| Tables (PostgREST) | `GET/POST/PATCH/DELETE /rest/v1/<table>` | CRUD on the reader's own rows: books, progress, captures, lexicon, and the AI results the client persists | [3 Tables](../backend-contract.md#3-tables), [5 Row-level security](../backend-contract.md#5-row-level-security) |
| RPC | `POST /rest/v1/rpc/<function>` (JSON body of named arguments) | Aggregated reads (library, stats, quest, records) and profile-identity writes | [8 RPC catalogue](../backend-contract.md#8-rpc-catalogue) |
| Edge functions | `POST /functions/v1/<slug>` | AI (Google Gemini, OpenAI images) and OCR | [10 Edge functions](../backend-contract.md#10-edge-functions) |
| Storage | `/storage/v1/*` | Recap images (private, signed URLs) and avatars (public) | [7 Storage](../backend-contract.md#7-storage) |
| Auth | `/auth/v1/*` | Email/password and magic link today | [1 Connection, auth & runtime limits](../backend-contract.md#1-connection-auth--runtime-limits) |
| External APIs | Google Books, Open Library, Free Dictionary API | Book metadata and definitions, called directly by the client | [11 External APIs (client-side)](../backend-contract.md#11-external-apis-client-side) |

**Inventory (live, 2026-10-18).**

- 7 edge functions.
- 69 functions in `public`:
  - 36 are client RPCs: 13 live (10 reading and stats, 3 profile identity), 2 dormant weekly-goal RPCs, and 21 dormant community and circle RPCs.
  - The other 33 are trigger and internal helpers. They are still reachable at `/rpc/<name>`, but they are **not** part of the contract.
- 26 tables.
- No Realtime tables, no `pg_cron` and no `pg_net` / database webhooks. Nothing runs on the server unless a request triggers it ([BE-85](../business-rules/09-database-invariants.md#be-85--nothing-happens-server-side-without-a-request)).

**Runtime limits that apply to every call** ([BE-08a](../business-rules/09-database-invariants.md#be-08a--per-request-runtime-limits-and-server-timezone)):

| Limit | Value | Client consequence |
|---|---|---|
| `statement_timeout` | 8 s for `authenticated`, 3 s for `anon` | SQLSTATE `57014`; retry with backoff |
| `safeupdate` | Preloaded by PostgREST | Every UPDATE or DELETE must carry a filter |
| DB `TimeZone` | `UTC` | Every RPC without a timezone argument uses UTC day, week, month and year boundaries |
| PostgREST `max_rows` | [UNVERIFIED: not readable; Supabase default 1000] | Paginate large table `select`s with `Range` |
| Edge wall-clock limit | [UNVERIFIED: plan-dependent] | A slow inferred recap or a long image job can be cut off |

---

## 2. Authentication and calling conventions

### 2.1 What to send

```http
Authorization: Bearer <user access token>
apikey: <publishable (anon) key>
Content-Type: application/json
```

- `supabase-js` and `functions.invoke` add `apikey` automatically. The PWA calls `generate-recap`, `generate-lore` and `ocr-page` with a raw `fetch` that sends only `Authorization` and `Content-Type`.
- Every edge function requires a `sub` claim, so the anon key sent as a Bearer token gets 401.
- AI provider keys exist only in the function environment and never reach a client.
- On any 401, refresh the session and retry once. Never auto-retry `generate-recap` or `generate-lore`: both are costly and not idempotent.

### 2.2 How each edge function really checks auth

| Function | `verify_jwt` | What the function checks itself | Consequence |
|---|---|---|---|
| `generate-recap` | **false** | `atob` decode of the JWT payload, requires `sub`. No signature, `exp` or `aud` check, and no base64url normalisation. | Forged tokens are accepted (S-06). Some valid tokens get a spurious 401 (S-07). |
| `generate-lore` | **false** | Base64url-normalised decode, requires `sub`. No signature or `exp` check. | Forged tokens are accepted (S-06). |
| `ocr-page` | **false** | `atob` decode, requires `sub`. No signature or `exp` check, and no base64url normalisation. | Forged and expired tokens are accepted. Some valid tokens get a spurious 401. |
| `extract-vocabulary`, `generate-page-resume`, `generate-book-quiz`, `generate-reading-dna` | true | The gateway verifies the token before the function runs. The function then decodes `sub` and returns 401 `unauthorized` when it is missing. | Sound. The gateway's 401 body is the platform's own [UNVERIFIED: shape]. |

**The three `verify_jwt = false` functions do not validate tokens. They only decode them.** Anyone on the internet can spend Gemini and OpenAI credit with a forged token.

The `recap_image` mode is worse. A forged `sub` plus a known `recapId` lets the **service role** rewrite another user's image status and path, and write objects into the victim's folder.

The base64url defect matters for Sign in with Apple. An Apple-provided name with non-ASCII characters in `user_metadata` makes `-` or `_` likely in the encoded payload, which triggers the spurious 401.

Rules: [PLT-78](../business-rules/08-platform-auth-account.md#plt-78--three-ai-edge-functions-accept-forged-tokens), [REC-21](../business-rules/03-recaps.md#rec-21--authentication), [INS-23](../business-rules/06-insights.md#ins-23--auth-is-decode-only), [CAP-81](../business-rules/04-capture-resume-quiz.md#cap-81--ocr-page-authentication-only-decodes-the-token), BE-D08 … BE-D11 in [09 · Known defects](../business-rules/09-database-invariants.md#known-defects).

**Fix (BC-02, Required)** — must ship before BC-11 enables Sign in with Apple:

- `verify_jwt = true`, or real `supabase.auth.getUser` verification.
- Drop the hand-rolled base64 decoding.
- No internal error text in 500 responses.
- Commit `supabase/config.toml` with per-function settings. No such file exists today, so `verify_jwt` lives only in deployed metadata.

### 2.3 RPC identity

RPCs are `SECURITY DEFINER`, so table RLS does not protect them. Most of them take a `p_user_id` argument, and identity is enforced per RPC:

| Status | RPCs | Behaviour for a foreign or anonymous caller |
|---|---|---|
| ✅ guarded | `get_reading_stats`, `get_book_passport_stats`, `get_reading_calendar`, `get_monthly_reading`, `get_reading_records`, the three identity RPCs, `upsert_weekly_goal`, `get_retention_summary`, every community and circle RPC | The `p_user_id` RPCs return empty or zero data silently. The identity, weekly-goal, community and circle RPCs take no user id: they derive the viewer from `auth.uid()` and touch only the caller's data; a signed-out call gets `42501`, a `not_authenticated` / `Not authenticated` error, or (`get_retention_summary`) `nudgeCode: signed_out`. |
| ⚠ no check (S-01) | `get_library_with_progress`, `get_last_session`, `get_library_breakdown`, `get_reading_velocity` | Returns **any** user's data to any signed-in caller |
| ⚠ NULL-unsafe (S-02) | `get_reading_quest_summary` | Raises `Not allowed` for another signed-in user. Returns the target's data to `anon`. |

Always pass the signed-in user's own id.

**BC-01 (Required)** asserts `p_user_id = (select auth.uid())` and keeps the parameter for PWA compatibility (D-05). It also makes the quest guard NULL-safe and revokes `anon` / `PUBLIC` EXECUTE.

Details: [BE-07](../business-rules/09-database-invariants.md#be-07--identity-re-assertion-differs-per-rpc) and contract [12 Security status](../backend-contract.md#12-security-status).

### 2.4 Cross-cutting facts

- **CORS.** `Access-Control-Allow-Origin: *`. Allowed headers: `authorization, x-client-info, apikey, content-type`. Methods: `POST, OPTIONS`. There is no `Access-Control-Expose-Headers`.
- **No limits.** No rate limiting, quota or entitlement check exists in any AI function (S-09). **BC-12** adds:
  - an entitlements table, fed by App Store Server Notifications v2 or RevenueCat;
  - an `ai_usage` ledger;
  - one shared check in every AI function.

  The check allows everything until tiers are decided (D-14).
- **SDK pinning.** Gemini is called through `npm:@google/genai`, which is **unpinned** (resolved at deploy).
- **Environment variable names.**
  - Edge functions: `GEMINI_API_KEY` (all functions); `OPENAI_API_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the `generate-recap` image job only).
  - Web: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_GOOGLE_BOOKS_API_KEY` (optional).

### 2.5 Error transport

| Source | HTTP | Handling |
|---|---|---|
| Edge function | Per function (sections below) | JSON body `{error, …}`; extra fields vary per function |
| RPC `raise exception '<code>'` (SQLSTATE `P0001`) | 400 | Body `{"code":"P0001","message":"<code>",…}`. Switch on `message`; never retry. |
| FK `23503`, unique `23505` | 409 | `23505` on `lore_cards_unique_milestone` means "already unlocked". `23503` after a book delete means "book gone". |
| NOT NULL `23502`, CHECK `23514`, bad input `22P02` / `22007` / `22008`, unknown IANA zone `22023` | 400 | Validate before writing |
| Permission `42501` | 401 for `anon`, 403 for `authenticated` | — |
| Statement timeout `57014` | 500 | Retry with backoff (reads and idempotent writes only) |

The SQLSTATE-to-HTTP mapping follows PostgREST's documented table [UNVERIFIED: not exercised for every code]. See [BE-86](../business-rules/09-database-invariants.md#be-86--error-transport).

---

## 3. Edge functions

### 3.1 Overview

Models are the **deployed** configuration, which is canonical (D-09).

| Function | Deployed | `verify_jwt` | Purpose | Models | PWA caller (transport) |
|---|---|---|---|---|---|
| `generate-recap` | v84 | false | Pre-start blurb, mid-book recap (inferred or corpus), passport summary, recap-image job | `gemini-2.5-flash` (composer, blurb, passport, image-prompt refiner); `gemini-2.5-pro` + Google Search (inferred extraction); OpenAI `gpt-image-2` | `src/services/recapService.ts` `streamRecap` / `requestRecapImage` (raw `fetch`), called by `src/stores/recaps.ts`; `src/stores/bookPassport.ts` (raw `fetch`, passport) |
| `generate-lore` | v18 | false | One Insight card per reading milestone (10 … 90 %) | `gemini-2.5-flash`, temperature 0.35, accuracy-first prompt | `src/services/loreService.ts` (raw `fetch`), called by `src/stores/loreCards.ts` |
| `ocr-page` | v2 | false | Page photo → text + confidence | `gemini-2.5-flash` (multimodal) | `src/composables/useCapture.ts` (raw `fetch`) |
| `extract-vocabulary` | v2 | true | Up to 5 uncommon words from capture text | `gemini-2.5-flash` | `src/composables/useVocabularyExtraction.ts` (`functions.invoke`) |
| `generate-page-resume` | v3 | true | Pre-session "Previously" resume from one captured page | `gemini-2.5-flash` | `src/composables/usePageResume.ts` (`functions.invoke`) |
| `generate-book-quiz` | v1 | true | Memory Check quiz (1–3 questions) from captures | `gemini-2.5-flash` | `src/composables/useBookQuiz.ts` (`functions.invoke`) |
| `generate-reading-dna` | v8 | true | Reader identity profile from finished books | `gemini-2.5-flash` + Google Search grounding | `src/stores/readingDna.ts` (`functions.invoke`) |

**Common rules:**

- **Stateless, except the recap-image job.** The client persists every result:
  - `recaps` rows;
  - `lore_cards` rows;
  - `page_captures.resume`;
  - `book_quizzes` rows;
  - `reading_dna` rows;
  - `book_passports` rows;
  - lexicon rows.

  BC-05, BC-07 and BC-08 move persistence for recaps, Insights, passports and DNA server-side.
- **No dedupe, no idempotency.** No function dedupes against stored rows. None is idempotent, and none enforces per-user limits.
- **Images are not stored.** Images sent to `ocr-page` are never stored.
- **Deployed source is canonical (BC-03).**

  | Function | Drift from the repo source |
  |---|---|
  | `generate-lore`, `generate-reading-dna` | Differ materially |
  | `generate-recap`, `ocr-page` | Differ only cosmetically |
  | The other three | Identical |

  BC-03 syncs the repo to deployed. See contract [13 Drift: migrations & deployed sources](../backend-contract.md#13-drift-migrations--deployed-sources).

### 3.2 Soft and hard failures

| Function | On AI or configuration failure | Client handling |
|---|---|---|
| `extract-vocabulary` | **200** `{"words": []}` — indistinguishable from "no qualifying words" | Ledger ends `skipped` or `failed`; capture save is never blocked |
| `generate-page-resume` | **200** `{"resume": null}` | Session starts without the dialog. Retried at the next Start for that capture. |
| `generate-book-quiz` | **200** `{"quiz": null}` | No quiz is offered |
| `ocr-page` | Hard errors (502 / 503 / 504 / 500) | If the model JSON omits `text` or `confidence`, the response is still **200** with `text: ""` / `confidence: 0`. Route that to manual review: empty text cannot be saved. |
| `generate-recap`, `generate-lore`, `generate-reading-dna` | Hard errors (non-2xx JSON) | Recap: error copy. Lore: silent (logged only). DNA: keep the previous DNA. |

### 3.3 `generate-recap`

Rules: [03 · Recaps](../business-rules/03-recaps.md) REC-20 … REC-49; [BE-75](../business-rules/09-database-invariants.md#be-75--generate-recap-request-validation-and-routing) … [BE-78](../business-rules/09-database-invariants.md#be-78--recap-image-job). Contract: [10 Edge functions](../backend-contract.md#10-edge-functions) §10.2.

**Routing.** The first match wins ([REC-24](../business-rules/03-recaps.md#rec-24--mode-resolution-priority)):

| Request | Path |
|---|---|
| `mode: "recap_image"` | Image job |
| `mode: "passport_summary"` | Passport summary |
| `currentPage === 0` (strict) | Pre-start blurb |
| Anything else, including a body without `currentPage` | Mid-book recap |

**Check order:**

1. Authorization header (401).
2. Payload decode (401).
3. `req.json()` — a malformed body gives **500**, not 400.
4. Field validation (400).
5. `GEMINI_API_KEY` (503, all modes).
6. `OPENAI_API_KEY` (image mode).
7. Dispatch.

There is no HTTP-method check and no 405.

**Text-mode request**

```json
{
  "title": "Dune",
  "author": "Frank Herbert",
  "isbn": "9780441172719",
  "currentPage": 120,
  "totalPages": 688,
  "percentage": 17.44,
  "from_page": 80,
  "captures": [{ "page": 110, "text": "Reviewed OCR text..." }]
}
```

- **Required fields.** Truthy `title`, `author` and `totalPages`, and a defined `percentage` — also for `passport_summary`. Otherwise `400 {"error":"Missing required fields"}`.
- **`isbn`** may be `null`.
- **`from_page`** is the page of the previous recap. The PWA omits it when it is 0.
- **`captures`.** A non-empty array selects the **corpus** path. The PWA sends at most the 3 highest-page captures with `from_page < page ≤ currentPage`, in ascending order. The server neither filters nor caps them.
- **Passport request**: `{title, author, isbn|null, percentage: 100, currentPage: totalPages, totalPages, mode: "passport_summary"}`.
- **Eligibility is client-side only today.** The rules are a +5 % page threshold, a 6 h cooldown and a 72 h idle unlock ([03 · Recaps](../business-rules/03-recaps.md) REC-03 … REC-11). **BC-07** moves eligibility into the function, on the server clock. The function will also select the corpus window and persist and return the validated `recaps` row.

**Success — a raw text stream, not token-by-token rendering**

- **Response.** `200`, `Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-cache`, chunked raw model text. This is **not SSE**: there are no events and no framing.
- **Blurb and recap body.** The text of **one JSON object**, possibly wrapped in ``` fences:

  ```json
  { "memory_jogger": "2–4 plain sentences, ≤ 90 words (blurb ≤ 600 chars)",
    "concept_watchlist": "a, b, c (≤ 5 items; blurb ≤ 13 names)",
    "thematic_bridge": "1–2 sentences: the open thread" }
  ```

- **Chunks are not renderable.** They are fragments of JSON, so a client cannot show them as they arrive. The PWA shows a loading state and accumulates the whole body. It then strips the fences (or takes the first `{…}`), runs `JSON.parse` and requires all three keys to be non-empty. Only then does it insert the `recaps` row and render it ([REC-36](../business-rules/03-recaps.md#rec-36--parse--validate)).
- **Passport body.** One plain-prose paragraph of 90–100 words. It is the only stream the PWA renders progressively.
- **First byte.**
  - Inferred path: nothing is sent until extraction finishes, which takes up to 3 sequential Gemini 2.5 Pro calls with Google Search — tens of seconds.
  - Corpus path: about 0.4 s to the first byte (observed).
- **Corpus header.** The corpus path adds `X-Recap-Mode: corpus`. Native clients can read it; browsers cannot, because the header is not exposed.
- **No server-side validation.** The server does not validate the streamed JSON. A mid-stream failure arrives as a read error or a truncated body after a 200.
- **Client disconnects.** The server does not observe them, and upstream calls already issued are not cancelled.
- **Abort.** Until BC-07, aborting the stream persists nothing ([REC-38](../business-rules/03-recaps.md#rec-38--abort-semantics)). After BC-07, once the call is paid the server finishes and saves.

**Paths and models**

| Path | Behaviour |
|---|---|
| Inferred (no captures) | **Extraction:** `gemini-2.5-pro`, temperature 0.0, 8 192 tokens, `googleSearch` tool, non-streaming.<br>**Retries:** while the output is unparseable or `confidence_level = "low"`, up to 2 retries (3 calls in total). Each retry lowers the page by 5 × attempt, never below `from_page + 1`. The prompt stops 15–20 % before the reader's page.<br>**Composer:** `gemini-2.5-flash` streams the result, temperature 0.7, 4 096 tokens, `thinkingBudget 0`. |
| Corpus (captures) | Composer only (same parameters), framed as "what happened in this stretch" |
| Blurb (`currentPage === 0`) | `gemini-2.5-flash`, 0.7, 4 096 tokens, `thinkingBudget 0`; uses title, author and ISBN only |
| Passport | `gemini-2.5-flash`, 0.8, 4 096 tokens, `thinkingBudget 0`; plain-text stream |

**Errors** (JSON + CORS)

| Status | Body | When |
|---|---|---|
| 401 | `{"error":"No authorization header"}` / `{"error":"Unauthorized"}` | Header missing; payload undecodable or without `sub` (includes the spurious base64url case) |
| 400 | `{"error":"Missing required fields"}` / `{"error":"Missing required image fields"}` | Validation |
| 503 | `{"error":"AI service not configured"}` / `"OpenAI image service not configured"` / `"Supabase admin client not configured"` | Missing environment variable |
| 500 | `{"error":"AI output invalid","detail":"Provider safety block" \| "Low extraction confidence after retries" \| "No JSON block found in response" \| "Recap composition failed","finishReason"?,"blockReason"?}` | Inferred or corpus failure **before** streaming starts. A safety block is terminal (no retry). |
| 500 | `{"error":"Internal server error","detail":"<internal error text>"}` | Uncaught error, e.g. a malformed body. Leaks internal text (S-08, fixed by BC-02). |
| 5xx | Platform body | A slow inferred path exceeding platform limits before the first byte [UNVERIFIED] |

**Image mode (`recap_image`) — a 202 job**

*Request and response*

```json
{ "mode": "recap_image", "recapId": "uuid", "title": "Dune", "author": "Frank Herbert",
  "genre": "Science Fiction", "memoryJogger": "Short recap text", "fromPage": 80, "currentPage": 120 }
```

- **Required:** truthy `recapId`, `title` and `memoryJogger`. `fromPage`, `currentPage` and `textStageDurationMs` are optional.
- **Response:** **`202 {"status":"accepted"}`**, returned immediately. The work continues in `EdgeRuntime.waitUntil`.
- **Result delivery.** The result arrives **only** through the `recaps` row: `image_status`, `image_path`, `image_generated_at`.

*Job steps*

1. Set `image_status = 'pending'`.
2. Refine the prompt with `gemini-2.5-flash` (temperature 0.4). The input is title, author, genre and memory jogger only. A deterministic fallback prompt is used on error or empty output.
3. Call OpenAI `gpt-image-2` at `1024x1024`, `quality: "low"`.
4. Upload `recap-images/{sub}/{recapId}.png` (upsert).
5. Set `succeeded`.

*Retries and terminal states*

- **Retries.** One retry each way: a safety error retries with a softer prompt; a transient error retries after 2 000 ms. A final failure sets `failed_safety` or `failed_transient`. `skipped` is never written. NULL means a legacy row.
- **Updates.** All updates use the **service role**, scoped `id = recapId AND user_id = <decoded sub>`.
- **Silent no-ops.** A `recapId` the caller does not own matches 0 rows silently, yet Gemini and OpenAI are still billed.
- **Rows stuck in `pending`.** The job has no `catch`. An upload or DB exception, a runtime kill, or a 503 before the job starts leaves the row `pending` forever (BC-13 adds a timeout sweep).

*Observing the result*

- **How the PWA learns the status.** Its Realtime subscription on `recaps` **never fires**, because the `supabase_realtime` publication is empty. The status actually arrives through 2-second polling of `recaps.image_status, image_path`, with no attempt cap.
- **Native clients.** Poll with backoff (2 s → 30 s) and stop after about 3 min. Observed p90 from insert to image is about 57 s.
- **Signed URLs.** 60 s for a single panel and 3 600 s for the carousel and gallery. Re-mint them on demand and cache image bytes, not URLs ([REC-42](../business-rules/03-recaps.md#rec-42--image-status-transitions), [REC-48](../business-rules/03-recaps.md#rec-48--live-status-updates)).

**Planned:** BC-02 (auth), BC-07 (server-side eligibility and persistence), BC-12 (entitlement check), BC-13 (job robustness, stale `pending`, Storage cleanup), BC-14 (Realtime on `recaps.image_status`).

### 3.4 `generate-lore`

Rules: [06 · Insights](../business-rules/06-insights.md) INS-22 … INS-30 and INS-61; [BE-79](../business-rules/09-database-invariants.md#be-79--generate-lore-validation). Contract §10.3.

**Request**

```json
{
  "title": "Dune",
  "author": "Frank Herbert",
  "isbn": "9780441172719",
  "currentPage": 344,
  "totalPages": 688,
  "percentage": 50,
  "milestone": 50,
  "masterRecap": "Known-safe recap text (non-blank)",
  "existingTopics": ["Titles of this book's existing cards"]
}
```

- **Required, non-null:** `title`, `author`, `currentPage`, `totalPages`, `percentage`, `milestone` and `masterRecap`.
- **`masterRecap`** must be non-blank.
- **`milestone`** must be one of `10, 20, …, 90`. It is coerced with `Number()`, so `"50"` passes.
- **No type or length checks.** Numeric types and string lengths are not validated.
- **`existingTopics`** holds the **titles** of the book's existing cards, not entity names.
- **`percentage`** is an integer: the PWA sends `Math.round(currentPage / totalPages × 100)`.

**Response `200`** — exactly these four fields, trimmed:

```json
{
  "title": "3–8 words",
  "content": "90–160 words of canonical context",
  "type": "History | Culture | Geography | Technology | Lore",
  "linked_entities": ["up to 5 names taken from the recap"]
}
```

**The function never writes `lore_cards`. It returns no page and no milestone.**

The client inserts the row and adds `user_id`, `book_id`, `unlocked_at_page`, `unlocked_at_milestone` and `seen: false`. A `23505` on `lore_cards_unique_milestone` means "already unlocked".

The call is not idempotent and has no server dedupe ([INS-30](../business-rules/06-insights.md#ins-30--success-response-and-generic-errors)).

**Errors.** There is no soft-failure 200.

| Status | Body | When |
|---|---|---|
| 400 | `{"error":"Missing required fields"}` | Validation failure; also invalid JSON |
| 401 | `{"error":"Unauthorized"}` | Token missing or undecodable, or no `sub` |
| 405 | `{"error":"Method not allowed"}` | Any method other than `POST` / `OPTIONS` |
| 503 | `{"error":"AI service not configured"}` | `GEMINI_API_KEY` missing |
| 500 | `{"error":"AI output invalid","detail":"No JSON block found in response" \| "Response was not valid JSON" \| "Response failed shape validation","finishReason"?,"blockReason"?}` | Model output unusable |
| 500 | `{"error":"Internal server error","detail"}` | Any other exception |

The PWA reads only `error` and logs it; the failure is never shown.

**Model (deployed v18, canonical)** ([INS-26](../business-rules/06-insights.md#ins-26--model-call-deployed-v18)):

- `gemini-2.5-flash`, non-streaming, temperature **0.35**, 4 096 tokens.
- **Accuracy-first** prompt: canonical context from the author's published works and companion materials, with no invented details.
- **Thinking config.** `thinkingBudget: 1000` and `includeThoughts: true` sit at the root of `config` instead of inside `thinkingConfig`, so thinking runs at the model default. **BC-03** syncs the repo source to deployed and fixes this placement. The repo copy still has temperature 0.85 and the "may introduce new details" prompt.

**Data sent to Google.** Title, author, ISBN, page numbers, the reader's recap text and prior card titles.

**Planned BC-08.** Server-side orchestration with a fallback chain: recap → captures → spoiler-guarded metadata (D-12). It also covers:

- backfill of skipped or failed milestones;
- insert `ON CONFLICT DO NOTHING`.

Clients will only list cards and mark them seen.

### 3.5 `ocr-page`

Rules: [04 · Capture, resume & quiz](../business-rules/04-capture-resume-quiz.md) CAP-17 … CAP-25 and CAP-81 … CAP-85; [BE-80](../business-rules/09-database-invariants.md#be-80--ocr-page-validation). Contract §10.4.

**Request:** `{ "imageBase64": "<raw base64, no data: prefix>", "mimeType": "image/jpeg" | "image/png" }`.

The PWA always sends JPEG:

- camera frames: canvas JPEG at quality 0.92;
- uploaded images: downscaled to a 2 000 px long edge and re-encoded as JPEG 0.85 (`src/utils/imageNormalize.ts`).

**Validation order** (each failure is a 400 `InvalidRequest` unless noted):

1. Auth (401).
2. JSON body: `"Body must be JSON"`.
3. `imageBase64` is non-empty: `"imageBase64 missing or invalid"`.
4. MIME type: `"mimeType must be image/jpeg or image/png"`.
5. Decoded size ≤ 5 MiB, computed from the base64 length: `"Image exceeds 5 MB limit"`.
6. `GEMINI_API_KEY` (503).

There is no HTTP-method check: a GET returns 400.

**Response `200`:** `{ "text": "string", "confidence": 0.0–1.0, "wordCount": 142 }`.

- `confidence` is clamped and defaults to 0 when missing. It is the model's **self-assessed** rating.
- `wordCount` is a whitespace split.
- The model's `notes` field is discarded.

**Errors** — all bodies are `{error, message}`:

| Status | `error` | Meaning |
|---|---|---|
| 401 | `Unauthorized` | Missing or invalid JWT |
| 400 | `InvalidRequest` | Validation (see the order above) |
| 503 | `AiUnavailable` | `GEMINI_API_KEY` missing |
| 504 | `OcrTimeout` | One 10 s budget covers both attempts. The timed-out call is not aborted. |
| 502 | `OcrUpstream` | Failed after one retry |
| 500 | `InternalError` | Unhandled error |

**Model:** `gemini-2.5-flash`, temperature 0.1, 8 192 tokens, `thinkingBudget 0`. The prompt excludes printed page numbers, running headers and footers, footnote markers and ornaments.

**Client thresholds (PWA)** ([CAP-20](../business-rules/04-capture-resume-quiz.md#cap-20--auto-save-for-high-confidence)):

- Auto-save at `confidence ≥ 0.90` with non-empty text.
- Review below that.
- Warning banner below 0.70.

These thresholds are calibrated for Gemini. **iOS (D-15)** uses on-device Apple Vision first and falls back to `ocr-page` on low confidence; the thresholds must be recalibrated for Vision.

### 3.6 `extract-vocabulary`

Rules: [05 · Codex & lexicon](../business-rules/05-codex-lexicon.md) LEX-84 … LEX-92 ([LEX-86](../business-rules/05-codex-lexicon.md#lex-86--extract-vocabulary-contract)); [BE-81](../business-rules/09-database-invariants.md#be-81--extract-vocabulary-validation). Contract §10.5.

**Request:** `{ "ocrText": "non-blank string" }`. The function sets no length cap; captures are at most 10 000 characters.

**Response `200`:** `{ "words": [{ "word": "calumny", "definition": "A false and defamatory statement." }] }`, with 0–5 items:

- each `word` is trimmed and longer than 1 character;
- each `definition` is non-empty.

The function also returns `200 {"words": []}` when:

- the key is missing;
- the output has no valid JSON;
- anything throws.

**Errors:** `400 {"error":"invalid_input"}`, `401 {"error":"unauthorized"}` (valid JWT without `sub`), `405 {"error":"Method not allowed"}`.

**Model:** `gemini-2.5-flash`, temperature 0.4, 1 024 tokens, `thinkingBudget 0`. It picks uncommon or literary words, excludes proper nouns, and writes one-sentence definitions in the passage's context.

**Client pipeline.** The function never writes the database and never dedupes against the lexicon. The client:

1. inserts the `vocabulary_extractions` ledger row (`pending`; unique `capture_id`, so a retry is a no-op);
2. calls the function;
3. filters proper nouns and dedupes case-insensitively against all of the reader's terms;
4. bulk-inserts the `lexicon_entries` rows (`source = 'auto'`, `leitner_box` 1, `next_review_at` = UTC date of now + 24 h);
5. closes the ledger as `succeeded`, `skipped` or `failed`.

Edge cases:

- A returned word longer than 200 characters would fail the `term` CHECK and with it the whole batch.
- A capture at page 0 always fails, because `page_found ≥ 1`.
- A capture on a finished book is purged before the ledger insert, which then fails with `23503` (LEX-94).

### 3.7 `generate-page-resume`

Rules: CAP-48 … CAP-57 ([CAP-86](../business-rules/04-capture-resume-quiz.md#cap-86--generate-page-resume-contract)); [BE-82](../business-rules/09-database-invariants.md#be-82--generate-page-resume-validation). Contract §10.6.

**Request:** `{ "pageText": "non-blank string", "recapContext"?: "string" }`.

- If present, `recapContext` must be a string: JSON `null` gives 400.
- The server truncates `pageText` to 12 000 characters and `recapContext` to 800.

**Response `200`:** `{ "resume": { "bullets": ["1–3 one-sentence strings, ≤ 240 chars"], "tension": "≤ 240 chars, may be \"\"" } | null }`.

`null` is returned when:

- the page is insufficient;
- the key is missing;
- the model fails or its output is unparseable.

At least one non-empty bullet is required.

**Errors:** `400 {"error":"invalid_input"}`, `401 {"error":"unauthorized"}`, `405`.

**Model:** `gemini-2.5-flash`, temperature 0.3, 512 tokens, `thinkingBudget 0`.

- Only the page text is summarised. The prior recap is used for names only, and there are no predictions.
- No retry and no server timeout.

**Client.** The PWA calls the function once after each capture save. At Start Session it backfills the highest-page capture of the book when that capture has no resume. It persists `page_captures.resume` + `resume_generated_at` only when bullets are non-empty.

"Generated once per capture" holds only for successful generations: a `null` result is retried at every Start. Writing the resume re-fires the capture trigger, so on a finished book the capture is purged.

### 3.8 `generate-book-quiz`

Rules: CAP-61 … CAP-78 ([CAP-87](../business-rules/04-capture-resume-quiz.md#cap-87--generate-book-quiz-contract)); [BE-83](../business-rules/09-database-invariants.md#be-83--generate-book-quiz-validation). Contract §10.7.

**Request:** `{ "captures": [{ "page": 104, "text": "non-blank" }], "recapContext"?: "string" }`.

- At least 1 capture is required.
- One invalid capture rejects the whole request with `400 invalid_input`.
- The server uses only the **last 6 array elements as sent**, so send them in reading order. Each capture is truncated to 6 000 characters, and the recap to 800.

**Response `200`:** `{ "quiz": { "questions": [{ "question": "≤ 240 chars", "options": ["3 strings ≤ 120 chars"], "correctIndex": 0, "sourcePage": 104 }] } | null }`.

- 1–3 questions. Invalid questions are filtered out, not repaired, so the maximum score equals the question count.
- Options are shuffled server-side (Fisher–Yates) and `correctIndex` is remapped.
- `null` is returned when the key is missing, the output cannot be parsed, or the material is insufficient.

**Errors:** `400 {"error":"invalid_input"}`, `401 {"error":"unauthorized"}`, `405`.

**Model:** `gemini-2.5-flash`, temperature 0.4, 1 024 tokens, `thinkingBudget 0`. Questions come only from the provided text. No retry and no server timeout.

**Client.** It upserts `book_quizzes` (`onConflict user_id,book_id`) and reuses the quiz while `page_snapshot ≥ current_page`. The completion trigger deletes the quiz when the book is finished.

### 3.9 `generate-reading-dna`

Rules: [07 · Profile, stats & goals](../business-rules/07-profile-stats-goals.md) PRO-52 … PRO-63 ([PRO-61](../business-rules/07-profile-stats-goals.md#pro-61--generate-reading-dna-request-and-response-validation), [PRO-62](../business-rules/07-profile-stats-goals.md#pro-62--dna-prompt-and-model-contract-deployed-v8-is-canonical)); [BE-84](../business-rules/09-database-invariants.md#be-84--generate-reading-dna-validation). Contract §10.8.

**Request:** `{ "books": [{ "title": "Dune", "author": "Frank Herbert" }] }`. At least 1 book; no upper bound and no per-entry validation.

**Response `200`:**

```json
{
  "personality": "50–800 characters of prose",
  "moodSignature": { "tone": "1–40 characters", "emojis": ["1–5 strings; the prompt asks for 3"] },
  "suggestions": [{ "title": "…", "author": "…", "reason": "…" }],
  "booksFinishedAtGeneration": 3,
  "generatedAt": "2026-10-18T12:00:00.000Z"
}
```

- `suggestions` has 3–5 items.
- `booksFinishedAtGeneration` is `books.length` (the number of books posted).
- `generatedAt` is the server timestamp.
- The function checks lengths in JavaScript UTF-16 units, while the DB CHECKs count code points.

**Errors:**

| Status | Body | When |
|---|---|---|
| 400 | `{"error":"invalid_input"}` | Validation |
| 401 | `{"error":"unauthorized"}` | No `sub` |
| 405 | `{"error":"Method not allowed"}` | Wrong method |
| 502 | `{"error":"ai_unavailable"}` | Missing key, no JSON, parse error or invalid shape |
| 500 | `{"error":"internal"}` | Any other error |

**Model (deployed v8, canonical):** `gemini-2.5-flash`, temperature 0.85, 2 048 tokens, `thinkingBudget 1`, with **`tools: [{googleSearch: {}}]`** (Google Search grounding). A misplaced top-level `dynamicRetrievalConfig` is probably ignored by 2.5 models [UNVERIFIED]. The repo copy has no tools and `thinkingBudget 0`, and BC-03 syncs it.

**Client.** It upserts `reading_dna` (`onConflict user_id`). Eligibility is client-side today and moves server-side with BC-05:

- at least 2 finished books;
- regenerate after +2 books or 90 days.

### 3.10 Planned edge functions

| Function | Purpose | Work package |
|---|---|---|
| `delete-account` | Immediate hard delete (D-10), with confirm + re-auth on web **and** iOS:<br>1. Purge `recap-images/{uid}/` and `community-avatars/{uid}/`.<br>2. Revoke the Sign in with Apple token.<br>3. Call `auth.admin.deleteUser`. FK cascades then remove the rows. | BC-11 |
| Book-search proxy | Hide the Google key, cache and rate-limit for multi-client traffic | BC-15 |
| Storage cleanup / orphan sweep | Delete recap images when a recap or book is deleted | BC-13 |
| Shared entitlement + AI-usage check | One check inside every AI function. It allows everything until tiers are decided (D-14). | BC-12 |

---

## 4. RPC overview

**Conventions:**

- **Call shape.** `POST /rest/v1/rpc/<name>` with the user's JWT and a JSON body of named arguments.
- **Execution.** Every RPC is `SECURITY DEFINER` with `search_path = public`.
- **JSON keys** are camelCase. The exception is `get_reading_velocity`, whose rows use `book_id` and `days_left`.
- **Timestamps** are ISO-8601 with an offset and 0–6 fractional digits.
- **`YYYY-MM-DD` fields** are calendar dates in the reader's zone. Never parse them as UTC midnight.
- **Timezone arguments** expect an IANA name. Note the spelling: `p_time_zone` on the passport RPC, `p_timezone` elsewhere. An unknown zone raises `22023`.

Full field formulas are in contract [8 RPC catalogue](../backend-contract.md#8-rpc-catalogue). Rule-level semantics are in [BE-36](../business-rules/09-database-invariants.md#be-36--xp-formula) … BE-50.

### 4.1 Core reading and stats RPCs (live)

| RPC | Signature | Returns | Guard | Day boundaries | PWA caller |
|---|---|---|---|---|---|
| `get_library_with_progress` | `(p_user_id uuid) → json` | Every book plus its progress row:<br>`[{id, title, author, coverUrl, totalPages, genre, isbn, description, source, pageCountEstimated, currentPage, percentage, status, lastReadAt, sessionStartAt, dnfAt, progressId}]`<br>`status` precedence: `dnf` → `unread` → `finished` → `reading`.<br>No pagination. `session_paused_at` is **not** returned. Includes imported books. | ⚠ S-01 | — | `src/stores/books.ts` |
| `get_reading_stats` | `(p_user_id uuid) → json` | `{pagesThisWeek, pagesThisMonth, totalPagesRead, totalReadingHours, sessionsThisMonth, currentStreakDays, longestStreakDays, allTimeVelocityPph}`<br>`totalPagesRead` counts **manual** books only. A "valid" session lasts ≥ 60 s and covers ≥ 1 page. | ✅ | **UTC** | `src/composables/useReadingProfile.ts` |
| `get_last_session` | `(p_user_id uuid) → json` | `null`, or the latest `progress_history` row of **any** book, timed session or plain page save:<br>`{bookId, bookTitle, endedAt, startedAt, pagesDelta, startPage, endPage, durationSeconds, velocityPph, completionDelta, finishPredictionSessions, sessionNote}`<br>Hide the prediction when `durationSeconds` is null. | ⚠ S-01 | — | `src/composables/useLastSession.ts` |
| `get_library_breakdown` | `(p_user_id uuid) → json` | `{genreDistribution[], authorsCount, booksFinished, booksInProgress, booksUnstarted, avgCompletionPct}`<br>Includes imports. **Ignores DNF.** Genre grouping is case-sensitive. | ⚠ S-01 | — | `src/composables/useLibraryBreakdown.ts` |
| `get_reading_velocity` | `(p_user_id uuid, p_book_ids uuid[]) → table(book_id, days_left)` | A days-to-finish forecast from the last 30 days. Books without enough data are omitted, so it never returns 0. | ⚠ S-01 | **UTC** | `src/composables/useReadingVelocity.ts` |
| `get_book_passport_stats` | `(p_user_id uuid, p_book_id uuid, p_time_zone text = 'UTC') → json` | `{totalDays, peakDay, peakDayPages, vocabularyCount}` | ✅ (anon EXECUTE still granted) | local | `src/stores/bookPassport.ts` |
| `get_reading_calendar` | `(p_user_id uuid, p_month_start date, p_timezone text = 'UTC') → json` | Active days of a month, with the books read on each and their furthest page | ✅ (anon EXECUTE still granted) | local | `src/composables/useReadingCalendar.ts` (Reading Stats, `/profile/stats`) |
| `get_monthly_reading` | `(p_user_id uuid, p_year int, p_timezone text = 'UTC') → json` | 12 rows `{month, pages, booksFinished}`. `booksFinished` = first history row with `page ≥ total_pages`. | ✅ (anon EXECUTE still granted) | local | `src/composables/useMonthlyReading.ts` (Reading Stats) |
| `get_reading_records` | `(p_user_id uuid, p_timezone text = 'UTC') → json` | `{bestDay, longestSession, fastestFinish, nightOwl}`. Also feeds achievement conditions. | ✅ (anon EXECUTE still granted) | local | `src/composables/useReadingRecords.ts` (Reading Stats) |
| `get_reading_quest_summary` | `(p_user_id uuid, p_year int) → jsonb` | `{goal, quest, level, sources}`<br>XP is lifetime: pages + 25 per completion + 10 per history row + 5 per captured page + 20 per recap + 15 per Insight. Page and completion XP count **manual** books only.<br>The quest year is a **UTC** window keyed on `reading_progress.updated_at`. | ⚠ S-02 | **UTC** year | `src/stores/readingQuest.ts` |

**Imported books.** Imports carry `books.source <> 'manual'` and write no history:

- excluded from `get_reading_stats.totalPagesRead` and from quest page and completion XP;
- included in the library, the breakdown and Reading DNA;
- absent from history-based stats only until the reader saves progress in-app — `source` never changes, but in-app saves write history.

**Planned changes:**

- **BC-04:** `reading_progress.completed_at` replaces `updated_at` for "finished this year".
- **BC-06:** `p_timezone` on every stats RPC (D-07).
- **BC-14:** a delta / paginated library RPC (`changed_since`).

### 4.2 Profile identity RPCs (live)

iOS v1 uses username, display name and avatar only (D-13).

| RPC | Signature | Returns | Errors (`P0001` message) | PWA caller |
|---|---|---|---|---|
| `get_my_community_profile` | `() → jsonb` | `null`, or `{profile: {userId, username, displayName, bio, avatarUrl, isPublic, createdAt, updatedAt}, privacy: {progress, currentlyReading, lexicon, readerDna}}`.<br>No row exists until the first save. | none (anon: `42501`) | `src/composables/useCommunityIdentity.ts` |
| `upsert_my_community_profile` | `(payload jsonb) → jsonb` | Same shape as above. **Full replace:**<br>• omitted text fields become NULL;<br>• an omitted `isPublic` becomes `true`;<br>• omitted privacy keys become `nobody`.<br>Always send the complete payload. | `not_authenticated`, `username_invalid`, `bio_too_long`, `visibility_invalid`, `username_taken`; raw `22P02` for a non-boolean `isPublic` | `useCommunityIdentity.ts` (`/profile/edit` save) |
| `is_username_available` | `(p_username text) → jsonb` | `{available, normalizedUsername}`. Reserved names look "taken". | none | `useCommunityIdentity.ts` (`/profile/edit`) |

Username rule: `^[a-z0-9_-]{3,30}$`, case-insensitive unique. Reserved names: `admin`, `api`, `auth`, `bookhero`, `login`, `profile`, `u`. Rules: [10 · Community & circles](../business-rules/10-community-circles.md) (COM).

### 4.3 Dormant RPCs (no client caller)

| Group | RPCs | Notes |
|---|---|---|
| Weekly session goal | `upsert_weekly_goal(p_goal int) → void`<br>`get_retention_summary(p_timezone text = 'UTC') → json` | A weekly **reading-session** goal and nudge, built from `progress_history` and `user_settings.weekly_goal`. It is **not** a vocabulary or retention rollup. Revive or drop: BE-Q01. |
| Follow graph, blocking, discovery (12) | `get_public_profile_by_username`, `search_community_readers`, `follow_community_user`, `unfollow_community_user`, `block_community_user`, `unblock_community_user`, `get_community_relationship_state`, `can_community_users_interact`, `list_community_followers`, `list_community_following`, `list_my_blocked_users`, `get_also_reading_for_book` | EXECUTE is granted to `authenticated` only; every RPC derives the viewer from `auth.uid()`. "Also reading" surfaces readers the viewer **follows**, not followers. |
| Reading circles (9) | `create_reading_circle`, `invite_reading_circle_members`, `respond_to_reading_circle_invitation`, `leave_reading_circle`, `remove_reading_circle_member`, `get_reading_circle_detail`, `list_my_reading_circles`, `add_circle_reaction`, `get_visible_circle_reactions` | Others' reactions are readable only through `get_visible_circle_reactions` (spoiler gate by normalised % location) |

The follow graph, discovery and circles are a much later Community phase. Their backend stays dormant (D-13).

Signatures, payloads, cursor formats, error codes and known pagination and privacy defects:

- contract [8 RPC catalogue](../backend-contract.md#8-rpc-catalogue) §8.5 – §8.6;
- [10 · Community & circles](../business-rules/10-community-circles.md).

### 4.4 Functions that are not part of the contract

Every `public` function is reachable at `/rest/v1/rpc/<name>`. Trigger functions fail with "trigger functions can only be called as triggers".

Some non-trigger helpers are **dangerous today** and are dropped or locked by BC-01:

- `prune_page_captures_for_book` and `community_remove_pair_follows` are anon-executable and destructive.
- `circle_progress_location` and `community_relationship_payload` leak progress and relationship data.
- `after_page_capture_saved` is dead (attached to no trigger).

Clients must never call them. See contract [9 Triggers & internal functions](../backend-contract.md#9-triggers--internal-functions) and [BE-06](../business-rules/09-database-invariants.md#be-06--every-function-is-an-http-endpoint-default-privileges-re-open-it).

### 4.5 RPC error codes

| Message (`P0001`, HTTP 400) | Raised by |
|---|---|
| `Not allowed` | `get_reading_quest_summary` (another signed-in user) |
| `Not authenticated`, `Weekly goal must be between 1 and 7` | `upsert_weekly_goal` |
| `not_authenticated`, `username_invalid`, `bio_too_long`, `visibility_invalid`, `username_taken` | `upsert_my_community_profile` |
| `not_authenticated`, `not_circle_member`, `not_circle_owner`, `blocked`, `circle_full`, `invalid_circle`, `invalid_circle_name`, `invalid_book`, `invalid_page`, `invalid_progress`, `invalid_reaction_content`, `reaction_ahead_of_progress`, `use_leave_circle`, `invitation_not_pending`, `circle_not_active`, `invalid_cursor` | Community and circle RPCs (dormant) |
| SQLSTATE `22023` | Any timezone argument with an unknown IANA name, except `get_retention_summary`, which falls back to UTC |

The "guarded" read RPCs never raise for a foreign caller. They return empty or zero data.

---

## 5. Direct table writes

Most writes today are plain PostgREST calls under the reader's RLS identity. Under D-06 they move behind RPCs before the iOS build:

- **BC-04:** `start/pause/resume/cancel_session` and `save_progress(book, page, note, client_occurred_at, idempotency_key)` on the server clock, plus DNF/resume RPCs.
- **BC-05 / BC-08 / BC-09:** completion effects, Insights and achievements.
- **BC-10 (recommended):** `review_lexicon_entry`.

Native clients should target those RPCs rather than copy the PWA's multi-step write sequence. Until they exist:

| Write (PWA today) | Table and conflict target | Must-know |
|---|---|---|
| Page save | `reading_progress` upsert (`book_id,user_id`), then `progress_history` insert, then clear the session columns | Send **only** the intended columns: a PostgREST upsert overwrites every column it sends.<br>`progress_history` has no idempotency key.<br>Offline replays write **no** history (D-08 changes this via BC-04). |
| Session start / pause / resume / cancel; DNF / resume | `reading_progress` updates | Contract [15 Notes for native clients](../backend-contract.md#15-notes-for-native-clients) §15.3 lists the exact column set per operation |
| Capture | `page_captures` upsert (`user_id,book_id,page`) | Trigger-written XP event. On a finished book the capture is deleted in the same statement ([BE-21](../business-rules/09-database-invariants.md#be-21--capture-writes-record-xp-then-purge-if-the-book-is-complete)). |
| AI results | `recaps` (insert), `lore_cards` (unique milestone), `book_quizzes` (`user_id,book_id`), `book_passports` (`book_id`), `reading_dna` (`user_id`), `page_captures.resume` (update by id) | Persisted by the client today |
| Goals, achievements, up-next | `reading_goals` (`user_id,year`), `achievements` (`ON CONFLICT DO NOTHING`), `up_next_order` (`user_id,book_id`) | — |

**General rules for every write:**

- Every UPDATE or DELETE needs a filter (`safeupdate`).
- Reference only your own `book_id`s. RLS does not check book ownership (S-10, fixed by BC-01).
- Never insert `reading_quest_events`: it is written by trigger only.

Table shapes are on [Database Data Model](Database-Data-Model.md) and in contract [3 Tables](../backend-contract.md#3-tables).

---

## 6. Storage

| Bucket | Public | Limit / MIME types | Path | Writer → reader |
|---|---|---|---|---|
| `recap-images` | no | 10 MiB; png, jpeg, webp | `{userId}/{recapId}.png` | **Writer:** `generate-recap` image job (service role, upsert).<br>**Reader:** owner via signed URLs — 60 s for a single panel, 3 600 s for the carousel and gallery. |
| `community-avatars` | yes | 5 MiB; jpeg, png, webp | `{userId}/avatar-{epochMs}.jpg` | **Writer:** client upload. The PWA downsizes to ≤ 512 px JPEG.<br>**Reader:** public URL stored in `community_profiles.avatar_url`. |

**No Storage object is ever deleted by the database.**

- `storage.protect_delete` blocks SQL deletes, so cleanup must use the Storage API.
- Book, recap and user deletions therefore orphan images: D-10 / BC-11 for accounts, BC-13 for recaps and books.

**Avatar order (native):** upload → save the profile → only then delete older files. The PWA deletes first and can break `avatar_url` when the save fails.

See contract [7 Storage](../backend-contract.md#7-storage).

---

## 7. External client-side APIs

The client calls these directly; Supabase is not involved. All are unauthenticated except the optional Google key. **Google Books is the primary metadata source**; Open Library only gap-fills and acts as the ISBN fallback.

| API | Endpoint | Used for | Failure behaviour | Rules |
|---|---|---|---|---|
| Google Books search | `GET https://www.googleapis.com/books/v1/volumes` | Add-book search, import fallback, description backfill, DNA recommendation covers. Parameters:<br>• `q`: free text, or `isbn:{query}` when the query is ISBN-shaped after removing `-` and whitespace;<br>• `startIndex = (page − 1) × 20`, `maxResults = 20`, `printType = books`;<br>• `langRestrict = {device language}`, **omitted for ISBN queries**;<br>• `key` (optional). | Non-OK (403 / 429 / 5xx) is treated as "no results"; no retry or backoff | [LIB-27](../business-rules/01-library.md#lib-27--search-endpoint), [LIB-28](../business-rules/01-library.md#lib-28--search-language), [LIB-29](../business-rules/01-library.md#lib-29--isbn-shaped-queries), [LIB-32](../business-rules/01-library.md#lib-32--search-error-semantics) |
| Google Books ISBN lookup | Same endpoint, `q = isbn:{clean}` (no `printType`, no `langRestrict`) | Barcode scan, typed ISBN, import enrichment | No hit → full Open Library fallback. Incomplete hit → Open Library gap-fills field by field. | [LIB-39](../business-rules/01-library.md#lib-39--isbn-lookup-scan-typed-isbn-import) |
| Google Books volume | `GET https://www.googleapis.com/books/v1/volumes/{id}` | Book details page | Failure → blank draft | LIB-35 |
| Google Books recommendations | `volumes`, up to 3 queries. Query: `subject:"…"`, else `subject:"{genre}"`, else `inauthor:"{author}"`. Parameters: random `startIndex` 0–7, `maxResults = 24`, `orderBy = relevance`. | "More … books" | A failed query skips to the next one | LIB-38 |
| Open Library books | `GET https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data` | ISBN fallback and gap-fill: author, cover (large → medium → small), `number_of_pages`, subjects. **Never a description.** | Best-effort; degrades silently | [LIB-36](../business-rules/01-library.md#lib-36--open-library-gap-fill-detail) |
| Open Library search + covers | `GET https://openlibrary.org/search.json?title=…&author=…&limit=3&fields=cover_i`; `https://covers.openlibrary.org/b/id/{cover_i}-M.jpg` | DNA recommendation covers when Google finds none | — | [07 · Profile, stats & goals](../business-rules/07-profile-stats-goals.md) (DNA) |
| Free Dictionary API | `GET https://api.dictionaryapi.dev/api/v2/entries/en/{term}` (English only) | Auto-definition when adding a word | 404 or error → no definition; no other provider. Content is Wiktionary data under CC BY-SA, and **attribution is missing today**. | [LEX-12](../business-rules/05-codex-lexicon.md#lex-12--auto-definition-lookup-on-blur), [LEX-103](../business-rules/05-codex-lexicon.md#lex-103--dictionary-content-is-cc-by-sa-and-shown-without-attribution) |
| Web Speech API (browser, no network call) | `window.speechSynthesis` | Pronunciation on review flashcards | Hidden when unsupported | [05 · Codex & lexicon](../business-rules/05-codex-lexicon.md) |

**Key behaviours:**

- **ISBN-aware search** (`src/services/bookSearchService.ts`). A bare ISBN-10/13 query uses the `isbn:` operator and omits `langRestrict`: an ISBN names one edition, so the language filter would hide it. Free-text searches keep `langRestrict` to suppress local-market editions picked by IP location.
- **Import enrichment** (`src/composables/useLibraryImport.ts`, [LIB-81](../business-rules/01-library.md#lib-81--enrichment)). It is ISBN-first:
  1. `useIsbn().lookup(isbn)` — Google, then Open Library.
  2. A title + author search when there is **no ISBN or the ISBN lookup returns nothing**.

  Up to 5 external calls per book, 3 books in parallel, 150 ms between batches ([LIB-66](../business-rules/01-library.md#lib-66--import-constants-and-throttling)). The calls share the Google quota. Enrichment never writes a description or an ISBN.
- **Result mapping:**
  - Cover = `thumbnail ?? smallThumbnail`, with `http:` → `https:`.
  - ISBN = first `ISBN_13`, else `ISBN_10`.
  - Genre = the first `/` segment of `categories[0]` (the raw value in the ISBN path).
- **ISBN format before insert.** Clients must bring an ISBN into the `books_isbn_check` format: strip hyphens and spaces, uppercase `X`. Checksums and ISBN-10 → 13 conversion are not implemented anywhere (BC-15).
- **Caching.** The PWA service worker caches Open Library `/api/*` (NetworkFirst, 7 days) and covers (CacheFirst, 30 days). Nothing else is cached.
- **Key exposure (S-13).** `VITE_GOOGLE_BOOKS_API_KEY` is embedded in the web bundle, and a literal key value is committed in `.env.example`. Rotate and restrict it.

  **BC-15 (recommended)** replaces direct Google calls with a server-side book-search proxy for every client.

---

## 8. Realtime, push and background work

- **No Realtime publication.** `supabase_realtime` contains no tables. The PWA's Postgres Changes subscription on `recaps` never fires; polling is what works ([PLT-84](../business-rules/08-platform-auth-account.md#plt-84--no-realtime-cross-device-freshness-is-ttl--and-refocus-driven)).
- **No push.** No server push, APNs, cron job or database webhook exists. Refresh on foreground and after mutations.
- **BC-14 (recommended):**
  - publish `recaps` (`image_status`) and `reading_progress`, or define refresh-on-foreground;
  - add a delta library RPC;
  - add `device_tokens` for APNs.
- **Background work.** Fire-and-forget calls run after the user action resolves: vocabulary extraction, page resume, the recap-image request and Insight generation. Only the recap-image job runs past its HTTP response, inside the edge runtime (`EdgeRuntime.waitUntil`).

---

## 9. Planned API changes

Every change keeps existing signatures working for the PWA during the transition (D-05). Details and acceptance criteria are in the [backend consolidation plan](../backend-consolidation-plan.md); the contract summary is in [16 Planned changes](../backend-contract.md#16-planned-changes).

| BC | Status | What changes for API consumers |
|---|---|---|
| [BC-01](../backend-consolidation-plan.md#bc-01--security-hardening) | Required | • Owner checks in the four unguarded RPCs (the parameter is kept).<br>• NULL-safe quest guard.<br>• Revoke `anon` / `PUBLIC` EXECUTE and fix `pg_default_acl`.<br>• Drop or lock the dangerous helpers.<br>• Child-table RLS checks book ownership. |
| [BC-02](../backend-consolidation-plan.md#bc-02--edge-function-auth) | Required | • Real JWT verification for `generate-recap`, `generate-lore` and `ocr-page`.<br>• No internal error text in 500s.<br>• Commit `supabase/config.toml`. |
| [BC-03](../backend-consolidation-plan.md#bc-03--source-of-truth--drift) | Decided | • Repo edge sources synced to deployed (lore v18, DNA v8).<br>• Baseline migration. |
| [BC-04](../backend-consolidation-plan.md#bc-04--atomic-progress--session-rpcs) | Decided | • Session RPCs and atomic `save_progress` on the server clock.<br>• `completed_at`.<br>• D-08 counting. |
| [BC-05](../backend-consolidation-plan.md#bc-05--server-owned-completion--lifecycle-effects) | Decided | One server owner for completion effects: passport, purge, Insights, achievements, DNA eligibility |
| [BC-06](../backend-consolidation-plan.md#bc-06--timezone-standardisation) | Decided | • `p_timezone` on every stats RPC.<br>• The reader's zone stored server-side. |
| [BC-07](../backend-consolidation-plan.md#bc-07--recap-eligibility--persistence-server-side) | Decided | `generate-recap` enforces eligibility, selects the corpus window, persists the row and returns it |
| [BC-08](../backend-consolidation-plan.md#bc-08--insights-orchestration-server-side--fallback) | Decided | Insights generated and inserted server-side with a fallback; clients list cards and mark them seen |
| [BC-09](../backend-consolidation-plan.md#bc-09--achievements-server-side) | Decided | Achievement catalog and evaluation server-side |
| [BC-10](../backend-consolidation-plan.md#bc-10--review-leitner-rpc) | Recommended | `review_lexicon_entry(entry_id, outcome, surface)` |
| [BC-11](../backend-consolidation-plan.md#bc-11--account-lifecycle--auth) | Decided | • `delete-account`.<br>• Password reset.<br>• Sign in with Apple + identity linking.<br>• Universal-link redirects. |
| [BC-12](../backend-consolidation-plan.md#bc-12--entitlements--ai-usage-foundation) | Decided in principle (tiers undecided) | Entitlement and AI-usage check in every AI function |
| [BC-13](../backend-consolidation-plan.md#bc-13--storage-hygiene--ai-job-robustness) | Recommended | • Recap-image cleanup.<br>• Stale `pending` → `failed_transient`. |
| [BC-14](../backend-consolidation-plan.md#bc-14--sync--realtime-readiness) | Recommended | • Realtime publication.<br>• Delta library RPC.<br>• `device_tokens`. |
| [BC-15](../backend-consolidation-plan.md#bc-15--book-data-hygiene) | Recommended | • ISBN normalisation.<br>• Book-search proxy.<br>• Atomic import RPC. |
