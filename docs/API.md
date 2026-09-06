# API

Base path for all endpoints: `/api`. JSON in, JSON out.

## Implemented

### `GET /api/health`

Used by Docker's `HEALTHCHECK` (and by anything else that wants a liveness
check). Always returns `200` while the process is up.

**Response `200`**
```json
{ "status": "ok", "uptime": 12.345 }
```

## Planned (not yet implemented)

These follow from [Spec.md](Spec.md) and are ordered per
[DevelopmentPlan.md](DevelopmentPlan.md). Shapes below are provisional and
will be refined when each feature is built.

### Auth
- `POST /api/auth/login` — email/username + password.
- `GET /api/auth/google` / `GET /api/auth/google/callback` — Google OAuth.
- `GET /api/auth/instagram` / `GET /api/auth/instagram/callback` — Instagram OAuth.
- `POST /api/auth/logout`
- `GET /api/auth/me` — current session's user.
- Invite-only: accounts are created via an invite (link or code), not open
  self-registration. Exact invite flow (who can generate invites, expiry) is
  still an open decision.

### Profile
- `GET /api/profile`
- `PATCH /api/profile` — name, profile picture.

### Flights
- `GET /api/flights` — overview of everyone's flights.
- `POST /api/flights`
- `PATCH /api/flights/:id`
- `DELETE /api/flights/:id`

### Accommodations
- `GET /api/accommodations`
- `POST /api/accommodations` — location, start date, end date, extra info.
- `POST /api/accommodations/:id/assign` — assign self, or assign someone else.
- `POST /api/accommodations/:id/assignments/:assignmentId/accept` — accept an
  assignment someone else created.

### Vehicles
- `GET /api/vehicles`
- `POST /api/vehicles` — capacity (seats), details.
- `POST /api/vehicles/:id/assign` / accept, mirroring accommodations.

### Media sharing
- `POST /api/media` — upload (original quality — storage strategy is an open
  decision, see DevelopmentPlan.md).
- `GET /api/media` — list/gallery.

No endpoint for the homepage cards (training times, travel info, packing
list) — that content is hardcoded directly in the frontend per spec.
