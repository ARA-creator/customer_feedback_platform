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

# Mimic Vercel Cron (GET + Bearer) against production:
CRON_SECRET=your_secret python scripts/workers/email_poll.py --once \\
  --url https://YOUR_DEPLOYMENT.vercel.app --vercel
```

### Recompute sentiment in the database

Deploying new sentiment logic does **not** change existing rows. To rewrite **`sentiment_label`** and **`sentiment_score`** for stored feedback (same rules as the app), use either:

**A) CLI (recommended for large backfills)** — uses **`DATABASE_URL`** and **`SECRET_KEY`** from the repo-root **`.env`** (same as the backend):

```bash
cd customer_feedback_platform

# Preview counts (no writes)
python scripts/data/reprocess_sentiment.py --force --dry-run

# Rewrite all rows that already have sentiment (typical after tuning the model)
python scripts/data/reprocess_sentiment.py --force --until-done --order oldest

# One batch only (500 rows); repeat with --cursor-id from printed next_cursor_id if needed
python scripts/data/reprocess_sentiment.py --force --limit 500 --order oldest
```

Omit **`--force`** to only fill rows where sentiment is still empty.

**Neon:** Your app’s feedback rows live in **Postgres** (often **Neon**). Both the script and Vercel use **`DATABASE_URL`**: when that variable is your Neon connection string, **`UPDATE feedback … sentiment_label / sentiment_score`** runs **on Neon**—there is no separate “local” sentiment store for production.

- Put the same **`DATABASE_URL`** as production in repo-root **`.env`** (Neon dashboard → **Connection string**; usually includes **`sslmode=require`**). The script prints a **`database_target`** line (host + database name, no password) so you can confirm it says **Neon** before it commits.
- On **Vercel**, **`DATABASE_URL`** should already point at Neon; calling **`/api/admin/reprocess-sentiment`** from production updates the **same** Neon database your dashboard reads.

**B) HTTP** — `POST` **`/api/admin/reprocess-sentiment?force=true&limit=5000`** with an admin session or **`token=`** matching **`ADMIN_ACTION_TOKEN`**. See the route’s **GET** handler for the full parameter list.

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
