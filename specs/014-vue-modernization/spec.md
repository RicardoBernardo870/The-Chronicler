# Feature Specification: Vue Codebase Modernization

**Feature Branch**: `014-vue-modernization`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "Refactor – Vue Codebase Modernization"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Component Decomposition (Priority: P1)

A developer opening any page component can immediately understand what it does without scrolling through hundreds of lines of interleaved logic and markup. Large, multi-responsibility page files are broken into focused child components, each with a clear single purpose. Parent components become thin orchestrators that wire children together.

**Why this priority**: This is the highest-leverage change. Oversized components are the primary barrier to onboarding, debugging, and confident modification. Reducing component size unlocks all other improvements — smaller units are easier to standardise on PrimeVue, easier to test, and easier to keep clean.

**Independent Test**: Open any page component after the refactor. The script block contains no inline markup logic (no large computed blocks rendering sub-sections), and the template contains meaningful semantic component names rather than raw HTML structures. A reviewer unfamiliar with the codebase can understand the page's responsibilities within 60 seconds.

**Acceptance Scenarios**:

1. **Given** a page component (e.g., Dashboard, Book Detail) currently has more than 300 lines, **When** the refactor is complete, **Then** the page component's line count is reduced by extracting self-contained sections into named child components — without any change to visible behaviour or styling.
2. **Given** a child component is extracted, **When** it is used in its parent, **Then** it accepts only the props it needs, emits events for actions, and carries its own scoped styles — no shared mutable state is introduced.
3. **Given** a component has been decomposed, **When** the application is loaded, **Then** all interactions (navigation, saving progress, displaying data) continue to work exactly as before.

---

### User Story 2 — PrimeVue Standardisation (Priority: P1)

Any UI element that has a direct PrimeVue equivalent is replaced with that component. Custom HTML structures for cards, dialogs, badges, and panels are retired in favour of the project's established design-system library, ensuring visual and behavioural consistency across the entire app.

**Why this priority**: Inconsistency across custom and PrimeVue implementations creates visual drift, duplicated CSS, and surprising behaviour differences. Standardising on PrimeVue for all eligible elements makes future UI changes predictable — one PrimeVue upgrade propagates everywhere.

**Independent Test**: Audit every custom-built card, modal, badge, chip, and panel in the codebase. Each one either uses a PrimeVue equivalent after the refactor, or has a documented reason for remaining custom (e.g., the PrimeVue component doesn't support the required layout). No new custom HTML structures are introduced.

**Acceptance Scenarios**:

1. **Given** a component uses a hand-rolled card wrapper (e.g., the LoreCard), **When** a PrimeVue `Card` or `Panel` component can fulfil the same layout, **Then** it is replaced — retaining the existing scoped styles and visual appearance.
2. **Given** PrimeVue is used for a replacement, **When** the user interacts with the element, **Then** all existing interaction behaviour (clicks, keyboard navigation, ARIA attributes) is preserved or improved.
3. **Given** a custom implementation has no equivalent PrimeVue component, **When** the refactor reaches that element, **Then** it is left unchanged and documented in an assumption.

---

### User Story 3 — Standardised Date Handling (Priority: P2)

All date manipulation throughout the application uses a single shared utility. Manual date arithmetic (string parsing, `getTime()` differences, custom formatting functions) is replaced with consistent, readable calls that any developer can understand at a glance.

**Why this priority**: Date bugs are subtle and hard to spot in code review. Centralising on a well-known date utility eliminates an entire class of off-by-one and timezone errors, and makes formatting consistent (e.g., "2 days ago" always looks and reads the same across cards and labels).

**Independent Test**: Search the codebase for manual date operations (e.g., `new Date(str).getTime()`, string-based date comparisons, custom format functions). After the refactor, all such operations are replaced with equivalent utility calls. The displayed output for all date/time fields (relative times, durations, countdowns) is identical to the pre-refactor output.

**Acceptance Scenarios**:

1. **Given** a component computes a relative time string manually (e.g., "2 hours ago"), **When** the refactor is complete, **Then** the same string is produced by a shared utility call — and the displayed text in the UI is unchanged.
2. **Given** the Last Session Card calculates session duration from two timestamps, **When** the refactor is applied, **Then** the duration display ("42 minutes", "1 h 03 min") is computed via the shared utility and the rendered value matches the previous output exactly.
3. **Given** a utility is introduced for date formatting, **When** new date fields are added to the app in future, **Then** developers use the same utility rather than introducing a new custom function.

---

### User Story 4 — Code Cleanliness & Separation of Concerns (Priority: P2)

All components have a clear separation between data/logic and presentation. Duplicated code is extracted into shared utilities or composables. Complex inline expressions in templates are replaced by named computed properties that explain their intent. The result is a codebase where the purpose of any line is clear without tracing context.

**Why this priority**: Cleanliness is a multiplier on all other development work. A clean codebase reduces review time, reduces the chance of introducing bugs when making changes, and lowers the learning curve for anyone new.

**Independent Test**: Select any computed property or template expression flagged as complex. After the refactor, complex inline expressions have been replaced by named computed properties with self-documenting names. Duplicated logic (e.g., the same guard condition copy-pasted across components) has been extracted into a shared composable or utility. No logic-only change alters any rendered output.

**Acceptance Scenarios**:

1. **Given** a template contains an inline expression with more than one operation (e.g., ternary inside filter inside map), **When** the refactor is applied, **Then** it is replaced by a named computed property with a descriptive name.
2. **Given** the same conditional guard or transformation appears in more than one component, **When** the refactor is complete, **Then** it is extracted into a shared composable or utility and both components import it from the same source.
3. **Given** a component mixes data-fetching logic with presentation logic in the same section, **When** it is cleaned up, **Then** data-fetching and state management logic lives in the script block (composables/store calls) and the template contains only rendering decisions.

---

### Edge Cases

- What happens if a PrimeVue replacement component does not support a required CSS class or slot? → The custom implementation is kept as-is and documented in the Assumptions section; no forced replacements.
- What happens if extracting a component introduces a prop-drilling chain longer than 2 levels? → A shared composable or Pinia store is used for the shared state instead of passing props.
- What happens if a date utility call changes the visual output of a formatted date? → The output must match exactly; if it doesn't, the custom implementation is kept until the discrepancy is resolved.
- What happens if a refactored component breaks an existing automated test? → The test is updated to match the new structure — only if the behaviour is unchanged; if the test catches a real behavioural change, the refactor is rolled back for that component.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All refactored components MUST produce identical rendered output to their pre-refactor counterparts — pixel-level visual regressions are not acceptable.
- **FR-002**: All existing user interactions (button clicks, form submissions, navigation, drag-and-drop) MUST continue to work after refactoring.
- **FR-003**: Extracted child components MUST communicate with parents exclusively through props (data in) and emits (events out) — no direct parent state mutation.
- **FR-004**: Any component currently exceeding 300 lines MUST be reviewed for decomposition; components that can be meaningfully split without creating an awkward prop chain MUST be split.
- **FR-005**: Any native HTML element that duplicates a PrimeVue component's purpose MUST be replaced with the PrimeVue component, preserving all existing CSS class names on the wrapper where needed for scoped styles.
- **FR-006**: All manual date arithmetic (millisecond differences, manual string formatting, manual relative-time computation) MUST be replaced with a shared date utility.
- **FR-007**: Duplicated logic that appears verbatim or near-verbatim in two or more components MUST be extracted into a shared composable or utility function.
- **FR-008**: All complex inline template expressions (ternaries with side effects, chained method calls, nested conditionals) MUST be replaced with named computed properties.
- **FR-009**: The refactor MUST NOT add new runtime dependencies beyond what is required for the date utility (one package).
- **FR-010**: Each refactoring increment MUST leave the application in a buildable, working state — no half-completed extractions committed.

### Key Entities

- **Component** (existing, restructured): A Vue single-file component. After refactoring, each component has a single stated responsibility, a script block under 150 lines for leaf components (under 250 for page-level orchestrators), and scoped styles.
- **Composable** (existing, extended): A `use*` function encapsulating reusable reactive logic. New composables may be introduced to house extracted shared logic; no existing composable contracts are changed.
- **Shared Utility** (new): A pure function module (no Vue reactivity) for date formatting, string manipulation, or other stateless helpers shared across components.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every page-level component (Dashboard, Book Detail, Library, etc.) has its line count reduced by at least 30% through child component extraction — measured against the pre-refactor baseline.
- **SC-002**: Zero new custom HTML card/panel/badge structures are introduced; all eligible existing ones are replaced with the design-system equivalents.
- **SC-003**: All date/time display fields produce character-for-character identical output before and after the refactor (verified by side-by-side comparison on the same data).
- **SC-004**: The build (`npm run build`) passes with zero TypeScript errors after every refactoring increment.
- **SC-005**: No automated test (if present) fails due to a behavioural change introduced by the refactor — only structural test updates (new component names, new prop names) are permitted.
- **SC-006**: A developer unfamiliar with the codebase can locate the component responsible for any visible UI element within 2 minutes, using only the component tree and file names.

## Clarifications

### Session 2026-04-25

- Q: `date-fns` is not currently installed — should we add it, use `dayjs`, or build an internal utility with no new dependency? → A: Install `date-fns` (Option A). It is the one permitted new runtime dependency under FR-009.

## Assumptions

- The refactor covers the `src/` directory only; backend edge functions and Supabase migrations are out of scope.
- The date utility selected is `date-fns`; it is **not** currently installed and must be added via `npm install date-fns`. This is the one permitted new runtime dependency under FR-009. No other new runtime packages will be introduced.
- "Visual regression" is assessed by manual side-by-side comparison in a browser, not by automated screenshot diffing (no screenshot tooling is currently set up).
- PrimeVue components that require significant theme overrides to match the existing glass-surface design language may be left as custom implementations if the override complexity outweighs the consistency benefit.
- Refactoring is applied incrementally, one component or area at a time, with a build check between each increment.
- Existing composables (`useLastSession`, `useReadingSession`, `useActiveBook`, etc.) are not restructured — only new shared utilities and extracted components are introduced.
- The project currently has no automated end-to-end or component test suite; "no behavioural change" is verified by manual testing against the quickstart scenarios in existing spec documents.
