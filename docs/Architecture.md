# Architecture

## Overview

TeamXtreme is a single deployable unit: one Node.js backend that serves both
the JSON API and the built React PWA as static files, backed by Postgres, and
exposed to the internet through a Cloudflare Tunnel. A ClamAV sidecar scans
every uploaded file before it becomes accessible. Everything runs via
`docker-compose.yml` in production; the frontend can also run standalone for
local UI development.

```
┌─────────────┐      ┌───────────────────────┐      ┌──────────────┐
│ cloudflared │─────▶│   teamxtreme-server    │─────▶│   postgres   │
│  (tunnel)   │      │  Express API + static  │      │  (data)      │
└─────────────┘      │  React PWA build       │      └──────────────┘
                      └───────────┬───────────┘
                                  │ scans uploads before
                                  ▼ they're served back
                      ┌───────────────────────┐
                      │        clamav          │
                      │  (malware scanning)    │
                      └───────────────────────┘
```

## Repository layout

```
docker-compose.yml       # orchestrates teamxtreme-server, postgres, cloudflared
.env                      # secrets/config for docker-compose (not committed)
.env.example              # documents every var .env needs
tests/                    # API + security tests, run locally against a disposable Postgres
                           # container — see tests/README.md
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
      003_create_media.sql                             # media table for shared photos/videos
    src/
      app.js                # builds and exports the Express app (routes, static hosting, SPA
                             # fallback) without calling .listen() — imported directly by index.js
                             # and by the test suite, which mounts it on an ephemeral port
      index.js             # process entry point: runs migrations, bootstraps the first admin,
                            # then app.listen()
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
        media.js              # media queries (shared photos/videos)
      utils/
        jwt.js               # session cookie + OAuth "state" JWT helpers
        asyncHandler.js       # forwards rejected promises from async route handlers to Express
        uploads.js            # resolves + creates the uploads dir and quarantine dir (UPLOADS_DIR/
                               # QUARANTINE_DIR or local defaults)
        malwareScan.js         # wraps `clamscan`, talking to the clamav container over TCP
        scanUpload.js          # shared multer-based upload middleware: writes to the quarantine
                                # dir, scans with malwareScan.js, only then moves the file into
                                # uploadsDir — used by both profile.js and media.js
      middleware/
        auth.js              # requireAuth (reads tx_session cookie), requireAdmin
      oauth/
        providers.js         # generic OAuth2 authorize/exchange for google + instagram
      routes/
        health.js           # GET /api/health
        auth.js              # login/logout/me, invites, register, google/instagram OAuth
        users.js             # GET /api/users — minimal {id, name} directory for assign pickers
        profile.js            # GET/PATCH /api/profile — name + profile picture upload (scanUpload.js)
        flights.js           # flights CRUD, mounted behind requireAuth
        accommodations.js    # accommodations add + assign/accept, mounted behind requireAuth
        vehicles.js          # vehicles add + assign/accept, mounted behind requireAuth
        media.js              # media upload (scanUpload.js) + gallery listing, mounted behind requireAuth
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
        RequireAuth.jsx      # route guards (RequireAuth, RequireAdmin); also renders BottomNav
        BottomNav.jsx         # fixed bottom nav, icon-only (Home/Reise/Unterkunft/Fahrzeuge/Profil/[Admin])
        auth.css
      pages/
        LoginPage.jsx
        InvitePage.jsx        # invite-acceptance: password signup or Google/Instagram
        AdminInvitesPage.jsx  # admin-only: create invites, copy shareable links
        HomePage.jsx          # hardcoded homepage cards (training, travel info, packing list);
                                # also the app-wide "share" button (Web Share API, clipboard
                                # fallback) overlaid on the header image
        FlightsPage.jsx        # add/edit/delete own flight, overview of everyone's flights
        AccommodationsPage.jsx # add accommodation, assign self/others, accept an assignment
        VehiclesPage.jsx       # add vehicle (seats/details), assign self/others, accept an assignment
        SettingsPage.jsx       # edit own name + profile picture ("Profil" in the bottom nav), logout
        CalendarPage.jsx       # read-only presence/accommodation table, derived from flights + accommodations
        MediaPage.jsx           # upload + gallery of shared photos/videos
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

## Media storage

- Uploaded files (profile pictures and shared media) are written to a
  directory resolved by `utils/uploads.js` — `UPLOADS_DIR` if set, otherwise
  `src/backend/uploads` next to the backend source (created on demand,
  gitignored) so it works without Docker too. In `docker-compose.yml` the
  backend mounts the `uploads-data` volume at `/app/uploads`, matching the
  spec's "uploaded media should be stored in a mounted volume."
- Files are served back publicly (no auth) from `/uploads/<filename>` via
  `express.static`, with filenames generated as a random UUID (see
  `utils/scanUpload.js`) — unguessable enough for this app's small-trusted-group
  threat model (same reasoning as [Auth](#auth)'s session design).
- Before a file ever reaches `uploadsDir`, it's scanned — see
  [Malware scanning](#malware-scanning) below.

## Malware scanning

Per the spec's "Security" requirement, every upload (profile pictures, shared
media) runs through ClamAV before it becomes reachable at `/uploads/...`:

1. `utils/scanUpload.js` (a shared multer-based middleware factory, used by
   both `routes/profile.js` and `routes/media.js`) writes the incoming file
   to `quarantineDir` — a directory resolved by `utils/uploads.js`
   (`QUARANTINE_DIR` if set, otherwise a `quarantine` folder next to
   `uploadsDir`) that is **not** covered by the `/uploads` static mount, so a
   file can never be served before it's cleared.
2. It's scanned via `utils/malwareScan.js`, which wraps the `clamscan` npm
   package configured to talk to the `clamav` container over TCP
   (`CLAMAV_HOST`/`CLAMAV_PORT`, default `localhost:3310`) — no local
   `clamscan`/`clamdscan` binary needed in the Node container.
3. If ClamAV reports the file as infected, it's deleted from quarantine and
   the request gets a `400`. If the scan itself fails (e.g. `clamav`
   unreachable), the file is likewise deleted and the request fails with a
   `500` — scanning failures fail closed rather than skipping the check.
4. Otherwise the file is moved (same filename) from quarantine into
   `uploadsDir`, and only then is it referenced in a response or the
   database.

`clamav` (see [Deployment](#deployment)) uses the `clamav/clamav-debian:1.4`
image, which ships with a preloaded signature database (the non-`_base` tag)
so it doesn't need to download the full ClamAV database set on every
container start/restart — just incremental updates.

## Frontend

- React 18 + Vite, plain JavaScript (no TypeScript, to keep the early-stage
  scaffold light — revisit if the codebase grows enough to justify it).
- `vite-plugin-pwa` generates the manifest and service worker
  (`generateSW` strategy) so the app is installable and works offline for
  already-visited pages.
- All UI text is hardcoded German, per spec — no i18n layer.
- The homepage (`pages/HomePage.jsx`) is fully hardcoded per spec: header image, training
  times/location card, travel info card (nearest airport: Málaga/AGP), and a
  packing recommendation list. The training times/location card has real
  content; `public/header.png` is still a placeholder — replace it with real
  branding/a team photo.

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
   [ExternalSetup.md](ExternalSetup.md). `clamav` can take a few minutes to
   report healthy the very first time (loading its bundled signature
   database); `teamxtreme-server` waits for it before starting.

Backend-only local dev (`cd src/backend && npm install && npm run dev`, via
`nodemon`) needs a reachable Postgres and `clamav` (e.g.
`docker compose up postgres clamav`, then set `CLAMAV_HOST`/`CLAMAV_PORT` to
wherever that container is reachable from the host) and the same env vars as
above, plus it has nothing to serve under `/` until the frontend has been
built into `src/backend/public` (a manual step, or via the Docker build) —
the `/api/*` routes work regardless. Uploads (profile picture, media) will
fail closed if `clamav` isn't reachable — see
[Malware scanning](#malware-scanning).

## Testing

`tests/` (a separate package from `src/backend/`) holds API and security
tests, run with Node's built-in test runner against the real Express app
(`src/backend/src/app.js`) and disposable containers defined in
`tests/docker-compose.yml`: a tmpfs-backed Postgres (port 5433) and a
`clamav-test` ClamAV instance (port 3311) — so it never touches a real
dev/prod database, and the malware-scan tests run against a real ClamAV, not
a mock. `cd tests && npm install && npm test` brings both containers up,
waits for them to be healthy, and runs everything under `tests/api/` (one
file per resource, covering the documented success/error responses —
`media.test.js` also uploads the standard EICAR test string and asserts it's
rejected and never stored) and `tests/security/` (every authenticated route
rejecting a missing/forged session cookie, non-admins hitting admin-only
routes, cross-user ownership checks). See [tests/README.md](../tests/README.md)
for details. This is also why the Express app is split into `app.js`
(exported, no `.listen()`) and `index.js` (the process entry point) — tests
import `app.js` directly and mount it on an ephemeral port.

## Deployment

`docker-compose.yml` defines four services:

- `teamxtreme-server` — built from `src/Dockerfile`, listens on container
  port 8000. Not published to a host port — only `cloudflared` reaches it,
  over the tunnel's internal Docker network. Has a Docker `HEALTHCHECK`
  against `/api/health`. Waits on both `postgres` and `clamav` being healthy
  before starting.
- `postgres` — Postgres 16, healthcheck via `pg_isready`, data persisted in
  the `postgres-data` volume.
- `teamxtreme-server` also mounts the `uploads-data` volume at `/app/uploads`
  (see [Media storage](#media-storage)).
- `clamav` — ClamAV (`clamav/clamav-debian:1.4`), healthcheck via
  `clamdscan --ping 1`, signature database persisted in the `clamav-data`
  volume so it isn't re-downloaded on every restart. Not published to a host
  port — only reachable from other containers on the compose network, at
  `clamav:3310`. See [Malware scanning](#malware-scanning).
- `cloudflared` — runs a Cloudflare Tunnel (token-based) to expose the app
  publicly without opening inbound ports. Public hostname routing is
  configured in the Cloudflare dashboard, not in this repo — see
  [ExternalSetup.md](ExternalSetup.md).
