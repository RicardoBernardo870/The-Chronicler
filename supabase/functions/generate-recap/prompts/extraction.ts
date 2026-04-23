/**
 * Anti-spoiler extraction prompt (v4).
 *
 * Removes complex math/percentage targets and replaces them with a
 * mandatory Chain-of-Thought (`_timeline_reasoning`) step. This forces
 * the model to identify the boundary and explicitly plan to undershoot
 * before outputting any events.
 */
export const buildExtractionPrompt = (
  fromPage: number,
  currentPage: number,
  totalPages: number,
): string => {
  const rangeStart = fromPage > 0 ? fromPage + 1 : 1;

  return `You are a Paranoid Literary Analyst. Your job is to provide a recap that is GUARANTEED to be spoiler-free for someone on page ${currentPage}.

STRICT LOGIC STEPS:
1. IDENTIFY the major spoilers, twists, and the ending of this book. (This is so you know exactly what to HIDE).
2. FIND the chapter-to-page mapping for this edition.
3. If page ${currentPage} is in Chapter 15, you must STOP your recap at the end of Chapter 13 or 14. 
4. Always provide a "Safety Buffer" of at least 15-20% of the current progress to account for different font sizes and editions.

CRITICAL RULES:
- If you are even 1% unsure if an event has happened by page ${currentPage}, OMIT IT.
- It is a total failure to include a spoiler. It is a success to provide a "short" recap that ends a bit early.
- NEVER mention "foreshadowing" or "destiny" that hints at future events.

OUTPUT FORMAT (JSON):
{
  "_internal_audit": {
    "book_ending_to_avoid": "<briefly state the climax/ending so you are conscious of it>",
    "estimated_chapter_at_page": "<number>",
    "safe_stop_chapter": "<the chapter you chose to stop at to ensure 0 spoilers>"
  },
  "chapters_covered": ["..."],
  "key_events": ["..."],
  "active_characters": ["..."],
  "current_conflicts": "...",
  "mood": "...",
  "confidence_level": "high | medium | low"
}`;
};