# Feature Specification: Community Reader Profiles

**Feature Branch**: `020-community-profiles`  
**Created**: 2026-05-02  
**Status**: Draft  
**Input**: User description: "Create the BookHero community foundation: public reader profiles with granular privacy controls."

## Clarifications

### Session 2026-05-02

- Q: How should follower-only privacy work while the full follow feature is out of scope? -> A: Add a minimal follow relationship now only for privacy evaluation; no follower list UI beyond what profile preview/testing needs.
- Q: How should progress visibility differ from currently reading visibility? -> A: Progress visibility controls aggregate stats only; currently reading visibility controls active book titles, covers, and page details.
- Q: What happens to old usernames when a user changes their username? -> A: Usernames can change freely; old usernames become available immediately.
- Q: Which lexicon entries appear as public lexicon highlights? -> A: Lexicon highlights show recently mastered words only.
- Q: How should hidden public profile sections be represented in profile read payloads? -> A: Profile reads return only allowed sections; hidden sections are omitted with no reason codes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create A Public Reader Profile (Priority: P1)

A signed-in reader can claim a current public username and create a reader-facing profile with a
display name, avatar URL, and short bio. The profile lets the reader express identity without
changing the existing private Profile page experience.

**Why this priority**: Public identity is the foundation for every later community feature,
including follows, feeds, reading together, and discovery.

**Independent Test**: Starting from an account with no public profile, create a profile with a
valid username, display name, avatar URL, and bio, then reload the app and confirm the profile
remains editable and previewable while the existing private Profile page still works.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no public profile, **When** they submit a valid username,
   display name, avatar URL, and bio, **Then** the profile is created and can be previewed.
2. **Given** a signed-in user editing their profile, **When** they save a bio longer than 160
   characters, **Then** the save is rejected with a clear message and no partial update occurs.
3. **Given** a signed-in user choosing a username, **When** the username contains spaces,
   uppercase letters, or unsupported symbols, **Then** the user sees URL-safe username guidance
   before or during submission.
4. **Given** a user changes from one valid username to another, **When** the change succeeds,
   **Then** the old username no longer resolves to that profile and can be claimed by another
   user.

---

### User Story 2 - Control Profile Privacy (Priority: P1)

A reader can control which parts of their reader identity are visible to others. The user can
make the whole profile non-public, or keep the profile visible while separately controlling
progress, currently reading, lexicon highlights, and Reader DNA visibility.

**Why this priority**: Reading identity is social, but reading behavior can be sensitive.
Granular privacy is required before any profile is safely shareable.

**Independent Test**: Change each visibility setting, preview the profile as self and as
another signed-in user, and confirm the hidden sections disappear while allowed sections remain.

**Acceptance Scenarios**:

1. **Given** a user with a public profile, **When** they set progress visibility to nobody,
   **Then** another signed-in user cannot view aggregate reading progress stats on that profile.
2. **Given** a user with a public profile, **When** they set Reader DNA visibility to everyone,
   **Then** another signed-in user can view the public Reader DNA summary if profile-level
   visibility allows it.
3. **Given** a user with a public profile, **When** they turn the whole profile non-public,
   **Then** other users cannot view any public profile sections except a clear unavailable state.
4. **Given** a user changing multiple privacy settings, **When** they save, **Then** all chosen
   privacy settings persist together and the preview reflects them.

---

### User Story 3 - View Another Reader's Allowed Profile (Priority: P2)

A signed-in reader can open another user's profile by username and see only the sections that
the profile owner has allowed for the viewer relationship. Hidden sections do not reveal counts,
titles, words, or placeholders that expose private data.

**Why this priority**: The community foundation is not useful unless other readers can safely
view a public-facing profile.

**Independent Test**: Create two signed-in users with different visibility settings, then view
one profile from the other account and verify every visible and hidden section matches the
owner's settings.

**Acceptance Scenarios**:

1. **Given** User A has a public profile with currently reading visible to everyone, **When**
   User B opens User A's profile, **Then** User B sees User A's current reading summary.
2. **Given** User A has lexicon visibility set to nobody, **When** User B opens User A's
   profile, **Then** User B cannot see mastered-word highlights, counts, words, or source books.
3. **Given** User A blocks User B through future block data, **When** User B opens User A's
   profile, **Then** User B sees the same unavailable state as a private or inaccessible profile.

---

### User Story 4 - Handle Username Conflicts Clearly (Priority: P2)

A reader receives immediate, understandable feedback when a desired username is unavailable,
invalid, or reserved, so they can choose another one without guessing.

**Why this priority**: Usernames are the stable public identity key. Confusing username errors
would make onboarding feel brittle and unsafe.

**Independent Test**: Attempt to claim an already-used username with different casing and
confirm the duplicate is rejected with a clear message.

**Acceptance Scenarios**:

1. **Given** User A owns username `ricardo`, **When** User B tries to claim `Ricardo`,
   **Then** the attempt is rejected as a duplicate.
2. **Given** a user enters a reserved or invalid username, **When** they submit, **Then** the
   error explains the allowed username format.

### Edge Cases

- A username is entered with uppercase letters: it is normalized for uniqueness and URLs while
  preserving a clean display elsewhere.
- A username differs only by case from an existing username: it is rejected as unavailable.
- A profile owner changes their username: the old username becomes available immediately and
  does not redirect to the new username.
- A profile owner makes their whole profile non-public: section-level privacy settings are
  retained for later but no sections are exposed to other users.
- A viewer is not signed in: public profile viewing is unavailable for this first foundation
  feature.
- A viewer is not allowed to see a section: the section is omitted from the public profile
  payload without a reason code.
- A viewer is blocked by the profile owner, or has blocked the profile owner: the profile is
  treated as unavailable.
- A profile references current reading, mastered lexicon words, or Reader DNA data that does
  not exist yet: the section is omitted without showing an error.
- A profile owner deletes or clears an avatar URL: the public profile falls back to initials or
  a neutral avatar state.
- Existing private profile data changes after a public profile is created: allowed public
  sections reflect the latest available private data without exposing hidden sections.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a signed-in user to create one public reader profile tied
  to their account.
- **FR-002**: The system MUST allow the profile owner to edit username, display name, avatar
  URL, bio, whole-profile public status, and section-level visibility settings.
- **FR-003**: The system MUST enforce a maximum bio length of 160 characters.
- **FR-004**: The system MUST enforce username uniqueness regardless of letter casing.
- **FR-005**: The system MUST enforce URL-safe usernames using lowercase letters, numbers,
  hyphens, and underscores, with no spaces.
- **FR-006**: The system MUST reject invalid, duplicate, or reserved usernames with clear
  user-facing error messages.
- **FR-006a**: The system MUST allow profile owners to change usernames after creation.
- **FR-006b**: The system MUST make a user's previous username available immediately after a
  successful username change, with no redirect or reservation history.
- **FR-007**: The system MUST support these visibility choices for progress: everyone,
  followers, and nobody.
- **FR-008**: The system MUST support these visibility choices for currently reading:
  everyone, followers, and nobody.
- **FR-009**: The system MUST support these visibility choices for lexicon highlights:
  everyone, followers, and nobody.
- **FR-010**: The system MUST support these visibility choices for Reader DNA: everyone,
  followers, and nobody.
- **FR-011**: The system MUST default sensitive section visibility to nobody for newly created
  profiles unless the user explicitly chooses otherwise.
- **FR-012**: The system MUST allow the profile owner to preview their profile as themselves
  and as another signed-in viewer would see it.
- **FR-013**: The system MUST allow another signed-in user to view a profile by username when
  the profile is public and not blocked.
- **FR-014**: The system MUST hide each profile section from viewers who are not allowed by
  the section's visibility rule.
- **FR-015**: The system MUST avoid exposing hidden profile data through counts, placeholder
  text, section labels, source titles, or partial records.
- **FR-016**: Public profile read payloads MUST include only sections the viewer is allowed to
  see and MUST omit hidden sections without returning reason codes.
- **FR-017**: The system MUST treat follower-only sections as hidden until the viewer is known
  to follow the profile owner.
- **FR-018**: Progress visibility MUST control aggregate reading stats only and MUST NOT reveal
  active book titles, covers, page numbers, or currently reading state.
- **FR-019**: Currently reading visibility MUST control active book titles, covers, current
  page, total pages, and percent-complete details.
- **FR-020**: Lexicon highlights MUST include recently mastered words only and MUST NOT expose
  unmastered recent additions.
- **FR-021**: The lexicon highlights payload MUST omit the lexicon section when the profile
  owner has no mastered words available for public display.
- **FR-022**: The system MUST include block compatibility so blocked viewer-owner pairs cannot
  view each other's public profile payloads once block records exist.
- **FR-023**: The system MUST include a minimal follow relationship needed to evaluate
  follower-only privacy settings in this feature.
- **FR-024**: The system MUST NOT require follower list, follower count, follow suggestions, or
  follow management UI beyond what is needed for owner preview and privacy validation.
- **FR-025**: The system MUST preserve existing private Profile page behavior and private
  profile data calculations.
- **FR-026**: Backend additions MUST be additive and must not rename or break existing profile,
  library, progress, lexicon, Reader DNA, or stats contracts.
- **FR-027**: Public profile read payloads MUST use a stable contract suitable for both the PWA
  and a future native iOS client.
- **FR-028**: Server-side authorization MUST enforce profile visibility, section visibility,
  follower-only visibility, and blocking rules.
- **FR-029**: Direct table reads by ordinary signed-in users MUST NOT leak private profile
  sections that are only intended for owner or authorized public profile payloads.
- **FR-030**: All profile lookup, account join, privacy evaluation, and future block/follow
  relationship paths MUST be designed for indexed access.
- **FR-031**: The public profile view MUST show an unavailable state when a profile is private,
  missing, blocked, or otherwise inaccessible.

### Key Entities *(include if feature involves data)*

- **Public Reader Profile**: A user's public community identity. Includes account owner,
  current username, display name, avatar URL, bio, whole-profile public status, and
  creation/update timestamps. Previous usernames are not retained as public aliases.
- **Profile Privacy Settings**: Section-level visibility choices for progress, currently
  reading, lexicon highlights, and Reader DNA. Progress refers to aggregate reading stats only;
  currently reading refers to active book identity and page-level details. Lexicon highlights
  refer to recently mastered words only. Each setting supports everyone, followers, and nobody.
- **Profile Viewer Relationship**: The relationship used to decide what a viewer may see. It
  includes self, signed-in non-follower, follower, blocked, and blocking states.
- **Public Profile Payload**: The safe profile summary returned for display to another user.
  It includes only allowed sections, omits hidden sections without reason codes, and never
  includes hidden private source data.
- **Block Compatibility Record**: A viewer-owner relationship marker used to prevent profile
  visibility in either direction once blocking exists.
- **Minimal Follow Relationship**: An asymmetric viewer-owner relationship used only to
  evaluate follower-only profile privacy in this feature. It supports privacy checks and test
  setup, but not follower lists, follower counts, suggestions, or full follow management UI.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can create a public reader profile in under 2 minutes.
- **SC-002**: 100% of username duplicate attempts using different letter casing are rejected
  with a clear user-facing error.
- **SC-003**: A user can update all four section-level privacy settings and see the preview
  reflect the new settings within one save-and-refresh cycle.
- **SC-004**: A second signed-in user sees only the sections allowed by the profile owner's
  privacy settings across progress, currently reading, lexicon highlights, and Reader DNA.
- **SC-005**: Hidden sections expose no private titles, pages, percentages, words, counts, or
  Reader DNA labels during public profile viewing, and progress visibility never reveals active
  book identity unless currently reading visibility also allows it.
- **SC-005a**: Public profile reads omit hidden sections without reason codes in 100% of
  privacy-denied section cases.
- **SC-006**: Existing private Profile page flows continue to load and display the same private
  stats, Reader DNA, and lexicon-derived information after the feature is enabled.
- **SC-007**: Public profile lookup by username succeeds for valid public profiles and shows
  an unavailable state for private, missing, or blocked profiles.

## Assumptions

- Public profile viewing is limited to signed-in users for this first community foundation.
- New profiles default to public identity being enabled only after explicit creation, while
  sensitive reading sections default to nobody until the user opts in.
- Follower-only privacy is backed by a minimal follow relationship in this feature, limited to
  privacy evaluation and validation rather than the full follow graph experience.
- Blocking UI is out of scope, but block-compatible data and server-side checks are required
  now so later block records immediately affect public profile reads.
- Avatar upload and image storage are out of scope; avatar is represented as a URL.
- Public profile payloads may summarize existing private data, but this feature does not change
  how private Reader DNA, lifetime stats, current reading, or lexicon data are generated.
