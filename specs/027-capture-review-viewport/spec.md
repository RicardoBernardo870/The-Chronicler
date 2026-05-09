# Feature Specification: Capture Review Viewport

**Feature Branch**: `027-capture-review-viewport`  
**Created**: 2026-05-09  
**Status**: Draft  
**Input**: User description: "Improve the mobile capture page experience so that after a user presses the capture button, the interface immediately transitions into a full-screen review viewport instead of leaving the user lower on the page or requiring them to scroll to find the next action. The capture flow must remain intentionally limited: the user can capture exactly one image, review it, and then either confirm/use that captured image or cancel/retake by returning to the camera state. The user must not be able to capture multiple images in one flow, queue additional captures, or generate a recap directly from this screen. The full-screen review state should make the captured image the primary focus of the mobile viewport, with the available actions always visible without scrolling. The primary action should confirm the captured image, while the secondary action should cancel the capture and return the user to the prior camera/capture state. The design should feel clear, focused, and mobile-friendly, especially for thumb reach and small viewport sizes. The feature should preserve the existing capture functionality and permissions behavior while improving the post-capture decision moment. It should handle failed captures, camera permission issues, and small-screen layouts gracefully. Success is measured by users being able to capture, review, and either confirm or cancel without scrolling on mobile, with no path to multi-image capture or recap generation from the capture page."

## Clarifications

### Session 2026-05-09

- Q: What should happen if the user uses mobile back navigation while the full-screen review is open? -> A: Mobile back navigation cancels the reviewed image and returns to the camera state.
- Q: Is this capture review improvement mobile-only or cross-device? -> A: Mobile-only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review One Capture Without Scrolling (Priority: P1)

As a reader capturing a page image on mobile, I want the app to immediately show my captured image in a focused full-screen review state so I can decide whether to use it or cancel without scrolling.

**Why this priority**: This is the core usability improvement. The post-capture decision must be visible immediately because the current scroll-dependent interaction hides the available actions at the exact moment the user needs them.

**Independent Test**: Can be fully tested on a mobile viewport by starting a capture, pressing the capture button, and verifying that the captured image and both available actions are visible in the current viewport without scrolling.

**Acceptance Scenarios**:

1. **Given** the camera capture screen is ready, **When** the user presses the capture button, **Then** the screen transitions to a full-screen review state showing the captured image as the main content.
2. **Given** the mobile user is in the full-screen review state, **When** the review state appears, **Then** the confirm action and cancel/retake action are both visible without requiring any scrolling.
3. **Given** the user is in the full-screen review state on a small mobile viewport, **When** the user holds the device normally, **Then** the available actions remain reachable and do not obscure the captured image's essential content.

---

### User Story 2 - Confirm the Captured Image (Priority: P1)

As a mobile reader who is satisfied with the captured image, I want to confirm that single image so the app can continue with the existing capture result behavior.

**Why this priority**: Confirming the image is the primary successful outcome of the capture flow and must remain clear, immediate, and limited to the single reviewed image.

**Independent Test**: Can be fully tested by capturing one image, confirming it from the review state, and verifying that the app accepts only that image and exits the review decision point according to the existing flow.

**Acceptance Scenarios**:

1. **Given** the user is reviewing a captured image, **When** the user selects the primary confirm action, **Then** the app accepts that captured image and continues the existing post-confirmation flow.
2. **Given** the user has confirmed a captured image, **When** the confirmation completes, **Then** the user is not offered a way to add another capture from the capture page.

---

### User Story 3 - Cancel or Retake a Capture (Priority: P2)

As a mobile reader who is not satisfied with the captured image, I want to cancel the reviewed capture and return to the camera state so I can decide whether to try again or leave.

**Why this priority**: Users need a safe escape from a poor capture, and that action should be just as visible as confirm while preserving the one-image flow.

**Independent Test**: Can be fully tested by capturing one image, choosing the cancel/retake action, and verifying that the captured image is discarded and the camera state returns.

**Acceptance Scenarios**:

1. **Given** the user is reviewing a captured image, **When** the user selects the cancel/retake action, **Then** the app discards the reviewed capture and returns to the previous camera capture state.
2. **Given** the user returns to the camera state after canceling, **When** the camera state is shown, **Then** the user sees the normal single-capture controls and no queued image remains.
3. **Given** the mobile user is reviewing a captured image, **When** the user uses mobile back navigation, **Then** the app discards the reviewed capture and returns to the previous camera capture state.

---

### User Story 4 - Preserve Existing Capture Readiness and Error Handling (Priority: P3)

As a mobile reader using camera capture, I want existing permission, readiness, and failure behaviors to remain understandable so the improved review state does not make capture errors harder to recover from.

**Why this priority**: The UX change should improve the successful post-capture path while preserving known behavior for camera access, capture failure, and unavailable camera states.

**Independent Test**: Can be fully tested by exercising camera permission denied, camera unavailable, and capture failure states and verifying that users receive clear recovery options without entering a broken review state.

**Acceptance Scenarios**:

1. **Given** camera permission is denied or unavailable, **When** the user reaches the capture page, **Then** the app shows the existing permission or availability guidance and does not show the review state.
2. **Given** an image capture fails, **When** the app cannot produce a captured image, **Then** the user remains in or returns to the camera state with a clear failure message and no hidden off-screen actions.

### Edge Cases

- The captured image is unusually tall, wide, rotated, or visually dense.
- The user captures on a very small mobile viewport where action placement could overlap image content.
- The user changes orientation while reviewing the captured image.
- The user attempts to scroll during review.
- The user presses capture multiple times quickly.
- The user uses mobile back navigation during review.
- The user closes the capture page during review.
- Camera permission is revoked after the capture page has already loaded.
- The capture succeeds visually but the resulting image cannot be accepted by the existing flow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The mobile capture page MUST transition immediately from the camera capture state to a full-screen review state after one successful image capture.
- **FR-002**: The full-screen review state MUST make the captured image the primary visual focus.
- **FR-003**: The full-screen review state MUST display exactly two user decision actions: confirm/use the capture and cancel/retake the capture.
- **FR-004**: Both review decision actions MUST be visible without requiring the user to scroll.
- **FR-005**: The system MUST allow the user to confirm only the single image currently shown in the review state.
- **FR-006**: The system MUST prevent capturing, queuing, or adding more than one image within this capture flow.
- **FR-007**: The system MUST NOT expose a recap generation action from the capture page or the full-screen review state.
- **FR-008**: The system MUST discard the reviewed capture when the user selects cancel/retake and return the user to the prior camera capture state.
- **FR-009**: The system MUST preserve existing camera permission, camera readiness, and capture failure behaviors.
- **FR-010**: The system MUST keep review actions usable and legible across small mobile viewports and common mobile orientation changes.
- **FR-011**: The system MUST avoid placing review actions where they obscure the user's ability to judge whether the captured image is usable.
- **FR-012**: The system MUST handle rapid repeated capture input so that only one review state and one captured image can be active at a time.
- **FR-013**: The system MUST provide a clear recovery path if the captured image cannot be accepted after review.
- **FR-014**: The system MUST treat mobile back navigation from the full-screen review state as cancel/retake, discarding the reviewed capture and returning the user to the camera capture state.
- **FR-015**: This feature MUST be scoped to the mobile capture experience only.

### Key Entities

- **Captured Image**: The single image produced by the capture action and shown for review before confirmation or cancellation.
- **Capture State**: The pre-review state where the user can access the camera capture experience.
- **Review Decision**: The user's choice to either confirm/use the captured image or cancel/retake it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful mobile captures transition to a review state where confirm and cancel/retake actions are visible without scrolling.
- **SC-002**: Users can complete the path from capture button press to confirm or cancel/retake in 2 taps or fewer after the image is captured.
- **SC-003**: No tested mobile viewport size exposes a path to capture multiple images, queue images, or generate a recap from the capture page.
- **SC-004**: At least 95% of first-time users in usability testing can identify the primary confirm action and secondary cancel/retake action within 3 seconds of capture.
- **SC-005**: Capture failure, camera unavailable, and permission denied scenarios never strand the user in a review state without a captured image.

## Assumptions

- The capture page already has a defined destination or callback for a confirmed image, and this feature preserves that outcome.
- "Cancel/retake" means the reviewed image is discarded and the user returns to the camera capture state rather than leaving the broader reading flow.
- The feature is focused on the post-capture decision moment and does not introduce new capture destinations, recap generation, multi-page capture, storage rules, or AI behavior.
- Desktop and non-mobile capture page changes are out of scope for this feature.
