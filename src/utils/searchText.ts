/** Accent- and case-insensitive normalization for client-side library search. */
export const normalizeForSearch = (raw: string): string =>
  raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase()
    .trim()
