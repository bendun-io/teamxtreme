import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { pool } from '../../src/backend/src/db/pool.js';
import { ApiClient } from './client.js';

// Inserts a user directly (bypassing the invite flow) for tests that just
// need "some user" to exist — cheap and keeps auth-flow tests focused on
// auth.test.js. Uses a low bcrypt cost factor purely for test speed.
export async function createUser({ email, password, name, isAdmin = false }) {
  const passwordHash = password ? await bcrypt.hash(password, 4) : null;
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name, is_admin)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, is_admin`,
    [email, passwordHash, name, isAdmin]
  );
  return rows[0];
}

// Creates a user and returns an ApiClient already logged in as them, via
// the real POST /api/auth/login route.
export async function loginAsNewUser(baseUrl, { email, password, name, isAdmin = false }) {
  await createUser({ email, password, name, isAdmin });
  const client = new ApiClient(baseUrl);
  const res = await client.post('/api/auth/login', { email, password });
  assert.equal(res.status, 200, `seeded user ${email} should be able to log in`);
  return { client, user: res.body.user };
}
