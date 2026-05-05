# Frontend (Vite + React)

The frontend is the Vite + React dashboard for the Customer Feedback Platform.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

## Build

```bash
cd frontend
npm run build
```

## Environment

- **`VITE_BACKEND_ORIGIN`**: Backend origin such as `http://localhost:5000`.
  - When omitted, the app falls back to the default origin logic in `src/shared/lib/apiClient`.

## Structure

- **`src/app/`**: app bootstrap + shell (sidebar/header/view switcher)
- **`src/pages/`**: thin page wrappers (dashboard overview/insights, inbox)
- **`src/features/`**: feature modules (auth, dashboard, inbox, admin, notifications, etc.)
- **`src/shared/`**: cross-cutting UI + utilities (API client, layout, reusable components)

## Conventions

- **Feature-owned API calls** live in that feature’s `services/` folder.
- **Shared cross-cutting code** belongs in `src/shared/`.
- **Page wrappers stay thin**: routing / view switching lives in `src/app/App.jsx`, while heavy UI lives under `src/features/...`.

## Deploy to Vercel (frontend-only)

This repo also contains a Flask backend under `backend/`. If you want Vercel to deploy **only** the frontend, the repo-level `vercel.json` is configured to use `@vercel/static-build` with the `frontend/` app.

If you want the backend deployed too, you’ll need a separate deployment target (e.g. Render/Fly.io/Railway) or a dedicated Vercel serverless setup for Flask.