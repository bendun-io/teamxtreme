import http from 'node:http';
import { once } from 'node:events';
import { app } from '../../src/backend/src/app.js';
import { runMigrations } from '../../src/backend/src/db/migrate.js';
import { bootstrapAdmin } from '../../src/backend/src/db/bootstrapAdmin.js';
import { pool } from '../../src/backend/src/db/pool.js';

let server;

// Starts the real Express app (src/backend/src/app.js) on an ephemeral port
// against the disposable postgres-test container (see ../.env.test, loaded
// via `node --env-file` before this module — and therefore before
// db/pool.js — ever runs).
export async function startServer() {
  await runMigrations();
  server = http.createServer(app);
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

export async function stopServer() {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

// Wipes every app table so each test file starts from a clean slate.
export async function resetDb() {
  await pool.query(`
    TRUNCATE TABLE
      accommodation_assignments,
      vehicle_assignments,
      accommodations,
      vehicles,
      flights,
      media,
      invites,
      users
    RESTART IDENTITY CASCADE
  `);
}

// Re-runs the real bootstrap-admin logic (ADMIN_EMAIL/ADMIN_PASSWORD from
// .env.test) — call after resetDb() in tests that need an admin account.
export async function seedAdmin() {
  await bootstrapAdmin();
}

export async function closeDb() {
  await pool.end();
}

export { pool };
