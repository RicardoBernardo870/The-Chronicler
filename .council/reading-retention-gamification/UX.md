# UX: Reading Retention Gamification

## Personas

**Maya, the Inconsistent Re-entry Reader**

Maya likes reading but loses momentum when work gets loud. She may have one active book, several queued books, or no current book after finishing something weeks ago.

Goal: feel welcomed back and know the smallest useful next action without shame, penalties, or a daily streak obligation.

**Theo, the Multi-book Power Reader**

Theo reads across formats and moods: one novel, one nonfiction book, and several active reading moods. He wants momentum signals that reflect real sessions without pushing him toward fake progress or completion gaming.

Goal: see Reading Pulse across all current books, choose what to continue, and get a crisp celebration when the week is on track.

**Rina, the Casual Weekend Reader**

Rina mostly reads on weekends and does not identify as a habit optimizer. She wants BookHero to feel playful and encouraging, not like another productivity dashboard.

Goal: understand that one or two sessions still count and keep her current book easy to resume.

## Journey: Maya

**Entry point:** Dashboard first thing after login or app open, after roughly two missed weeks.

| User Action | System Response | State |
|-------------|-----------------|-------|
| Opens Dashboard | Reading Pulse card appears below the current book CTA if retention summary loads. It shows this week's confirmed sessions, default goal of 3, and a comeback-friendly headline. | `loading -> ready`, `daysSinceLastSession >= 14`, `sessionsThisWeek = 0` |
| Scans current book area | If there is an active book, primary CTA remains book-contextual: Continue, Resume, or Log progress. | Active book present |
| Taps Continue current book | Existing reading session flow starts. Retention card does not count the session yet. | Session active, count unchanged |
| Saves progress after reading | Progress writes to `reading_progress` and inserts confirmed `progress_history`; retention cache invalidates and revalidates. | Sync pending, then confirmed |
| Returns to Dashboard | Reading Pulse updates to 1/3 sessions and shows a brief comeback celebration such as "Back in the story. That counts." | Confirmed session, local celebration shown once |
| Taps tiny next action | Navigates to current book, recap, or last-session context depending on available data. | Re-entry path |

**Success state:** Maya sees one confirmed session this week, a warm comeback message, and a next action that feels small enough to do again.

**Error states:**

- Retention RPC fails: show the current book CTA normally and a compact "Reading Pulse is taking a breather" retry state; do not block reading.
- Offline progress queued: show optimistic local copy only if available, clearly marked as pending; do not unlock durable achievement or final weekly count until sync/revalidation.
- No active/current book: show empty Dashboard onboarding state with Add Book and Up Next paths; Reading Pulse may show last confirmed session history but no false "start session" shortcut.
- Session start blocked offline: use existing session-start offline behavior and explain that confirmed rhythm updates after reconnection.

**Exit:** Maya leaves via current book, Add Book, Recap/Last Session, or normal Dashboard navigation. No notification prompt appears.

**Integration points:**

- `DashboardPage.vue`: place Reading Pulse after active book hero and before secondary modules.
- `useRetentionSummary.ts`: fetch `get_retention_summary(p_user_id, p_timezone)` through SWR cache.
- `progressStore.updateProgress`: invalidate retention summary after successful `progress_history` insert and after offline queue sync.
- `useActiveBook`: choose the book-contextual CTA and avoid creating a separate gamification flow.
- Existing onboarding states: no-book, queued, active, completed-only states must remain intact.

## Journey: Theo

**Entry point:** Dashboard first thing, with multiple books in progress.

| User Action | System Response | State |
|-------------|-----------------|-------|
| Opens Dashboard | Current active book remains primary. Reading Pulse summarizes confirmed sessions across all books for the local browser week. | `ready`, multi-book |
| Reviews weekly progress | Card shows 0-3+ confirmed sessions toward the editable goal of 3 and active days this week if returned by RPC. | Server-confirmed aggregate |
| Switches focus to another in-progress book | Existing active-book/up-next controls update the hero. Retention card remains book-agnostic unless a nudge references a specific stale book. | Active book changed |
| Completes a session on any book | Retention count increments only after confirmed `progress_history` revalidation. | Confirmed all-book session |
| Hits 3/3 sessions | Dashboard shows a brief celebration such as "Three readings this week. Extremely legal wizardry." Achievement is local v1 only unless future durable achievements exist. | Goal met |
| Opens reward preview | If lore/recap/passport milestones are available, card can point to the next reading-native unlock without implying it is required. | Optional reward preview |

**Success state:** Theo sees that multi-book reading contributes to one weekly rhythm, gets a compact celebration at 3/3, and keeps control over which book to read next.

**Error states:**

- Duplicate or rapid progress saves: weekly count follows server-confirmed session semantics, not button taps or fake session edits.
- Imported completed/currently-reading book: import progress does not count as a reading session and does not trigger gamification celebration.
- Timezone unavailable: pass `UTC` fallback to RPC and avoid copy that promises precise local week boundaries.
- RPC returns stale data after offline sync: show last known SWR state while revalidating; durable unlock copy waits for fresh response.

**Exit:** Theo exits through active book, Up Next, Great Library/Lexicon, Profile, or reward preview. No public ranking, comparison, or challenge enrollment appears in v1.

**Integration points:**

- `get_retention_summary`: counts all confirmed user-scoped `progress_history` sessions within browser-timezone week.
- `useRetentionSummary`: exposes `sessionsThisWeek`, `weeklyGoal`, `goalProgressPct`, `activeDaysThisWeek`, `lastSessionAt`, `daysSinceLastSession`, `nudgeCode`, and optional eligible local achievements.
- `src/domain/retention/rules.ts`: maps summary fields to celebratory/nudge states.
- `HeroBookCard` and in-progress sections: remain the primary book selection surfaces.
- RLS/RPC auth: caller can only retrieve their own retention summary.

## Journey: Rina

**Entry point:** Dashboard on a weekend, with one current book and only one session completed this week.

| User Action | System Response | State |
|-------------|-----------------|-------|
| Opens Dashboard | Reading Pulse shows 1/3 sessions without failure language. Copy validates partial progress. | Light week |
| Reads the nudge | Nudge suggests a tiny action: "One page is a perfectly respectable plot twist." | Encouraging nudge |
| Taps Resume | Opens current book session flow or book detail. | Reading path |
| Saves small progress | Confirmed session updates rhythm to 2/3 after sync. | Confirmed session |
| Dismisses celebration | Celebration disappears and does not block navigation. | Skippable feedback |
| Browses elsewhere | Dashboard modules continue to work normally; gamification is not a mandatory challenge. | Normal app |

**Success state:** Rina understands that small sessions matter, avoids pressure, and gets back to the book.

**Error states:**

- User has only completed books: show completed-only onboarding/import state and suggest Add Book or choose from library; do not manufacture a retention task.
- User misses the weekly goal: next week starts cleanly with supportive copy; no debt, penalty, or make-up requirement.
- User lowers or pauses goal once settings exist: UI respects the edited goal; v1 must not pretend the hardcoded default is permanent.
- User ignores the card: Reading Pulse remains fixed in place and no reminder permission prompt follows.

**Exit:** Rina exits by continuing her book, adding a book, opening completed archive, or ignoring Reading Pulse.

**Integration points:**

- Dashboard component state should support compact, fixed, non-blocking feedback.
- Future Profile settings surface must allow editing weekly session goal once goal is exposed as real configuration.
- Existing completed-only and no-book onboarding states decide the CTA before retention nudges do.

## Alternative Flows and Edge Cases

- **No current book:** Reading Pulse can show historical context only if helpful, but primary action is Add Book or choose from library.
- **Multiple current books:** Sessions from any book count toward the same weekly goal; book-specific nudges may only suggest returning to a stale current book.
- **Missed two weeks:** Show comeback state, not streak break state. Celebrate the next confirmed session as a return win.
- **Offline reading/progress:** UI may show pending progress, but weekly totals, goal completion, and unlocks wait for server sync and retention summary revalidation.
- **Queued offline progress syncs later:** Count sessions in the week determined by confirmed server/RPC semantics using browser timezone input; quietly update count without retroactive celebration if the user is no longer in that context.
- **Completed import:** Does not count as a session, does not trigger recap/lore/passport/session prompts beyond existing import safeguards.
- **Zero fake-session editing:** Users cannot directly edit session count. Corrections happen through legitimate progress/history correction flows if such tools exist later.
- **Timezone failure:** Use UTC fallback and neutral copy; persisted timezone is deferred to preferences.
- **RPC unavailable:** Degrade to normal Dashboard and allow reading. Retention UI should retry without blocking session/progress flows.
- **First week/new user:** Show "Start your first weekly rhythm" with 0/3 only after the user has a current book path; no empty trophy case.
- **Goal reached early:** Continue showing extra confirmed sessions positively without escalating pressure or adding mandatory stretch challenges.

## Business Rules

- Weekly session count is derived only from server-confirmed `progress_history` sessions.
- A confirmed `progress_history` row with `session_start_at` counts as one reading session.
- App opens, Dashboard views, queued offline writes, imported progress, and manual fake count edits do not count.
- Audiobooks are not supported in v1 and do not need separate minute-based session semantics.
- Default weekly goal is 3 sessions/week for v1 prototype.
- Once exposed as a real setting, weekly goal must be editable and the UI must reflect the user's chosen goal.
- Future goal editing belongs in Profile settings.
- Browser timezone is passed into v1 RPC to compute week boundaries; persisted timezone belongs to future preferences.
- RLS and RPC implementation must remain user-scoped.
- Durable weekly totals and unlocks require sync and SWR/RPC revalidation.
- Primary CTA remains book-contextual: Continue, Resume, Log progress, Add Book, or choose from library.
- Tone must be celebratory, encouraging, and medium-humorous.
- Copy must avoid guilt, debt, failure, penalty, public comparison, and daily-streak pressure.
- V1 includes no public rankings, mandatory challenges, push notification prompt, email, or payments.
- Celebrations are brief, specific, and skippable.
- V1 achievements are celebratory copy only, not persistent badge IDs.
- Rewards should reinforce reading comprehension/re-entry: recap, lore, passport, vocabulary, or return-to-book context.

## Open Questions for Product Owner

- Should Reading Pulse appear above or below Last Session on dense mobile screens?
- What exact medium-humor copy boundaries should apply for heavy nonfiction or serious reading topics?
