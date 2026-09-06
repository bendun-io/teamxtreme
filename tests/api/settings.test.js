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

test('GET /api/settings returns the default WhatsApp link when nothing has been set', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'settings-reader@test.local',
    password: 'pw123456',
    name: 'Reader',
  });

  const res = await client.get('/api/settings');
  assert.equal(res.status, 200);
  assert.match(res.body.settings.whatsappLink, /^https:\/\/chat\.whatsapp\.com\//);
});

test('an admin can update the WhatsApp link and it is reflected in GET /api/settings', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'settings-admin@test.local',
    password: 'pw123456',
    name: 'Settings Admin',
    isAdmin: true,
  });

  const patchRes = await client.patch('/api/admin/settings', {
    whatsappLink: 'https://chat.whatsapp.com/real-group-invite',
  });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.settings.whatsappLink, 'https://chat.whatsapp.com/real-group-invite');

  const getRes = await client.get('/api/settings');
  assert.equal(getRes.body.settings.whatsappLink, 'https://chat.whatsapp.com/real-group-invite');
});

test('PATCH /api/admin/settings rejects an empty WhatsApp link', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'settings-admin2@test.local',
    password: 'pw123456',
    name: 'Settings Admin 2',
    isAdmin: true,
  });

  const res = await client.patch('/api/admin/settings', { whatsappLink: '   ' });
  assert.equal(res.status, 400);
});
