# Contract: `refineImagePrompt(input)`

A pure, side-effect-free function. Takes a `memory_jogger` and book metadata, returns a single plain-text image prompt. Lives at `supabase/functions/generate-recap/prompts/imagePromptRefiner.ts`.

This function is the **single point of compliance** with the bulk of the spec's image-prompt requirements (FR-004 through FR-014). It MUST NOT make network calls, read databases, or reference any global mutable state. Its determinism is what makes the feature testable.

## Signature

```typescript
export interface ImagePromptInput {
  bookTitle: string
  bookAuthor: string | null
  bookGenre: string | null         // free-form genre string from `books.genre`; may be null
  memoryJogger: string             // VERBATIM from the just-generated recap
  pageRange?: {                    // optional; included only when the recap has a known span
    fromPage: number
    toPage: number
  }
  softer?: boolean                 // when true, refiner prefers atmospheric over literal language
                                   // (used for the safety-rejection retry per FR-019a)
}

export const refineImagePrompt = (input: ImagePromptInput): string
```

## Output Format

- **Plain text only.** No JSON, no Markdown, no labels, no bullet points, no surrounding code fences. (FR-014)
- **Single string** — typically 80–250 words.
- **Newlines permitted** for readability inside the prompt body.

## Behavioral Requirements

### MUST

1. **Source-of-truth fidelity (FR-004, FR-007)** — All visual content (characters, locations, objects, actions, atmosphere) MUST originate from `memoryJogger` or be a clear visual implication of it. The function MUST NOT introduce visual content from `bookTitle` or `bookAuthor` beyond what is essential to set genre tone.

2. **Name preservation (FR-007)** — Every proper noun (character name, location name, faction name, distinctive object) appearing in `memoryJogger` MUST appear in the output prompt. The function MUST NOT replace specific names with generic descriptors ("a warrior" instead of the actual character's name).

3. **Genre adaptation (FR-005, FR-008)** — Visual-fidelity terms MUST fit the book's genre. The function selects from disjoint vocabulary banks based on inferred genre:

   - Fantasy / epic → "atmospheric concept art", "volumetric lighting", "wide-angle landscape"
   - Sci-fi → "futuristic cinematography", "neon ambient light", "high-detail rendering"
   - Historical fiction → "period-accurate production design", "natural light", "editorial photography style"
   - Literary fiction → "intimate close-up", "moody natural light", "shallow depth of field"
   - Horror / thriller → "chiaroscuro", "low-key lighting", "atmospheric tension"
   - Mystery → "shallow depth of field", "shadow composition", "film noir framing"
   - Children's → "warm natural light", "gentle illustration", "age-appropriate framing"
   - Default (unknown genre) → "cinematic composition", "naturalistic lighting"

   Genre is inferred from `bookGenre` when present, otherwise from textual cues in `memoryJogger`, `bookTitle`, and `bookAuthor`. The function MUST NOT force fantasy vocabulary onto a non-fantasy book.

4. **Composition (FR-009)** — The output MUST explicitly describe: camera angle, subject focus, foreground, background, scale, distance, and visual hierarchy. All composition choices MUST derive from `memoryJogger`.

5. **Atmosphere (FR-010)** — Sensory descriptors (light, weather, texture, temperature, tension, stillness) MUST be drawn only from `memoryJogger`. The function MUST NOT invent atmosphere that contradicts or extends beyond the source.

6. **Consistency (FR-011)** — Clothing, technology, weapons, architecture, and object styling MUST match the book's setting. The function MUST avoid anachronisms (no modern clothing in pre-modern settings, no futuristic technology in non-sci-fi settings, no fantasy armor in realistic contemporary fiction, etc.).

7. **Spoiler safety (FR-012)** — The output MUST NOT include any visual content not present or directly implied by `memoryJogger`. No future events, no future relationships, no symbolic foreshadowing. If the `pageRange` is provided, no detail beyond `pageRange.toPage` may appear.

8. **Minimal invention (FR-013)** — When `memoryJogger` lacks visual detail for a referenced character or object, the output MUST keep the description minimal and genre-appropriate rather than fabricating details.

9. **Composition constraint for square frame (FR-020)** — The output MUST include the literal directive `square 1:1 composition; central subject anchor; no widescreen crop, no portrait crop` (or a near-verbatim equivalent). The function MUST NOT include vocabulary that implies a non-square aspect ratio (e.g., "anamorphic widescreen", "tall portrait", "panoramic", "letterbox").

10. **Softer mode (FR-019a)** — When `softer: true`, the function MUST favor atmospheric language over literal depiction (e.g., "the silhouette of two figures meeting in low light" instead of an explicit named-character close-up). Softer mode is the safety-rejection retry path; the goal is the same scene with reduced literal trigger surface.

### MUST NOT

- **No hardcoded book-specific names (FR-006, SC-010)** — The implementation MUST NOT contain string literals referencing any specific book, author, character, place, or world from any example or sample (no Tolkien, no Lord of the Rings, no Middle-earth, no Gandalf, no Aragorn, no Rohan, no Isengard, no Ents, no Orcs, no Frodo, no Sauron, no Hogwarts, no Mordor, no Westeros, no Stark, no Dune, no Arrakis, etc.). The genre adaptation logic above is the only allowed string-vocabulary content.

- **No use of `thematic_bridge` or `concept_watchlist`** — The function signature does not accept these fields. Even if a future caller mistakenly passed them, they would be ignored. (FR-004)

- **No JSON output, no labeled output, no Markdown wrapping (FR-014).**

## Test Vectors (Illustrative, Not Hardcoded)

Tests in `tests/unit/refineImagePrompt.test.ts` MUST cover at minimum:

1. **Genre fork** — three inputs with distinct genres produce three prompts using disjoint vocabulary banks.
2. **Name preservation** — an input whose `memoryJogger` contains specific proper nouns produces a prompt that contains those exact strings (asserting via `toContain` rather than equality).
3. **No book-specific literals leak** — a static lint test scans `imagePromptRefiner.ts` source for forbidden literal strings (the names listed above) and fails the build if any are present.
4. **Spoiler shield** — when `pageRange` is supplied, the prompt does not contain content from a `memoryJogger` that intentionally was *truncated* before the function was called (the function is a passthrough — the truncation is upstream).
5. **Softer mode shifts language** — same input with and without `softer: true` produces different output, and the softer variant is detectably less literal (heuristic: contains words like "silhouette", "implied", "in shadow", "atmospheric").
6. **Square directive present** — every output contains the 1:1 composition directive.

## Determinism

For a given `(input)` tuple, the function MUST be deterministic. No `Math.random()`, no `Date.now()`, no clock reads. Variation across recap generations comes from the model's image generation step, not from the prompt-refinement step.

## Logging

The function does NOT log. The caller (`handlers/image.ts`) is responsible for logging the prompt's length and a hash for traceability.
