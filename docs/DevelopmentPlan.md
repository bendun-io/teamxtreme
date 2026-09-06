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

### Not started
Roughly in build order — earlier items unblock later ones:

1. **Auth** — password login + invite-only accounts; Google and Instagram
   social login. Needs a decision on session strategy (signed cookie session
   vs JWT) and where invites are stored/generated. This blocks everything
   below that's per-user (flights, accommodations, vehicles, profile), since
   they all need a real user identity.
2. **Data model & migrations** — once auth design is settled, add a Postgres
   connection to the backend plus a migration mechanism (not yet chosen —
   options: a minimal hand-rolled SQL runner, or a library like `node-pg-migrate`)
   and the core tables: `users`, `invites`, `flights`, `accommodations`,
   `accommodation_assignments`, `vehicles`, `vehicle_assignments`.
3. **Flights** — add + overview list, end to end (API + UI).
4. **Accommodations** — add, assign self/others, accept assignment.
5. **Vehicles** — add with capacity, assign/accept (mirrors accommodations).
6. **Profile management** — name + profile picture; prefill picture from
   social login when available.
7. **Share option** — share the app link via the device's native share sheet
   (Web Share API), falling back to copy-link.
8. **Media sharing** — images/videos in original quality. Needs a storage
   decision (local Docker volume vs. an object store) since "original
   quality" likely means large files that shouldn't live in Postgres.
9. **PWA polish** — replace placeholder icons (`src/frontend/public/icons/`)
   and header image (`src/frontend/public/header.png`) with real branding/
   team photo; fill in the real training times/location on the homepage
   (currently a placeholder string in `App.jsx`).

## Open decisions

- **Session strategy**: cookie session (with a Postgres-backed store) vs.
  JWT. Affects invite/auth design.
- **Migration tooling**: hand-rolled SQL files vs. a library.
- **Media storage**: local volume mounted into the backend container vs. an
  external object store (e.g. S3-compatible). "Original file quality" rules
  out anything with aggressive compression/resizing.
- **Invite mechanism**: single shareable invite link vs. per-person invite
  codes; who can mint invites.

## Next unfinished item

Start with **Auth** (item 1 above) — it blocks nearly everything else. The
social login providers need external app registration first — see
[ExternalSetup.md](ExternalSetup.md).
