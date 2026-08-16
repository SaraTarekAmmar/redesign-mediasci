# Enterprise TaskFlow Agile Suite

Welcome to the Enterprise TaskFlow project management system. The repo is split into a FastAPI `backend/` app and a standalone React `frontend/` app.

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt

   cd ../frontend
   npm install
   ```

2. **Environment Setup**:
   - Update `backend/.env` if needed.
   - Keep `FRONTEND_URL=http://127.0.0.1:5173` for local split development.

3. **Run the Backend**:
   ```bash
   cd backend
   python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```

4. **Run the Frontend**:
   ```bash
   cd frontend
   npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
   ```

5. **Open the App**:
   - Frontend: `http://127.0.0.1:5173/app`
   - Backend auth/API: `http://127.0.0.1:8000`

## Sample Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Super Admin** | `superadmin@taskflow.dev` | `password` |
| **Project Admin** | `admin@taskflow.dev` | `password` |
| **Team Leader** | `leader@taskflow.dev` | `password` |
| **Developer** | `dev1@taskflow.dev` | `password` |

## Core Features

- **Agile Backlog**: Drag & drop issues between backlog and sprints.
- **Sprint Management**: Complete sprints with intelligent task movement options.
- **Enterprise Chat**: Per-task chat with @mentions, inline images, and file referencing.
- **File Management**: Multi-file uploads with secure storage.
- **Advanced Recovery**: Cascading restore for issues, comments, and attachments.
- **Dependencies**: Support for blocking and related task links.
- **Analytics**: Burn-down charts, velocity tracking, and user productivity dashboards.

## Database Schema

The system uses a relational schema centered on:
- `issues`
- `epics`
- `chats` and `messages`
- `issue_attachments`
- `task_dependencies`
- `activity_logs`
