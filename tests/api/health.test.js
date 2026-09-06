import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, closeDb } from '../helpers/server.js';
import { ApiClient } from '../helpers/client.js';

let baseUrl;

before(async () => {
  baseUrl = await startServer();
});

after(async () => {
  await stopServer();
  await closeDb();
});

test('GET /api/health returns ok without auth', async () => {
  const client = new ApiClient(baseUrl);
  const res = await client.get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(typeof res.body.uptime, 'number');
});
