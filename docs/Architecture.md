# Architecture

## Overview

TeamXtreme is a single deployable unit: one Node.js backend that serves both
the JSON API and the built React PWA as static files, backed by Postgres, and
exposed to the internet through a Cloudflare Tunnel. Everything runs via
`docker-compose.yml` in production; the frontend can also run standalone for
local UI development.

```
┌─────────────┐      ┌───────────────────────┐      ┌──────────────┐
│ cloudflared │─────▶│   teamxtreme-server    │─────▶│   postgres   │
│  (tunnel)   │      │  Express API + static  │      │  (data)      │
└─────────────┘      │  React PWA build       │      └──────────────┘
                      └───────────────────────┘
```

## Repository layout

```
docker-compose.yml       # orchestrates teamxtreme-server, postgres, cloudflared
.env                      # secrets/config for docker-compose (not committed)
src/
  Dockerfile              # multi-stage: builds frontend, copies dist into backend image
  .dockerignore
  backend/                # Node.js (Express) API + static file host
    package.json
    src/
      index.js             # app entry: static hosting, SPA fallback, mounts routers
      routes/
        health.js           # GET /api/health
  frontend/               # React PWA (Vite)
    package.json
    vite.config.js         # includes vite-plugin-pwa (manifest + service worker)
    index.html
    public/
      icons/                # PWA icons (currently placeholders — swap for real branding)
      header.png            # homepage header image (placeholder)
    src/
      main.jsx
      App.jsx               # hardcoded homepage cards (training, travel info, packing list)
```

## Backend

- Node.js + Express, ESM (`"type": "module"`).
- Serves the API under `/api/*`.
- Serves the frontend's built `dist/` (copied into `backend/public` at Docker
  build time) as static assets, with a catch-all SPA fallback to `index.html`
  for any non-`/api` route.
- `cors` is enabled so the frontend can also be run against the backend from a
  different origin during local development (e.g. Vite's dev server on
  `localhost:5173` talking to the backend on `localhost:8000`).
- Currently stateless — no database connection is wired up yet. That lands
  with the first data-backed feature (see
  [DevelopmentPlan.md](DevelopmentPlan.md)).

## Frontend

- React 18 + Vite, plain JavaScript (no TypeScript, to keep the early-stage
  scaffold light — revisit if the codebase grows enough to justify it).
- `vite-plugin-pwa` generates the manifest and service worker
  (`generateSW` strategy) so the app is installable and works offline for
  already-visited pages.
- All UI text is hardcoded German, per spec — no i18n layer.
- The homepage (`App.jsx`) is fully hardcoded per spec: header image, training
  times/location card, travel info card (nearest airport: Málaga/AGP), and a
  packing recommendation list. The header image and training
  times/location are placeholders — replace `public/header.png` and the
  training card's placeholder text with real content.

## Local development

Two supported modes:

1. **Frontend-only (no backend, no Docker)** — for iterating on the PWA UI:
   ```
   cd src/frontend
   npm install
   npm run dev
   ```
   Runs on Vite's dev server. Since the current homepage has no API calls,
   this is fully self-contained. A `/api` proxy to `http://localhost:8000` is
   already configured in `vite.config.js` for when API-backed features land.

2. **Full stack via Docker Compose** — for production-like testing:
   ```
   docker compose up --build
   ```
   Requires `POSTGRES_PASSWORD` (and eventually `CLOUD_FLARE_TUNNEL_TOKEN`)
   set in `.env`. See [ExternalSetup.md](ExternalSetup.md).

Backend-only local dev (`cd src/backend && npm install && npm run dev`, via
`nodemon`) also works but currently has nothing to serve under `/` until the
frontend has been built into `src/backend/public` (a manual step, or via the
Docker build) — the `/api/health` endpoint works regardless.

## Deployment

`docker-compose.yml` defines three services:

- `teamxtreme-server` — built from `src/Dockerfile`, listens on container
  port 8000 (mapped to host `1337`), has a Docker `HEALTHCHECK` against
  `/api/health`.
- `postgres` — Postgres 16, healthcheck via `pg_isready`, data persisted in
  the `postgres-data` volume. Not yet used by the backend.
- `cloudflared` — runs a Cloudflare Tunnel (token-based) to expose the app
  publicly without opening inbound ports. Public hostname routing is
  configured in the Cloudflare dashboard, not in this repo — see
  [ExternalSetup.md](ExternalSetup.md).
