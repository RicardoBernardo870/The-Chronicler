# Feature Specification: Community Follows And Blocks

**Feature Branch**: `022-community-follows-blocks`  
**Created**: 2026-05-03  
**Status**: Draft  
**Input**: User description: "Add the BookHero asymmetric follow graph and blocking system."

## Clarifications

### Session 2026-05-03

- Q: Who can view follower and following lists for a visible profile? -> A: Social lists are visible to signed-in users who can view the profile.
- Q: What happens to existing follows when a block is created? -> A: Remove follow relationships in both directions.
- Q: How can users unblock someone once blocked users disappear from normal surfaces? -> A: Include a blocked-users management list.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Follow A Reader (Priority: P1)

A signed-in reader can discover another public reader profile and follow that reader to keep track of their reading identity and future community activity.

**Why this priority**: Following is the foundation for the community graph. Without it, later feed, discovery, and reading-together features have no trusted social context.

**Independent Test**: Can be fully tested by finding a second reader, following them, seeing the following state update, then unfollowing them and seeing the state return to not-following.

**Acceptance Scenarios**:

1. **Given** a signed-in user is viewing another visible reader profile, **When** the user selects Follow, **Then** the profile shows the viewer is following that reader and the relevant counts update within 1 second.
2. **Given** a signed-in user already follows another reader, **When** the user selects Unfollow, **Then** the follow relationship is removed and counts update within 1 second.
3. **Given** a signed-in user views their own profile, **When** the profile actions are displayed, **Then** no self-follow action is available.

---

### User Story 2 - Search And View Reader Lists (Priority: P1)

A signed-in reader can search for other readers by username or display name and can open follower/following lists when profile visibility allows it.

**Why this priority**: Users need a low-friction way to find people before the follow graph is useful, and counts/lists make profiles feel alive without requiring a full activity feed.

**Independent Test**: Can be tested by creating multiple public profiles, searching by username/display name fragments, and opening follower/following lists from a visible profile.

**Acceptance Scenarios**:

1. **Given** matching public profiles exist and neither user blocks the other, **When** a signed-in user searches by username or display name, **Then** matching visible readers appear with enough profile context to choose one.
2. **Given** a signed-in user can view a profile, **When** the user opens followers or following, **Then** the list shows visible readers with pagination or progressive loading.
3. **Given** a profile is not visible to the viewer, **When** the viewer searches or opens lists, **Then** the hidden profile and its relationship entries are not exposed.

---

### User Story 3 - Block A Reader (Priority: P1)

A signed-in reader can block another user so both users are hidden from each other across search, profiles, lists, and future community surfaces.

**Why this priority**: Blocking is a safety and privacy requirement for any social graph and must exist before follow-based community surfaces expand.

**Independent Test**: Can be tested by blocking another reader, confirming both users no longer see each other in search/profile/list surfaces, then unblocking and confirming normal visibility returns when other privacy rules allow it.

**Acceptance Scenarios**:

1. **Given** a signed-in user is viewing another reader profile, **When** the user blocks that reader, **Then** any existing follow relationship in either direction is removed and both users stop seeing each other in community surfaces.
2. **Given** user A has blocked user B, **When** user B searches for user A or attempts to view user A's profile, **Then** user A is not visible to user B.
3. **Given** user A has blocked user B, **When** user A opens their blocked-users management list and unblocks user B, **Then** visibility may resume according to each user's profile privacy and no previous follow is silently restored.

---

### User Story 4 - Reusable Interaction Safety (Priority: P2)

Future community features can determine whether two users may interact through one consistent rule so blocking and profile visibility are applied uniformly.

**Why this priority**: The follow graph will later power feeds, reading circles, and social lexicon features. A reusable interaction rule prevents each feature from inventing its own privacy behavior.

**Independent Test**: Can be tested by checking the interaction decision for allowed, blocked, self, hidden-profile, and normal-public-profile pairs.

**Acceptance Scenarios**:

1. **Given** two users have no block relationship and applicable profiles are visible, **When** the interaction rule is evaluated, **Then** the result permits the relationship or list read requested by the feature.
2. **Given** either user has blocked the other, **When** the interaction rule is evaluated, **Then** the result denies interaction in both directions.
3. **Given** a user attempts to create a relationship with themselves, **When** the interaction rule is evaluated, **Then** the result denies the action.

### Edge Cases

- A user tries to follow themselves.
- A user tries to follow a private, hidden, or blocked profile.
- Two users follow each other and one blocks the other.
- Repeated follow, unfollow, block, or unblock actions are submitted rapidly.
- A username or display name search has zero visible matches.
- A user wants to unblock someone who no longer appears in search or profile surfaces.
- A profile changes visibility after followers already exist.
- A user is deleted or loses access while another user is viewing relationship lists.
- A blocked user appears in historical data that future community features might query.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to follow another visible reader profile.
- **FR-002**: Users MUST be able to unfollow a reader they currently follow.
- **FR-003**: The system MUST prevent users from following themselves.
- **FR-004**: The system MUST prevent duplicate follow relationships between the same follower and followed reader.
- **FR-005**: Users MUST be able to block another user.
- **FR-006**: Users MUST be able to unblock a user they previously blocked.
- **FR-006a**: Users MUST be able to view and manage a blocked-users list for their own account.
- **FR-007**: Blocking MUST hide both users from each other in reader search, profile viewing, followers lists, following lists, and future community surfaces that use the shared interaction rule.
- **FR-008**: Blocking MUST remove any existing follow relationships in both directions between the blocker and blocked user, and unblocking MUST NOT silently restore those previous follow relationships.
- **FR-009**: Users MUST be able to search visible reader profiles by username and display name.
- **FR-010**: Reader search results MUST exclude profiles the viewer cannot see because of public visibility, privacy restrictions, or blocking.
- **FR-011**: Users MUST be able to view follower and following counts on visible profiles.
- **FR-012**: Signed-in users MUST be able to view followers and following lists when the target profile is visible to the viewer and blocking rules allow it.
- **FR-013**: Followers and following lists MUST exclude users hidden by blocking, deleted accounts, or profile visibility rules.
- **FR-014**: Follow counts MUST remain correct after repeated follow, unfollow, block, and unblock actions.
- **FR-015**: Follow counts MUST be available without requiring an expensive recount every time a profile is viewed.
- **FR-016**: The system MUST expose a single reusable decision for whether two users may interact or see each other in community surfaces.
- **FR-017**: Only the acting signed-in user MUST be able to create or remove their own follows and blocks.
- **FR-018**: Relationship changes MUST provide clear success, already-done, or not-allowed outcomes so the client can show stable UI without guessing.
- **FR-019**: The feature MUST remain compatible with existing public profile privacy controls and must not expose private profile sections through follow/search/list surfaces.
- **FR-020**: Relationship and block behavior MUST be suitable for reuse by future mobile clients without relying on private client-only rules.

### Key Entities

- **Follow Relationship**: Represents one user following another user. Key attributes include follower, followed reader, and creation time. The relationship is asymmetric and unique per pair.
- **Block Relationship**: Represents one user blocking another user. Key attributes include blocker, blocked user, and creation time. Blocks apply in both directions for visibility and interaction decisions.
- **Reader Profile Search Result**: A visible summary of a reader profile returned during search. It includes public identity fields and follow state when allowed.
- **Follow Counts**: The follower and following totals shown on a profile. Counts must stay consistent with follow and block changes.
- **Interaction Eligibility**: A reusable yes/no result that determines whether two users can see or interact with each other on community surfaces.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of follow and unfollow actions show updated state to the acting user within 1 second.
- **SC-002**: 95% of reader searches with up to 50 visible matches return usable results within 1 second.
- **SC-003**: Blocked users are absent from search, profile, follower, and following surfaces in 100% of tested blocked-pair cases.
- **SC-004**: Repeated follow/unfollow actions against the same profile do not create duplicate relationships or incorrect counts in 100% of tested retry cases.
- **SC-005**: Users are prevented from following themselves in 100% of tested self-action cases.
- **SC-006**: A future community feature can use one documented interaction rule to decide whether two users may interact, with no feature-specific blocking exceptions required.
- **SC-007**: Users can unblock a previously blocked user from account settings or equivalent blocked-users management within 30 seconds.

## Assumptions

- This feature depends on the existing public reader profile foundation, including usernames, display names, whole-profile visibility, and profile privacy controls.
- Reader search is available only to signed-in users.
- Follower and following lists are visible to signed-in users who can view the target profile.
- Follows are asymmetric and do not require approval in this release.
- Follow and block lists are scoped to community-visible profile summaries, not private reading data.
- Blocked-users management is private to the signed-in account owner.
- Follow counts should reflect only active follow relationships; blocking removes follows rather than hiding retained relationships.
- User-facing UI can be minimal for the current app, but the behavior and data contracts should be stable enough for future mobile clients.
- Activity feed, notifications, recommendations, and reading circles will consume this graph later but are not part of this feature.
