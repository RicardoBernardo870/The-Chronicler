export interface CompletionPromptTarget {
  bookId: string
  bookTitle: string
}

export const crossedCompletionThreshold = (
  previousPercentage: number,
  nextPercentage: number,
): boolean => previousPercentage < 100 && nextPercentage >= 100

export const createCompletionPromptTarget = (
  bookId: string,
  bookTitle: string | null | undefined,
  previousPercentage: number,
  nextPercentage: number,
): CompletionPromptTarget | null => {
  if (!crossedCompletionThreshold(previousPercentage, nextPercentage)) return null

  return {
    bookId,
    bookTitle: bookTitle?.trim() || 'this book',
  }
}
