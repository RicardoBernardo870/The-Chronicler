# Quickstart: Bulletproof Recap Generation

**Feature**: 008-recap-hardening

## Local verification (pre-deploy)

1. The refactored function lives at `supabase/functions/generate-recap/` with the module layout documented in `plan.md`.
2. Type-check the Deno sources:
   ```bash
   deno check supabase/functions/generate-recap/index.ts
   ```
3. Confirm the Book Blurb and Passport Summary prompt files are byte-equivalent to the pre-refactor strings:
   ```bash
   # spot check — the three closing `}` prompts should match character counts
   wc -c supabase/functions/generate-recap/prompts/blurb.ts
   wc -c supabase/functions/generate-recap/prompts/passport.ts
   ```
4. The client (`src/services/recapService.ts`, recap stores) MUST NOT be modified.

## Deployment (Supabase MCP)

Deploy via `mcp__supabase__deploy_edge_function` to project `zlndhygpqacygceivuvk`:

- Function slug: `generate-recap`
- `verify_jwt`: false (preserved)
- Files: all modules from `supabase/functions/generate-recap/` (index.ts, cors.ts, auth.ts, types.ts, aiClient.ts, router.ts, utils/json.ts, utils/logging.ts, prompts/*.ts, handlers/*.ts, extraction/*.ts)

## Post-deploy smoke tests

Run against the live function with a valid Supabase JWT.

### 1. Blurb mode (page 0)

```bash
curl -N -X POST "$SUPABASE_URL/functions/v1/generate-recap" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"title":"Dune","author":"Frank Herbert","currentPage":0,"totalPages":688,"percentage":0}'
```

**Expect**: streaming `text/plain`; when concatenated, parses to `{memory_jogger, concept_watchlist, thematic_bridge}`; no spoilers, no plot reveals.

### 2. Mid-book recap mode (happy path — high confidence)

```bash
curl -N -X POST "$SUPABASE_URL/functions/v1/generate-recap" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"title":"Dune","author":"Frank Herbert","currentPage":150,"totalPages":688,"percentage":22}'
```

**Expect**: streaming JSON recap of pages 1–150 only. Inspect logs for `stage=extractor attempt=0` entry with no retry.

### 3. Mid-book recap — force low confidence

Request at an extreme late-book page for an obscure book (where the model is likely to self-report low confidence):

**Expect logs**:
- `stage=extractor attempt=0 ... confidence_level=low`
- `stage=extractor attempt=1` with `adjustedPage = currentPage - 5`
- Either a success, or a final graceful 500 `{error: "AI output invalid", detail: "Low extraction confidence after retries"}` — never a speculative recap.

### 4. Incremental recap (from_page)

```bash
curl -N -X POST "$SUPABASE_URL/functions/v1/generate-recap" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"title":"Dune","author":"Frank Herbert","currentPage":200,"totalPages":688,"percentage":29,"from_page":100}'
```

**Expect**: recap content references only pages 101–200.

### 5. Passport Summary

```bash
curl -N -X POST "$SUPABASE_URL/functions/v1/generate-recap" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"title":"Dune","author":"Frank Herbert","currentPage":688,"totalPages":688,"percentage":100,"mode":"passport_summary"}'
```

**Expect**: streaming plain-text paragraph, 300–500 words. Behavior unchanged vs. pre-refactor.

### 6. Error paths

- Missing `title` → 400 `{error: "Missing required fields"}`
- Missing `Authorization` header → 401 `{error: "No authorization header"}`
- OPTIONS preflight → 200 with CORS headers

## Spoiler-audit walkthrough (SC-001)

Pick 5 well-known books with famous late-book twists. For each, request recaps at 25%, 50%, and 75%. Reviewer verifies zero recap output references events beyond the supplied `currentPage`. Record results in a table.

## Rollback

If the new function fails smoke tests, re-deploy the pre-refactor `index.ts` via the Supabase MCP. No DB or client migration needed — contract is preserved.
