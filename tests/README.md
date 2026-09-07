# Tests

API and security tests for the TeamXtreme backend. They run against the real
Express app (`src/backend/src/app.js`) and a disposable Postgres container —
no mocking of the database or HTTP layer.

## Running

Requires the backend's dependencies to be installed once
(`cd ../src/backend && npm install`) — these tests import the backend's app
code (`app.js`, `db/*`) directly and rely on Node resolving *its* imports
(express, pg, ...) from `src/backend/node_modules`. The test helpers
themselves need a couple of packages too (currently just `bcryptjs`, to seed
users directly in the database) — install those once with `npm install` in
this folder, since Node resolves a file's own bare imports relative to that
file's location, not the app's.

```
cd tests
npm install
npm test
```

`npm test` first brings up a throwaway `postgres-test` container (via
`docker-compose.yml` in this folder, port 5433, tmpfs storage — it never
touches your real dev/prod database) and a throwaway `clamav-test` container
(port 3311, so it never collides with a real dev/prod clamd on 3310) and
waits for both to be healthy, then runs every `*.test.js` file under `api/`
and `security/` with Node's built-in test runner, using the fixed test
credentials in `.env.test`. `clamav-test` uses the database-preloaded image
tag (not `_base`), so it doesn't need to download virus signatures on
startup — it's usually healthy within ~30 seconds.

Tear down the container when you're done (optional — it's tmpfs, so a
`docker compose down` or a reboot wipes it either way):
```
npm run down
```

## Structure

- `helpers/server.js` — starts the real app on an ephemeral port against the
  test database; `resetDb()` truncates every app table between tests;
  `seedAdmin()` re-runs the real bootstrap-admin logic.
- `helpers/client.js` — a small cookie-aware `fetch` wrapper (`ApiClient`),
  since session auth here is a cookie, not a bearer token.
- `helpers/seed.js` — creates users directly in the database (bypassing the
  invite flow, for speed) and/or logs them in through the real
  `POST /api/auth/login` route.
- `api/` — one file per resource, covering the documented success and error
  responses in [../docs/API.md](../docs/API.md). `api/media.test.js` also
  covers the ClamAV integration end to end (via the real `clamav-test`
  container) by uploading the standard EICAR test string and asserting it's
  rejected and never stored — no mocking of the scanner either.
- `security/` — non-users hitting authenticated routes, non-admins hitting
  admin-only routes, and users trying to modify data owned by someone else.

Each test file runs serially (`--test-concurrency=1`) against the same
Postgres container and truncates tables in a `beforeEach`, so tests within a
file must not run concurrently — this is deliberate, not an accident of
Node's test runner defaults.

## `add-user` script

`scripts/add-user.js` (per docs/Spec.md's "Test cases" section) logs in as
the admin and creates a fully-populated test user — invite, registration,
contact info, both flights, and an accommodation — against a **real
running instance** (local dev, or a deployed one), via the real HTTP API.
Unlike everything else in this folder, it doesn't touch the disposable test
containers; it talks to whatever `APP_BASE_URL` points at.

```
npm run add-user                       # interactive prompts
npm run add-user -- --input file.json  # non-interactive, reads file.json
npm run add-user -- --save file.json   # interactive, but save under this path
```

**PowerShell**: the `npm.ps1` shim drops a bare `--` before it reaches npm,
so the commands above silently fall back to interactive mode (npm logs
`Unknown cli config "--input"` and swallows the flag instead of forwarding
it). Quote the separator — `npm run add-user '--' --input file.json` — or
call node directly: `node --env-file=../.env scripts/add-user.js --input
file.json` (from `tests/`).

Requires `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `APP_BASE_URL` — the npm script
loads them from the repository root's `.env` via `node --env-file=../.env`,
the same file `docker compose` itself uses, so pointing this at the
deployed instance is just a matter of that `.env` having the deployed
`APP_BASE_URL` and the real admin credentials.

Whichever way the input was obtained, the resolved answers (including an
auto-generated email/password if either was left blank — neither is
optional for the actual registration API call, even though the spec's
question list doesn't mention a password at all) are saved back to a JSON
file for re-use — default path `scripts/output/<slug>-<timestamp>.json`, or
the `--input`/`--save` path if one was given. `scripts/output/` is
gitignored: these files contain a real (or placeholder) email and a
plaintext password. See
[Architecture.md](../docs/Architecture.md#add-user-script) for the full
design and the input file's JSON shape.
