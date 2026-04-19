/**
 * Passport Summary prompt — narrative paragraph for a completed book.
 *
 * BYTE-EQUIVALENT copy of the legacy `buildPassportSummaryPrompt` in the
 * pre-refactor index.ts. Do NOT edit this prompt in feature 008-recap-hardening;
 * behavioral changes to the Passport mode are explicitly out of scope.
 */
export const buildPassportSummaryPrompt = (title: string, author: string): string =>
  `You are a book chronicler celebrating a reader's completion of "${title}" by ${author}. Write a flowing, personal narrative summary of this book for the reader who has just finished it.

The summary should:
- Be a single cohesive paragraph of 300–500 words
- Cover the full arc of the story from beginning to end
- Highlight the most memorable moments, characters, and themes
- Capture the emotional journey and what made this book special
- Feel warm and celebratory — this reader just finished a book!
- No spoiler constraints — they have read the entire book

Write ONLY the narrative paragraph. No JSON, no headings, no bullet points, no extra text.`
