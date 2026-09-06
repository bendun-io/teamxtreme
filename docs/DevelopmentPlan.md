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

## Next unfinished item

Swap the placeholder WhatsApp group link in `HomePage.jsx`'s "Hilfreiche
Links" card for the real invite link once it's available. Beyond that,
nothing is outstanding from `docs/Spec.md` — every listed feature has an
end-to-end implementation. Remaining work is polish/content, at the
user's discretion: swapping `header.svg` for a real team photo if/when one
is available, and any spec additions that come up as the trip gets closer.
