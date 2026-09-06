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
touches your real dev/prod database) and waits for it to be healthy, then
runs every `*.test.js` file under `api/` and `security/` with Node's built-in
test runner, using the fixed test credentials in `.env.test`.

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
  responses in [../docs/API.md](../docs/API.md).
- `security/` — non-users hitting authenticated routes, non-admins hitting
  admin-only routes, and users trying to modify data owned by someone else.

Each test file runs serially (`--test-concurrency=1`) against the same
Postgres container and truncates tables in a `beforeEach`, so tests within a
file must not run concurrently — this is deliberate, not an accident of
Node's test runner defaults.
