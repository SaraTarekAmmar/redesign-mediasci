# MediaSci Operation Hub — Local Interactive Demo

## Preview

Open the local interactive preview at:

https://5173-i04qt2bh6yec0orfhrnya-6e12f491.sg1.manus.computer/?demo=1

The `demo=1` query parameter opens the local demo directly without requiring a stored login session. The preview uses local demo data and does not require MySQL.

## What is now covered

The preview now includes a shared Gumroad-inspired application shell with a persistent sidebar, workspace switcher, grouped navigation, responsive mobile menu, search field, notification feedback, profile entry point, breadcrumb header, and action feedback.

The main pages include Overview, Projects, Project Detail, Board, Analytics, Team, Settings, and reusable utility pages for Clients, Requests, Proposals, Issues, Sprints, Backlog, Roadmap, Scope, Risks, Change Requests, Validation, Priority and Impact, Partners, Workforce, Time Logs, Stakeholders, Documents, Reports, Budget, Departments, Users, Admin Tasks, Recovery, Custom Fields, Skills, Plan Comparison, Automation, Workflow Templates, Gantt, Enterprise Gantt, and Global Sprints.

The local demo also covers deeper record flows. Clicking a project or utility-table record opens a detail surface with status, ownership, progress, activity, checklists, follow-up actions, and back navigation. Clicking a project task opens an issue-detail surface with checklist controls, metadata, watchers, and completion actions.

Create actions open a reusable modal with Project, Issue, Request, and Document entry points. Controls that are not yet connected to production data produce visible demo-mode feedback rather than appearing inert. Settings includes editable workspace fields, a timezone selector, preference toggles, and save feedback.

## Verification

The frontend production build passes with `npm run build`. Direct route bootstrapping was verified for the root dashboard, `/projects`, `/scope`, `/settings`, `/workflow-templates`, and `/projects/1/issues/OPS-142`. Project navigation, utility table navigation, create modal opening, checklist controls, and route-safe demo rendering were also verified in the browser.

## Local-only status

This pass was kept local. No additional GitHub pushes or deployment actions were performed during the full interaction work. The existing remote `gumroad-preview` branch from the earlier deployment attempt remains separate from these later local changes.

## Expanded page-specific coverage

The latest pass replaces the former generic utility page fallback with domain-specific layouts for clients, requests, proposals, partners, sprints, global sprints, backlog, roadmap, scope, risks, change requests, approvals, validation, priority and impact, Gantt, enterprise Gantt, analytics, reports, budget, plan comparison, stakeholders, stakeholder analytics, stakeholder registration, stakeholder engagement, stakeholder impact, team tasks, teams, departments, users, skills, resources, workforce, time logs, documents, automation, workflow templates, administration, triage, custom fields, recovery, and profile.

Project milestones, project plans, project creation, issue inbox, team overview, and dynamic stakeholder detail pages now have dedicated experiences as well. Each specialized page includes its own eyebrow, description, metrics, tabs, contextual record data, next-best-action panel, and relevant create or review actions. Record rows lead to detail surfaces, tabs update the active view, and controls provide demo-mode feedback.

The latest browser verification covered Clients, Reports, Milestones, Issues, Create Project, Administration, Triage, and a dynamic Stakeholder profile route. The latest `npm run build` also passes.
