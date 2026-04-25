import {
  formatDistanceToNow,
  format,
  parseISO,
  differenceInSeconds,
  differenceInHours,
  differenceInDays,
  isSameDay,
  startOfDay,
  compareDesc,
} from 'date-fns'

const toDate = (date: Date | string): Date =>
  typeof date === 'string' ? parseISO(date) : date

/**
 * "Just now" for < 2 min, then delegates to date-fns formatDistanceToNow.
 * Examples: "Just now", "3 minutes ago", "Yesterday", "2 days ago", "1 week ago"
 */
export const formatRelativeToNow = (date: Date | string): string => {
  const d = toDate(date)
  const secondsAgo = differenceInSeconds(new Date(), d)
  if (secondsAgo < 120) return 'Just now'
  return formatDistanceToNow(d, { addSuffix: true })
}

/**
 * "Apr 24, 2026" — locale-stable via date-fns format tokens.
 */
export const formatShortDate = (isoStr: string): string =>
  format(parseISO(isoStr), 'MMM d, yyyy')

/**
 * "2026-04-24" — ISO calendar day string.
 */
export const formatISODate = (date: Date): string =>
  format(date, 'yyyy-MM-dd')

/**
 * Positive when later > earlier.
 */
export const diffInSeconds = (
  later: Date | string,
  earlier: Date | string,
): number => differenceInSeconds(toDate(later), toDate(earlier))

/**
 * Positive when later > earlier.
 */
export const diffInHours = (
  later: Date | string,
  earlier: Date | string,
): number => differenceInHours(toDate(later), toDate(earlier))

/**
 * Positive when later > earlier.
 */
export const diffInDays = (
  later: Date | string,
  earlier: Date | string,
): number => differenceInDays(toDate(later), toDate(earlier))

/**
 * True when both dates fall on the same calendar day.
 */
export const isSameCalendarDay = (
  a: Date | string,
  b: Date | string,
): boolean => isSameDay(toDate(a), toDate(b))

/**
 * Midnight of the given date's calendar day.
 */
export const startOfCalendarDay = (date: Date): Date => startOfDay(date)

/**
 * Returns a new array sorted descending by a date-string field.
 */
export const sortDescByDate = <T>(arr: T[], key: keyof T): T[] =>
  [...arr].sort((a, b) =>
    compareDesc(toDate(a[key] as unknown as string), toDate(b[key] as unknown as string)),
  )
