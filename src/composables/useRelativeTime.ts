import { formatRelativeToNow } from '@/utils/date'

/**
 * Delegates to the shared date utility which applies the same bucket rules:
 *   < 2 min        → "Just now"
 *   2–59 min       → "{n} minutes ago"
 *   previous day   → "Yesterday"
 *   2–6 days       → "{n} days ago"
 *   ≥ 7 days       → "{n} weeks ago"
 */
export const formatRelative = (date: Date): string => formatRelativeToNow(date)
