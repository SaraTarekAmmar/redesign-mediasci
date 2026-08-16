# Database Schema

The database relies on Laravel's Eloquent ORM. Here is a high-level overview of the tables based on the system's requirements.

## Users & Access Control
- `users`: Core table. Fields include name, email, password, phone, role, department_id, team_id, avatar_url, active, deleted_at (Soft Deletes).
- `roles` & `permissions`: Standard Spatie Permission schema for Super Admin, Admin, Team Leader, Member.

## Team & Departments
- `teams`: id, name, leader_id, description, deleted_at.
- `departments`: id, name, description, color, leader_id, deleted_at.

## Projects & Agile Structure
- `projects`: id, name, description, lead_id, start_date, end_date, status, logo, documents (JSON array for documents), deleted_at.
- `project_phases`: Roadmap/Gantt support. id, project_id, name, start_date, end_date, color, order, status.
- `sprints`: id, project_id, name, goal, start_date, end_date, status, notes.
- `epics`: id, project_id, name, goal, color.

## Issues (Tasks/Stories/Bugs)
- `issues`: Main task table. Fields: id, project_id, epic_id, sprint_id, title, description, type (Task, Subtask, Bug), status_id, priority, created_by, deleted_at.
- `task_assignees`: Pivot table for multi-assignment (issue_id, user_id).
- `task_dependencies`: Relates issues (issue_id, depends_on_id, type).
- `issue_attachments`: File uploads linked to tasks.
- `issue_comments`: Comments on tasks.
- `issue_history`: Audit log tracking changes (e.g., status changes).
- `time_logs`: Time tracked per task.

## Collaboration & Achievements
- `chats`: Real-time chat threads. Polling enabled.
- `mentions`: Mentions of @user in comments or chat.
- `achievements`: User achievements tab. Fields: title, project_name, sprint_id, task_name, notes, date_achieved.
- `achievement_comments`: Admin comments on achievements.

## Admin Features
- `admin_tasks`: Custom table for admins. Fields: project_id, subject, comment, person_name, start_date, end_date, status, notes.

## Logs
- `activity_logs`: Timeline activities per task, user, and project.

This schema is optimized for InnoDB with foreign keys and cascading where appropriate. Soft deletes are used heavily to satisfy the 30-day restore rule.
