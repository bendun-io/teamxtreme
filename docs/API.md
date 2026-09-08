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
**429** `{ "error": "too many failed login attempts", "retryAfterSeconds": N }`
(also sent as a `Retry-After` header) — the caller's IP has reached 10 failed
attempts; see
[Architecture.md](Architecture.md#login-brute-force-protection). A successful
login resets the counter for that IP.

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
Requires auth. Directory of every user, used both to populate "assign
someone else" pickers and to build the Calendar page's contact overlay.
**200** `{ "users": [{ id, name, email, phone, instagramHandle }] }`,
ordered by name — `email`, `phone` and `instagramHandle` are `null` when a
user hasn't filled them in (see [Profile](#profile)).

#### `DELETE /api/users/:id` — admin only
Deletes a user's account and everything that belongs to them (flights,
accommodations/vehicles/activities they created, media they uploaded, their
own used invite, their profile picture file) — see
[Architecture.md](Architecture.md#user-deletion).
**204**, no body.
**400** if `:id` is the caller's own account (an admin can't delete
themselves through this route). **403** if the caller isn't an admin.
**404** if no user with that id exists. **409** if the user still has
associated data the delete can't safely cascade past (an admin who has
created invites for other people).

### Accommodations
All routes require auth. Anyone can create an accommodation and assign
anyone (self or another user) to it; only the assigned user can accept a
pending assignment.

#### `GET /api/accommodations`
Overview of all accommodations with their assignments, ordered by
`startDate` ascending.
**200** `{ "accommodations": [{ id, createdBy, createdByName, location, startDate, endDate, notes, spots, freeSpots, createdAt, assignments: [{ id, userId, userName, assignedById, assignedByName, status, createdAt }] }] }`
— `status` is `"pending"` or `"accepted"`. `spots` is `null` for an
accommodation created before this field existed. `freeSpots` is
`spots` minus the number of assignments (pending *and* accepted both
count — a spot is reserved once assigned, not only once accepted), `null`
whenever `spots` is; it is **not** clamped at 0, since assigning isn't
capacity-checked (same as vehicles) — a negative value signals more people
are assigned than there's room for.

#### `POST /api/accommodations`
Body: `{ location, startDate, endDate, spots, notes? }` (`startDate`/
`endDate` are `YYYY-MM-DD`). Creates an accommodation owned by the caller.
**201** `{ "accommodation": {...} }`
**400** if `location`, `startDate` or `endDate` is missing, or `spots`
isn't a positive whole number.

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

A "ride" (still the `vehicles` route/table name): a starting point, an
ending point, a departure time, seats (capacity) and freeform details. Same
assignment shape as Accommodations otherwise (anyone can create one and
assign anyone; only the assigned user can accept a pending assignment).

#### `GET /api/vehicles`
**200** `{ "vehicles": [{ id, createdBy, createdByName, startingPoint, endingPoint, departureTime, seats, details, freeSpots, createdAt, assignments: [...] }] }`,
ordered by `departureTime` ascending (a `null` `departureTime` — a ride
created before this field existed — sorts last). `freeSpots` is `seats`
minus the number of assignments (pending *and* accepted both count, same as
accommodations); unlike accommodations' `freeSpots` it's never `null` since
`seats` is required. Not clamped at 0 — assigning isn't capacity-checked, so
a negative value signals more people are assigned than there's room for. The
frontend splits this into "upcoming" (shown by default) and "past" (behind a
toggle) — see [Architecture.md](Architecture.md#vehicles--ride-sharing).

#### `POST /api/vehicles`
Body: `{ startingPoint, endingPoint, departureTime, seats, details? }`.
**201** `{ "vehicle": {...} }`
**400** if `startingPoint`, `endingPoint` or `departureTime` is missing, or
`seats` is missing or not a positive number.

#### `POST /api/vehicles/:id/assign`
Body: `{ userId? }` — mirrors accommodations' assign endpoint.
**201** `{ "vehicle": {...} }`
**404** vehicle not found. **409** that user is already assigned.

#### `POST /api/vehicles/:id/assignments/:assignmentId/accept`
Mirrors accommodations' accept endpoint.
**200** `{ "vehicle": {...} }`
**403** not your assignment. **404** assignment not found.

### Activities
All routes require auth. Anyone can create an activity; the list only ever
shows ongoing or future ones.

#### `GET /api/activities`
Ongoing/future activities, ordered by `startTime` ascending. An activity with
no `endTime` runs indefinitely (until stopped); one whose `endTime` has
already passed is omitted.
**200** `{ "activities": [{ id, createdBy, createdByName, title, location, startTime, endTime, createdAt }] }`

#### `POST /api/activities`
Body: `{ title, location, startTime, endTime? }`. Creates an activity owned by
the caller.
**201** `{ "activity": {...} }`
**400** if `title`, `location` or `startTime` is missing.

#### `POST /api/activities/:id/stop`
Sets `endTime` to the current time. Only the creator or an admin may stop an
activity.
**200** `{ "activity": {...} }`
**403** not the creator/an admin. **404** not found.

### Profile
All routes require auth and act on the caller's own account — there is no
way to edit anyone else's profile.

#### `GET /api/profile`
**200** `{ "user": {...} }` — same shape as `/api/auth/me`.

#### `PATCH /api/profile`
Body: `multipart/form-data` with any combination of `name`, `email`,
`phone`, `instagramHandle` (all optional text fields) and an optional
`picture` file field. Any field that's omitted entirely is left unchanged;
`phone` and `instagramHandle` can be cleared by sending them as an empty
string. `instagramHandle` is stored without a leading `@` if one is sent.
Uploaded pictures are stored under the `uploads-data` Docker volume (see
[Architecture.md](Architecture.md#media-storage)) and served back at
`/uploads/<filename>`.
**200** `{ "user": {...} }`
**400** empty `name`; `email` sent empty while the account still has a
password set (would lock out password login); `picture` isn't an image /
exceeds 5 MB, or it failed the malware scan
(`{ "error": "file failed malware scan" }`) — see
[Architecture.md](Architecture.md#malware-scanning).
**409** `email` already belongs to another account.

### Media

All routes require auth. Anyone can upload; everyone sees everyone's photos
and videos (no delete endpoint — out of scope for now). Every upload —
here and for profile pictures — is scanned by ClamAV before it's stored; see
[Architecture.md](Architecture.md#malware-scanning).

#### `GET /api/media`
Gallery of everyone's shared photos/videos, ordered newest first.
**200** `{ "media": [{ id, uploadedBy, uploadedByName, url, thumbnailUrl, originalName, mimeType, fileSize, createdAt }] }`
— `url` is the original file's `/uploads/<filename>` path (unchanged, full
quality). `thumbnailUrl` is a generated `/uploads/thumbnails/<filename>` JPEG
used by the gallery grid instead of the original — for an image this is a
resized copy, for a video an extracted frame with a play-button overlay
baked in — see [Architecture.md](Architecture.md#media-thumbnails). `null`
when generation failed (an unsupported codec/format, or `ffmpeg` unavailable
for a video); the frontend falls back to the full-resolution original for an
image, or a fixed video-icon placeholder for a video.

#### `POST /api/media`
Body: `multipart/form-data` with a `file` field (image or video, original
quality — no resizing/transcoding), up to 500 MB.
**201** `{ "media": {...} }`
**400** missing file, file isn't an image/video, exceeds the size limit, or
it failed the malware scan (`{ "error": "file failed malware scan" }`).

#### `GET /api/media/count`
Total number of shared photos/videos, for the bottom nav's "Bilder" badge —
a lighter query than `GET /api/media` for something fetched on every
authenticated page.
**200** `{ "count": N }`

#### `GET /api/media/recent`
The two most recent uploads (same shape as `GET /api/media`'s entries), for
the homepage's photos & videos card.
**200** `{ "media": [{ id, uploadedBy, uploadedByName, url, thumbnailUrl, originalName, mimeType, fileSize, createdAt }] }`
— empty array if nothing has been shared yet.

#### `GET /api/media/download-all`
Streams every shared photo/video as a single zip (for the gallery's "download
all" button), each entry named after its `originalName` (de-duplicated with
the media id when two uploads share a name).
**200** `application/zip`, `Content-Disposition: attachment; filename="teamxtreme-media.zip"`.
**404** `{ "error": "no media to download" }` if nothing has been shared yet.

### Settings

#### `GET /api/settings`
Requires auth (any user, not admin-only — the homepage needs the current
WhatsApp link).
**200** `{ "settings": { "whatsappLink": "..." } }` — `whatsappLink` defaults
to a placeholder until an admin sets a real one (see
[Admin](#admin)/`PATCH /api/admin/settings`).

### Admin
All routes require auth **and** `is_admin`; see
[Architecture.md](Architecture.md#admin-menu).

#### `PATCH /api/admin/settings`
Body: `{ "whatsappLink": "..." }`.
**200** `{ "settings": { "whatsappLink": "..." } }`
**400** if `whatsappLink` is present but empty/whitespace-only.

#### `POST /api/admin/clear-data`
Resets the app for a new season: deletes every shared photo/video (DB rows
and files on disk), every flight/accommodation/vehicle/activity and their
assignments, every invite, and every **non-admin** user (and their profile
picture file, if locally uploaded). Admin accounts and their own profile
data are kept so the app stays usable immediately afterwards.
Body: `{ "confirm": "LÖSCHEN" }` — must match exactly, so the destructive
action can't be triggered by an accidental or scripted request.
**200** `{ "cleared": { users, flights, accommodations, vehicles, activities, media } }`
— counts of rows deleted.
**400** if `confirm` doesn't match `"LÖSCHEN"` exactly (nothing is deleted).

### Planned

Not implemented yet — see [DevelopmentPlan.md](DevelopmentPlan.md) for build
order.

No endpoint for the homepage cards (training times, travel info, packing
list) — that content is hardcoded directly in the frontend per spec.
