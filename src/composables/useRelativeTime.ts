/**
 * Pure relative-time formatter with coarse human-friendly buckets.
 * No external dependencies — intentionally simple for predictable test output.
 *
 * Buckets:
 *   < 2 min        → "Just now"
 *   2–59 min       → "{n} minutes ago"
 *   same-day hours → "{n} hours ago"
 *   previous day   → "Yesterday"
 *   2–6 days       → "{n} days ago"
 *   ≥ 7 days       → "{n} weeks ago"
 */
export const formatRelative = (date: Date): string => {
  const now = Date.now()
  const deltaMs = now - date.getTime()
  const deltaMin = deltaMs / (1000 * 60)
  const deltaHours = deltaMs / (1000 * 60 * 60)
  const deltaDays = deltaMs / (1000 * 60 * 60 * 24)

  if (deltaMin < 2) return 'Just now'
  if (deltaMin < 60) return `${Math.floor(deltaMin)} minutes ago`

  // Check for "Yesterday" before falling through to hours/days
  const inputDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayDay = new Date()
  todayDay.setHours(0, 0, 0, 0)
  const yesterdayDay = new Date(todayDay.getTime() - 24 * 60 * 60 * 1000)

  if (inputDay.getTime() === yesterdayDay.getTime()) return 'Yesterday'

  if (deltaHours < 24) return `${Math.floor(deltaHours)} hours ago`
  if (deltaDays < 7) return `${Math.floor(deltaDays)} days ago`

  return `${Math.floor(deltaDays / 7)} weeks ago`
}
