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
.env.example              # documents every var .env needs
src/
  Dockerfile              # multi-stage: builds frontend, copies dist into backend image
  .dockerignore
  backend/                # Node.js (Express) API + static file host
    package.json
    migrations/            # hand-rolled, numbered SQL files, applied in order at startup
      001_create_users_and_invites.sql
      002_create_flights_accommodations_vehicles.sql  # also creates accommodations/vehicles
                                                        # tables + their assignment tables, ahead
                                                        # of those features' routes/UI landing
    src/
      index.js             # app entry: runs migrations, static hosting, SPA fallback, mounts routers
      db/
        pool.js              # pg Pool (POSTGRES_* env vars); overrides pg's DATE type parser
                              # to keep DATE columns as plain 'YYYY-MM-DD' strings (avoids a
                              # timezone-dependent off-by-one-day bug on JSON round-trip)
        migrate.js           # applies pending migrations/*.sql, tracked in schema_migrations
        bootstrapAdmin.js    # creates the first admin from ADMIN_EMAIL/PASSWORD on an empty DB
        users.js             # user queries
        flights.js           # flight queries
        accommodations.js    # accommodation + accommodation_assignment queries
        vehicles.js          # vehicle + vehicle_assignment queries
      utils/
        jwt.js               # session cookie + OAuth "state" JWT helpers
        asyncHandler.js       # forwards rejected promises from async route handlers to Express
      middleware/
        auth.js              # requireAuth (reads tx_session cookie), requireAdmin
      oauth/
        providers.js         # generic OAuth2 authorize/exchange for google + instagram
      routes/
        health.js           # GET /api/health
        auth.js              # login/logout/me, invites, register, google/instagram OAuth
        users.js             # GET /api/users — minimal {id, name} directory for assign pickers
        flights.js           # flights CRUD, mounted behind requireAuth
        accommodations.js    # accommodations add + assign/accept, mounted behind requireAuth
        vehicles.js          # vehicles add + assign/accept, mounted behind requireAuth
  frontend/               # React PWA (Vite)
    package.json
    vite.config.js         # includes vite-plugin-pwa (manifest + service worker)
    index.html
    public/
      icons/                # PWA icons (currently placeholders — swap for real branding)
      header.png            # homepage header image (placeholder)
    src/
      main.jsx              # BrowserRouter + AuthProvider + App
      App.jsx               # route table
      auth/
        AuthContext.jsx      # fetches /api/auth/me, exposes {user, loading, refresh, logout}
        RequireAuth.jsx      # route guards (RequireAuth, RequireAdmin)
        auth.css
      pages/
        LoginPage.jsx
        InvitePage.jsx        # invite-acceptance: password signup or Google/Instagram
        AdminInvitesPage.jsx  # admin-only: create invites, copy shareable links
        HomePage.jsx          # hardcoded homepage cards (training, travel info, packing list)
        FlightsPage.jsx        # add/edit/delete own flight, overview of everyone's flights
        AccommodationsPage.jsx # add accommodation, assign self/others, accept an assignment
        VehiclesPage.jsx       # add vehicle (seats/details), assign self/others, accept an assignment
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
- On startup the server connects to Postgres, applies any pending files in
  `migrations/` (tracked in a `schema_migrations` table — see
  `src/db/migrate.js`), then bootstraps the first admin account if the users
  table is still empty (see [Auth](#auth) below) before it starts listening.

## Auth

- Sessions are a JWT in an httpOnly `tx_session` cookie (`sameSite: lax`,
  30-day expiry, signed with `JWT_SECRET`) — set by login, registration, and
  the OAuth callbacks, cleared by logout. Stateless: there's no server-side
  session store or revocation list, so a leaked token stays valid until it
  expires. Acceptable for this app's threat model (a small, trusted travel
  group); revisit if that changes.
- Accounts are invite-only. `users.is_admin` gates who can create invites
  (`POST /api/auth/invites`); a fresh database has no users, so
  `bootstrapAdmin.js` creates one admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env
  vars the first time the server starts against an empty `users` table.
- An invite (`invites` table: `token`, `invitee_name`, `used_by`/`used_at`) is
  a one-time link, `${APP_BASE_URL}/invite/:token`. Visiting it lets the
  invitee either set a password (`POST /api/auth/register`) or continue with
  Google/Instagram — either path consumes the invite and creates the
  `users` row.
- Google and Instagram OAuth (`src/oauth/providers.js`) are implemented by
  hand (no `passport`) since both are plain authorization-code OAuth2: build
  the authorize URL, exchange the code for a token, fetch the profile.
  OAuth `state` is itself a short-lived signed JWT carrying
  `{ mode: 'login' | 'invite', invite? }`, so no server-side state storage is
  needed for the round trip either.
  - Google returns an email; Instagram's API does not, so Instagram-only
    accounts have `email = NULL` and can't use password login.
  - Instagram login requires the account to be an Instagram professional
    (business/creator) account and a configured Meta app — see
    [ExternalSetup.md](ExternalSetup.md).
- Login-mode OAuth (no `invite` param) only succeeds if that Google/Instagram
  ID is already linked to a user — it does not auto-link by matching email,
  so a provider can't be added to an existing account after the fact without
  going through a new invite.

## Frontend

- React 18 + Vite, plain JavaScript (no TypeScript, to keep the early-stage
  scaffold light — revisit if the codebase grows enough to justify it).
- `vite-plugin-pwa` generates the manifest and service worker
  (`generateSW` strategy) so the app is installable and works offline for
  already-visited pages.
- All UI text is hardcoded German, per spec — no i18n layer.
- The homepage (`pages/HomePage.jsx`) is fully hardcoded per spec: header image, training
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
   Runs on Vite's dev server. The homepage itself has no API calls, but
   login/invite/logout do — a `/api` proxy to `http://localhost:8000` is
   configured in `vite.config.js`, so run the backend (below) alongside this
   for anything auth-related to work. Password login/registration work fine
   this way; Google/Instagram's full-page OAuth redirect isn't proxied, so
   after completing it the browser lands on the backend's own port
   (`localhost:8000`) rather than back on `5173` — use backend-only dev
   (below) instead if you need to test those end to end.

2. **Full stack via Docker Compose** — for production-like testing:
   ```
   docker compose up --build
   ```
   Requires `POSTGRES_PASSWORD`, `JWT_SECRET`, and `ADMIN_EMAIL`/
   `ADMIN_PASSWORD` (to bootstrap the first admin) set in `.env`, plus
   `CLOUD_FLARE_TUNNEL_TOKEN` for the tunnel to come up. Note that
   `teamxtreme-server` isn't published to a host port (see Deployment below),
   so this mode is for exercising the full stack together, not for opening it
   in a browser directly — for that, use backend-only dev. See
   [ExternalSetup.md](ExternalSetup.md).

Backend-only local dev (`cd src/backend && npm install && npm run dev`, via
`nodemon`) needs a reachable Postgres (e.g. `docker compose up postgres`) and
the same env vars as above, plus it has nothing to serve under `/` until the
frontend has been built into `src/backend/public` (a manual step, or via the
Docker build) — the `/api/*` routes work regardless.

## Deployment

`docker-compose.yml` defines three services:

- `teamxtreme-server` — built from `src/Dockerfile`, listens on container
  port 8000. Not published to a host port — only `cloudflared` reaches it,
  over the tunnel's internal Docker network. Has a Docker `HEALTHCHECK`
  against `/api/health`.
- `postgres` — Postgres 16, healthcheck via `pg_isready`, data persisted in
  the `postgres-data` volume.
- `cloudflared` — runs a Cloudflare Tunnel (token-based) to expose the app
  publicly without opening inbound ports. Public hostname routing is
  configured in the Cloudflare dashboard, not in this repo — see
  [ExternalSetup.md](ExternalSetup.md).
