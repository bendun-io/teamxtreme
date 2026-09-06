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
.github/
  dependabot.yml           # weekly version-update checks for every package.json, Dockerfile
                            # and docker-compose.yml (see docs/Spec.md's "Security" section)
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
      004_add_user_contact_fields.sql                  # users.phone, users.instagram_handle
      005_add_media_thumbnail.sql                      # media.thumbnail_name
      006_create_settings.sql                           # key/value settings table (whatsapp_link)
      007_add_accommodation_spots.sql                    # accommodations.spots (nullable)
      008_create_activities.sql                           # activities table
      009_add_vehicle_ride_fields.sql                       # vehicles.starting_point/ending_point/
                                                              # departure_time (nullable — pre-migration
                                                              # rows simply have none of these)
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
        activities.js         # activity queries (create/list/stop)
        media.js              # media queries (shared photos/videos)
        settings.js            # key/value app settings (currently just whatsappLink)
      utils/
        jwt.js               # session cookie + OAuth "state" JWT helpers
        loginRateLimit.js     # per-IP failed-login counter + 10-minute block
                               # (in-memory), used by routes/auth.js's login handler
        asyncHandler.js       # forwards rejected promises from async route handlers to Express
        uploads.js            # resolves + creates the uploads dir, quarantine dir and thumbnails
                               # dir (UPLOADS_DIR/QUARANTINE_DIR or local defaults)
        malwareScan.js         # wraps `clamscan`, talking to the clamav container over TCP
        scanUpload.js          # shared multer-based upload middleware: writes to the quarantine
                                # dir, scans with malwareScan.js, only then moves the file into
                                # uploadsDir — used by both profile.js and media.js
        thumbnail.js            # generateImageThumbnail() — resizes an uploaded image via sharp;
                                # used only by routes/media.js (see Architecture.md#media-thumbnails)
      middleware/
        auth.js              # requireAuth (reads tx_session cookie), requireAdmin
      oauth/
        providers.js         # generic OAuth2 authorize/exchange for google + instagram
      routes/
        health.js           # GET /api/health
        auth.js              # login/logout/me, invites, register, google/instagram OAuth
        users.js             # GET /api/users — directory (id, name, contact info) for assign
                               # pickers and the Calendar contact overlay
        profile.js            # GET/PATCH /api/profile — name, email, phone, Instagram handle,
                                # and profile picture upload (scanUpload.js)
        flights.js           # flights CRUD, mounted behind requireAuth
        accommodations.js    # accommodations add + assign/accept, mounted behind requireAuth
        vehicles.js          # vehicles add + assign/accept, mounted behind requireAuth
        activities.js         # activities add + list (ongoing/future only) + stop,
                               # mounted behind requireAuth
        media.js              # media upload (scanUpload.js + thumbnail.js) + gallery listing +
                               # download-all zip (archiver), mounted behind requireAuth
        settings.js            # GET /api/settings — read-only, any authenticated user
        admin.js                # PATCH /api/admin/settings + POST /api/admin/clear-data,
                                 # mounted behind requireAuth + requireAdmin — see "Admin Menu" below
  frontend/               # React PWA (Vite)
    package.json
    vite.config.js         # includes vite-plugin-pwa (manifest + service worker); dev proxy for
                            # both /api and /uploads to the backend
    index.html
    public/
      icons/                # PWA icons — the real Team Xtreme BJJ Karlsruhe club logo
      header.svg            # homepage hero banner — a designed graphic in brand colors
                             # with a belt-knot emblem; swap for a real team photo if/when
                             # one becomes available (any image format works, .hero-image
                             # in App.css just does object-fit: cover)
    src/
      main.jsx              # BrowserRouter + AuthProvider + App
      App.jsx               # route table
      auth/
        AuthContext.jsx      # fetches /api/auth/me, exposes {user, loading, refresh, logout}
        RequireAuth.jsx      # route guards (RequireAuth, RequireAdmin); also renders BottomNav
        BottomNav.jsx         # fixed bottom nav, icon-only (Home/Kalender/Reise/Unterkunft/
                               # Fahrzeuge/Aktivitäten/Bilder[+count badge]/Profil/[Admin])
        auth.css
      components/            # small UI pieces shared across pages
        Modal.jsx             # generic centered/bottom-sheet overlay (backdrop click + Escape to
                               # close); used by CalendarPage's contact overlay, reusable elsewhere
        ContactLinks.jsx       # renders a user's mailto/tel/wa.me/instagram links from
                                # {email, phone, instagramHandle}, skipping any that are unset
        ResourceList.css        # shared "add form + list of items with per-owner actions"
                                 # styling for a flat, single-owner resource (no assignments) —
                                 # used by FlightsPage and ActivitiesPage; the richer
                                 # accommodations/vehicles shape has its own AssignableList.css
      media/
        MediaCountContext.jsx  # shared { count, refresh() } for the bottom nav's Bilder badge —
                                # a context (not a plain fetch in BottomNav.jsx) because
                                # MediaPage.jsx needs to trigger a refresh right after an upload
      pages/
        LoginPage.jsx
        InvitePage.jsx        # invite-acceptance: password signup or Google/Instagram
        AdminPage.jsx          # admin menu index (/admin): cards linking to Invites and
                                # Settings, plus the inline "clear data" danger button — see
                                # "Admin Menu" below
        AdminInvitesPage.jsx  # admin-only: create invites, copy shareable links,
                                # or send them via a mailto: link
        AdminSettingsPage.jsx  # admin-only: edit general settings (currently just the
                                 # WhatsApp link)
        HomePage.jsx          # hardcoded homepage cards (training, travel info, packing list);
                                # also the app-wide "share" button (Web Share API, clipboard
                                # fallback) overlaid on the header image, and the "Offene
                                # Aufgaben" open-tasks card (computed client-side from the
                                # caller's own flights/accommodations, hidden when empty)
        FlightsPage.jsx        # add/edit/delete own flight, overview of everyone's flights
        AccommodationsPage.jsx # add accommodation, assign self/others, accept an assignment
        VehiclesPage.jsx       # add a ride (start/end point, departure time, seats/details), assign
                                # self/others, accept an assignment; creator's name opens the shared
                                # contact-overlay Modal; list splits into upcoming (ascending) and a
                                # collapsed past section — see "Vehicles / ride sharing" below
        ActivitiesPage.jsx     # add activity (title/location/start/optional end, with a
                                # "use my location" button), list of ongoing/future activities,
                                # "Beenden" (stop) button for the creator or an admin
        SettingsPage.jsx       # edit own name + profile picture ("Profil" in the bottom nav), logout
        CalendarPage.jsx       # read-only presence/accommodation table, derived from flights + accommodations;
                                # clicking a row's name opens a Modal with that user's ContactLinks; a
                                # landing/departure plane icon marks each row's arrival/departure day
        MediaPage.jsx           # upload + thumbnail-grid gallery of shared photos/videos, a
                                # "download all" zip button, and a full-resolution Modal (with
                                # its own download link) opened by clicking a grid item
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

## Admin Menu

Per docs/Spec.md's "Admin Menu" section, `/admin` (`AdminPage.jsx`) is a
card-list index — the bottom nav's "Admin" item now points here instead of
straight to invites — linking to:

- **Einladungen** (`/admin/invites`, `AdminInvitesPage.jsx`) — unchanged,
  just moved one level deeper; its back-link now goes to `/admin` instead of
  `/`.
- **Allgemeine Einstellungen** (`/admin/settings`, `AdminSettingsPage.jsx`)
  — currently just the WhatsApp group link (`GET /api/settings` to prefill,
  `PATCH /api/admin/settings` to save), stored as a row in a small
  key/value `settings` table (`db/settings.js`, migration
  `006_create_settings.sql`) rather than a dedicated column, since the spec
  explicitly expects this to grow ("might extend in the future") — adding a
  setting later is a data change, not a migration. `HomePage.jsx`'s
  "Hilfreiche Links" WhatsApp button now reads this value via
  `GET /api/settings` (any authenticated user) instead of a hardcoded
  placeholder string.
- **Daten löschen** — an inline danger button on `AdminPage.jsx` itself
  (no sub-route), for resetting the app before a new season.

### Clear data

`POST /api/admin/clear-data` (`routes/admin.js`) deletes, in one DB
transaction: every `media` row, every `invites` row (deleted first — they
reference `users(id)` with no `ON DELETE CASCADE`, so they'd otherwise block
deleting the users below), every `accommodations`/`vehicles`/`flights` row
(their `*_assignments` rows cascade automatically), and every **non-admin**
user. The underlying files (originals + thumbnails in `uploadsDir`, and any
locally-uploaded profile pictures belonging to a deleted user) are then
unlinked from disk — best-effort, after the DB transaction commits, since a
leftover file at that point is untidy, not a functional or security issue.

**Admin accounts are kept** (a scope decision made explicitly, not implied
by the spec's literal "delete all uploaded files and users" wording): the
server only re-creates an admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` at
*startup* on an empty `users` table (see [Auth](#auth)), and
[ExternalSetup.md](ExternalSetup.md) even suggests removing
`ADMIN_PASSWORD` from `.env` after initial setup — wiping every admin too
would risk the app becoming completely inaccessible until someone
redeploys/restarts the container with those env vars set again. Keeping
admins means the app stays immediately usable after a reset to re-invite
people for the next season.

The button requires typing the exact confirmation phrase `LÖSCHEN` (German
for "delete", matching the app's German-only UI) into a text input before
it's enabled — a deliberate step up from a plain OK/Cancel `confirm()`
dialog, since this is destructive and hard to reverse. The backend
independently re-checks `req.body.confirm === 'LÖSCHEN'` (`400` otherwise,
nothing deleted) so the confirmation can't be bypassed by replaying or
scripting the request directly.

Per the spec's "For all admin features, ensure that there is a test that
only admins can use them" requirement, `tests/security/admin-only.test.js`
covers both new routes (non-admin → `403`, admin → success) alongside the
existing invites coverage, and `tests/api/admin.test.js` exercises
`clear-data` end-to-end (seeds a full trip's worth of data, asserts a wrong
`confirm` deletes nothing, then asserts a correct one wipes everything
except the admin — who can still `GET /api/auth/me` afterwards).

## Login brute-force protection

Per the spec's "Security" requirement, `POST /api/auth/login`
(`utils/loginRateLimit.js`) tracks failed attempts per source IP in memory —
acceptable for this app's single-container deployment, same reasoning as
[Auth](#auth)'s stateless sessions. A failed attempt (wrong password, unknown
email, or a social-only account with no password) increments a counter for
the caller's IP; reaching 10 blocks further login attempts from that IP for
10 minutes (`429`, with a `Retry-After` header/`retryAfterSeconds` body
field — see [API.md](API.md#post-apiauthlogin)). A successful login resets
the counter. A malformed request (missing email/password, `400`) isn't
counted as an attempt. Entries for an IP that never got blocked are dropped
after an hour of inactivity so the map doesn't grow unbounded over a
long-running process.

The caller's IP is resolved by `getClientIp()`: it prefers the
`Cf-Connecting-Ip` header, which `cloudflared` sets to the real visitor IP as
seen at Cloudflare's edge, falling back to `req.ip` (used in local
dev/tests, where there's no Cloudflare Tunnel in front). `app.js` also sets
`app.set('trust proxy', 1)` since `cloudflared` is the one reverse-proxy hop
between the internet and this server in production.

## CSRF & XSS hardening

Per the spec's "Security" requirement ("especially stored XSS"), an audit
covered every place user-supplied content is stored and later rendered back,
plus the app's CSRF posture:

- **CSRF**: every state-changing route is `POST`/`PATCH`/`DELETE` — there are
  no state-changing `GET` routes — and the session cookie is
  `sameSite: lax` (see [Auth](#auth)), which browsers only attach to a
  cross-site request for a top-level `GET` navigation, never a cross-site
  form `POST`/fetch. That combination is sufficient CSRF protection for this
  app without an explicit CSRF token.
- **Reflected/stored XSS in the frontend**: the React frontend never uses
  `dangerouslySetInnerHTML` (or any other raw-HTML injection point) anywhere
  — every place user text (flight/accommodation/vehicle notes, profile
  fields, media filenames, invitee names) is rendered goes through normal
  JSX, which HTML-escapes it automatically. mailto/tel/`wa.me`/Instagram
  links built from user-supplied contact fields
  (`components/ContactLinks.jsx`) are set via JSX's `href={...}` attribute
  binding rather than string-built markup, so they can't break out of the
  attribute either.
- **Stored XSS via file upload**: uploads (profile pictures, shared media)
  are served back publicly and unauthenticated from `/uploads/<filename>`
  (see [Media storage](#media-storage)) — before this audit, an SVG file
  passed `isAcceptedMediaFile()`'s "declared MIME type starts with `image/`"
  check like any other image, but unlike a raster photo (JPEG/PNG/etc.) an
  SVG is an XML document that can carry a `<script>`; a browser navigated
  directly to that URL (not just loading it inline via `<img>`) would
  execute it in the app's own origin — a stored-XSS vector, and one ClamAV's
  malware scan wouldn't catch since the payload isn't malware. Fixed in
  `utils/scanUpload.js`'s `isAcceptedMediaFile()`, which now explicitly
  excludes `image/svg+xml`; camera-roll photos/videos are never SVG, so this
  costs no real functionality. Covered by
  `tests/api/media.test.js`/`tests/api/profile.test.js` ("... rejects an SVG
  even though its MIME type starts with image/").
- **Defense in depth**: `app.js` now sets `X-Content-Type-Options: nosniff`
  on every response, so a browser never MIME-sniffs a served file into
  something more dangerous than its declared `Content-Type` (e.g. treating a
  mislabeled upload as HTML/SVG) — this also protects against the SVG vector
  above via a renamed extension, not just the direct MIME check. It also
  sets `Content-Security-Policy: frame-ancestors 'none'` (clickjacking) and
  `Referrer-Policy: strict-origin-when-cross-origin` (avoids leaking full
  URLs, which can carry invite tokens, to third-party sites linked from
  within the app). Covered by `tests/security/security-headers.test.js`.
- **CORS**: `cors()` was previously called with no options, which reflects
  `Access-Control-Allow-Origin: *` for any caller. Not itself exploitable —
  there's no `Access-Control-Allow-Credentials`, so a cross-origin browser
  request still can't have the session cookie read back by the calling
  page — but needlessly wide. Restricted to `APP_BASE_URL` (falling back to
  `http://localhost:8000`) plus the Vite dev server origin
  (`http://localhost:5173`, used only for [local development](#local-development); it normally proxies `/api` same-origin anyway, see
  `vite.config.js`).

## Contact info

Per the spec, every user can add an email address, phone number and
Instagram handle in their profile (`SettingsPage.jsx` /
`PATCH /api/profile`) so other users can reach them — surfaced in the
Calendar page's contact overlay (`components/Modal.jsx` +
`components/ContactLinks.jsx`, opened by clicking a name in
`CalendarPage.jsx`), which renders whichever of a mailto/tel/`wa.me`
WhatsApp/Instagram link apply. `GET /api/users` returns all four fields for
every user (not just `id`/`name` as before) so the Calendar page can build
that overlay without a route per user.

`email` is the same column used for password login (`users.email`), so
editing it in the profile changes login credentials too — `routes/profile.js`
blocks clearing it while the account still has a password set (would lock
the user out) and rejects a value already used by another account, but
otherwise treats it like any other profile field. `phone` and
`instagramHandle` (`users.phone`/`users.instagram_handle`, added in
migration `004_add_user_contact_fields.sql`) have no such constraint and can
be cleared by submitting them empty.

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
   database. The move tries a plain rename first and falls back to
   copy-then-delete on `EXDEV` ("cross-device link not permitted") — in
   production `uploadsDir` is the `uploads-data` Docker volume while
   `quarantineDir` is a plain directory on the container's own writable
   layer (see [Media storage](#media-storage)), and `rename()` can't cross
   that filesystem boundary.

Every rejection in `scanUpload.js` (a multer-level error such as an
oversized file, a `fileFilter` rejection, or an infected/failed scan) is
logged server-side with `console.warn`/`console.error` — including the
route, the caller's user id, and the file's original name/declared MIME
type — specifically so a failed upload can be diagnosed from
`docker compose logs teamxtreme-server` instead of just the generic German
error text the frontend shows. Uncaught errors elsewhere already reach
`app.js`'s catch-all error middleware, which logs the full error.

`clamd`'s compiled-in `StreamMaxLength`/`MaxFileSize`/`MaxScanSize` default
to 100 MB, well under the 500 MB media upload cap — `docker-compose.yml`
raises all three to 550 MB via `CLAMD_CONF_*` environment variables (the
image's entrypoint rewrites the matching directive in `clamd.conf`; see its
`/init` script) so a large photo/video isn't aborted mid-scan.

`fileFilter` on both upload routes (`routes/media.js`, `routes/profile.js`)
no longer trusts the browser-declared MIME type alone —
`utils/scanUpload.js`'s `isAcceptedMediaFile()` falls back to the file's
extension when the type is missing or generic (`application/octet-stream`
and the like). Mobile browsers often omit or misreport the Content-Type for
a camera-roll photo/video — e.g. an iCloud/Google Photos file that's still
just a placeholder locally — which was previously rejected outright even
though the file itself was a perfectly ordinary JPEG.

`clamav` (see [Deployment](#deployment)) uses the `clamav/clamav-debian:1.4`
image, which ships with a preloaded signature database (the non-`_base` tag)
so it doesn't need to download the full ClamAV database set on every
container start/restart — just incremental updates.

## Media thumbnails

Per the spec ("the view showing the images should only show a thumbnail for
better performance"), `routes/media.js` generates a thumbnail once an
uploaded file clears the malware scan and lands in `uploadsDir`:

- **Images**: `utils/thumbnail.js`'s `generateImageThumbnail()` uses `sharp`
  to resize to at most 480×480 (preserving aspect ratio, never upscaling),
  re-encoded as a JPEG, written to `uploadsDir/thumbnails/` (a subdirectory
  of the same `uploads-data` volume, not a separate mount — served back at
  `/uploads/thumbnails/<filename>`, see [Media storage](#media-storage)).
  `.rotate()` respects EXIF orientation, since camera photos are frequently
  rotated via an EXIF tag rather than in the pixels themselves. If
  generation throws (a corrupt file, or a format `sharp`'s bundled libvips
  can't decode) the upload still succeeds — `thumbnail_name` just stays
  `NULL` (added in migration `005_add_media_thumbnail.sql`) and the frontend
  falls back to the full-resolution original for that item's grid tile.
- **Videos**: no server-side processing at all — extracting a real video
  frame would mean adding `ffmpeg` to the image and pipeline for a feature
  the spec only asks be "just a thumbnail with an indication that it is a
  video." `MediaPage.jsx` renders a fixed placeholder (a video icon + a
  "Video" badge) for any item whose `mimeType` starts with `video/`,
  fetching zero video bytes for the grid.
- `isImageFile()` (`utils/scanUpload.js`, alongside the existing
  `isAcceptedMediaFile()`) reuses the same declared-MIME-type-then-extension
  fallback to decide whether an upload is an image worth thumbnailing —
  profile pictures don't go through this path; only `routes/media.js` does.

`GET /api/media/download-all` (see [API.md](API.md#get-apimediadownload-all))
answers the spec's "download all" button by streaming a zip of every
original file via `archiver`, piped straight from disk to the response —
memory usage stays flat regardless of how much media has accumulated, since
nothing is buffered or written to a temporary zip on disk first.

## Media count badge

Per docs/Spec.md's "Bottom Navigation" section ("'Pictures' should show the
gallery view ... it should also have a number attached to the icon with the
total number of pictures shared"), the bottom nav's "Bilder" item
(`auth/BottomNav.jsx`) shows a small badge with the live count.

`GET /api/media/count` (`routes/media.js` / `db/media.js`'s `countMedia()`)
returns just `{ count }` via `SELECT COUNT(*)` — deliberately not reusing
`GET /api/media`'s full listing, since the badge is fetched on every
authenticated page (via `media/MediaCountContext.jsx`, a small context
provided by `RequireAuth`/`RequireAdmin` alongside `BottomNav`) and pulling
every row's metadata just to display a number would be wasteful.

A context (rather than a plain `fetch` inside `BottomNav.jsx`) exists
because `BottomNav` stays mounted across route changes within its
`RequireAuth`/`RequireAdmin` branch (see [Frontend](#frontend)'s route
table), so a fetch-on-mount alone wouldn't reflect an upload made on
`MediaPage.jsx` without a hard reload — `MediaPage.jsx` calls the context's
`refresh()` right after a successful upload instead. `RequireAuth` and
`RequireAdmin` each provide their own `MediaCountProvider` instance (they're
separate route branches, see `App.jsx`), so the badge briefly refetches from
0 when crossing between a regular page and an admin page — acceptable since
it resolves in one round trip and admin pages don't otherwise show media.

## Accommodation capacity

Per docs/Spec.md's "Core information sharing" section ("the accomodation
should also have a number of (free) spots. The free spots are the spots
minus the assigned users"), `accommodations.spots` (migration
`007_add_accommodation_spots.sql`, nullable — existing rows created before
this field simply have no capacity recorded) mirrors `vehicles.seats`:
required and validated as a positive whole number on
`POST /api/accommodations`, entered via a new "Anzahl Plätze" field in
`AccommodationsPage.jsx`'s add form.

`freeSpots` (`routes/accommodations.js`'s `publicAccommodation()`) is
computed as `spots - assignments.length` — counting **every** assignment
regardless of `pending`/`accepted` status, since a spot is reserved once
assigned, matching how `HomePage.jsx`'s open-tasks logic already treats "has
an accommodation" (pending counts, not just accepted). It is deliberately
**not** clamped at 0: assigning to an accommodation isn't capacity-checked
(the same design as `vehicles` — nothing stops assigning more people than
`seats`), so `AccommodationsPage.jsx` shows a negative "frei" count in the
danger color (`.assignable-spots--over`) as a visible overbooking signal
rather than silently hiding it. A `null` `spots` (a pre-migration
accommodation) hides the capacity line entirely instead of showing a
misleading "0 frei".

## Activities

Per docs/Spec.md's "Activities" section, any user can create an activity
(title, location, start time, optional end time) to invite others to join;
the creator or an admin can always stop it, which sets its end time to the
current moment; and the list only ever shows ongoing or future activities.

- **"Ongoing or future" filtering** (`db/activities.js`'s
  `listActiveActivities()`): `WHERE end_time IS NULL OR end_time > now()`.
  An activity with no `end_time` runs indefinitely until explicitly stopped
  (matching "the user ... can always stop an activity" — there's no separate
  scheduled-vs-open-ended distinction); one with a future `end_time` is
  still upcoming/ongoing; one whose `end_time` has passed (whether it was
  stopped or its scheduled end simply elapsed) is excluded. Unlike Flights
  there's no separate past/future toggle — the spec only asks that the list
  "consist of" ongoing or future activities, not that past ones be
  reachable at all.
- **Stop authorization** (`routes/activities.js`): mirrors the spec's exact
  wording — `existing.created_by !== req.user.id && !req.user.is_admin`
  returns `403`, otherwise `stopActivity()` sets `end_time = now()`
  server-side (the client never sends a timestamp for this, so it can't be
  backdated or postdated). No edit endpoint exists — the spec only calls for
  creating and stopping, not editing title/location/times afterwards.
- **"Use current location"** (`ActivitiesPage.jsx`'s `handleUseLocation()`):
  reads `navigator.geolocation.getCurrentPosition()`, then reverse-geocodes
  the coordinates via OpenStreetMap's Nominatim API (`nominatim.openstreetmap.org/reverse`,
  no API key required) to fill the location field with a human-readable
  address instead of raw coordinates. If the device denies/lacks geolocation,
  or the reverse-geocoding request fails (offline, rate-limited), it falls
  back to a plain `"<lat>, <lon>"` string — the location field stays a free
  text input either way, so a failed lookup never blocks creating the
  activity. No backend involvement; the browser calls Nominatim directly.
- **No dedicated CSS file**: `ActivitiesPage.jsx` reuses the new
  `components/ResourceList.css` (see [Frontend](#frontend)'s repository
  layout) rather than introducing its own — its add-form-plus-flat-list
  shape is the same as Flights', just without the edit form/fields being
  flight-specific.

## Vehicles / ride sharing

Per docs/Spec.md's "Core information sharing" section ("some rides in there
with startingpoint and endpoint ... make the one offering the ride clickable
and re-use the user overlay ... only show rides that are in the future ...
sort the future rides ascending in time"), `vehicles` (still that table/route
name — the entity is a ride, but renaming the table/nav item wasn't part of
the gap being closed here) gained three fields on top of the existing
`seats`/`details`: `starting_point`, `ending_point`, `departure_time`
(migration `009_add_vehicle_ride_fields.sql`, all nullable — existing rows
created before this migration simply have none of them, the same pattern as
`accommodations.spots`). `POST /api/vehicles` requires all three (`400` if
any is missing), so every ride created from here on has them even though the
column itself stays nullable for backward compatibility.

- **Clickable creator, reusing the user overlay**: `VehiclesPage.jsx` already
  fetches `GET /api/users` (for the "assign someone else" picker), which
  includes every user's contact fields — so the ride's `createdByName` is
  rendered as a button that opens the same `components/Modal.jsx` +
  `components/ContactLinks.jsx` pattern `CalendarPage.jsx` uses, keyed off
  `createdBy`/a `usersById` lookup built from that same response. No new
  backend route needed.
- **Future/past split, sorted ascending**: computed entirely client-side
  (same pattern as Calendar/HomePage's open-tasks card) from the existing
  `GET /api/vehicles` response, which orders rows by
  `departure_time ASC NULLS LAST, created_at ASC` — a ride with no
  `departure_time` (a pre-migration row) sorts last among the "future" list
  rather than being excluded, since there's no time to compare against `now()`
  and hiding it entirely would silently drop still-relevant data. A ride
  whose `departureTime` has passed is filtered out of the default view and
  shown only behind a "▼ Vergangene Fahrten anzeigen" toggle at the bottom of
  the list (`▲ ... ausblenden` once expanded), sorted descending (most recent
  first) since that reads more naturally for a past list than the ascending
  order used for upcoming ones — the spec asks that past rides appear below
  a toggle without specifying their order.
- **No dedicated CSS file**: the new "Start"/"Ziel"/"Abfahrt" form fields and
  the past-rides toggle reuse `pages/AssignableList.css` (already shared with
  `AccommodationsPage.jsx` for the assignment list/accept-button styling)
  rather than introducing a new stylesheet — `.assignable-owner-button`
  mirrors `CalendarPage.css`'s `.calendar-name-button` (underlined,
  primary-colored text button) for the same "click a name to see contact
  info" affordance, and `.assignable-toggle-past`/`.assignable-list--past`
  are new rules for the collapsed section.

## Calendar arrival/departure markers

Per docs/Spec.md's "Calendar view" section ("The day of arrival ... marked
by a landing plane and the day of leaving by a departing one" — green
highlighting for a confirmed accommodation already existed via
`.calendar-cell--stay-accepted`, added when the Calendar view itself was
first built), `CalendarPage.jsx` gained a small `PlaneIcon` component: one
SVG (a paper-plane glyph) rendered twice — once as-is for departure, once
rotated 180° for landing — rather than two separate icon shapes, so the two
read as the same plane travelling in opposite directions instead of
unrelated glyphs. Each row already computes `startKey` (arrival day, from
the earliest flight's arrival) and `endKey` (departure day, from the latest
flight's departure — `null` when the user has only one flight logged,
per the existing "not yet returned" convention); the icon is layered inside
the existing cell content (stay location text or a plain `✓`) rather than
replacing it, via a small `.calendar-cell-content` flex wrapper, and both
markers can appear on the same day in the (rare) case of a same-day
turnaround. The cell's `title` tooltip gains "Ankunft"/"Abreise" text
alongside any stay location, and the legend gained two matching entries so
the icons are explained without relying on people guessing what a small
rotated glyph means. `stroke="currentColor"` means each icon automatically
picks up its cell's status color (muted for a plain presence day, green/
orange for an accommodation) rather than needing its own color logic.

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
  content; `public/header.svg` is a designed brand-colored banner (not an
  actual team photo) — swap it for a real photo whenever one is available.
- **Open tasks card**: per the spec's "User tasks" section, every user needs
  a flight to camp, a return flight, and an accommodation on file; each
  missing part is an open task shown on the starting page, and the whole
  card is omitted once nothing is missing. `HomePage.jsx` fetches the
  caller's own `GET /api/flights`/`GET /api/accommodations` on mount (no new
  backend route — same client-side-derivation pattern as `CalendarPage.jsx`)
  and computes: 0 flights → both an outbound and a return task; exactly 1
  flight → a return-flight task only (mirroring `CalendarPage.jsx`'s
  convention of treating a user's earliest flight as the trip there and
  latest as the trip back, since flights have no explicit outbound/return
  flag); no `accommodation_assignments` row for the caller (pending or
  accepted — the task is about having added one, not about acceptance) → an
  accommodation task. Each task links to the page that resolves it.

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
   for anything auth-related to work. `/uploads` is proxied the same way, so
   profile pictures and shared media (Settings, Media pages) render too —
   without it they'd 404 against Vite's own dev server, which knows nothing
   about that path. Password login/registration work fine this way;
   Google/Instagram's full-page OAuth redirect isn't proxied, so after
   completing it the browser lands on the backend's own port
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
  `clamav:3310`. `CLAMD_CONF_StreamMaxLength`/`MaxFileSize`/`MaxScanSize`
  raise clamd's 100 MB compiled-in scan limits to 550 MB to match the media
  upload cap. See [Malware scanning](#malware-scanning).
- `cloudflared` — runs a Cloudflare Tunnel (token-based) to expose the app
  publicly without opening inbound ports. Public hostname routing is
  configured in the Cloudflare dashboard, not in this repo — see
  [ExternalSetup.md](ExternalSetup.md).
