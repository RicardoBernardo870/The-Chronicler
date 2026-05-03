# Tasks: Community Follows And Blocks

**Input**: Design documents from `/specs/022-community-follows-blocks/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Formal test-file tasks are not included because the specification does not explicitly request automated tests. Validation is covered by SQL smoke checks, Supabase advisors, `npx.cmd vue-tsc -b`, and the manual quickstart flows.

**Organization**: Tasks are grouped by user story so each follow/block capability can be implemented and validated independently after the shared backend foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`, `US4`)
- Every task includes an exact repository path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared frontend contracts and prepare the additive migration file.

- [X] T001 Create additive migration shell for follow/block graph expansion in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T002 Add community graph response types, cursor list types, relationship reason types, and mutation result types in `src/types/index.ts`
- [X] T003 [P] Create empty Pinia store skeleton for community graph state in `src/stores/communityGraph.ts`
- [X] T004 [P] Create composable wrapper skeleton for graph actions and UI helpers in `src/composables/useCommunityGraph.ts`
- [X] T005 [P] Add cache key names for community search, relationship state, follow lists, and blocked-users list in `src/composables/useCache.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the durable server-side graph foundation that every story depends on.

**Critical**: No user story UI should ship until these backend contracts enforce privacy and blocking server-side.

- [X] T006 Add `community_follow_counts` table with non-negative count checks and RLS enabled in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T007 Add required count, follow-list cursor, block-list cursor, and profile search indexes in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T008 Add fixed-`search_path` helper functions for either-direction block checks and profile visibility checks in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T009 Add canonical interaction helper returning `allowed`, `self`, `blocked`, or `profile_unavailable` in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T010 Add atomic count-maintenance helper and follow insert/delete triggers in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T011 Add profile-create count-row backfill/ensure logic and migration backfill for existing community profiles in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T012 Add block-create cleanup logic that removes follow relationships in both directions in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T013 Add count reconciliation helper for smoke testing and future maintenance in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T014 Add RLS policies for `community_follow_counts` and verify existing `follows`/`blocks` policies use `(select auth.uid())` patterns in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T015 Add authenticated-only grant/revoke statements for all new community graph helpers/RPCs in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T016 Implement cursor encode/decode SQL helpers for relationship list RPCs in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T017 Implement typed Supabase RPC wrapper methods in `src/stores/communityGraph.ts`
- [X] T018 Implement shared loading/error/status helpers in `src/composables/useCommunityGraph.ts`

**Checkpoint**: Server-side graph contracts are private-by-default, indexed, RLS-aware, and callable from the PWA store.

---

## Phase 3: User Story 1 - Follow A Reader (Priority: P1) MVP

**Goal**: A signed-in user can follow and unfollow another visible reader profile, with counts and relationship state updating after server confirmation.

**Independent Test**: Find a second visible reader, follow them, confirm button/count state updates within 1 second, then unfollow and confirm the state returns.

- [X] T019 [US1] Add `get_community_relationship_state(p_target_user_id uuid)` RPC in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T020 [US1] Add idempotent `follow_community_user(p_target_user_id uuid)` RPC in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T021 [US1] Add idempotent `unfollow_community_user(p_target_user_id uuid)` RPC in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T022 [US1] Add `fetchRelationshipState`, `followUser`, and `unfollowUser` actions with cache updates in `src/stores/communityGraph.ts`
- [X] T023 [P] [US1] Create PrimeVue-first `FollowButton` component in `src/components/community/FollowButton.vue`
- [X] T024 [P] [US1] Create `FollowCounts` component in `src/components/community/FollowCounts.vue`
- [X] T025 [US1] Wire relationship state loading into `src/pages/PublicProfilePage.vue`
- [X] T026 [US1] Render follow/unfollow action and follower/following counts in `src/pages/PublicProfilePage.vue`
- [X] T027 [US1] Hide follow action for self-profile and denied relationship states in `src/pages/PublicProfilePage.vue`
- [X] T028 [US1] Add user-facing follow/unfollow error handling and disabled loading states in `src/pages/PublicProfilePage.vue`

**Checkpoint**: User Story 1 is independently usable and fixes the core social graph action path.

---

## Phase 4: User Story 2 - Search And View Reader Lists (Priority: P1)

**Goal**: A signed-in user can search visible readers and open follower/following lists with server-side privacy/block filtering.

**Independent Test**: Search by username/display name, open a visible profile's followers/following lists, page through results, and confirm hidden/blocked users are omitted.

- [X] T029 [US2] Add `search_community_readers(p_query text, p_limit int, p_cursor text)` RPC in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T030 [US2] Add `list_community_followers(p_user_id uuid, p_limit int, p_cursor text)` RPC in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T031 [US2] Add `list_community_following(p_user_id uuid, p_limit int, p_cursor text)` RPC in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T032 [US2] Add `searchReaders`, `fetchFollowers`, and `fetchFollowing` actions with cursor merge behavior in `src/stores/communityGraph.ts`
- [X] T033 [P] [US2] Create `ReaderSearchDialog` with empty/loading/results/no-match/error states in `src/components/community/ReaderSearchDialog.vue`
- [X] T034 [P] [US2] Create `FollowListDialog` with followers/following tabs and cursor load-more behavior in `src/components/community/FollowListDialog.vue`
- [X] T035 [US2] Add reader search entry point to `src/pages/CommunityProfileEditPage.vue`
- [X] T036 [US2] Wire follower/following list entry points from `FollowCounts` into `src/pages/PublicProfilePage.vue`
- [X] T037 [US2] Ensure search and list rows can follow/unfollow visible users through `src/stores/communityGraph.ts`
- [X] T038 [US2] Add concise empty and unavailable states for search/list surfaces in `src/components/community/ReaderSearchDialog.vue` and `src/components/community/FollowListDialog.vue`

**Checkpoint**: User Story 2 is independently testable without activity feed or recommendations.

---

## Phase 5: User Story 3 - Block A Reader (Priority: P1)

**Goal**: A signed-in user can block, unblock, and manage blocked users; blocks remove follows both directions and hide users from community surfaces.

**Independent Test**: Create mutual follows, block the other user, confirm both follows disappear and both users vanish from search/profile/list surfaces, then unblock through blocked-users management.

- [X] T039 [US3] Add idempotent `block_community_user(p_target_user_id uuid)` RPC in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T040 [US3] Add idempotent `unblock_community_user(p_target_user_id uuid)` RPC in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T041 [US3] Add `list_my_blocked_users(p_limit int, p_cursor text)` RPC in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T042 [US3] Add `blockUser`, `unblockUser`, and `fetchBlockedUsers` actions in `src/stores/communityGraph.ts`
- [X] T043 [P] [US3] Create blocked-users management panel in `src/components/community/BlockedUsersPanel.vue`
- [X] T044 [US3] Add block action and confirmation dialog to `src/pages/PublicProfilePage.vue`
- [X] T045 [US3] Render blocked/profile-unavailable state after block actions in `src/pages/PublicProfilePage.vue`
- [X] T046 [US3] Integrate `BlockedUsersPanel` into `src/pages/CommunityProfileEditPage.vue`
- [X] T047 [US3] Ensure search, follower lists, following lists, and relationship cache entries are invalidated after block/unblock in `src/stores/communityGraph.ts`
- [X] T048 [US3] Add user-facing blocked-users empty/loading/error states in `src/components/community/BlockedUsersPanel.vue`

**Checkpoint**: User Story 3 enforces the safety model across all current community surfaces.

---

## Phase 6: User Story 4 - Reusable Interaction Safety (Priority: P2)

**Goal**: Future community features can use one server-side interaction rule instead of duplicating block/privacy logic.

**Independent Test**: Check interaction decisions for allowed, self, blocked, and profile-unavailable target users through the stable RPC.

- [X] T049 [US4] Add `can_community_users_interact(p_target_user_id uuid)` RPC in `supabase/migrations/20260503_community_follows_blocks.sql`
- [X] T050 [US4] Add `canInteract` action and typed reason mapping in `src/stores/communityGraph.ts`
- [X] T051 [US4] Document interaction reason semantics in `specs/022-community-follows-blocks/contracts/rpc-contracts.md`
- [X] T052 [US4] Add future-consumer usage notes for feed/circle/social-lexicon features in `docs/community-speckit-prompts.md`

**Checkpoint**: User Story 4 gives later community features one reusable gate for user-to-user visibility.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate backend safety, frontend type safety, and quickstart behavior.

- [X] T053 Run `npx.cmd vue-tsc -b` and fix TypeScript issues in `src/types/index.ts`, `src/stores/communityGraph.ts`, and community Vue components
- [ ] T054 Run Supabase security advisor after applying the migration and address relevant RLS/grant findings in `supabase/migrations/20260503_community_follows_blocks.sql`
- [ ] T055 Run Supabase performance advisor after applying the migration and address relevant index/query findings in `supabase/migrations/20260503_community_follows_blocks.sql`
- [ ] T056 Execute backend smoke checks from `specs/022-community-follows-blocks/quickstart.md`
- [ ] T057 Execute follow/unfollow, search/list, and block/unblock manual quickstart flows from `specs/022-community-follows-blocks/quickstart.md`
- [ ] T058 Verify existing public profile create/edit behavior remains unchanged in `src/pages/CommunityProfileEditPage.vue` and `src/pages/PublicProfilePage.vue`
- [X] T059 Update recent-change context for community follows/blocks in `AGENTS.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: Starts immediately.
- **Phase 2 Foundational**: Depends on Setup and blocks all user-story UI.
- **US1 Follow A Reader**: Depends on Foundational RPC helpers, counts, RLS, and store wrappers.
- **US2 Search And Lists**: Depends on Foundational and benefits from US1 store relationship actions.
- **US3 Block A Reader**: Depends on Foundational and should be validated against US1/US2 surfaces.
- **US4 Reusable Interaction Safety**: Depends on Foundational helper predicates and can be implemented after US3 block behavior is stable.
- **Polish**: Depends on all desired user stories.

### User Story Dependencies

- **US1 (P1)**: MVP graph action; can ship after Foundational.
- **US2 (P1)**: Can start after Foundational, but row-level follow/unfollow actions depend on US1 store methods.
- **US3 (P1)**: Can start after Foundational, but full validation uses US1/US2 surfaces.
- **US4 (P2)**: Depends on block/profile helper decisions from Foundational and US3 semantics.

### Within Each User Story

- SQL RPCs before store actions.
- Store actions before composables/components.
- Components before page integration.
- Page integration before quickstart validation.

### Parallel Opportunities

- T003, T004, and T005 can run in parallel after T002 is understood.
- T023 and T024 can run in parallel after US1 store contracts exist.
- T033 and T034 can run in parallel after US2 RPC response types exist.
- T043 can run in parallel with T044 after US3 store contracts exist.
- T054 and T055 can be run in parallel after the migration is applied.

---

## Parallel Example: User Story 2

```text
Task: "Create ReaderSearchDialog with empty/loading/results/no-match/error states in src/components/community/ReaderSearchDialog.vue"
Task: "Create FollowListDialog with followers/following tabs and cursor load-more behavior in src/components/community/FollowListDialog.vue"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete US1 follow/unfollow RPCs, store methods, and public profile integration.
3. Validate a two-user follow/unfollow loop and count updates before moving on.

### Incremental Delivery

1. Ship server-side graph foundation with RLS and durable counts.
2. Add follow/unfollow on public profiles.
3. Add reader search and follower/following lists.
4. Add block/unblock and blocked-users management.
5. Add canonical interaction RPC for future community surfaces.
6. Run Supabase advisors and full quickstart validation.

### Risk Controls

- Do not expose broad direct table reads for social data; use RPC payloads.
- Do not rely on client filtering for blocks or profile visibility.
- Do not use offset pagination for social lists.
- Do not restore follows after unblock.
- Keep all backend changes additive so the existing PWA profile feature remains compatible.
