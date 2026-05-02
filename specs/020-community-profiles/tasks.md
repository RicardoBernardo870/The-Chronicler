# Tasks: Community Reader Profiles

**Input**: Design documents from `/specs/020-community-profiles/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Formal test-file tasks are not included because tests were not explicitly requested in the specification. Validation is covered through SQL smoke checks, PWA manual flows, and `npx.cmd vue-tsc -b`.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the shared backend foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label (`US1`, `US2`, `US3`, `US4`)
- Every task includes an exact repository path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared frontend types, cache keys, and route placeholders before implementing stories.

- [X] T001 Add community profile domain interfaces and RPC payload types in `src/types/index.ts`
- [X] T002 Add community profile SWR cache keys in `src/composables/useCache.ts`
- [X] T003 [P] Create empty community component directory with placeholder exports in `src/components/community/`
- [X] T004 [P] Create initial community profile store skeleton in `src/stores/communityProfile.ts`
- [X] T005 [P] Create initial community profile composable wrapper in `src/composables/useCommunityProfile.ts`
- [X] T006 Add route placeholders for profile edit and public profile pages in `src/router/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the additive Supabase social profile foundation, RLS, indexes, and stable RPC contracts required by every user story.

**Critical**: No user story UI work can be considered complete until this phase is done.

- [X] T007 Create additive Supabase migration for `profile_visibility`, `community_profiles`, `community_profile_privacy`, `follows`, and `blocks` in `supabase/migrations/20260502_community_profiles.sql`
- [X] T008 Add all FK, username, public lookup, follow relationship, and block relationship indexes in `supabase/migrations/20260502_community_profiles.sql`
- [X] T009 Enable RLS on all new community tables with `(select auth.uid())` owner policies in `supabase/migrations/20260502_community_profiles.sql`
- [X] T010 Add minimal follow insert/delete/select policies and block insert/delete/select policies in `supabase/migrations/20260502_community_profiles.sql`
- [X] T011 Add `get_my_community_profile()` RPC with owner-only payload shaping in `supabase/migrations/20260502_community_profiles.sql`
- [X] T012 Add `upsert_my_community_profile(payload jsonb)` RPC with atomic profile/privacy writes and username/bio/visibility validation in `supabase/migrations/20260502_community_profiles.sql`
- [X] T013 Add `is_username_available(p_username text)` RPC with lowercase normalization and current-owner allowance in `supabase/migrations/20260502_community_profiles.sql`
- [X] T014 Add `get_public_profile_by_username(p_username text)` RPC with server-side privacy, follower, and block predicates in `supabase/migrations/20260502_community_profiles.sql`
- [X] T015 Revoke RPC execute from `public` and `anon`, then grant execute to `authenticated` for community RPCs in `supabase/migrations/20260502_community_profiles.sql`
- [X] T016 Document any intentional SQL contract refinements against `contracts/sql-schema.md` and `contracts/rpc-contracts.md` in `specs/020-community-profiles/contracts/`

**Checkpoint**: Database contract is ready; user stories can now be implemented against stable RPCs.

---

## Phase 3: User Story 1 - Create A Public Reader Profile (Priority: P1)

**Goal**: A signed-in reader can create and edit a public profile with current username, display name, avatar URL, and short bio without changing the private Profile page.

**Independent Test**: Create a profile, reload the app, edit fields including username, and confirm the existing `/profile` page still displays private stats/Reader DNA as before.

- [X] T017 [US1] Implement `getMyProfile`, `saveProfile`, and profile mutation state in `src/stores/communityProfile.ts`
- [X] T018 [US1] Implement typed profile form helpers and validation mapping in `src/composables/useCommunityProfile.ts`
- [X] T019 [P] [US1] Create username input component with lowercase normalization and availability state in `src/components/community/UsernameField.vue`
- [X] T020 [P] [US1] Create profile edit page shell using PrimeVue form primitives in `src/pages/CommunityProfileEditPage.vue`
- [X] T021 [US1] Wire profile create/edit form fields and save action in `src/pages/CommunityProfileEditPage.vue`
- [X] T022 [US1] Add profile edit navigation entry from the existing private profile page in `src/pages/ProfilePage.vue`
- [X] T023 [US1] Handle `username_invalid`, `username_taken`, `bio_too_long`, and `visibility_invalid` errors with user-facing messages in `src/pages/CommunityProfileEditPage.vue`
- [X] T024 [US1] Ensure old username becomes available after a username change by using `upsert_my_community_profile` and `is_username_available` in `src/stores/communityProfile.ts`

**Checkpoint**: User Story 1 is independently usable and the private Profile page remains unchanged.

---

## Phase 4: User Story 2 - Control Profile Privacy (Priority: P1)

**Goal**: A reader can set whole-profile public status and section-level visibility for progress, currently reading, lexicon highlights, and Reader DNA.

**Independent Test**: Change every visibility setting, save, reload, and preview as self/other-viewer mode to confirm hidden sections disappear while allowed sections remain.

- [X] T025 [P] [US2] Create reusable privacy visibility controls with PrimeVue Select/Toggle primitives in `src/components/community/ProfilePrivacyControls.vue`
- [X] T026 [US2] Integrate `ProfilePrivacyControls` into `src/pages/CommunityProfileEditPage.vue`
- [X] T027 [US2] Add default sensitive visibility values of `nobody` for new profiles in `src/stores/communityProfile.ts`
- [X] T028 [P] [US2] Create public profile preview component that renders owner and viewer-preview modes in `src/components/community/PublicProfilePreview.vue`
- [X] T029 [US2] Implement preview refresh after privacy saves in `src/composables/useCommunityProfile.ts`
- [X] T030 [US2] Validate progress/currently-reading privacy split in preview rendering in `src/components/community/PublicProfilePreview.vue`
- [X] T031 [US2] Ensure whole-profile non-public state hides all public sections for non-owner preview in `src/components/community/PublicProfilePreview.vue`

**Checkpoint**: User Story 2 privacy controls are independently testable with profile preview.

---

## Phase 5: User Story 3 - View Another Reader's Allowed Profile (Priority: P2)

**Goal**: A signed-in reader can open another profile by username and see only allowed sections, with hidden sections omitted and blocked/private profiles showing a generic unavailable state.

**Independent Test**: With two signed-in users, set different visibility states, create/remove minimal follow/block relationships, and confirm the public profile payload renders only allowed sections.

- [X] T032 [US3] Implement `fetchPublicProfileByUsername` and public payload state in `src/stores/communityProfile.ts`
- [X] T033 [P] [US3] Create public profile display card for identity, stats, current reading, lexicon highlights, and Reader DNA sections in `src/components/community/PublicProfileCard.vue`
- [X] T034 [US3] Create public profile route page with loading, unavailable, and loaded states in `src/pages/PublicProfilePage.vue`
- [X] T035 [US3] Wire `/u/:username` route to `PublicProfilePage` in `src/router/index.ts`
- [X] T036 [US3] Render omitted hidden sections without reason-code UI in `src/components/community/PublicProfileCard.vue`
- [X] T037 [US3] Render aggregate stats without active book identity when only progress visibility allows the viewer in `src/components/community/PublicProfileCard.vue`
- [X] T038 [US3] Render currently reading title, cover, page, total pages, and percentage only when the payload includes `currentlyReading` in `src/components/community/PublicProfileCard.vue`
- [X] T039 [US3] Render recently mastered lexicon words only from `lexiconHighlights` payload in `src/components/community/PublicProfileCard.vue`
- [X] T040 [US3] Add generic unavailable state for missing, private, or blocked profiles in `src/pages/PublicProfilePage.vue`

**Checkpoint**: User Story 3 public viewing is independently testable with two users and visibility changes.

---

## Phase 6: User Story 4 - Handle Username Conflicts Clearly (Priority: P2)

**Goal**: A reader gets clear feedback when a username is invalid, duplicate, reserved, or available.

**Independent Test**: Try to claim an existing username with different casing and confirm the duplicate is rejected with a clear message.

- [X] T041 [US4] Add debounced username availability checking against `is_username_available` in `src/components/community/UsernameField.vue`
- [X] T042 [US4] Display username format guidance for spaces, uppercase input, and unsupported symbols in `src/components/community/UsernameField.vue`
- [X] T043 [US4] Display case-insensitive duplicate messaging for `username_taken` in `src/components/community/UsernameField.vue`
- [X] T044 [US4] Prevent profile save while username validation is pending or invalid in `src/pages/CommunityProfileEditPage.vue`
- [X] T045 [US4] Confirm current owner can keep their existing username while editing other profile fields in `src/stores/communityProfile.ts`

**Checkpoint**: User Story 4 username conflict handling is independently testable from the edit page.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full vertical slice, update docs, and ensure contracts remain stable.

- [X] T046 Run TypeScript project validation with `npx.cmd vue-tsc -b`
- [ ] T047 Apply the validation flow from `specs/020-community-profiles/quickstart.md`
- [X] T048 Run Supabase security and performance advisors after migration and address relevant findings in `supabase/migrations/20260502_community_profiles.sql`
- [X] T049 Confirm existing private profile route behavior at `/profile` remains unchanged in `src/pages/ProfilePage.vue`
- [X] T050 Update community implementation notes in `docs/community-design-notes.md`
- [X] T051 Update feature recent-change context in `AGENTS.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: Starts immediately.
- **Phase 2 Foundational**: Depends on Phase 1 skeleton paths and blocks all story completion.
- **Phase 3 US1**: Depends on Phase 2 RPCs and shared store/composable skeletons.
- **Phase 4 US2**: Depends on US1 edit form and profile save flow.
- **Phase 5 US3**: Depends on Phase 2 public profile RPC and can proceed after shared types/store exist.
- **Phase 6 US4**: Depends on US1 username field and Phase 2 username RPC.
- **Phase 7 Polish**: Depends on all desired stories.

### User Story Dependencies

- **US1 Create Profile (P1)**: MVP entry point; required before user-owned privacy editing is useful.
- **US2 Privacy Controls (P1)**: Builds on US1 edit form; required before safe public viewing.
- **US3 Public Viewing (P2)**: Can use Phase 2 RPC independently, but full validation depends on US2 settings.
- **US4 Username Conflicts (P2)**: Enhances US1 username flow and can be implemented after `UsernameField` exists.

### Within Each User Story

- Store/composable wiring before page integration.
- Reusable components before page-level usage.
- Server-side RPC validation before frontend success states.
- Story checkpoint before starting the next priority when working sequentially.

---

## Parallel Opportunities

- Phase 1 skeleton tasks T003-T005 can run in parallel.
- Phase 2 SQL tasks T011-T014 can be drafted in parallel after tables/RLS shape T007-T010 is decided, but must be merged into one migration carefully.
- US1 component work T019 and page shell T020 can run in parallel after types/store skeletons exist.
- US2 controls T025 and preview component T028 can run in parallel.
- US3 display card T033 can run in parallel with route page T034.

---

## Parallel Example: User Story 3

```text
Task: "Create public profile display card in src/components/community/PublicProfileCard.vue"
Task: "Create public profile route page in src/pages/PublicProfilePage.vue"
Task: "Implement public payload state in src/stores/communityProfile.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1 and Phase 2.
2. Complete US1 so users can create/edit profiles.
3. Complete US2 so sensitive sections are private by default and previewable.
4. Stop and validate profile creation, username changes, and privacy preview before public viewing.

### Incremental Delivery

1. Add backend foundation and owner profile editing.
2. Add privacy controls and preview.
3. Add public profile viewing by username.
4. Add richer username conflict handling.
5. Run quickstart validation and Supabase advisors.

### Final Validation

1. `npx.cmd vue-tsc -b`
2. `specs/020-community-profiles/quickstart.md`
3. Supabase security/performance advisors
4. Manual check that `/profile` private behavior is unchanged
