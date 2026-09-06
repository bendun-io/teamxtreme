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

### Not started
Roughly in build order — earlier items unblock later ones:

1. **Data model for the remaining features** — `flights`,
   `accommodations`, `accommodation_assignments`, `vehicles`,
   `vehicle_assignments` tables (new files under
   `src/backend/migrations/`, following `001_create_users_and_invites.sql`).
2. **Flights** — add + overview list, end to end (API + UI).
3. **Accommodations** — add, assign self/others, accept assignment.
4. **Vehicles** — add with capacity, assign/accept (mirrors accommodations).
5. **Profile management** — name + profile picture; prefill picture from
   social login when available (Google/Instagram profile pictures aren't
   pulled in yet — `profile_picture_url` is only ever set from the OAuth
   provider payload's `picture`/`profile_picture_url` field, which is `null`
   for password-only accounts until this lands).
6. **Share option** — share the app link via the device's native share sheet
   (Web Share API), falling back to copy-link. (`AdminInvitesPage` already
   has a "copy link" button for invites specifically — this item is the
   general "share the app" button from the spec.)
7. **Media sharing** — images/videos in original quality. Needs a storage
   decision (local Docker volume vs. an object store) since "original
   quality" likely means large files that shouldn't live in Postgres.
8. **PWA polish** — replace placeholder icons (`src/frontend/public/icons/`)
   and header image (`src/frontend/public/header.png`) with real branding/
   team photo; fill in the real training times/location on the homepage
   (currently a placeholder string in `pages/HomePage.jsx`).

## Open decisions

- **Media storage**: local volume mounted into the backend container vs. an
  external object store (e.g. S3-compatible). "Original file quality" rules
  out anything with aggressive compression/resizing.

## Next unfinished item

**Data model for flights/accommodations/vehicles** (item 1 above), then
**Flights** end-to-end — it's the simplest of the three remaining per-user
features (no assign/accept flow) and a good template for accommodations and
vehicles to follow.
