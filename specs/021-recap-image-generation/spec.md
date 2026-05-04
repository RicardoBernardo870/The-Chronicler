# Feature Specification: Recap Image Generation

**Feature Branch**: `021-recap-image-generation`
**Created**: 2026-05-03
**Status**: Draft
**Input**: User description: "Add image generation to the existing recap feature. Each recap should include an AI-generated image refined exclusively from the `memory_jogger` field, adapting to the current book's genre, setting, and tone, while preserving the specific names and terms in the source content and avoiding spoilers."

---

## Clarifications

### Session 2026-05-03

- Q: What aspect ratio should the generated recap image use? → A: 1:1 square
- Q: What alt-text strategy should the recap image use? → A: No alt text
- Q: What is the auto-retry policy for transient image-generation failures, and is a manual retry control offered? → A: One silent auto-retry on transient errors; on second failure show placeholder with no manual retry button. Users obtain a new image only by generating a new recap.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See a Cover-Like Image with My Recap (Priority: P1)

A reader generates an AI recap for their current book. Alongside the existing text components (memory jogger, thematic bridge, concept watchlist), the recap now includes a single visual image that depicts a scene grounded in what the user has actually read — characters, places, objects, and atmosphere drawn directly from the memory jogger. The image style adapts to the book's genre and feels intentional, like a thoughtfully-art-directed still rather than a generic stock image.

**Why this priority**: This is the headline outcome of the entire feature. Without a visible image attached to the recap, the work has no user-facing value. Everything else in the spec exists to make this image trustworthy, on-brand, and spoiler-safe.

**Independent Test**: Generate a recap on any book in the library. The recap result includes both the existing text fields and a single image rendered alongside them. Refresh the recap from history — the image persists and renders without re-generating.

**Acceptance Scenarios**:

1. **Given** a book with sufficient progress for a recap, **When** the user generates a new recap, **Then** the result contains the existing text fields (memory jogger, thematic bridge, concept watchlist) **and** an image.
2. **Given** a generated recap is saved, **When** the user views it later from the recap history, **Then** the same image renders without re-invoking generation.
3. **Given** the recap stream is in progress, **When** text fields begin to render, **Then** the user sees a clear loading state for the image (skeleton, shimmer, or progress indicator) until the image is ready.
4. **Given** the image generation completes, **When** the image renders, **Then** it appears at a fixed prominent placement in the recap card (top, hero, or banner — to be specified at design time but consistent across recaps).

---

### User Story 2 — Image Reflects What I've Actually Read (Priority: P1)

A reader has just finished a chapter where two named characters meet in a specific named location described in the memory jogger. When the recap image renders, those exact named characters and that exact named location appear — not a generic substitute. The image visibly corresponds to the moment the memory jogger described, with no scenes, characters, or details from later parts of the book.

**Why this priority**: The image is only valuable if it is a faithful, spoiler-safe visual anchor of the user's actual reading. A generic or post-progress image undermines trust and risks spoiling the book.

**Independent Test**: Read a passage with distinctive named characters or locations. Generate a recap and confirm the memory jogger references those names. Verify that the rendered image visually corresponds to those same named entities — not generic replacements — and depicts no event, character, location, or detail not present or directly implied by the memory jogger.

**Acceptance Scenarios**:

1. **Given** a memory jogger that names specific characters, **When** the image is generated, **Then** it depicts characters that correspond to those specific names rather than generic figures.
2. **Given** a memory jogger that names a specific location, **When** the image is generated, **Then** the setting depicted matches that location's description rather than a generic interpretation.
3. **Given** the user is at page X of Y, **When** the image is generated, **Then** the image contains no character, event, object, or visual hint from beyond page X.
4. **Given** the memory jogger does not provide enough detail to depict a character or object, **When** the image is generated, **Then** the rendering uses a tasteful, minimal, genre-appropriate treatment rather than inventing speculative details.

---

### User Story 3 — Image Style Matches the Book's Genre (Priority: P2)

A reader switches between a fantasy novel, a mystery thriller, and a historical fiction work. The recap image for each book uses visual language appropriate to its genre — fantasy gets epic cinematic atmosphere, mystery gets shadowed tension, historical gets period-accurate production design — without forcing one aesthetic onto another. The reader never sees fantasy armor in a contemporary novel or futuristic technology in a 19th-century setting.

**Why this priority**: Genre-appropriate styling is what makes the feature feel deliberate rather than gimmicky. It is essential for credibility but secondary to correctness (P1) and spoiler safety (P1).

**Independent Test**: Generate recaps for at least three books across distinct genres (e.g., fantasy, historical fiction, contemporary literary fiction). Compare the resulting images. Each should visibly use a different visual register that fits its book's genre, period, and tone.

**Acceptance Scenarios**:

1. **Given** a fantasy book, **When** the image is generated, **Then** the visual treatment evokes epic fantasy cinematography (lighting, scale, atmosphere) without being generic.
2. **Given** a historical fiction book set in a specific period, **When** the image is generated, **Then** clothing, architecture, and objects respect that period and avoid anachronisms.
3. **Given** a contemporary literary fiction book, **When** the image is generated, **Then** the treatment is grounded and character-focused rather than fantastical.
4. **Given** a horror or thriller book, **When** the image is generated, **Then** the composition emphasizes mood — shadow, tension, atmosphere — rather than direct gore or shock.
5. **Given** a children's fiction book, **When** the image is generated, **Then** the result is age-appropriate in subject matter and style.
6. **Given** any book, **When** the image is generated, **Then** the visual treatment never imposes elements from a different genre (e.g., no fantasy creatures in realistic contemporary fiction).

---

### User Story 4 — Recap Without Image Still Works (Priority: P2)

If image generation fails or is unavailable for any reason, the user still receives a complete recap with the existing text components. The system silently retries once on transient failures; if the retry also fails, a non-alarming placeholder takes the image's slot and the recap is treated as complete-without-image. There is no in-place manual retry control — to obtain a new image, the user generates a new recap.

**Why this priority**: Graceful degradation protects the existing recap experience from regressions and isolates failure surface. Critical for trust and for not blocking AI text outputs on a separate AI call.

**Independent Test**: Force a failure in image generation (e.g., simulated provider error). Confirm the system silently retries once. After both attempts fail, confirm the recap still completes, renders all text fields, and shows a placeholder where the image would have been — with no retry button. Generate a new recap on the same book — confirm a fresh image attempt occurs.

**Acceptance Scenarios**:

1. **Given** image generation transiently fails after text fields succeed, **When** the system reacts, **Then** it performs exactly one silent auto-retry without notifying the user.
2. **Given** the auto-retry succeeds, **When** the recap is presented, **Then** the image renders normally as if no failure had occurred.
3. **Given** the auto-retry also fails, **When** the recap is presented, **Then** all text fields render normally and a non-alarming visual placeholder occupies the image slot — with no retry button or affordance.
4. **Given** a recap saved without an image, **When** the user views it later, **Then** the placeholder remains in place and no background regeneration is attempted.
5. **Given** a recap is in the no-image state, **When** the user wants a new image, **Then** their only path is to generate a new recap (which makes a fresh image attempt).

---

### Edge Cases

- **Empty or trivial memory jogger**: If the memory jogger contains no specific names, places, or visual content, the image must use minimal, atmospheric, genre-appropriate imagery rather than fabricating details. The system must not insert characters or events absent from the source.
- **Memory jogger contains potentially sensitive content** (e.g., violence, intimate situations): the image must be tasteful and respect content safety policies of the image provider; suggestive content should be conveyed through atmosphere and composition rather than explicit depiction.
- **Book genre is mixed or ambiguous** (e.g., literary horror, sci-fi mystery): the system favors the dominant atmospheric cues from the memory jogger over a single rigid genre template.
- **Book has no genre metadata**: the system infers genre cues from the book title, author, and the tone of the memory jogger itself rather than failing.
- **Memory jogger is very long**: the prompt refinement preserves all proper nouns and unique terms while compressing narrative description into a single composable image prompt.
- **Image generation latency exceeds reasonable threshold**: the recap result is delivered without the image and the image arrives separately when ready, rather than blocking the entire recap.
- **The same book/recap is generated twice**: each generation may produce a different image; this is acceptable. The persisted recap row binds the image generated at that recap's creation time — viewing history does not change images retroactively.
- **Image generation provider returns an unsafe-content rejection**: the system retries once with a more atmospheric (less literal) prompt; if still rejected, fall back to the no-image state with placeholder.
- **Provider returns a transient error (timeout, 5xx, transient rate-limit)**: the system performs exactly one silent auto-retry after a short backoff; if the retry also fails, fall back to the no-image state with placeholder. No manual retry is offered.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The recap output structure MUST include a new `image` field alongside the existing `memory_jogger`, `thematic_bridge`, and `concept_watchlist` fields.
- **FR-002**: The system MUST NOT remove, rename, or change the meaning of the existing `memory_jogger`, `thematic_bridge`, or `concept_watchlist` fields.
- **FR-003**: The system MUST generate the recap image using the `gemini-2.5-flash-image` model with image-only response modality.
- **FR-004**: The system MUST refine the image prompt exclusively from the `memory_jogger` content; `thematic_bridge` and `concept_watchlist` MUST NOT contribute any content to the image prompt.
- **FR-005**: The image prompt refinement MUST adapt dynamically to the current book's metadata (title, author, genre, optional page range).
- **FR-006**: The image prompt refinement logic MUST NOT hardcode references to any specific book, author, character, place, faction, object, or world (no Tolkien-specific, no Lord of the Rings-specific, no Middle-earth-specific names appear in the production prompt template).
- **FR-007**: The image prompt MUST preserve specific proper nouns (character names, location names, faction names, unique objects, distinctive terms) that appear in `memory_jogger` rather than substituting generic descriptions.
- **FR-008**: The image prompt MUST select visual-fidelity language (cinematography, photography, illustration, rendering terms) that fits the current book's genre and tone — fantasy language is not used for non-fantasy books and vice versa.
- **FR-009**: The image prompt MUST define a clear composition: camera angle, subject focus, foreground, background, scale or distance, and visual hierarchy, with all these details derived solely from the `memory_jogger`.
- **FR-010**: The image prompt MUST describe atmosphere using sensory cues (light, weather, texture, temperature, tension, stillness, etc.) drawn only from the `memory_jogger`; atmospheric details MUST NOT imply or foreshadow events absent from the `memory_jogger`.
- **FR-011**: The image prompt MUST maintain visual consistency between depicted characters, locations, clothing, technology, weapons, architecture, and objects and the book's setting and genre — no anachronisms or genre mismatches.
- **FR-012**: The image prompt MUST be spoiler-safe — it must not include any event, character, location, relationship, identity revelation, or visual hint that originates beyond the user's current reading position or that is absent from `memory_jogger`.
- **FR-013**: When `memory_jogger` lacks sufficient visual detail to render a character or object, the prompt MUST use minimal, tasteful, genre-appropriate treatment rather than inventing speculative details.
- **FR-014**: The image prompt refinement function MUST output only the final image prompt as plain text — no JSON, no markdown, no labels, no bullet points, no explanatory wrapper.
- **FR-015**: The recap generation flow MUST execute the image prompt refinement and image generation **after** the existing text fields have been produced, treating image generation as a downstream stage that consumes only `memory_jogger`.
- **FR-016**: The recap persistence layer MUST store the generated image together with the rest of the recap result so that subsequent retrievals of the same recap return the same image without regenerating it.
- **FR-017**: If image generation fails after the auto-retry policy has been exhausted, the recap MUST still be delivered with all text fields intact, and the image slot MUST display a non-alarming visual placeholder (rather than blocking the recap or showing an error message).
- **FR-018**: The system MUST NOT expose a manual "retry image" control in the recap UI. Once a recap settles into the no-image state, that state is final for that recap. To obtain a new image, the user must generate a new recap, which triggers a fresh image-generation attempt.
- **FR-019**: The system MUST handle transient image-generation failures (network errors, provider 5xx responses, transient rate-limit responses) by performing exactly **one** silent auto-retry. The retry MUST occur without user notification and within a short backoff (a few seconds). If the retry also fails, the recap settles into the no-image state per FR-017.
- **FR-019a**: The system MUST handle image-provider safety rejections by attempting **one** retry with a more atmospheric (less literal) prompt derived from the same `memory_jogger`. Safety-rejection retries are independent of and counted separately from transient-failure retries. On continued rejection, the recap settles into the no-image state per FR-017.
- **FR-020**: The image MUST be generated and displayed at a 1:1 square aspect ratio in a consistent, prominent placement within the recap presentation (e.g., as a hero element of the recap card). The image-prompt-refinement step MUST request composition language compatible with a square frame (avoiding instructions that assume wide-cinematic or tall-portrait composition).
- **FR-021**: The image is presented as a decorative visual companion to the recap text. No alternative text is generated or stored; assistive technologies should treat the image as decorative (e.g., empty `alt`, `aria-hidden="true"`, or platform equivalent). The recap's text fields remain the canonical content for non-sighted users.
- **FR-022**: The image generation MUST NOT block the rendering of text fields; text fields MUST appear as soon as they are available, with the image streaming in or rendering once it completes.
- **FR-023**: The system MUST track image-generation metadata sufficient for cost monitoring and quality review (e.g., generation timestamp, success/failure, retry count) without persisting prompts or content that would compromise spoiler-safety guarantees.
- **FR-024**: The implementation MUST be modular — the image-prompt-refinement step and the image-generation step MUST be reusable from contexts other than the current recap pipeline (e.g., regeneration, future passport or lore image features) without code duplication.

### Key Entities

- **Recap**: The existing recap record extended with one new field representing the generated image (image bytes, image URL/reference, or storage handle — exact form determined at planning time). Existing fields (`memory_jogger`, `thematic_bridge`, `concept_watchlist`) remain unchanged in shape and meaning.
- **RecapImage**: The new conceptual entity representing the visual companion to a recap. Exists in a one-to-one relationship with its parent Recap. Has a state (pending, succeeded, failed) and metadata for retries and provenance.
- **ImagePromptInput**: The transient input to the prompt refinement step — combines the current book's metadata (title, author, genre when available, optional page range) with the recap's `memory_jogger`. Never persists to the database; exists only at request time.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% or more of recap generations on books with non-trivial `memory_jogger` content produce a successful image without manual retry.
- **SC-002**: When tested against a curated sample of 20 recaps spanning at least 5 distinct genres, an external reviewer judges the image's genre and tone match the book's genre and tone in 90% or more of cases.
- **SC-003**: When tested against a curated sample of 20 recaps where `memory_jogger` contains specific named characters or locations, the rendered image preserves those specific named entities (does not substitute generic equivalents) in 95% or more of cases.
- **SC-004**: A spoiler-safety audit on a curated sample of 30 recaps finds zero instances where the image depicts an event, character, or detail that occurs beyond the user's current reading position or is absent from `memory_jogger`.
- **SC-005**: Recap text fields render to the user no later than they did before this feature was introduced (no regression in time-to-first-text-token).
- **SC-006**: When an image fails to generate after the auto-retry policy is exhausted, the user sees a non-alarming placeholder, no retry control is exposed, and the text recap remains fully usable in 100% of failure cases.
- **SC-007**: The silent auto-retry on transient failures does not affect the existing text fields and re-uses the same `memory_jogger` content as the source-of-truth in 100% of cases.
- **SC-008**: The end-to-end time from "Get Recap" tap to image visible in the UI is at most 2× the time from "Get Recap" tap to text recap visible, in 90th percentile observations.
- **SC-009**: User-perceived quality (measured via thumb-up/thumb-down or similar lightweight feedback on the recap card, when collected) shows the version with images receiving at least the same satisfaction rate as the version without images, with no statistically significant decrease.
- **SC-010**: A code review confirms the image-prompt-refinement step contains no hardcoded book, author, character, place, faction, or world-specific names from any example book.

## Assumptions

- The current recap feature already produces structured output containing `memory_jogger`, `thematic_bridge`, and `concept_watchlist` fields. This spec extends, not replaces, that flow.
- The book metadata model already provides title and author; genre is available for many but not all books — the system handles books without explicit genre by inferring from title, author, and `memory_jogger` tone.
- The image provider's content-safety policies apply and may reject prompts; one retry with a more atmospheric prompt is sufficient mitigation for the vast majority of legitimate recaps.
- Recaps are user-private; images are not shared between users without explicit user action (sharing is out of scope for this spec).
- Image storage approach (binary in DB, object store URL, CDN cache, etc.) is a planning concern, not a specification concern. The spec only requires that the image be retrievable alongside the recap on subsequent reads.
- Cost per generated image is acceptable within the existing AI cost envelope; tier-based gating (free vs. paid) is out of scope for this spec but may be applied in a follow-up.
- Existing recap caching, invalidation, and SWR behavior continues to work; the image is part of the recap payload and is invalidated together with it.
- Display/layout decisions (where exactly the image sits in the recap card, animation behavior on stream completion, etc.) are deferred to design and the planning phase.
- Localization of generated visual content is not in scope — image content is universal regardless of UI locale.

## Out of Scope (Explicitly Deferred)

- Generating images for other AI outputs (lore cards, book passports, reading DNA visualizations) — though FR-024 mandates the implementation be reusable for those future features.
- User-driven image style customization (filters, "regenerate with different style", style presets).
- Multi-image recaps (galleries, panels, comic-strip).
- Sharing images publicly or to community surfaces (covered by the future community spec).
- Tier-based subscription gating of the image feature (handled by the future subscriptions spec).
- Editing or annotating the generated image.
- Persisting the image-prompt text itself (raw prompt is regenerated on demand from `memory_jogger` and book metadata; storing prompts is unnecessary and would needlessly enlarge the data footprint).
