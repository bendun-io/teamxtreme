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
