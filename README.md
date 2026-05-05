# Customer Feedback Platform

This repository is organized as a two-app workspace:

- `backend/`: Flask API, ingestion logic, server-rendered fallback pages, and backend tests
- `frontend/`: Vite/React dashboard application
- `docs/`: setup, integration, architecture, and operations documentation
- `scripts/`: development, database, data-maintenance, and worker helper scripts
- `config/`: repo-level config assets and deployment-oriented configuration

## Quick Start

### 0) Go to the repo (from `/home/araba`)

```bash
cd /home/araba/customer_feedback_platform
```

### Backend

```bash
cd /home/araba/customer_feedback_platform/backend

# Create venv (first time)
python -m venv ../.venv
source ../.venv/bin/activate

# Install deps (first time / after changes)
pip install -r requirements.txt

# Run
python run.py
```

### Frontend

```bash
cd /home/araba/customer_feedback_platform/frontend
npm install
npm run dev
```

### Build (frontend)

```bash
cd /home/araba/customer_feedback_platform/frontend
npm run build
```

### Helpful Scripts

```bash
./scripts/dev/start_backend.sh
python scripts/db/init_db.py
python scripts/workers/email_poll.py --once
```

## Environment variables

- **Backend**: values are loaded from the repo root `.env` (see `.env.example`).
- **Frontend**: `VITE_BACKEND_ORIGIN` can point the UI at your backend (example: `http://localhost:5000`).

## Repository Layout

```text
backend/   Flask application and backend tests
frontend/  React dashboard
docs/      Product and engineering documentation
scripts/   Dev, db, data, and worker scripts
config/    Shared configuration assets
```

## Push to GitHub

From the repo root:

```bash
cd /home/araba/customer_feedback_platform

# Check what changed
git status

# Stage everything (or replace '.' with specific files)
git add .

# Commit
git commit -m "Refactor dashboard structure and Vercel config"

# Push (main branch)
git push origin main
env -u GIT_ASKPASS -u SSH_ASKPASS GIT_TERMINAL_PROMPT=1 git push -u origin main
```

If you haven’t set the remote yet:

```bash
cd /home/araba/customer_feedback_platform
git remote -v
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Notes

- Local runtime data such as `feedback.db` stays at the repository root for now.
- Backend `.env` values are loaded from the repo root `.env`.
- The first reorganization pass preserves behavior while making the codebase easier to scale and split further by domain.
