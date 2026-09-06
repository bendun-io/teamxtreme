# Development Plan

Recommended build order and current status. Update this file as work lands —
it's the source of truth for "what's next," not a fixed roadmap.

## Status

### Done
- Docker Compose skeleton: `teamxtreme-server`, `postgres`, `cloudflared`.
- Node.js (Express) backend scaffold with `GET /api/health`, serving the
  built frontend as static files with an SPA fallback.
- React PWA frontend scaffold (Vite + `vite-plugin-pwa`): installable,
  offline-capable shell, hardcoded German homepage matching the spec's card
  list (header image, training times/location, travel info, packing list).
- Multi-stage `Dockerfile` (frontend build → copied into backend image).
- Frontend runs fully standalone (`npm run dev`, no backend/Docker needed) —
  satisfies the spec's "test the PWA without the full docker stack"
  requirement.
- **Auth**: Postgres connection + hand-rolled SQL migration runner
  (`src/backend/migrations/`, tracked in `schema_migrations`); `users` and
  `invites` tables; JWT sessions in an httpOnly cookie; admin-only invite
  creation with a bootstrap admin from env vars on a fresh database;
  password-based registration/login through an invite link; Google and
  Instagram OAuth (hand-rolled, no `passport`) for both invite acceptance and
  login. Frontend: `AuthContext` + route guards, `/login`, `/invite/:token`,
  and an admin `/admin/invites` page to create and copy invite links. See
  [Architecture.md](Architecture.md#auth) and [API.md](API.md) for details.
- **Data model for the remaining features** — `flights`, `accommodations`,
  `accommodation_assignments`, `vehicles`, `vehicle_assignments` tables
  (`src/backend/migrations/002_create_flights_accommodations_vehicles.sql`).
  Only `flights` has routes/UI so far; the other three tables exist but are
  unused until their own items below land.
- **Flights** — add + overview list + edit + delete, end to end (API + UI).
  `GET/POST/PATCH/DELETE /api/flights`, mounted behind `requireAuth`; only
  the creator can edit/delete their own flight. Frontend: `FlightsPage.jsx`
  (add/edit form + list of everyone's flights, sorted by departure time),
  linked from the homepage's travel info card. See
  [API.md](API.md#flights) for details.
- **Accommodations** and **Vehicles** — add, assign self/others, accept
  assignment, end to end (API + UI), built together since they share the
  same shape. `GET/POST /api/accommodations`, `GET/POST /api/vehicles`,
  plus `POST .../:id/assign` and `POST .../:id/assignments/:assignmentId/accept`
  on both, mounted behind `requireAuth`. A self-assign is inserted already
  `accepted`; assigning someone else is inserted `pending` until that user
  accepts it — only they can accept it. Also added `GET /api/users` (a
  minimal `{id, name}` directory) to populate the "assign someone else"
  picker on both pages. Frontend: `AccommodationsPage.jsx` and
  `VehiclesPage.jsx` (shared `AssignableList.css`) — add form, list with
  per-assignment status badges, "Mir zuweisen" / assign-another-person /
  "Annehmen" controls — linked from the homepage's travel info card. See
  [API.md](API.md#accommodations) for details. `accommodations.start_date`/
  `end_date` are Postgres `DATE` columns; `db/pool.js` overrides pg's
  default `DATE` type parser to keep them as plain `YYYY-MM-DD` strings
  instead of JS `Date` objects, which avoids a timezone-dependent
  off-by-one-day bug when they round-trip through JSON.
- **Profile management** — view/edit own name and profile picture.
  `GET/PATCH /api/profile` (multipart, `name` + optional `picture` file),
  mounted behind `requireAuth`; only the caller's own account can be edited.
  Uploaded pictures land in the new `uploads-data` Docker volume (mounted at
  `/app/uploads`; falls back to a local `src/backend/uploads` folder when
  running the backend standalone) and are served back at
  `/uploads/<filename>` — see
  [Architecture.md](Architecture.md#media-storage). Prefilling the picture
  from Google/Instagram on social signup was already in place from the auth
  work; this item added the ability to view/change it afterwards. Frontend:
  `SettingsPage.jsx` (name field, file picker with live preview, logout
  button) at `/settings`. See [API.md](API.md#profile) for details.
- **Bottom navigation** — a fixed mobile-first nav bar (`BottomNav.jsx`) with
  Home / Reise / Unterkunft / Fahrzeuge / Profil, plus Admin when
  `user.isAdmin`, rendered by `RequireAuth`/`RequireAdmin` around every
  authenticated route so it's always present. This was a spec addition (not
  in the original build order) that arrived alongside Profile management,
  which it depends on for its "Profil" destination — built together.
  `HomePage`'s old top user-bar admin-link/logout button moved into this nav
  / the Settings page respectively, since the nav has no logout slot of its
  own. Nav items render as inline SVG icons (home/plane/bed/car/profile/
  shield) with no visible label — a later spec addition ("use appropriate
  icons and avoid text whenever possible") — with the destination name kept
  as an `aria-label`/`title` for accessibility and hover/long-press hints.
  (A later "continue development" pass added the missing **Kalender** item —
  see below.)

- **Calendar view** — a read-only table with one column per day, spanning
  from the earliest flight's arrival to the latest flight's departure (or,
  for a user with no logged return flight, treated as still present through
  the end of that range — "not yet returned"), and one row per user with
  flights, sorted by their first flight's arrival time. Computed entirely
  client-side from the existing `GET /api/flights` and
  `GET /api/accommodations` responses — no new backend routes or data model.
  A cell shows the accommodation location the user is assigned to that day
  (styled differently for `accepted` vs. `pending`, reusing the status
  wording from Accommodations/Vehicles) or a plain "✓" if present with no
  accommodation on file yet. Frontend: `CalendarPage.jsx` +
  `CalendarPage.css` (a horizontally-scrollable table with a sticky
  name column, since the day range can exceed mobile screen width), linked
  from the homepage's travel info card as `/calendar`.

- **Share option** — a round icon-only button (share glyph) overlaid on the
  homepage header image. Uses the Web Share API (`navigator.share`) to open
  the device's native share sheet when available (mobile browsers); falls
  back to `navigator.clipboard.writeText` (brief "✓" feedback on the button,
  mirroring `AdminInvitesPage`'s invite-link copy pattern) and finally to
  `window.prompt` if the Clipboard API is also unavailable. Shares
  `window.location.origin` (the app's own URL), not an invite link —
  distinct from `AdminInvitesPage`'s existing per-invite "copy link" button.
  No backend involved. Frontend: `pages/HomePage.jsx` + `.share-button` in
  `App.css`.

- **Test suite** — spec addition: a `/tests` folder with API tests plus
  dedicated security tests, runnable locally. Tooling: Node's built-in
  `node --test` runner (no new runtime dependency, in keeping with the
  project's "no framework unless it earns its place" stance) plus a small
  hand-rolled cookie-aware `fetch` wrapper (`tests/helpers/client.js`) in
  place of `supertest`, since session auth here is a cookie, not a bearer
  token. Tests run against the real Express app and a disposable
  Postgres container (`tests/docker-compose.yml`, tmpfs storage, port 5433
  so it never collides with a real dev/prod database) — no mocking of the
  database or HTTP layer. `npm test` from `tests/` brings the container up,
  waits for it to be healthy, and runs every `*.test.js` under `api/` and
  `security/`. `api/` covers the documented success/error responses for
  health, auth (password login, invites, registration), flights,
  accommodations, vehicles, users and profile. `security/` covers every
  authenticated route rejecting both a missing and a forged session cookie,
  non-admins hitting the admin-only invites routes, and cross-user ownership
  checks (editing/deleting someone else's flight, accepting an assignment
  that isn't yours, `PATCH /api/profile` never touching another account).
  71 tests, all passing. This required a small refactor:
  `src/backend/src/index.js`'s Express app assembly moved into
  `src/backend/src/app.js` (exporting `app` without calling `.listen()`) so
  tests can mount it on an ephemeral port against the test database;
  `index.js` is now just the process entry point (migrations, bootstrap
  admin, `app.listen()`). See [tests/README.md](../tests/README.md) for how
  to run it.

- **Media sharing** and **upload malware scanning** — built together, since
  building media sharing without scanning would have meant a second upload
  path needing retrofitting shortly after. `GET/POST /api/media` (multipart `file` field,
  image or video, up to 500 MB, original quality — no resizing/transcoding),
  mounted behind `requireAuth`; everyone can upload and everyone sees
  everyone's media (no delete endpoint — out of scope for now). A new
  `clamav` service (`clamav/clamav-debian:1.4`, preloaded signature database)
  in `docker-compose.yml` scans every upload — profile pictures now too —
  before it becomes reachable: `utils/scanUpload.js` (a shared multer-based
  middleware used by both `routes/profile.js` and `routes/media.js`) writes
  to a `quarantineDir` outside the `/uploads` static mount, scans it via
  `utils/malwareScan.js` (wraps the `clamscan` npm package, talking to
  `clamav` over TCP — no local `clamscan`/`clamdscan` binary needed), and
  only moves it into the public `uploadsDir` once it's clean; a failed or
  errored scan deletes the quarantined file and fails the request (400 for
  an infected file, 500 if the scanner itself is unreachable — fails closed
  either way). Frontend: `MediaPage.jsx` (upload form + a grid gallery of
  everyone's photos/videos, images as `<img>`, videos as `<video controls>`)
  at `/media`, linked from the homepage's travel info section like Calendar.
  Tests: a new `clamav-test` container in `tests/docker-compose.yml` (real
  ClamAV, not mocked) plus `tests/api/media.test.js`, which also uploads the
  standard EICAR test string and asserts it's rejected and never stored. See
  [API.md](API.md#media) and
  [Architecture.md](Architecture.md#malware-scanning) for details.

- **Invite "Send E-Mail" button** — spec addition: alongside the existing
  copy-link button on `AdminInvitesPage.jsx`, each unused invite now also
  shows an "E-Mail senden" link next to "Link kopieren", rendered as a plain
  `mailto:?subject=...&body=...` anchor (styled to match the existing
  buttons) pre-filled with a German greeting using the invitee's name and
  the invite URL — opens the admin's own mail client instead of only
  copy/pasting the link elsewhere. No backend changes.

- **PWA polish** — the placeholder PWA icons
  (`src/frontend/public/icons/`, `favicon-*.png`, `apple-touch-icon.png`)
  were already replaced with the real Team Xtreme BJJ Karlsruhe club logo
  outside of a tracked feature item. The homepage header image
  (`src/frontend/public/header.png`, a plain "Titelbild" text placeholder)
  is now `header.svg`: a vector banner in the app's brand colors
  (`--color-primary` maroon fading into near-black) with diagonal
  belt-stripe accents and a simplified belt-knot emblem echoing the club
  logo, referenced from `pages/HomePage.jsx`'s `.hero-image`. This is a
  designed graphic rather than an actual team photo (none was available to
  the assistant) — swap in a real header photo whenever one exists, no
  other changes needed since the `<img>` markup and `.hero-image` CSS
  (`object-fit: cover`) don't care about the source format.

- **Bugfix: photo uploads from mobile browsers silently rejected** — a user
  reported "Datei konnte nicht hochgeladen werden" uploading a JPG straight
  from their phone's camera roll to `/media`. Root causes found by code
  review (no access to the production container's logs from this
  environment — see below for how to check them next time):
  1. `fileFilter` on both `routes/media.js` and `routes/profile.js` only
     accepted the browser's declared `Content-Type`. Mobile browsers often
     send `application/octet-stream` (or no type at all) for a camera-roll
     file that's still an iCloud/Google Photos placeholder — a perfectly
     normal JPEG then got rejected outright. Fixed by
     `utils/scanUpload.js`'s new `isAcceptedMediaFile()`, which falls back
     to the file extension when the declared type is missing/generic.
  2. Separately (latent, not necessarily what the user hit, but a real
     mismatch): `clamd`'s compiled-in `StreamMaxLength`/`MaxFileSize`/
     `MaxScanSize` default to 100 MB, well under the 500 MB media upload
     cap — any larger video/photo would always fail the scan and 500. Fixed
     via `CLAMD_CONF_*` environment variables on the `clamav` service in
     `docker-compose.yml`, raising all three to 550 MB.
  3. **Every** upload rejection (multer errors, `fileFilter` rejections,
     infected/failed scans) previously failed silently server-side for the
     400 cases — only 500s reached `app.js`'s catch-all logger. All three
     paths in `scanUpload.js` now `console.warn`/`console.error` with the
     route, calling user's id, and the file's name/declared MIME type, so
     future occurrences are diagnosable with
     `docker compose logs teamxtreme-server` instead of guessing from the
     generic German error text alone.
  Tests: `tests/api/media.test.js` and `tests/api/profile.test.js` each
  gained a case uploading a `.jpg`/`.png` with an
  `application/octet-stream` MIME type to confirm the extension fallback
  accepts it. See [Architecture.md](Architecture.md#malware-scanning).

- **Profile contact fields + Calendar contact overlay** — the spec asked for
  two related things that a prior "everything's done" pass had missed: (1)
  users can add an email, phone number and Instagram handle to their
  profile "in order to be contacted by other users", and (2) clicking a
  user in the Calendar view opens an overlay with mailto/phone/WhatsApp/
  Instagram links for them. Built together since the overlay has nothing to
  show without the fields existing. Backend: migration
  `004_add_user_contact_fields.sql` adds `users.phone`/
  `users.instagram_handle`; `PATCH /api/profile` now also accepts `email`,
  `phone`, `instagramHandle` (any omitted field is left unchanged; `phone`/
  `instagramHandle` can be cleared with an empty string — `email` cannot be
  cleared while the account still has a password set, since it doubles as
  the login credential; a duplicate `email` is rejected with 409); `GET
  /api/users` now returns all four contact fields per user instead of just
  `id`/`name`. Frontend: `SettingsPage.jsx` gained the three new fields;
  new reusable `components/Modal.jsx` (generic overlay, closes on backdrop
  click or Escape) and `components/ContactLinks.jsx` (renders whichever
  mailto/tel/`wa.me`/Instagram links apply, given a user's contact fields)
  are wired into `CalendarPage.jsx` — clicking a row's name now opens the
  modal for that user. See [API.md](API.md#profile),
  [API.md](API.md#users) and
  [Architecture.md](Architecture.md#contact-info) for details.

- **Bugfix: media uploads failing with EXDEV in production** — the logs
  showed every upload failing with `EXDEV: cross-device link not permitted,
  rename '/app/quarantine/<uuid>.jpg' -> '/app/uploads/<uuid>.jpg'`. Root
  cause: in `docker-compose.yml`, `uploadsDir` (`/app/uploads`) is the
  `uploads-data` named volume, while `quarantineDir` (`/app/quarantine`) is
  a plain directory on the container's own writable layer — two different
  filesystems, and `fs.rename()` can't move a file across that boundary.
  This never showed up locally or in `tests/`, since dev/test setups always
  point `UPLOADS_DIR`/`QUARANTINE_DIR` at plain folders on the same disk.
  Fixed in `utils/scanUpload.js`: the quarantine-to-uploads move now tries
  `rename()` first and falls back to `copyFile()` + `unlink()` when it fails
  with `EXDEV`; if removing the now-redundant quarantine copy afterwards
  fails, that's only logged as a warning (an untidy leftover temp file, not
  a functional or security issue) rather than failing the upload. See
  [Architecture.md](Architecture.md#malware-scanning). Tests:
  `tests/api/media.test.js` reproduces the exact bug by mocking
  `fs.rename()` to throw `EXDEV` (confirmed to fail with a 500 against the
  pre-fix code) and asserts the upload still succeeds and the file is
  reachable at `/uploads/<filename>` — profile picture uploads share the
  same `scanUpload.js` code path, so no separate fix/test was needed there.

- **Homepage "Hilfreiche Links" card** — the spec's Starting Page section
  called for a card with a WhatsApp group button and a link to
  https://www.leogalatijiujitsu.com/ ("Website of the Leo Galati Team"); a
  prior pass had built every other homepage card but missed this one.
  Frontend only: `HomePage.jsx` gained a "Hilfreiche Links" card between the
  photo/video card and the packing list, with two buttons styled via the new
  `.helpful-link-button`/`.helpful-links` rules in `App.css` (mirroring
  `AdminInvitesPage.css`'s existing `.invite-row a` button-as-anchor
  pattern). The WhatsApp href is a placeholder
  (`https://chat.whatsapp.com/REPLACE_WITH_GROUP_INVITE_LINK`) — the real
  group invite link wasn't available at build time; swap it in
  `HomePage.jsx` once it exists. No backend changes.

- **Homepage open-tasks card** — the spec's "Starting Page" and "User tasks"
  sections called for a card, second in the list right after the header
  image, showing each user's open tasks (a flight to camp, a return flight,
  and an accommodation on file), hidden entirely when nothing is missing.
  A prior "everything's done" pass had missed this — it was the one
  homepage card with no implementation at all, not polish. ("plus a
  recommendation" in the spec's wording was confirmed with the user to be a
  typo for "an accomodation", matching every other feature in that
  section.) Frontend only, no new backend route: `HomePage.jsx` fetches the
  caller's own flights/accommodations from the existing `GET /api/flights`/
  `GET /api/accommodations` and derives task state client-side (same
  pattern as `CalendarPage.jsx`) — 0 flights → outbound + return tasks, 1
  flight → a return-flight task only (a flight has no outbound/return flag,
  so this mirrors `CalendarPage.jsx`'s existing convention of treating the
  earliest flight as the trip there and the latest as the trip back), no
  accommodation assignment (pending or accepted) → an accommodation task.
  New `.task-list`/`.task-item` rules in `App.css` (warning-colored pills,
  reusing `--color-warning-bg`/`--color-warning-text`). Verified in a
  browser: a fresh user sees all three tasks; adding an outbound + return
  flight and self-assigning to an accommodation makes the card disappear.
  See [Architecture.md](Architecture.md#frontend) for details.

- **Login brute-force protection** — a per-IP failed-login counter
  (`src/backend/src/utils/loginRateLimit.js`), reset on a successful login,
  blocking further login attempts from that IP with a `429` for 10 minutes
  once it reaches 10 failures. In-memory (no separate store), as noted when
  this was scoped — acceptable for this app's single-container deployment.
  The caller's IP is resolved via a new `getClientIp()` helper that prefers
  the `Cf-Connecting-Ip` header (`cloudflared` sets this to the real visitor
  IP in production) over `req.ip`; `app.js` now also sets
  `app.set('trust proxy', 1)` since `cloudflared` is the one reverse-proxy
  hop in front of the server. A malformed login request (missing
  email/password) isn't counted as a failed attempt, only a wrong
  password/unknown email/social-only account. Entries for an IP that never
  got blocked expire after an hour of inactivity so the in-memory map
  doesn't grow unbounded. Tests: `tests/security/brute-force.test.js`, each
  test using its own synthetic `Cf-Connecting-Ip` for isolation (10 failures
  → `429`; a different IP is unaffected; a success resets the counter). See
  [Architecture.md](Architecture.md#login-brute-force-protection) and
  [API.md](API.md#post-apiauthlogin) for details.

- **CSRF/XSS hardening audit** — the spec explicitly calls this out
  ("especially stored XSS"). Findings: CSRF is already adequately covered
  (every state-changing route is `POST`/`PATCH`/`DELETE`, and the
  `sameSite: lax` session cookie isn't sent on a cross-site
  `POST`/fetch) — no explicit token needed. The frontend never uses
  `dangerouslySetInnerHTML`, so user text rendered back (notes, profile
  fields, filenames) is already safe via JSX's automatic escaping. The one
  real gap: uploads (profile pictures, shared media) are served back
  unauthenticated from `/uploads/<filename>`, and an SVG file (an XML
  document that can carry a `<script>`) passed the "image" filter just like
  any raster photo — a stored-XSS vector via file upload that ClamAV
  wouldn't catch. Fixed by excluding `image/svg+xml` in
  `utils/scanUpload.js`'s `isAcceptedMediaFile()` (camera-roll photos are
  never SVG, so no functionality lost), plus defense-in-depth: a global
  `X-Content-Type-Options: nosniff` header (also covers a renamed-extension
  bypass of the SVG check), `Content-Security-Policy: frame-ancestors 'none'`
  and `Referrer-Policy: strict-origin-when-cross-origin` on every response,
  and restricting the previously wide-open `cors()` to `APP_BASE_URL` (or
  `localhost:8000`) plus the Vite dev origin. Tests:
  `tests/api/media.test.js` and `tests/api/profile.test.js` each gained an
  SVG-rejection case, and a new `tests/security/security-headers.test.js`
  asserts the new headers are present. See
  [Architecture.md](Architecture.md#csrf--xss-hardening) for details.

- **Media gallery rework** — thumbnails generated at upload time, the
  gallery showing thumbnails only, a "download all" button, and click-through
  to a full-resolution view with its own download option. Images get a real
  generated thumbnail; videos get a fixed placeholder rather than an
  extracted frame (see below for why). `GET /api/media` responses gained
  `thumbnailUrl` (`null` for videos, or for an image whose thumbnail
  generation failed); a new `GET /api/media/download-all` streams a zip of
  every original file. See [API.md](API.md#media) and
  [Architecture.md](Architecture.md#media-thumbnails) for the full design.
  Frontend: `MediaPage.jsx` rebuilt around a thumbnail grid (real thumbnails
  for images, a fixed video-icon placeholder + "Video" badge for videos — no
  video bytes fetched just to render the grid), a "download all" link at the
  top of the gallery card, and clicking any item opens the existing
  `Modal.jsx` with the full-resolution original and its own download link.
  - **Why no video frame extraction**: the spec asks for "just a thumbnail
    with an indication that it is a video," not a real preview frame —
    reading that literally avoided adding `ffmpeg` (a much heavier Docker
    image + pipeline dependency) for a feature videos don't strictly need.
  - **New backend dependencies**: `sharp` (image resizing —
    `utils/thumbnail.js`) and `archiver` (zip streaming, no buffering, so
    memory use doesn't grow with how much media has accumulated). Thumbnail
    generation is best-effort: a failure (e.g. a corrupt file) is logged and
    leaves `thumbnail_name` `NULL` rather than failing the upload.
  - **Found in browser verification, not covered by the API test suite**:
    two real bugs surfaced only by actually loading the reworked page.
    (1) `vite.config.js`'s dev proxy only covered `/api`, so profile
    pictures and media (old and new alike) 404'd in frontend-only dev —
    fixed by proxying `/uploads` too, and excluding it from the PWA service
    worker's `navigateFallbackDenylist` so a same-origin `<a download>` link
    to an uploaded file isn't intercepted and handed the cached app shell
    instead. (2) `.card a` (specificity `0,1,1`) was silently beating
    `.helpful-link-button` (`0,1,0`) on `color` for every button-styled
    anchor placed inside a `.card` — which is every current usage,
    including the pre-existing "Hilfreiche Links" WhatsApp/Leo Galati
    buttons on the homepage — rendering maroon text on a maroon background.
    Fixed by renaming the selector to `a.helpful-link-button` (same
    specificity as `.card a`, so source order — which already put it later
    in `App.css` — now correctly wins).
  - Tests: `tests/api/media.test.js` gained cases for thumbnail generation
    (image and video), the zip endpoint's headers/content and its 404 on an
    empty gallery; `tests/security/unauthenticated.test.js` covers
    `download-all` alongside every other authenticated route.

- **Dependabot** — the spec picked up a new requirement mid-session
  ("a github dependabot workflow for at least all package.json, Dockerfile
  and docker compose files"). `.github/dependabot.yml`: weekly `npm`
  version-update checks for each of the three independent `package.json`s
  (`src/backend`, `src/frontend`, `tests` — separate dependency sets and
  lockfiles), plus weekly `docker` checks in every directory holding a
  `Dockerfile`/`docker-compose.yml` (repo root, `src/`, `tests/`). No app
  code changes.

- **Bugfix: Calendar missing from the bottom nav** — a fresh read-through of
  `docs/Spec.md` against the running app (its "Bottom Navigation" section
  explicitly lists Home, Calendar, Travel, Accommodation, Vehicles, Settings,
  Admin) found `BottomNav.jsx` never had a Kalender item — `/calendar` was
  only reachable via a link on the homepage, not from the nav present on
  every authenticated page as the spec requires. All 98 backend tests were
  re-run to confirm nothing else had drifted (all passing) before this
  narrower gap was found by inspecting the frontend directly. Fixed by adding
  a `calendar` icon and a `{ to: '/calendar', label: 'Kalender' }` entry to
  `BottomNav.jsx`'s `items` array, positioned between Home and Reise to match
  the spec's listed order. No CSS changes needed — `.bottom-nav-item` already
  uses `flex: 1`, which auto-adjusts to the item count (it already varies
  today between 5 and 6 items depending on `user.isAdmin`). Verified via a
  production `vite build` (succeeds, and the compiled bundle contains the new
  "Kalender" string); a full local login-and-screenshot pass was attempted
  but abandoned when installing Playwright/Chromium in this environment
  proved too slow to be worth blocking on for a single additive flex-item
  change — worth a proper browser-based check next time this page is
  touched.

- **Admin Menu rework** — the spec grew a new "Admin Menu" section mid-session
  (via a commit made directly by the user while this session was running,
  landing alongside the Kalender nav fix above) calling for `/admin` to
  become a card-list index rather than going straight to invites, with cards
  for general settings (currently just an admin-editable WhatsApp link),
  invite management (existing, just moved a level deeper), and a
  confirmation-gated "clear data" reset button. Also picked up mid-session: a
  new blanket requirement that every admin-only feature has a test proving
  non-admins/unauthenticated callers are rejected.

  Two decisions were confirmed with the user before building the destructive
  part, since the spec's literal wording ("delete all uploaded files and
  users") was ambiguous in a way that could have made the app permanently
  inaccessible: **clear-data keeps admin accounts** (only deletes non-admins
  and all trip data — flights, accommodations, vehicles, their assignments,
  invites, shared media), and confirmation is **type-to-confirm** (the admin
  must type `LÖSCHEN` exactly into a text field before the button enables)
  rather than a plain OK/Cancel dialog. Full reasoning in
  [Architecture.md](Architecture.md#admin-menu).

  Backend: migration `006_create_settings.sql` (a small key/value `settings`
  table, since the spec expects more settings later); `GET /api/settings`
  (any authenticated user, for `HomePage.jsx`'s WhatsApp button);
  `PATCH /api/admin/settings` and `POST /api/admin/clear-data`
  (`routes/admin.js`, admin-only). Frontend: `AdminPage.jsx` (new index at
  `/admin`, replacing the bottom nav's old direct link to
  `/admin/invites`), `AdminSettingsPage.jsx` (new, at `/admin/settings`),
  `AdminInvitesPage.jsx`'s back-link updated to `/admin`. Verified with a
  full local login-and-click-through (Playwright driving the Vite dev server
  against disposable Postgres/ClamAV containers): the admin menu's three
  cards, the settings form prefilling and saving the real link, and the
  clear-data modal's confirm button staying disabled until `LÖSCHEN` is
  typed exactly. Tests: `tests/api/settings.test.js`,
  `tests/api/admin.test.js` (seeds a full trip, asserts a wrong confirmation
  phrase deletes nothing, a correct one wipes everything except the admin),
  and new cases in `tests/security/admin-only.test.js` and
  `tests/security/unauthenticated.test.js` for both new routes — 112 tests
  total, all passing.

- **Bottom nav "Bilder" item with a live media count badge** — the second
  of the three remaining spec items from the mid-session update (see Admin
  Menu above). `BottomNav.jsx` gained a gallery icon linking to `/media`,
  positioned between Fahrzeuge and Profil per the spec's listed order, with
  a small badge showing the total shared photo/video count.

  Backend: `GET /api/media/count` (`db/media.js`'s `countMedia()`, a plain
  `SELECT COUNT(*)`) — a dedicated lighter endpoint rather than reusing
  `GET /api/media`'s full listing, since the badge is fetched on every
  authenticated page. Frontend: a new `media/MediaCountContext.jsx`
  (`{ count, refresh() }`, provided by `RequireAuth`/`RequireAdmin`
  alongside `BottomNav`) rather than a plain fetch-on-mount in
  `BottomNav.jsx` — `BottomNav` stays mounted across route changes, so
  without a shared context the badge wouldn't update after an upload
  without a hard reload; `MediaPage.jsx` now calls `refresh()` right after a
  successful upload. New `.bottom-nav-icon-wrap`/`.bottom-nav-badge` CSS in
  `BottomNav.css`. See
  [Architecture.md](Architecture.md#media-count-badge) for the full design,
  including the one accepted tradeoff (the badge briefly resets to 0 when
  crossing between `RequireAuth` and `RequireAdmin` route branches, since
  each provides its own context instance).

  Verified with a full local login-and-click-through (Playwright driving the
  Vite dev server against disposable Postgres/ClamAV containers): the badge
  reads "0" on a fresh account, and updates to "1" immediately after
  uploading a photo on `/media` — no reload needed. Tests:
  `tests/api/media.test.js` gained a case asserting the count starts at 0
  and reflects two uploads; `GET /api/media/count` added to
  `tests/security/unauthenticated.test.js`'s route sweep. 115 tests total,
  all passing.

- **Accommodation capacity** — the third of the four spec items from the
  mid-session update (see Admin Menu and the media count badge above for
  the first two). A `spots` field on accommodations (mirroring
  `vehicles.seats`), with a `freeSpots` shown as spots minus the number of
  assignments.

  Backend: migration `007_add_accommodation_spots.sql`
  (`accommodations.spots`, nullable — existing rows keep `null` rather than
  a backfilled guess); `POST /api/accommodations` now requires `spots` as a
  positive whole number (same validation shape as vehicles' `seats`);
  `publicAccommodation()` in `routes/accommodations.js` adds `freeSpots =
  spots - assignments.length`, counting pending and accepted assignments
  alike (a spot is reserved once assigned, not only once accepted) and
  deliberately **not** clamped at 0 — assigning isn't capacity-checked
  (same as vehicles), so a negative value is a real "overbooked" signal, not
  a bug. Frontend: `AccommodationsPage.jsx` gained an "Anzahl Plätze" input
  in the add form and a "`X Platz/Plätze · Y frei`" line per accommodation
  (singular "Platz" at exactly 1, hidden entirely when `spots` is `null`),
  styled red (`.assignable-spots--over` in `AssignableList.css`) when
  overbooked. Full reasoning in
  [Architecture.md](Architecture.md#accommodation-capacity).

  Verified with a full local click-through (Playwright): created a
  1-spot accommodation via the real form → "1 Platz · 1 frei"; self-assigned
  as admin → "0 frei"; registered a second account through the real invite
  flow and self-assigned them too → "-1 frei" rendered in red, confirming
  the overbooking path end to end, not just the happy path. Tests: existing
  `tests/api/accommodations.test.js` cases updated to pass `spots` (now
  required), plus two new cases — spots validation (missing/zero/fractional
  all rejected) and a full free-spots walkthrough (self-assign → pending
  assign → over-capacity assign, asserting 2 → 1 → 0 → -1) — and
  `tests/api/admin.test.js`/`tests/security/ownership.test.js`'s
  accommodation fixtures updated to include `spots` too. 117 tests total,
  all passing.

- **Calendar arrival/departure markers** — the fourth and last item from the
  mid-session spec update (see Admin Menu, the media count badge, and
  accommodation capacity above for the other three). Green highlighting for
  a *confirmed* accommodation day already existed (`.calendar-cell--stay-
  accepted`, from when the Calendar view was first built) — the only
  actually-missing piece was the landing/departing plane icon on each row's
  arrival/departure day cell.

  Frontend-only, no schema or API changes. `CalendarPage.jsx` gained a
  `PlaneIcon` component (one SVG glyph, rotated 180° for the landing
  variant rather than two separate shapes) layered inside the existing cell
  content — stay location text or `✓` — via a new `.calendar-cell-content`
  flex wrapper, so the marker doesn't replace whatever the cell already
  showed. The cell's tooltip and the legend both gained matching
  "Ankunft"/"Abreise" text. Full reasoning in
  [Architecture.md](Architecture.md#calendar-arrivaldeparture-markers).

  Verified with a full local click-through (Playwright, seeding two users'
  flights and an accommodation via the real API against disposable
  Postgres/ClamAV containers, since the UI forms for Flights/Accommodations
  were already exercised in earlier verification passes): the admin's
  arrival day shows the landing icon, their departure day (scrolled into
  view, since the table is wider than the viewport) shows the departure
  icon, and the accommodation's confirmed days render green exactly as
  before — the new markers layer over that pre-existing coloring rather
  than clobbering it. No new automated tests (no frontend test suite exists
  in this project — see [tests/README.md](../tests/README.md); this was a
  pure frontend/UI change with nothing to add to the backend suite), so the
  browser click-through above is this feature's only verification.

## Next unfinished item

Nothing is currently outstanding from `docs/Spec.md`, including the full
mid-session update covered above (Admin Menu, media count badge,
accommodation capacity, Calendar markers) — beyond the still-open
placeholder WhatsApp group link noted earlier (blocked on the real link
existing, not on implementation work). Worth a fresh read-through of
`docs/Spec.md` against the running app next time to confirm nothing else
has been missed, rather than assuming this list is exhaustive — that's
exactly how the missing Kalender nav item was found this session.
