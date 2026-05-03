# UI Contract: Reading Circles

The first PWA surface should be compact and quiet. It must not interrupt reading or block the
Book Detail page from rendering.

## Book Detail Entry Point

Add a Reading Circles panel/card below the primary progress controls or near the existing
community awareness area.

**Behavior**:

- Loads after core book detail and progress content.
- Hidden when the viewer is signed out or circle data has no relevant rows.
- Shows accepted circles for the current book/work and pending invitations.
- Provides actions to create a circle, accept/decline invitations, and open a circle detail
  dialog.

**PrimeVue guidance**:

- Use `Button` for actions.
- Use `Dialog` for create/detail/invite flows.
- Use `Avatar`, `Tag`, and list markup for members.
- Use `Textarea` for reaction composition with a visible character count.
- Use `InlineMessage` or `Message` for invalid page/progress states.

## Create Circle Flow

Inputs:

- Circle name.
- Eligible followed readers to invite.

Rules:

- Readers are invited, not directly added.
- Submit uses `create_reading_circle`.
- Skipped/unavailable invitees are reported without exposing private reasons beyond safe copy.

## Invitation Flow

Pending invitations addressed to the viewer show accept and decline actions.

Rules:

- Accept uses `respond_to_reading_circle_invitation`.
- If the circle is full or blocked state changed, show a non-destructive error and refresh.
- Decline removes the invitation from the local list after successful RPC response.

## Circle Detail Flow

Displays:

- Circle name and book summary.
- Accepted members.
- Owner-only pending invitations.
- Visible reactions only from `get_visible_circle_reactions`.
- Current-page reaction indicator when visible reactions exist at the viewer's current
  normalized location/page window.

Rules:

- If viewer progress metadata is invalid, show membership/details but disable reaction viewing
  and composition with a concise correction prompt.
- Never render reaction content from realtime payloads unless the payload came from the same
  visibility-safe RPC contract.

## Reaction Composer

Inputs:

- Source page defaults to the viewer's current page.
- Reaction content max 280 characters.

Rules:

- Disable submit for empty content, content over 280 characters, invalid page, missing total
  pages, or page ahead of current progress.
- Server remains authoritative; UI validation is only convenience.
- Successful submit refetches visible reactions.

## Realtime Behavior

While a circle detail dialog is open:

- Subscribe to safe circle/reaction invalidation events when available.
- On event, refetch `get_visible_circle_reactions`.
- If realtime is unavailable, use a short refresh loop only while the dialog is open and stop
  when hidden.

## Accessibility And Loading

- Dialogs must have clear labels and initial focus.
- Buttons must expose loading/disabled states.
- Empty states should be short and actionable.
- Book Detail remains usable if circle RPCs fail.
