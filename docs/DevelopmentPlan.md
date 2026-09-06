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
  own.

### Not started
Roughly in build order — earlier items unblock later ones:

1. **Calendar view** — a table with one column per day from the first
   outbound flight to the last return flight and one row per user (sorted by
   arrival time), showing per user/day whether they're present (between
   their own flights) and which accommodation they're staying at. Another
   spec addition; purely a read view over already-existing flights +
   accommodations data, no new data model needed.
2. **Share option** — share the app link via the device's native share sheet
   (Web Share API), falling back to copy-link. (`AdminInvitesPage` already
   has a "copy link" button for invites specifically — this item is the
   general "share the app" button from the spec.)
3. **Media sharing** — images/videos in original quality, shared between
   users. The storage mechanism is now precedented by profile pictures (a
   Docker volume, served via `express.static`, random-UUID filenames) — this
   item is mainly the gallery/list UI and an upload flow that preserves
   original quality (no resizing), rather than a new infra decision.
4. **PWA polish** — replace placeholder icons (`src/frontend/public/icons/`)
   and header image (`src/frontend/public/header.png`) with real branding/
   team photo; fill in the real training times/location on the homepage
   (currently a placeholder string in `pages/HomePage.jsx`).

## Next unfinished item

**Calendar view** (item 1 above) — the table-format presence/accommodation
overview described in the spec's newest bullet.
