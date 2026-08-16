# Redesign MediaSci Local Demo

Redesign MediaSci is the standalone full-stack copy of MediaSci Operation Hub with the Gumroad-inspired visual system applied across the frontend. The local development configuration uses SQLite so the application can be run without a MySQL service.

## Run locally

Start the backend from the `backend` directory with `uvicorn main:app --host 0.0.0.0 --port 8001`. The SQLite database is configured through `backend/.env` as `sqlite:///./redesign_mediasci.db`.

To recreate the local database from the current SQLAlchemy models and load the linked operation-hub demo data, run the following from `backend`:

```bash
python3 create_local_db.py
```

Start the frontend from the `frontend` directory with:

```bash
npm run dev
```

The frontend runs on port `5174` and proxies `/api`, `/spa`, `/locale`, `/sanctum`, `/storage`, and `/attachments` to the backend on port `8001`.

## Demo access

| Field | Value |
|---|---|
| Frontend | https://5174-i04qt2bh6yec0orfhrnya-6e12f491.sg1.manus.computer/ |
| Email | `superadmin@taskflow.dev` |
| Password | `password123` |
| Backend | `http://localhost:8001` |

## Verified flows

The login endpoint, authenticated bootstrap request, global summary dashboard, 15-row issues table, and project overview at `/projects/1` were verified against the seeded SQLite database. The project overview includes the Digital Banking Platform, health and delivery metrics, issue breakdowns, teams, members, sprints, and links to the project’s Board, Backlog, Roadmap, Reports, and Issues views.

The frontend production build and backend Python compilation both pass. The project has not been pushed from this standalone working directory.
