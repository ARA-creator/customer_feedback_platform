# Customer Feedback Platform

This repository is organized as a two-app workspace:

- `backend/`: Flask API, ingestion logic, server-rendered fallback pages, and backend tests
- `frontend/`: Vite/React dashboard application
- `docs/`: setup, integration, architecture, and operations documentation
- `scripts/`: development, database, data-maintenance, and worker helper scripts
- `config/`: repo-level config assets and deployment-oriented configuration
````bash
source .venv/bin/activate
````
Backend 
````bash
cd /home/araba/customer_feedback_platform/backend
python run.py`
````
Frontend
````bash
cd /home/araba/customer_feedback_platform/frontend
npm install   # only needed the first time (or after dependency changes)
npm run dev
````

## Quick Start

### Backend

```bash
cd backend
../.venv/bin/python run.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Helpful Scripts

```bash
./scripts/dev/start_backend.sh
python scripts/db/init_db.py
python scripts/workers/email_poll.py --once
```

## Repository Layout

```text
backend/   Flask application and backend tests
frontend/  React dashboard
docs/      Product and engineering documentation
scripts/   Dev, db, data, and worker scripts
config/    Shared configuration assets
```

## Notes

- Local runtime data such as `feedback.db` stays at the repository root for now.
- Backend `.env` values are loaded from the repo root `.env`.
- The first reorganization pass preserves behavior while making the codebase easier to scale and split further by domain.
