# MediaSci Operation Hub — Comprehensive Enhancement Plan

## Executive Summary

This plan addresses three major areas: (1) UI/UX enhancement based on deep competitive analysis of Jira, ClickUp, Linear, Monday.com, Asana, and Notion; (2) RBAC system overhaul to enable role-based dashboards and menus; (3) Bug fixes for 7 identified issues including a critical 404 and authorization bypass.

---

## Part 1: Competitive UI/UX Research

### Jira Patterns (Best-in-Class)
- **Left sidebar**: Project switcher at top → grouped nav (Boards, Backlog, Reports, Releases, Settings) → collapsible
- **Dashboard**: Personalized gadgets (assigned issues, recently viewed, quick filters, sprint health)
- **Role-based**: Project roles (Admin, Developer, Viewer) control visibility of nav items
- **Keyboard**: `.` command palette (like GitHub), `?` shortcuts overlay, `j/k` navigation
- **Views**: Board, Backlog, Timeline (Gantt), List, Calendar — switchable per user preference
- **Search**: Global search with filters (type, status, assignee, project, date range)

### ClickUp Patterns (Most Feature-Rich)
- **Sidebar**: Favorites pinning, workspace → space → folder → list hierarchy
- **Dashboard**: Custom widgets (line chart, bar chart, table, embedding), drag-to-reorder
- **Role-based**: Custom roles with granular permissions (view, comment, edit, admin)
- **Views**: List, Board, Calendar, Gantt, Timeline, Workload, Table, Whiteboard
- **Notable**: "Me Mode" hides everything except user's own tasks; "Everything" view across all spaces

### Linear Patterns (Best UX/Keyboard)
- **Sidebar**: Team-centric, minimal items (My Issues, Inbox, Projects, Views)
- **Dashboard**: Inbox (notifications) + My Issues list — no complex widgets
- **Keyboard**: `C` new issue, `G` go to, `/` search, `j/k` navigate, `s` set status
- **Views**: Saved filters with custom icons/colors, shareable team-wide
- **Notable**: No project switcher — teams are the unit of organization

### Monday.com Patterns (Most Visual)
- **Sidebar**: Favorites, workspaces, dashboards list
- **Dashboard**: Highly customizable with 30+ widget types, layout freedom
- **Role-based**: 6 built-in roles + custom roles
- **Notable**: Board views as first-class citizens, automation center

### Asana Patterns (Best Task Management)
- **Sidebar**: Favorites, My Tasks, Inbox, Portfolios, Goals
- **Dashboard**: My Tasks with due dates, recent projects, workload
- **Notable**: Portfolios for cross-project visibility, Goals for OKR alignment

### Notion Patterns (Best Knowledge Base)
- **Sidebar**: Page tree with nesting, favorites, shared pages
- **Dashboard**: None — everything is a page
- **Notable**: Databases with multiple views, relations, rollups

---

## Part 2: Role-Based Access Control (RBAC) Plan

### Current State (Broken)
- 3 conflicting seeder files with different role/permission definitions
- Casing mismatch: `Super Admin` vs `super-admin` causes authorization bypass
- Permission naming mismatch: `$user->can()` calls never match seeded permissions
- Zero Spatie middleware on routes — all protection is ad-hoc inline
- Frontend has NO role/permission guards
- SPA bootstrap returns ALL data to ANY authenticated user

### Proposed Role Hierarchy

```
super-admin    → Full platform access, manage users, manage all projects
admin          → Manage projects, manage users in their scope
project-manager → Manage their assigned projects, view all reports
team-leader    → Manage their team, assign tasks, view team reports
developer      → Work on assigned issues, log time, view their dashboard
member         → View only, comment on assigned items
viewer         → Read-only access to assigned projects
```

### Permission Matrix (50 permissions across 8 modules)

| Module | Permissions |
|--------|-------------|
| Projects | view-project, create-project, edit-project, delete-project, manage-project-members |
| Issues | view-issues, create-issues, edit-issues, delete-issues, assign-issues, transition-issues |
| Scope | view-scope, edit-scope, manage-objectives, manage-deliverables |
| Sprints | view-sprints, create-sprints, edit-sprints, manage-sprint-issues |
| Reports | view-reports, export-reports, view-analytics |
| Resources | view-resources, allocate-resources, manage-budget |
| Admin | manage-users, manage-roles, manage-departments, manage-skills, view-audit-logs |
| System | manage-settings, manage-boards, manage-labels, view-notifications, manage-notifications |

### Backend Changes Required

1. **Unify seeder** → Single `RolePermissionSeeder` with kebab-case permissions
2. **Fix casing** in `TaskPolicy`, `ChangeRequestPolicy`, `EnsureProjectAccess`
3. **Add Spatie middleware aliases** to `Kernel.php`
4. **Apply middleware to routes** — group routes by role requirements
5. **Add `permissions` to SPA bootstrap** response
6. **Enforce project scoping** in `SpaController` — verify membership
7. **Create missing policies** for Sprint, Department, Document, Resource, Expense

### Frontend Changes Required

1. **Add `useAuth()` hook** → returns user, role, permissions
2. **Add route guards** → protect `/users`, `/departments`, `/settings` etc.
3. **Role-based sidebar** → different nav items per role
4. **Role-based dashboard** → different widgets per role

---

## Part 3: Role-Based Dashboards

### Super Admin Dashboard
- Platform health overview (all projects, all users)
- System notifications and alerts
- User management quick access
- Cross-project portfolio view
- Audit log summary

### Admin Dashboard
- All projects overview with status
- Team utilization metrics
- Budget summary across projects
- Pending approvals (change requests, time logs)
- Quick user management

### Project Manager Dashboard
- Assigned projects with health indicators
- Sprint velocity and burndown charts
- Team workload and capacity
- Pending decisions (change requests, escalations)
- Milestone timeline

### Team Leader Dashboard
- Team members and their current tasks
- Team velocity and capacity
- Pending assignments
- Team skills and availability
- Department metrics

### Developer Dashboard
- My assigned issues (prioritized)
- My time logs this week
- Sprint progress (if in active sprint)
- Recent activity on my issues
- Quick link to log time

### Member/Viewer Dashboard
- My assigned items (read-only)
- Recent updates on watched items
- Project news/announcements
- Team directory

---

## Part 4: Sidebar Navigation Per Role

### Super Admin
```
Dashboard
Projects (all)
Users
Departments
Skills Directory
Reports & Analytics
Budget
Settings
Audit Logs
```

### Admin
```
Dashboard
Projects (managed)
Users (in scope)
Departments
Reports & Analytics
Budget
Settings
```

### Project Manager
```
Dashboard
My Projects
Board
Backlog
Sprints
Scope & Roadmap
Reports
Documents
Change Requests
Stakeholders
Risks
Resources
Time Logs
```

### Team Leader
```
Dashboard
My Team
Team Tasks
Board
Backlog
Sprints
Reports (team)
Skills Directory
```

### Developer
```
Dashboard
My Issues
Board
Backlog
Sprints
Time Logs
Documents
```

### Member/Viewer
```
Dashboard
Projects (assigned)
Documents
```

---

## Part 5: Bug Fixes (Priority Order)

### Critical (Fix Immediately)
1. **TimeLogsPage 404** — `PUT /api/time-logs/{id}` missing → Add route + controller method
2. **Role casing bypass** — `Super Admin` vs `super-admin` → Unify to kebab-case everywhere

### High
3. **Sprint create missing project_id** — Orphaned sprints → Add project_id to payload + validation
4. **DocumentsPage no GET endpoint** — Uploads lost → Add listing endpoint
5. **SPA bootstrap security** — No project scoping → Verify user membership before returning data

### Medium
6. **Board/Backlog no API persistence** — Drag-drop lost → Wire to transition API
7. **UsersPage invite button non-functional** — No handler → Wire to create endpoint

### Low
8. **DocumentsPage upload doesn't refresh** — Data flow gap → Re-fetch after upload
9. **Duplicate notification routes** — Maintenance risk → Consolidate to one controller

---

## Part 6: Implementation Phases

### Phase 1: Critical Bug Fixes (1-2 hours)
- Fix TimeLogsPage 404 (add PUT route + controller method)
- Fix role casing in policies
- Fix sprint project_id
- Add documents GET endpoint

### Phase 2: RBAC Unification (2-3 hours)
- Create single unified seeder
- Fix all casing mismatches
- Add Spatie middleware to Kernel
- Apply middleware to route groups
- Create missing policies

### Phase 3: SPA Auth Enhancement (2-3 hours)
- Add permissions to bootstrap response
- Create `useAuth()` hook with role/permission data
- Add frontend route guards
- Enforce project scoping in SPA bootstrap

### Phase 4: Role-Based UI (3-4 hours)
- Design role-based sidebar component
- Create role-specific dashboard pages
- Implement permission-based UI hiding
- Add keyboard shortcuts (Jira-style)

### Phase 5: Board/Backlog Persistence (2-3 hours)
- Wire board drag-drop to API
- Wire backlog reordering to API
- Add optimistic updates

### Phase 6: UX Polish (2-3 hours)
- Command palette (Jira `.` style)
- Global search with filters
- Notification preferences
- Keyboard shortcut overlay

---

## Success Metrics
- All 82+ tests passing
- Zero 404s on any user flow
- Each role sees only appropriate dashboard + sidebar
- Board drag-drop persists to database
- Sprint creation links to project
- Documents list from API
- SPA bootstrap scoped to user's projects
