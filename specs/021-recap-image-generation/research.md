# Phase 0 Research — Recap Image Generation

This document resolves all `NEEDS CLARIFICATION` items implicit in the Technical Context and captures key technical decisions for the planning phase.

---

## R1 — Gemini 2.5 Flash Image Model: API Shape

**Decision**: Use the Generative Language REST API endpoint `models/gemini-2.5-flash-image:generateContent` from inside the Deno Edge Function. Request includes a single `parts: [{ text: <refinedPrompt> }]` content block. `responseModalities: ['IMAGE']` instructs the model to return image data only — no text candidate. Response payload contains `inlineData.mimeType` (`image/png`) and `inlineData.data` (base64-encoded bytes).

**Rationale**:
- Same API surface as `gemini-2.5-flash` already used by `generate-recap`, `generate-lore`, and the others — zero new SDK or auth surface.
- Response-modality control via `responseModalities` is the documented mechanism for image-only output and aligns exactly with the spec requirement (FR-003).
- `inlineData` allows a single round-trip from Edge Function: receive base64 → decode → upload to Supabase Storage. No need for a second fetch from a Google CDN.

**Alternatives considered**:
- *Imagen 3 via Vertex AI*: separate auth (Google Cloud service account) and a different API surface. Rejected to keep the project's single API-key pattern.
- *Returning a Google-hosted URL*: would couple our recap row's lifetime to Google's CDN retention. Rejected — we own image lifetime.

---

## R2 — Image Storage Strategy

**Decision**: Supabase Storage, new private bucket `recap-images`. Object path `{user_id}/{recap_id}.png`. Bucket policies enforce that only the row owner reads via signed URLs (60-second TTL minted client-side via `supabase.storage.from('recap-images').createSignedUrl`). The `recaps` table gains an `image_path` column (the relative path inside the bucket), an `image_status` enum, and `image_generated_at`.

**Rationale**:
- **Bytes in Postgres rows would bloat the table.** `recaps.content` is already non-trivial; adding a 200–500KB `bytea` column would multiply row sizes and slow `SELECT` by orders of magnitude. Storage decouples the binary from the indexed metadata.
- **Signed URLs preserve the existing privacy model.** No public bucket = no leakage if a recap row is somehow exposed. TTL is short because the client only needs the URL long enough to render once; the next page load mints a new signed URL from the persisted path.
- **Path scheme keys deletes to user removal.** When a user is deleted, deleting the `{user_id}/` prefix cleans up all their images in one operation.
- **Image lifetime tracks the recap.** When a recap row is deleted (cascade), a server-side trigger or scheduled job removes the matching object. Alternatively, the Edge Function deletes synchronously when a recap is invalidated (out of scope for v1; documented as TODO).

**Alternatives considered**:
- *bytea column on `recaps`*: simplest schema, worst performance. Rejected.
- *Separate `recap_images` table 1:1 with recap*: extra join on every recap fetch. The columns we need (path, status, timestamp) are tiny and belong on the parent row. Rejected.
- *Public bucket with obscured filenames*: violates Constitution IV (privacy). Rejected.

---

## R3 — Image Stage Placement in the Recap Pipeline

**Decision**: Image generation runs as a downstream stage **inside the same Edge Function invocation**, after the text generation stage commits the `recaps` row but **does not block the text response to the client**. The function returns text fields immediately; the image stage continues server-side and updates the `recaps` row with `image_path` and flips `image_status` from `pending` → `succeeded`/`failed_*` when complete. The client subscribes via Supabase Realtime to the `recaps` row and re-renders when the row changes.

**Rationale**:
- **Time-to-first-text-token must not regress** (SC-005, Constitution III latency budget). Coupling the image stage synchronously would add 5–10 seconds of latency to the text response.
- **Single function invocation simplifies auth, logging, and shared state.** The Edge Function already has the user JWT, the validated payload, and the recap_id. Splitting into two functions would duplicate the auth check and require either a second client call or a server-to-server invocation.
- **Realtime subscription is already used elsewhere.** Fragments stream via Realtime; reusing the same channel pattern for the image-status update is zero new infrastructure.
- **Background continuation is supported by Deno's runtime.** Edge Functions can use `EdgeRuntime.waitUntil(promise)` (Supabase's Deno runtime API) to keep work alive after the response is sent.

**Alternatives considered**:
- *Synchronous: image is part of the response payload*: simple but blows the latency budget. Rejected.
- *Separate `generate-recap-image` Edge Function called from the client after text recap settles*: doubles network round trips, doubles auth cost, splits failure surface. Rejected.
- *Postgres trigger that fans out to a new function*: indirection without benefit; the original function already has the recap_id. Rejected.

---

## R4 — Retry Policy Implementation

**Decision**:
- **Transient retry** (FR-019): catch network/timeout/5xx/429 from the Gemini call; sleep 1.5s; retry exactly once. Counter `transient_attempt` (0 or 1) tracked in-process only — not persisted.
- **Safety-rejection retry** (FR-019a): if the model rejects the prompt for safety, call `imagePromptRefiner` again with a flag `softer = true` that re-builds the prompt with more atmospheric (less literal) language; submit once. Counter `safety_attempt` (0 or 1) tracked in-process only.
- **Counters are independent** — a transient retry does not consume the safety budget and vice versa.
- **No client-visible retry control** per Clarification 3. Manual regeneration is achieved only by the user generating a new recap, which is a separate user action.

**Rationale**: Two binary flags are the simplest correct model for the spec's requirements. Tracking them in-process avoids polluting the schema with retry metadata that the client doesn't care about. The function's own log (Supabase Edge Function logs) records each attempt for observability without persisting per-recap retry counts.

**Alternatives considered**:
- *Exponential backoff with N retries*: over-engineered for what is effectively a "blip protection" policy. Rejected.
- *Persisting retry attempts on the recap row*: schema bloat with no UI surface. Rejected.

---

## R5 — Frontend Loading & Error Display

**Decision**:
- The `RecapImagePanel.vue` component is mounted inside `RecapStream.vue` as soon as a recap_id is known, even before text streaming completes.
- Initial state: PrimeVue `Skeleton` at 1:1 aspect ratio matching the final image footprint, so the recap card layout does not jump when the image arrives.
- On image_status = `succeeded`: fade in the image via PrimeVue `Image` (with `preview="false"`, `imageStyle="aspect-ratio: 1; object-fit: cover; border-radius: var(--p-border-radius-xl)"`).
- On image_status = `failed_*`: render a simple gradient placeholder (`<div>` with the same 1:1 aspect ratio + a subtle book/page icon from `pi pi-book`). No retry button (FR-018, Clarification 3). No error toast.
- Reactive subscription to the recap row via the Supabase Realtime channel managed by `useRecapImage`.

**Rationale**:
- Skeleton-first prevents layout shift, which would be jarring during the user's reading flow.
- Decorative-only treatment matches Clarification 2: alt is empty, role is presentation, screen readers skip the element entirely.
- PrimeVue components are mandatory per Constitution VI; both `Image` and `Skeleton` are already imported elsewhere — zero new dependency.

**Alternatives considered**:
- *Custom `<img>` with a CSS-only loading shimmer*: violates Constitution VI when an equivalent PrimeVue primitive exists. Rejected.
- *Show the image only after it succeeds, leaving an empty space until then*: causes layout shift. Rejected.

---

## R6 — Composition Constraints for Square Images

**Decision**: The `imagePromptRefiner` includes the literal directive `square 1:1 composition; central subject anchor; no wide-cinematic crop, no portrait crop`. The system prompt for the refiner additionally instructs the model to avoid composition language that would only make sense in a different aspect ratio (e.g., "anamorphic widescreen", "tall portrait", "panoramic").

**Rationale**: `gemini-2.5-flash-image` honors composition language in the prompt; explicit constraint avoids generation of images whose cropping intent fights the 1:1 frame.

**Alternatives considered**:
- *Generate in widescreen and crop server-side*: lossy aesthetically; the model wouldn't compose for a square. Rejected.
- *Make aspect ratio a runtime parameter*: spec fixes it at 1:1 (FR-020). Future-proofing against an in-app preference can come later. Rejected for v1.

---

## R7 — Cost Estimation & Budget Posture

**Decision**: Approximate cost per image via `gemini-2.5-flash-image`: ~$0.04 per image generation (estimated against the model's published pricing tier; actual cost subject to Google's billing). Daily expected volume of recaps: <1,000 in early access, <10,000 at projected launch. Monthly cost ceiling at launch ≈ $12,000/month worst case.

**Rationale**: Cost is bounded by recap generation volume, which is itself naturally rate-limited by the recap-lock mechanic (the user must read more pages to unlock another recap). The implementation passes generation counts and timestamps to the existing observability surface so finance can monitor before tier-gating becomes necessary.

**Alternatives considered**:
- *Tier-gate the image to paid users only*: explicitly out of scope per the spec ("subscription tier gating handled by the future subscriptions spec"). Rejected for this feature.

---

## R8 — Migration Safety

**Decision**: The migration `20260503_recap_image_columns.sql` is **strictly additive**:
- Three nullable columns on `recaps`: `image_path text`, `image_status text default 'pending' check (image_status in ('pending','succeeded','failed_safety','failed_transient','skipped'))`, `image_generated_at timestamptz`.
- Bucket creation: `insert into storage.buckets (id, name, public) values ('recap-images', 'recap-images', false) on conflict do nothing;`
- Bucket policy SQL: read/write access keyed to `(storage.foldername(name))[1] = auth.uid()::text`.

The PWA continues to work without rebuild — old code reads `recaps` rows and ignores the new columns; the new client code tolerates `image_status = null` as if it were `'skipped'` for any pre-existing recaps.

**Rationale**: Constitution requires backwards-compatible additions. No PWA downtime, no client-side bumped version required.

---

## Summary of Resolved Unknowns

| Item | Decision |
|---|---|
| Image-generation API shape | Gemini Generative Language REST, `responseModalities: ['IMAGE']` |
| Image storage | Supabase Storage private bucket `recap-images`; key `{user_id}/{recap_id}.png` |
| Schema impact | 3 nullable columns on `recaps`; one new bucket |
| Pipeline placement | Same Edge Function invocation, image runs after text returns to client (background) |
| Retry policy | 1 transient retry + 1 safety retry, counted independently, in-process only |
| UI loading state | PrimeVue `Skeleton` (1:1) → fade-in PrimeVue `Image` on success; gradient placeholder on failure |
| Composition constraint | Refiner emits explicit `square 1:1` directive |
| Cost posture | Tracked via existing Edge Function logs; tier-gating deferred |
| Migration safety | Strictly additive; no PWA-side breaking change |

**No NEEDS CLARIFICATION items remain.** Phase 1 may proceed.
