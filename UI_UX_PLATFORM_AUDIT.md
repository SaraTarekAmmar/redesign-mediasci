# MediaSci Operation Hub UI/UX Platform Audit

Audit date: July 15, 2026  
Product: MediaSci Operation Hub  
Stack: Laravel 10, Blade, public CSS design layer, Vite, PHPUnit, Playwright

## 1. Current Product Audit

MediaSci Operation Hub is a broad task and enterprise planning platform with project delivery, roadmap planning, scope management, stakeholders, risks, resources, reports, time logs, documents, and assistant workflows.

The product is functionally ambitious, but the experience is currently unstable because the interface is assembled from several competing design approaches:

- A global shell in `resources/views/layouts/app.blade.php`.
- A global CSS token layer in `public/css/app.css`.
- Many page-local `<style>` blocks and inline `style=""` attributes.
- Tailwind-like utility classes mixed with custom CSS variables.
- Legacy literal gray/slate colors mixed with Jira-inspired blue tokens.
- Per-page components instead of shared reusable components.

The result is the repeated corruption seen in screenshots: dropped top bars, overlapping hover actions, inconsistent active sidebar states, mixed dark/light mode, gray fills on roadmap, basic browser-native controls, inconsistent hierarchy, and route navigation states that do not match the current page.

The product should move from "page-by-page visual patching" to a design-system-led rebuild of the shell, tokens, shared components, and priority workflows.

## 2. Evidence Reviewed

Commands and files reviewed:

- `php artisan route:list`
- `rg --files app/Http/Controllers resources/views resources/css resources/js public routes`
- `rg --files tests`
- `composer.json`
- `package.json`
- `resources/views/layouts/app.blade.php`
- `public/css/app.css`
- Key Blade pages across dashboard, projects, roadmap, plans, scope, documents, time logs, stakeholders, analytics, users, teams, departments, resources, risks, reports, and change requests.

Current route count: 352 registered routes.

Existing test coverage:

- `tests/Feature/AuthLoginFlowTest.php`
- `tests/Feature/DashboardHealthSignalTest.php`
- `tests/Feature/ProjectApiWiringTest.php`
- `tests/Feature/RoadmapTest.php`
- `tests/Feature/TimeLogFlowTest.php`

## 3. Full Page And Route Inventory

### Authentication

- `/login`
- `/register`
- `/logout`

Primary views:

- `resources/views/auth/login.blade.php`
- `resources/views/auth/register.blade.php`

Audit notes:

- Login has previously had credential confusion and logo/favicon issues.
- Auth pages use their own visual system instead of shared tokens.
- Error state and demo credential guidance need a clearer hierarchy.

### Main Workspace

- `/dashboard`
- `/analytics`
- `/profile`

Primary views:

- `resources/views/dashboard.blade.php`
- `resources/views/analytics.blade.php`
- `resources/views/profile.blade.php`

Audit notes:

- Dashboard content hierarchy is inconsistent between cards, project rows, and activity panels.
- Analytics includes overly generic component labels and icons.
- Profile page uses large empty regions and basic tab styling.
- Responsive behavior is not reliable across widths.

### Projects And Delivery

- `/projects`
- `/projects/create`
- `/projects/{project}`
- `/projects/{project}/board`
- `/projects/{project}/backlog`
- `/projects/{project}/reports`
- `/projects/{project}/roadmap`
- `/projects/{project}/settings`
- `/projects/{project}/issues/{issue}`

Primary views:

- `resources/views/projects/index.blade.php`
- `resources/views/projects/create.blade.php`
- `resources/views/projects/show.blade.php`
- `resources/views/projects/board.blade.php`
- `resources/views/projects/backlog.blade.php`
- `resources/views/projects/reports.blade.php`
- `resources/views/projects/roadmap.blade.php`
- `resources/views/projects/settings.blade.php`
- `resources/views/issues/show.blade.php`

Audit notes:

- Project cards can overlap on hover because actions occupy the same horizontal space as badges.
- Current project navigation is mixed into the global sidebar in a way that feels misplaced.
- Project subnavigation should live inside the project page as a contextual horizontal tab bar or project sidebar, not permanently inside the global enterprise sidebar.

### Sprints And Backlog

- `/projects/{project}/sprints`
- `/projects/{project}/sprints/{sprint}/board`
- `/projects/{project}/sprints/{sprint}/backlog`
- Sprint CRUD and task movement endpoints.

Primary views:

- `resources/views/sprints/index.blade.php`
- `resources/views/sprints/board.blade.php`
- `resources/views/sprints/backlog.blade.php`

Audit notes:

- Sprint views need Jira-like issue hierarchy, compact cards, drag affordances, and empty states.
- Task movement and sprint controls require browser-level regression tests.

### Enterprise Planning

- `/roadmap`
- `/roadmap/plans`
- `/roadmap/plans/hub`
- `/roadmap/plans/compare`
- `/roadmap/plans/{plan}/gantt-data`
- `/roadmap/milestones`
- `/roadmap/man-days`
- `/roadmap/man-hours`
- Roadmap task, dependency, analytics, export, and global search endpoints.

Primary views:

- `resources/views/roadmap/enterprise.blade.php`
- `resources/views/roadmap/plans-hub.blade.php`
- `resources/views/roadmap/milestones.blade.php`
- `resources/views/roadmap/man-days.blade.php`
- `resources/views/roadmap/man-hours.blade.php`

Audit notes:

- Roadmap has the most visible corruption: dark header blocks, gray filter strips, basic controls, and Gantt density issues.
- Plan comparison should not be always open in the hub. It should be a dedicated compare route reached through a compare button.
- Gantt should use a clean planning surface with pinned task columns, readable dates, accessible status badges, modern controls, and no gray fills.

### Scope Management

- `/scope/{project?}`
- Objective, deliverable, document, logo, version, and comment endpoints.

Primary view:

- `resources/views/scope/index.blade.php`

Audit notes:

- `/scope/1` has been reported as corrupted.
- Scope needs a clearer page model: overview, deliverables, documents, decisions, versions, and comments.
- The page should use the same page shell and form/table/card components as the rest of the app.

### Change Requests

- `/change`
- `/change/create`
- `/change/{changeRequest}`
- Request upload, approve, impact analysis, and report endpoints.

Primary views:

- `resources/views/change/index.blade.php`
- `resources/views/change/create.blade.php`
- `resources/views/change/show.blade.php`

Audit notes:

- Table styling still uses literal light gray colors.
- Change request iconography needs to use real icons, not ambiguous symbols.
- Workflow statuses need consistent semantic badges.

### Stakeholders

- `/stakeholders`
- `/stakeholders/register`
- `/stakeholders/engagement`
- `/stakeholders/analytics`

Primary views:

- `resources/views/stakeholders/index.blade.php`
- `resources/views/stakeholders/register.blade.php`
- `resources/views/stakeholders/engagement.blade.php`
- `resources/views/stakeholders/analytics.blade.php`

Audit notes:

- Sidebar active state previously selected multiple stakeholder items.
- Analytics page includes emoji-like symbols in content.
- Stakeholder module needs consistent tabs and route active logic.

### Documents

- `/documents`
- `/documents/create`
- `/documents/{document}`
- Upload, download, preview, version, approval, archive, folder, and search endpoints.

Primary views:

- `resources/views/documents/index.blade.php`
- `resources/views/documents/create.blade.php`
- `resources/views/documents/show.blade.php`

Audit notes:

- Documents page was reported as totally corrupted.
- Needs a document library pattern: filters, table/list toggle, folder tree, version status, approval state, and preview affordances.

### Time Logs

- `/time-logs`
- Timer start/stop/pause/resume, manual store/update/delete, analytics, export, approval endpoints.

Primary view:

- `resources/views/time-logs/index.blade.php`

Audit notes:

- Task selection, start timer, and manual log flows have been reported as not working.
- Needs robust dependent selects, disabled/loading states, validation feedback, and no native broken dropdown styling.
- Feature test exists and should be extended after UI fixes.

### Organization

- `/departments`
- `/teams`
- `/users`
- `/users/search`
- `/users/{user}/profile`
- `/recovery`
- `/admin-tasks`

Primary views:

- `resources/views/departments/index.blade.php`
- `resources/views/teams/index.blade.php`
- `resources/views/users/index.blade.php`
- `resources/views/users/profile.blade.php`
- `resources/views/recovery/index.blade.php`
- `resources/views/admin-tasks/index.blade.php`

Audit notes:

- Organization pages should share the same table, empty state, filter, drawer, and detail page components.
- User profile needs a major redesign with meaningful summary metrics and better tabs.

### Governance And Operations

- `/risks`
- `/resources`
- `/reports`
- Budget, expense, cloud service, software license endpoints under projects.

Primary views:

- `resources/views/risks/index.blade.php`
- `resources/views/resources/index.blade.php`
- `resources/views/reports/dashboard.blade.php`
- Budget and expense views under `resources/views/budget`, `expenses`, `cloud-services`, and `software-licenses`.

Audit notes:

- These modules should be organized as operations/governance, not scattered as unrelated pages.
- Cards, tables, charts, and status indicators should follow one visual grammar.

### Global Features

- Global search: `/roadmap/global-search`
- Notifications: `/notifications`, `/notifications/mark-all-read`
- Assistant: `/assistant/query`
- Global timer endpoints under `/time-logs`

Primary implementation:

- `resources/views/layouts/app.blade.php`
- `app/Http/Controllers/AssistantController.php`
- `app/Http/Controllers/NotificationController.php`
- `app/Http/Controllers/RoadmapController.php`

Audit notes:

- Search exists but must remain typeable, focusable, and useful on every page.
- Assistant should not cover key page actions.
- Notifications currently show empty state; behavior needs smoke testing with seeded data.
- Global timer must not conflict with page-level timer controls.

## 4. UX Issue List

### Critical

- Sidebar active state logic can mark multiple pages active at once.
- Some sidebar clicks appear selected without navigating because active state and contextual navigation are mixed.
- Global shell layout can collapse badly at small widths.
- Dark mode is incomplete and mixes light panels with dark surfaces.
- Roadmap uses large dark/gray blocks and low contrast text.
- Time logs task selection and timer actions have reported functional failures.
- Search has reported focus/type failures and must be verified in browser.
- Several pages rely on inline styles that bypass the design system.

### High

- Current project navigation is in the wrong place and should be contextual.
- Page hierarchy is inconsistent: heroes, actions, cards, filters, and tables appear in different orders.
- Many controls look like native browser defaults.
- Hover actions overlap with card content.
- Gray fills appear across the product despite the desired no-gray visual direction.
- Emoji-like symbols appear where icons are required.
- Gantt view is dense and difficult to scan.
- Plan comparison is too prominent in the plans hub and should be moved to a separate compare page.

### Medium

- Empty states are inconsistent and often not action-oriented.
- Button hierarchy is inconsistent between primary, secondary, ghost, danger, and icon buttons.
- Focus states are inconsistent.
- Forms lack a standard structure for labels, helper text, validation, and dependent loading states.
- Tables lack a consistent responsive strategy.
- Cards use inconsistent spacing and border radius.
- Some status pills use color without enough semantic structure.

### Low

- Footer appears on pages where an app shell footer is unnecessary.
- Some labels are vague or not domain-specific.
- Microcopy needs to become more operational and less generic.

## 5. Proposed Information Architecture

The navigation should be simplified around user mental models:

1. Home
2. Work
3. Planning
4. Documents
5. People
6. Insights
7. Governance
8. Admin

Recommended primary sidebar:

- Dashboard
- Projects
- Planning
- Documents
- Time Logs
- Reports
- People
- Governance
- Settings

Recommended Planning section:

- Global Roadmap
- Plans Hub
- Compare Plans
- Milestones
- Capacity

Recommended contextual project navigation:

- Board
- Backlog
- Sprints
- Project Roadmap
- Issues
- Reports
- Scope
- Budget
- Settings

This solves the complaint that Board, Backlog, Sprints, and Roadmap feel misplaced in the global sidebar. They belong to the selected project context, not the global enterprise menu.

## 6. Proposed Design System

### Visual Direction

Jira/ClickUp-inspired but branded for MediaSci:

- Clean white primary surfaces.
- Soft blue-tinted app background instead of gray fills.
- Atlassian-like blue primary actions.
- Strong typographic hierarchy.
- Compact enterprise density where data matters.
- Friendly rounded cards, but not oversized.
- Calm semantic colors for status and risk.
- No emojis in UI; only SVG icons.

### Tokens

Core surfaces:

- `--surface-canvas`: app page background, very light blue tint.
- `--surface-card`: white card surface.
- `--surface-raised`: white with subtle blue shadow.
- `--surface-selected`: blue-tinted selected state.
- `--surface-hover`: light brand-blue hover.

Text:

- `--text-primary`: near-navy.
- `--text-secondary`: slate-blue.
- `--text-muted`: accessible muted blue.
- `--text-inverse`: white.

Brand:

- `--brand-primary`: Jira-like blue.
- `--brand-primary-hover`: deeper blue.
- `--brand-accent`: cyan or indigo used sparingly.

Semantic:

- `--success`
- `--warning`
- `--danger`
- `--info`
- `--blocked`

Dark mode:

- Must define all surfaces, borders, shadows, text, badge backgrounds, inputs, tables, and overlays.
- No component should hardcode light backgrounds.

### Spacing

Use an 8px grid:

- Page gutters: 24px desktop, 16px tablet, 12px mobile.
- Section spacing: 24px to 32px.
- Card padding: 20px to 24px.
- Compact table cell padding: 10px to 12px.
- Form vertical rhythm: 16px between fields.

### Typography

Recommended scale:

- Page title: 28px/36px, 700.
- Section title: 20px/28px, 700.
- Card title: 16px/24px, 700.
- Body: 14px/22px.
- Metadata: 12px/18px, 600 for labels.

### Components

Build or standardize:

- App shell
- Sidebar
- Topbar
- Global search
- Notification dropdown
- Floating assistant
- Page header
- Section header
- Metric card
- Project card
- Action button
- Icon button
- Tabs
- Filter bar
- Select
- Date input
- Text input
- Textarea
- Checkbox
- Table
- Data list
- Empty state
- Status badge
- Avatar
- Modal
- Drawer
- Toast
- Tooltip
- Gantt timeline
- Plan card
- Compare panel

## 7. Component Inventory

### Existing Strong Foundations

- `resources/views/components/icon.blade.php` provides a central icon rendering point.
- `public/css/app.css` already contains a token system and many reusable classes.
- `layouts/app.blade.php` centralizes the app shell, search, assistant, notifications, and theme behavior.
- Feature tests exist for several important flows.

### Components Needing Refactor

- Sidebar route active logic.
- Current project navigation.
- Global search panel.
- Assistant overlay placement.
- Notification dropdown.
- Page hero component.
- Roadmap filters and tabs.
- Plan cards and comparison UI.
- Gantt header and timeline rows.
- Project cards.
- Profile tabs and info panels.
- Native select/date controls.
- Tables in change requests, users, documents, and reports.

### Components To Remove Or Replace

- Page-local gray utility patches.
- Inline `style=""` on page structure.
- Emoji text icons from database display.
- Native browser-looking controls.
- Always-open compare panels inside overview pages.

## 8. Redesign Implementation Plan

### Phase 0: Stabilize Shell And Navigation

Goals:

- Fix sidebar active state so only one page group is selected.
- Keep collapsed sidebar collapsed after navigation.
- Restore visible menu collapse button.
- Move current-project navigation into project pages.
- Fix topbar alignment and search placement.
- Make global search typeable, keyboard accessible, and useful.
- Make assistant panel avoid covering primary actions.
- Make dark mode complete for shell components.

Validation:

- Browser smoke test desktop, tablet, and mobile.
- Verify navigation clicks go to correct routes.
- Verify collapsed sidebar state persists.
- Verify search input can type and results render.
- Verify dark mode has no light islands.

### Phase 1: Token And Component Cleanup

Goals:

- Consolidate page surfaces into no-gray Jira-inspired tokens.
- Create shared classes for buttons, cards, forms, badges, tabs, filters, tables, and empty states.
- Remove literal gray colors from priority pages.
- Replace emoji or symbol icons with SVG icon component calls.

Validation:

- Visual review of primary pages.
- Color contrast spot checks.
- `php artisan view:cache`.

### Phase 2: Redesign Priority Pages

Priority order:

1. Dashboard
2. Projects
3. Global Roadmap
4. Plans Hub
5. Compare Plans
6. Time Logs
7. Scope
8. Documents
9. Profile
10. Stakeholder Analytics

Goals:

- Apply consistent hierarchy.
- Remove broken spacing.
- Replace basic controls.
- Fix responsive behavior.
- Wire page actions to backend endpoints.

Validation:

- Browser smoke through each page.
- PHPUnit feature tests.
- Manual flow tests for create, edit, filter, search, timer, comparison, and navigation.

### Phase 3: Complete Secondary Modules

Pages:

- Reports
- Analytics
- Risks
- Resources
- Change Requests
- Users
- Teams
- Departments
- Recovery
- Admin Tasks
- Budget
- Expenses
- Cloud Services
- Software Licenses

Goals:

- Standardize tables, forms, drawers, empty states, and detail pages.
- Improve IA and labels.
- Ensure data states work for empty, loading, success, error, and permission cases.

### Phase 4: QA And Regression

Automated tests:

- `php artisan test`
- `php artisan view:cache`
- `npm run build`
- Playwright smoke tests for major routes.

Manual flows:

- Login.
- Dashboard load.
- Project browse.
- Project detail.
- Board/backlog/sprint navigation.
- Roadmap plan selection.
- Plan comparison route.
- Add roadmap task.
- Time log manual entry.
- Timer start/stop.
- Global search.
- Notification dropdown.
- Assistant query.
- Dark mode toggle.
- Sidebar collapse/expand.
- Mobile navigation.

## 9. Pages Ordered By Priority

### P0: Must Fix First

- `resources/views/layouts/app.blade.php`
- `public/css/app.css`
- `resources/views/dashboard.blade.php`
- `resources/views/roadmap/enterprise.blade.php`
- `resources/views/roadmap/plans-hub.blade.php`
- `resources/views/time-logs/index.blade.php`
- `resources/views/scope/index.blade.php`
- `resources/views/documents/index.blade.php`

### P1: Next Critical UX

- `resources/views/projects/index.blade.php`
- `resources/views/projects/show.blade.php`
- `resources/views/projects/board.blade.php`
- `resources/views/projects/backlog.blade.php`
- `resources/views/sprints/index.blade.php`
- `resources/views/sprints/board.blade.php`
- `resources/views/profile.blade.php`
- `resources/views/stakeholders/analytics.blade.php`

### P2: Full Platform Cleanup

- `resources/views/analytics.blade.php`
- `resources/views/reports/dashboard.blade.php`
- `resources/views/change/index.blade.php`
- `resources/views/users/index.blade.php`
- `resources/views/users/profile.blade.php`
- `resources/views/teams/index.blade.php`
- `resources/views/departments/index.blade.php`
- `resources/views/resources/index.blade.php`
- `resources/views/risks/index.blade.php`
- `resources/views/admin-tasks/index.blade.php`
- Budget, expenses, licenses, and cloud services views.

## 10. Risks And Dependencies

- The app has many inline styles, so global token fixes may not reach every page.
- The shell contains JavaScript before the `<head>`, which is invalid HTML structure and can create unpredictable behavior.
- Blade pages mix global classes, inline styles, and page-local CSS, which causes specificity fights.
- Some icons may come from database fields and can still be emojis unless normalized at render time.
- Dark mode must be tested route by route because page-local styles may bypass `.dark` tokens.
- Roadmap and time logs depend on seeded project/task data for meaningful testing.
- Browser smoke tests require the local PHP/XAMPP server to be running.
- The current branch has existing uncommitted roadmap/plans changes and an untracked batch file.
- Building a true Jira/ClickUp feature-parity replica is a multi-phase product effort, not a single CSS pass.

## 11. Recommended Immediate Work

Start with Phase 0 and Phase 1 together:

- Refactor app shell structure.
- Fix route active state.
- Fix collapsed sidebar persistence.
- Normalize topbar and global search.
- Make dark mode complete at shell level.
- Replace route-local gray fills with surface tokens.
- Extract shared component classes.
- Redesign Dashboard, Roadmap, Plans Hub, Time Logs, Scope, and Documents using those shared components.

This is the fastest path to stop the visible corruption while creating a foundation that the rest of the product can safely inherit.
