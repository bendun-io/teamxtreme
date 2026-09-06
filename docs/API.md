# API

Base path for all endpoints: `/api`. JSON in, JSON out. Authenticated
requests carry a `tx_session` httpOnly JWT cookie (see
[Architecture.md](Architecture.md#auth)) — the frontend must send
`credentials: 'include'` on every `fetch`.

## Implemented

### `GET /api/health`

Used by Docker's `HEALTHCHECK` (and by anything else that wants a liveness
check). Always returns `200` while the process is up.

**Response `200`**
```json
{ "status": "ok", "uptime": 12.345 }
```

### Auth

Accounts are invite-only: an admin creates a per-person invite, and the
invitee uses its link to either set a password or continue with Google/
Instagram. Regular users cannot create invites.

#### `POST /api/auth/login`
Body: `{ "email": "...", "password": "..." }`. Sets the session cookie on
success.
**200** `{ "user": { id, email, name, profilePictureUrl, isAdmin } }`
**401** `{ "error": "invalid credentials" }` — wrong password, unknown email,
or an account that only has a social login (no `password_hash`).

#### `POST /api/auth/logout`
Clears the session cookie. **204**, no body.

#### `GET /api/auth/me`
Requires auth. **200** `{ "user": {...} }` (same shape as login).
**401** `{ "error": "not authenticated" }` if the cookie is missing/invalid.

#### `GET /api/auth/google`, `GET /api/auth/instagram`
Redirects to the provider's consent screen. Add `?invite=<token>` to link the
result to an invite (registration flow); omit it for a plain login attempt
against an already-linked account. The `/callback` route on each completes
the exchange and redirects back to `APP_BASE_URL` — to `/` on success, or to
`/login?error=<code>` on failure (`oauth`, `oauth_state`, `invite_invalid`,
`not_invited`).

#### `POST /api/auth/invites` — admin only
Body: `{ "name": "<invitee's name>" }`.
**201** `{ id, inviteeName, token, url, createdAt }` — `url` is the shareable
invite link (`${APP_BASE_URL}/invite/:token}`).
**403** if the caller isn't an admin.

#### `GET /api/auth/invites` — admin only
**200** `{ "invites": [{ id, inviteeName, url, createdAt, usedAt, usedByName }] }`

#### `GET /api/auth/invites/:token`
Public — used by the invite-acceptance page to validate a link before
showing the signup form.
**200** `{ "inviteeName": "..." }`
**404** if the token doesn't exist or was already used.

#### `POST /api/auth/register`
Body: `{ token, name, email, password }`. Consumes an unused invite, creates
the account, and sets the session cookie.
**201** `{ "user": {...} }`
**404** invite not found/used. **409** email already in use.

### Flights
All routes require auth (`requireAuth` on the whole router). A flight belongs
to the user who created it (`userId`/`userName` in every response); only that
user can edit or delete it.

#### `GET /api/flights`
Overview of everyone's flights, ordered by `departureTime` ascending.
**200** `{ "flights": [{ id, userId, userName, airline, flightNumber, departureAirport, arrivalAirport, departureTime, arrivalTime, notes, createdAt, updatedAt }] }`

#### `POST /api/flights`
Body: `{ airline?, flightNumber?, departureAirport, arrivalAirport, departureTime, arrivalTime?, notes? }`.
Creates a flight owned by the caller.
**201** `{ "flight": {...} }`
**400** if `departureAirport`, `arrivalAirport` or `departureTime` is missing.

#### `PATCH /api/flights/:id`
Body: same shape as `POST` (full replace, not a partial patch — the frontend
edit form always sends every field). Only the owner may edit.
**200** `{ "flight": {...} }`
**400** missing required field. **403** not the owner. **404** not found.

#### `DELETE /api/flights/:id`
Only the owner may delete.
**204**, no body. **403** not the owner. **404** not found.

### Users

#### `GET /api/users`
Requires auth. Minimal directory used to populate "assign someone else"
pickers.
**200** `{ "users": [{ id, name }] }`, ordered by name.

### Accommodations
All routes require auth. Anyone can create an accommodation and assign
anyone (self or another user) to it; only the assigned user can accept a
pending assignment.

#### `GET /api/accommodations`
Overview of all accommodations with their assignments, ordered by
`startDate` ascending.
**200** `{ "accommodations": [{ id, createdBy, createdByName, location, startDate, endDate, notes, createdAt, assignments: [{ id, userId, userName, assignedById, assignedByName, status, createdAt }] }] }`
— `status` is `"pending"` or `"accepted"`.

#### `POST /api/accommodations`
Body: `{ location, startDate, endDate, notes? }` (`startDate`/`endDate` are
`YYYY-MM-DD`). Creates an accommodation owned by the caller.
**201** `{ "accommodation": {...} }`
**400** if `location`, `startDate` or `endDate` is missing.

#### `POST /api/accommodations/:id/assign`
Body: `{ userId? }`. Omit `userId` to assign yourself (created already
`accepted`); pass another user's id to assign them (created `pending` until
they accept).
**201** `{ "accommodation": {...} }` (with the new assignment included).
**404** accommodation not found. **409** that user is already assigned.

#### `POST /api/accommodations/:id/assignments/:assignmentId/accept`
Accepts a pending assignment. Only the assigned user may accept it.
**200** `{ "accommodation": {...} }`
**403** not your assignment. **404** assignment not found.

### Vehicles
Same shape as Accommodations, with `seats` (capacity) and `details` instead
of location/dates.

#### `GET /api/vehicles`
**200** `{ "vehicles": [{ id, createdBy, createdByName, seats, details, createdAt, assignments: [...] }] }`, ordered by `createdAt` ascending.

#### `POST /api/vehicles`
Body: `{ seats, details? }`.
**201** `{ "vehicle": {...} }`
**400** if `seats` is missing or not a positive number.

#### `POST /api/vehicles/:id/assign`
Body: `{ userId? }` — mirrors accommodations' assign endpoint.
**201** `{ "vehicle": {...} }`
**404** vehicle not found. **409** that user is already assigned.

#### `POST /api/vehicles/:id/assignments/:assignmentId/accept`
Mirrors accommodations' accept endpoint.
**200** `{ "vehicle": {...} }`
**403** not your assignment. **404** assignment not found.

### Profile
All routes require auth and act on the caller's own account — there is no
way to edit anyone else's profile.

#### `GET /api/profile`
**200** `{ "user": {...} }` — same shape as `/api/auth/me`.

#### `PATCH /api/profile`
Body: `multipart/form-data` with an optional `name` field and an optional
`picture` file field (so a name-only update still posts as multipart).
Uploaded pictures are stored under the `uploads-data` Docker volume (see
[Architecture.md](Architecture.md#media-storage)) and served back at
`/uploads/<filename>`; only `name`, only `picture`, or both may be sent —
whichever is omitted is left unchanged.
**200** `{ "user": {...} }`
**400** empty `name`, or `picture` isn't an image / exceeds 5 MB.

### Planned

Not implemented yet — see [DevelopmentPlan.md](DevelopmentPlan.md) for build
order.

#### Media sharing
- `POST /api/media` — upload (original quality — storage strategy is an open
  decision, see DevelopmentPlan.md).
- `GET /api/media` — list/gallery.

No endpoint for the homepage cards (training times, travel info, packing
list) — that content is hardcoded directly in the frontend per spec.
