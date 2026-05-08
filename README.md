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
pip install -r ../requirements-dev.txt  # optional: tests only

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

# Mimic Vercel Cron (GET + Bearer) against production:
CRON_SECRET=your_secret python scripts/workers/email_poll.py --once \\
  --url https://YOUR_DEPLOYMENT.vercel.app --vercel
```

## Environment variables

- **Backend**: values are loaded from the repo root `.env` (see `.env.example`).
- **Frontend**: `VITE_BACKEND_ORIGIN` can point the UI at your backend (example: `http://localhost:5000`).

## Vercel: scheduled email polling (Cron)

Inbound email is ingested when something calls **`GET` or `POST`** `/api/integrations/email/poll` (same route; credentials come from env unless you override in the JSON body).

- **POST** (`curl`, scripts): no `CRON_SECRET` required—use JSON as today.
- **GET** (**Vercel Cron**): Vercel only issues **GET** requests. Those calls must authenticate with **`CRON_SECRET`**:
  - In the Vercel project, set env **`CRON_SECRET`** (long random string, 16+ characters).
  - Vercel automatically sends **`Authorization: Bearer <CRON_SECRET>`** on cron invocations.
  - If `CRON_SECRET` is unset, **GET returns 503** (POST still works).

This repo includes **`crons`** in root `vercel.json` targeting `/api/integrations/email/poll`. The current schedule is **`*/15 * * * *`** (every 15 minutes, UTC). If you’re on **Vercel Hobby**, cron jobs are limited (for example, runs may be restricted to once/day); in that case, change the schedule to a supported value or use GitHub Actions. See [Vercel Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Manual check (production):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR_DEPLOYMENT/api/integrations/email/poll"
```

Optional query params on GET match POST overrides: `hours_back`, `folder`, `imap_port`, `imap_server`, `username`, `password`.

More detail: [`docs/integrations/email.md`](docs/integrations/email.md).

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

- Production uses an external database via `DATABASE_URL` (for example Neon Postgres).
- Backend `.env` values are loaded from the repo root `.env`.
- The first reorganization pass preserves behavior while making the codebase easier to scale and split further by domain.
