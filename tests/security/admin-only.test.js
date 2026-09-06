// Per docs/Spec.md's "For all admin features, ensure that there is a test
// that only admins can use them" — invites, general settings, and clear-data
// are all admin-only surfaces; make sure a regular authenticated user can't
// reach any of them no matter how the request is shaped.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, resetDb, closeDb } from '../helpers/server.js';
import { loginAsNewUser } from '../helpers/seed.js';

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

test('a non-admin cannot create invites', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'nonadmin1@test.local',
    password: 'pw123456',
    name: 'Non Admin',
  });
  const res = await client.post('/api/auth/invites', { name: 'Someone' });
  assert.equal(res.status, 403);
});

test('a non-admin cannot list invites', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'nonadmin2@test.local',
    password: 'pw123456',
    name: 'Non Admin 2',
  });
  const res = await client.get('/api/auth/invites');
  assert.equal(res.status, 403);
});

test('an admin can create and list invites', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'admin-only@test.local',
    password: 'pw123456',
    name: 'Real Admin',
    isAdmin: true,
  });
  const createRes = await client.post('/api/auth/invites', { name: 'Someone' });
  assert.equal(createRes.status, 201);

  const listRes = await client.get('/api/auth/invites');
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.invites.length, 1);
});

test('a non-admin cannot change general settings', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'nonadmin-settings@test.local',
    password: 'pw123456',
    name: 'Non Admin Settings',
  });
  const res = await client.patch('/api/admin/settings', { whatsappLink: 'https://chat.whatsapp.com/x' });
  assert.equal(res.status, 403);
});

test('an admin can change general settings', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'admin-settings@test.local',
    password: 'pw123456',
    name: 'Admin Settings',
    isAdmin: true,
  });
  const res = await client.patch('/api/admin/settings', { whatsappLink: 'https://chat.whatsapp.com/x' });
  assert.equal(res.status, 200);
});

test('a non-admin cannot clear all data', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'nonadmin-cleardata@test.local',
    password: 'pw123456',
    name: 'Non Admin Clear',
  });
  const res = await client.post('/api/admin/clear-data', { confirm: 'LÖSCHEN' });
  assert.equal(res.status, 403);
});
