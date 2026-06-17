// Normalizes book descriptions from external sources for display:
//  - Google Books descriptions sometimes contain light HTML (<p>, <br>, <b>…).
//  - Open Library descriptions often end with a Wikipedia-style attribution
//    footer such as "([source][1])" plus a trailing "[1]: https://…" reference
//    line — the "weird url at the end" we want gone.

const decodeEntities = (text: string): string =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')

export const cleanDescription = (raw: string | null | undefined): string | null => {
  if (!raw) return null

  let text = raw
    // HTML → plain text
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')

  text = decodeEntities(text)

  text = text
    // Open Library inline source marker: "([source][1])"
    .replace(/\(\[source\]\[\d+\]\)/gi, '')
    // Markdown reference-link definitions: "[1]: https://…"
    .replace(/^\s*\[\d+\]:\s*\S+.*$/gim, '')
    // A trailing standalone "Source(s): …" attribution line
    .replace(/\n+\s*sources?\s*:[^\n]*$/i, '')
    // A bare URL left dangling at the very end
    .replace(/\s*https?:\/\/\S+\s*$/i, '')

  // Collapse runaway whitespace introduced by the strips above.
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

  return text || null
}
