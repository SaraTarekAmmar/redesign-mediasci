# System Architecture

## Overview
This Enterprise Project Management System (similar to Jira) is built on **Laravel 10** using a monolithic architecture with heavily optimized client-side interactions via Alpine.js.

## Tech Stack
- **Backend:** PHP 8+, Laravel 10
- **Database:** MySQL 8+ (InnoDB engine)
- **Frontend:** Blade Templating, Alpine.js (Reactivity), Tailwind-style Custom CSS
- **Charts:** Chart.js
- **Gantt:** Frappe Gantt
- **Exports:** jsPDF, html2canvas, SheetJS (Client-side generation)

## Core Modules

### 1. User & Access Control (RBAC)
Implemented using `spatie/laravel-permission`. 
Roles: `super-admin`, `admin`, `team-leader`, `member`.
Middleware intercepts requests and validates roles based on department and team hierarchies.

### 2. Agile Project Management
- **Epics & Sprints:** Epic acts as the top-level container, stories/tasks are bound to Sprints.
- **Workflow State Machine:** Custom workflow states (To Do, In Progress, Review, Done). Transitions are validated via `IssueController@transition`.
- **Dependencies:** Task blocking/relating uses the `TaskDependency` model to form directed graphs of dependencies.

### 3. Collaboration & Communication
- **Chat System:** Polling-based real-time chat with `@mention` support.
- **Activity Timeline:** `ActivityLog` records every status change, comment, and attachment, creating an audit trail per issue.
- **Notifications:** Built on Laravel's native Notification system (database driver). Notifications are triggered by mentions, task assignments, and overdue warnings.

### 4. Storage & Files
Local disk storage via `public` disk. Attachments and project logos/documents are uploaded, hashed, and served through symbolic links.

### 5. Recovery System (Soft Deletes)
A central tenant of the architecture is data safety. 
All primary models (`User`, `Project`, `Issue`, `Department`) utilize `Illuminate\Database\Eloquent\SoftDeletes`. 
A dedicated `RecoveryController` handles restoring these entities along with their relationships (comments, chats) within a 30-day window.
