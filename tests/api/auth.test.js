import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, resetDb, seedAdmin, closeDb } from '../helpers/server.js';
import { createUser, loginAsNewUser } from '../helpers/seed.js';
import { ApiClient } from '../helpers/client.js';

let baseUrl;

before(async () => {
  baseUrl = await startServer();
});

beforeEach(async () => {
  await resetDb();
});

after(async () => {
  await stopServer();
  await closeDb();
});

test('bootstraps an admin from ADMIN_EMAIL/ADMIN_PASSWORD on an empty database', async () => {
  await seedAdmin();
  const client = new ApiClient(baseUrl);
  const res = await client.post('/api/auth/login', {
    email: 'admin@test.local',
    password: 'test-admin-password-123',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.isAdmin, true);
});

test('login rejects a wrong password', async () => {
  await createUser({ email: 'a@test.local', password: 'correct-horse', name: 'A' });
  const client = new ApiClient(baseUrl);
  const res = await client.post('/api/auth/login', {
    email: 'a@test.local',
    password: 'wrong-password',
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'invalid credentials');
});

test('login rejects an unknown email', async () => {
  const client = new ApiClient(baseUrl);
  const res = await client.post('/api/auth/login', {
    email: 'nobody@test.local',
    password: 'whatever',
  });
  assert.equal(res.status, 401);
});

test('login rejects a social-only account (no password_hash)', async () => {
  await createUser({ email: 'social@test.local', password: null, name: 'Social' });
  const client = new ApiClient(baseUrl);
  const res = await client.post('/api/auth/login', {
    email: 'social@test.local',
    password: 'anything',
  });
  assert.equal(res.status, 401);
});

test('GET /api/auth/me requires auth and reflects the logged-in user', async () => {
  const anon = new ApiClient(baseUrl);
  const anonRes = await anon.get('/api/auth/me');
  assert.equal(anonRes.status, 401);

  const { client, user } = await loginAsNewUser(baseUrl, {
    email: 'me@test.local',
    password: 'pw123456',
    name: 'Me',
  });
  const res = await client.get('/api/auth/me');
  assert.equal(res.status, 200);
  assert.equal(res.body.user.id, user.id);
  assert.equal(res.body.user.email, 'me@test.local');
});

test('logout clears the session', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'logout@test.local',
    password: 'pw123456',
    name: 'Logout',
  });
  const logoutRes = await client.post('/api/auth/logout');
  assert.equal(logoutRes.status, 204);

  const meRes = await client.get('/api/auth/me');
  assert.equal(meRes.status, 401);
});

test('admin can create an invite and it can be used to register exactly once', async () => {
  const { client: admin } = await loginAsNewUser(baseUrl, {
    email: 'admin2@test.local',
    password: 'pw123456',
    name: 'Admin2',
    isAdmin: true,
  });

  const createRes = await admin.post('/api/auth/invites', { name: 'Invitee' });
  assert.equal(createRes.status, 201);
  const { token } = createRes.body;
  assert.ok(token);

  const lookupRes = await new ApiClient(baseUrl).get(`/api/auth/invites/${token}`);
  assert.equal(lookupRes.status, 200);
  assert.equal(lookupRes.body.inviteeName, 'Invitee');

  const registerClient = new ApiClient(baseUrl);
  const registerRes = await registerClient.post('/api/auth/register', {
    token,
    name: 'Invitee',
    email: 'invitee@test.local',
    password: 'pw123456',
  });
  assert.equal(registerRes.status, 201);
  assert.equal(registerRes.body.user.email, 'invitee@test.local');

  // the invite is now consumed
  const reuseRes = await new ApiClient(baseUrl).post('/api/auth/register', {
    token,
    name: 'Invitee',
    email: 'invitee2@test.local',
    password: 'pw123456',
  });
  assert.equal(reuseRes.status, 404);

  const lookupAgainRes = await new ApiClient(baseUrl).get(`/api/auth/invites/${token}`);
  assert.equal(lookupAgainRes.status, 404);
});

test('registering with an already-used email returns 409', async () => {
  await createUser({ email: 'dupe@test.local', password: 'pw123456', name: 'Dupe' });
  const { client: admin } = await loginAsNewUser(baseUrl, {
    email: 'admin3@test.local',
    password: 'pw123456',
    name: 'Admin3',
    isAdmin: true,
  });
  const invite = await admin.post('/api/auth/invites', { name: 'Second' });

  const res = await new ApiClient(baseUrl).post('/api/auth/register', {
    token: invite.body.token,
    name: 'Second',
    email: 'dupe@test.local',
    password: 'pw123456',
  });
  assert.equal(res.status, 409);
});

test('a non-admin cannot create invites', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'plain@test.local',
    password: 'pw123456',
    name: 'Plain',
  });
  const res = await client.post('/api/auth/invites', { name: 'Nope' });
  assert.equal(res.status, 403);
});
