import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, resetDb, closeDb } from '../helpers/server.js';
import { loginAsNewUser } from '../helpers/seed.js';
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

test('GET /api/users requires auth and returns a minimal, name-sorted directory', async () => {
  const anonRes = await new ApiClient(baseUrl).get('/api/users');
  assert.equal(anonRes.status, 401);

  const { client } = await loginAsNewUser(baseUrl, { email: 'zz@test.local', password: 'pw123456', name: 'Zed' });
  await loginAsNewUser(baseUrl, { email: 'aa@test.local', password: 'pw123456', name: 'Aaron' });

  const res = await client.get('/api/users');
  assert.equal(res.status, 200);
  const names = res.body.users.map((u) => u.name);
  assert.deepEqual(names, [...names].sort());
  assert.ok(res.body.users.every((u) => Object.keys(u).sort().join(',') === 'id,name'));
});
