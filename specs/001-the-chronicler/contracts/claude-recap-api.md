# Contract: Claude Recap API

**Service**: Anthropic Claude API
**Model**: `claude-haiku-4-5-20251001`
**Direction**: Client (Vue app) → Claude API (via Anthropic SDK or server-side proxy)
**Auth note**: The Anthropic API key MUST NOT be exposed in the browser bundle. Calls MUST be
proxied through a Supabase Edge Function or similar serverless handler.

---

## Request

### System Prompt (cached)

```
You are a reading companion for The Chronicler app. Your job is to produce a spoiler-free
three-part briefing for a reader returning to a book.

SPOILER RULE (NON-NEGOTIABLE):
- You MUST NOT reference any events, characters, revelations, or plot points that occur
  AFTER the reader's current progress percentage.
- If you are uncertain whether something falls after their progress point, omit it.

OUTPUT FORMAT:
Respond with a valid JSON object only. No markdown fences, no extra text.
{
  "memory_jogger": "<2-4 sentence summary of recent events at this point in the book>",
  "concept_watchlist": "<bulleted list of active characters and key concepts the reader should keep in mind>",
  "thematic_bridge": "<1-2 sentences describing the current narrative mood and direction>"
}
```

### User Message (not cached)

```
Book: "{title}" by {author}
The reader is currently at {percentage}% ({currentPage} of {totalPages} pages).
Generate their reading briefing now.
```

### SDK Call Shape (TypeScript reference)

```typescript
const stream = await anthropic.messages.stream({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  system: [
    {
      type: 'text',
      text: SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
  ],
  messages: [
    {
      role: 'user',
      content: userMessage,
    },
  ],
});
```

---

## Response

### Success (stream completes)

The accumulated stream content is a valid JSON string matching:

```typescript
interface RecapContent {
  memory_jogger: string      // non-empty
  concept_watchlist: string  // non-empty
  thematic_bridge: string    // non-empty
}
```

### Validation before persist

- Parse JSON from accumulated stream output.
- All three fields MUST be non-empty strings.
- If parsing fails or any field is empty: surface error to user, do NOT persist.

### Error responses

| Scenario | Behavior |
|---|---|
| Network failure | Surface "Recap generation failed. Please try again." |
| API rate limit (429) | Surface "Service busy. Please try again shortly." |
| Partial stream (connection drop) | Discard partial content, surface error |
| Invalid JSON output | Retry once; if still invalid, surface error |

---

## Security Notes

- API key stored server-side only (Supabase Edge Function environment variable).
- The Vue client calls the Edge Function endpoint, not the Claude API directly.
- Edge Function validates the user's Supabase JWT before forwarding to Claude.
- No book content or user personal data beyond title/author/progress is sent to Claude.
