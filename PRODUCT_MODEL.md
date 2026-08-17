# Redesign MediaSci product model

## Account and project boundaries

The product uses one account model with roles and project-scoped visibility. Internal corporate roles remain the source of truth for company-wide operations. A partner account is an external delivery collaborator: the super admin creates or invites the partner user, grants the partner role and explicit privileges, then assigns the partner member or team to one or more projects. A client account is a project stakeholder: the super admin creates or invites the client contact, links the login to the client record, and the existing project-access policy grants visibility only to projects billed to that client.

Partner and client users must never receive the corporate administration surface. They may only access project-scoped records permitted by their role and project relationship. The client can see the full project story—status, issues, board, milestones, requests, reports, documents, comments, and relevant financial or contractual information exposed to the project—but not internal workforce, departments, teams, resources, internal-only notes, or corporate settings. Partner users can see and work on assigned project tasks, comment, update the work they own, and assign or request work according to privileges granted by the super admin. Assignment must be project-scoped and must not become a global user-management capability.

## Task collaboration

Issue tasks already have comment infrastructure in the backend and an existing discussion composer in the issue detail sheet. The next implementation should ensure comments are visible and usable for all allowed project participants, while preserving author-only edit/delete behavior and admin moderation. The comment surface should clearly distinguish internal notes from client-visible project discussion if the data model supports that distinction; otherwise the first safe slice is project-visible comments with no corporate data leakage.

## Project creation metadata

Project creation already supports `presale`, `postsale`, and `rnd` classifications and partner/client assignments. The next pass should make the labels and explanatory copy clearer: Presale, Postsale, and R&D (research and development). Presale can retain a required subtype such as POC, Demo, RFP, RFQ, or ROP. Contractual terms remain a manual field editable by the super admin only; they must never be AI-generated or automatically inferred.

## Content banks and demo data

The proposal workflow already exists at `/proposals`, the presentation bank exists at `/presentations`, and the local demo preview contains ready demo records. The next pass should clarify the naming and grouping in the sidebar and dashboard: Proposal bank for reusable proposal drafts and templates, Presentation bank for reusable decks, and Demo workspace for ready-to-show sample records. Existing live routes and demo routes should not be duplicated.

## Skills and dashboard information architecture

The Skills page currently supports Cards and Table views. Add a Matrix view that places people on one axis and skills on the other, with proficiency shown through accessible text and restrained neutral/semantic styling. The dashboard should prioritize Projects as the first and largest operational section. Secondary sections should be grouped by the user's daily flow—work needing attention, planning, resources/capabilities, and administration—rather than mirroring a long sidebar catalogue. Sidebar headings should use clearer user-facing language, and the dashboard section titles should match the same information architecture with more descriptive names.
