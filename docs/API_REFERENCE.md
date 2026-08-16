# API Reference

The application uses a RESTful API powered by Laravel Sanctum for authentication. All API routes are prefixed with `/api`.

## Authentication
- `POST /api/auth/register`: Register new user.
- `POST /api/auth/login`: Authenticate and obtain Sanctum token.
- `POST /api/auth/logout`: Revoke token.
- `GET /api/auth/me`: Get current authenticated user profile.

## User Management & Departments (v2)
- `GET /api/manage/users`: List users (Admin/Super Admin).
- `POST /api/manage/users`: Create a new user (with generated password if omitted).
- `DELETE /api/manage/users/{id}`: Soft delete a user (30-day recovery rule).
- `POST /api/manage/users/{id}/restore`: Restore deleted user.
- `GET /api/departments`: List all departments.

## Projects & Sprints
- `GET /api/projects`: List accessible projects.
- `POST /api/projects`: Create a new project.
- `GET /api/projects/{id}/sprints`: Get sprints for a project.
- `POST /api/sprints`: Create sprint.
- `POST /api/sprints/{id}/start`: Start sprint.
- `POST /api/projects/{id}/logo`: Upload project logo.
- `POST /api/projects/{id}/documents`: Upload document to a project.

## Roadmap & Gantt (Project Phases)
- `GET /api/projects/{id}/phases`: Get roadmap phases for Gantt chart.
- `POST /api/projects/{id}/phases`: Add a new phase.

## Tasks & Issues
- `GET /api/issues`: Global issue list.
- `GET /api/projects/{id}/issues`: Issue backlog.
- `POST /api/projects/{id}/issues`: Create task/subtask.
- `POST /api/issues/{id}/transition`: Move task to a new status (Board transition).
- `PUT /api/issues/{id}/assignees`: Set multiple assignees.
- `POST /api/issues/{id}/dependencies`: Link tasks (e.g., blocking, related).

## Achievements
- `GET /api/users/{id}/achievements`: List achievements for a user profile.
- `POST /api/users/{id}/achievements`: Add an achievement.
- `POST /api/achievements/{id}/comments`: Admin comment on achievement.

## Collaboration & Analytics
- `GET /api/chat/{type}/{id}`: Poll chat messages.
- `POST /api/chat/{type}/{id}`: Send message with optional attachment and mentions.
- `GET /api/analytics/me`: Fetch productivity and efficiency charts for current user profile.

## Recovery System
- `GET /api/recovery`: List all soft-deleted entities (users, tasks, projects).
- `POST /api/recovery/issues/{id}/restore`: Restore task with comments and chat.
