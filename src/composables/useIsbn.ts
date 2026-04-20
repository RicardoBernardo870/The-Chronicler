import type { BookMetadata } from "@/types";

const OPEN_LIBRARY_URL = "https://openlibrary.org/api/books";
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

// ── Open Library ──────────────────────────────────────────────────────────────

const fetchFromOpenLibrary = async (
  isbn: string,
): Promise<BookMetadata | null> => {
  try {
    const url = `${OPEN_LIBRARY_URL}?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const book = json[`ISBN:${isbn}`];
    if (!book) return null;

    const author = book.authors?.[0]?.name ?? "Unknown Author";
    const totalPages = book.number_of_pages ?? null;
    const coverUrl =
      book.cover?.large ?? book.cover?.medium ?? book.cover?.small ?? null;
    const genre = book.subjects?.[0]?.name ?? null;

    return { title: book.title, author, coverUrl, totalPages, genre };
  } catch {
    return null;
  }
};

// ── Google Books (fallback) ────────────────────────────────────────────────────

const fetchFromGoogleBooks = async (
  isbn: string,
): Promise<BookMetadata | null> => {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
    const url = `${GOOGLE_BOOKS_URL}?q=isbn:${isbn}${apiKey ? `&key=${apiKey}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const item = json.items?.[0];
    if (!item) return null;

    const info = item.volumeInfo;
    const author = info.authors?.[0] ?? "Unknown Author";
    const totalPages = info.pageCount ?? null;
    const coverUrl =
      info.imageLinks?.thumbnail?.replace("http:", "https:") ?? null;
    const genre = info.categories?.[0] ?? null;

    return { title: info.title, author, coverUrl, totalPages, genre };
  } catch {
    return null;
  }
};

// ── Field-by-field merge ──────────────────────────────────────────────────────

const isMissingFields = (result: BookMetadata): boolean =>
  !result.coverUrl ||
  !result.totalPages ||
  !result.genre ||
  result.author === "Unknown Author";

const mergeMetadata = (
  primary: BookMetadata,
  secondary: BookMetadata,
): BookMetadata => ({
  // Title always comes from primary
  title: primary.title,
  // Fill each field from secondary only when primary is missing it
  author:
    primary.author !== "Unknown Author" ? primary.author : secondary.author,
  coverUrl: primary.coverUrl ?? secondary.coverUrl,
  totalPages: primary.totalPages ?? secondary.totalPages,
  genre: primary.genre ?? secondary.genre,
});

// ── Public composable ─────────────────────────────────────────────────────────

export const useIsbn = () => {
  const lookup = async (isbn: string): Promise<BookMetadata | null> => {
    const clean = isbn.replace(/[^0-9X]/gi, "");

    const olResult = await fetchFromOpenLibrary(clean);

    // Open Library returned nothing — full fallback to Google Books
    if (!olResult) return fetchFromGoogleBooks(clean);

    // Open Library has all fields — return immediately, no Google Books call
    if (!isMissingFields(olResult)) return olResult;

    // Open Library returned a partial result — fetch Google Books for gap-filling only
    const gbResult = await fetchFromGoogleBooks(clean);
    if (!gbResult) return olResult;

    // Merge: primary = Open Library, secondary = Google Books (fills gaps only)
    return mergeMetadata(olResult, gbResult);
  };

  return { lookup };
};
