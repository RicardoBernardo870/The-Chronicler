/**
 * Anti-spoiler extraction prompt (v3).
 *
 * Adds under-shoot bias + timeline scratchpad to the v2 cautious analyst.
 * Still self-reports `confidence_level`; the orchestrator retries low-confidence
 * responses with a reduced page window.
 */
export const buildExtractionPrompt = (
  fromPage: number,
  currentPage: number,
  totalPages: number,
): string => {
  const rangeStart = fromPage > 0 ? fromPage + 1 : 1;

  const rangeDesc =
    fromPage > 0
      ? `pages ${rangeStart} to ${currentPage}`
      : `the first ${currentPage} pages (out of ${totalPages} total)`;

  const toPct = Math.round((currentPage / totalPages) * 100);
  const fromPct = Math.round((fromPage / totalPages) * 100);

  // Create a safer target for the model to aim for
  const safeTargetPct = Math.max(0, toPct - 10);

  return `You are a highly cautious literary analyst. Your task is to describe ONLY what happens in ${rangeDesc} of a book.

CRITICAL CONSTRAINT:
You do NOT have reliable knowledge of exact page boundaries. You MUST behave conservatively and avoid spoilers at all costs.

ANTI-SPOILER RULES (STRICT) & UNDER-SHOOT BIAS:
- If you are not 100% certain an event occurs within this page range, DO NOT include it
- If an event might occur slightly after this range, DO NOT include it
- It is better to OMIT real events than to include a future spoiler
- Avoid including famous or major scenes unless you are absolutely certain they occur within this range
- UNDER-SHOOT: While the target is ${toPct}% of the book, aim your timeline for the ${safeTargetPct}% mark. A slightly outdated recap is infinitely better than a single spoiler.

SCOPE:
- Include ONLY events that clearly occur between ${rangeStart} and ${currentPage}
- If fromPage > 0, DO NOT include anything before page ${rangeStart}
- STOP strictly at page ${currentPage} — do not continue into the next scene

GUIDELINES:
- Work from general story progression, NOT full reconstruction of the entire book
- Focus on grounded, local events rather than big-picture arcs
- Prefer smaller, confirmed interactions over major turning points

MANDATORY SELF-CHECK:
For each event, ask yourself: "Am I completely certain this happens before or within page ${currentPage}?"
- If NO → REMOVE the event
- If UNSURE → REMOVE the event
- Only include HIGH-CONFIDENCE events

OUTPUT FORMAT (JSON OUTPUT):

output the JSON object. Do not wrap the JSON in code fences — emit it as raw text on its own lines.

{
  "chapters_covered": ["<chapter name/number or approximate section>", "..."],
  "key_events": ["<detailed event description, strictly within range>", "..."],
  "active_characters": ["<character name and their role so far>", "..."],
  "current_conflicts": "<unresolved tensions and open questions as of page ${currentPage}>",
  "mood": "<the emotional tone and atmosphere at this point in the story>",
  "confidence_level": "<high | medium | low based on how certain you are about staying within range>"
}`;
};
