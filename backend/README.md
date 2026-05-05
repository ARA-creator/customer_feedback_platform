# Backend

The backend is a Flask application that handles:

- feedback ingestion and APIs
- authentication and sessions
- channel integrations and polling
- reporting, workflow, and analytics

## Run locally

```bash
cd backend
../.venv/bin/python run.py
```

## Tests

```bash
cd backend
../.venv/bin/pytest tests
```

## Structure

- `app/core/`: configuration, database, and security
- `app/routes/`: HTTP blueprints
- `app/services/`: business logic helpers
- `app/integrations/`: external platform adapters
- `tests/`: backend test suite

## Configuration

Backend settings are loaded from the repository root `.env`.

### WhatsApp (Twilio)

- **Inbound webhook:** `POST /integrations/whatsapp/twilio` (configure this URL in Twilio; set `TWILIO_AUTH_TOKEN` to verify signatures).
- **REST polling (no public URL):** with `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`, the app can fetch recent inbound WhatsApp messages from Twilio’s API on a timer—similar to IMAP email polling.
  - Environment variables: see the root `.env.example` (`WHATSAPP_POLL_*`, optional `TWILIO_WHATSAPP_TO_NUMBER` to match a specific “To” number).
  - In `development`, a background poller may start when Twilio credentials are present; in other environments, set `WHATSAPP_POLL_ENABLED=true` to enable it.
  - **Manual run:** `POST /integrations/whatsapp/poll` with optional JSON overrides (`account_sid`, `auth_token`, `hours_back`, `to_number`); defaults come from config.

Future improvement:

- add `migrations/` with Alembic once schema changes become more frequent
