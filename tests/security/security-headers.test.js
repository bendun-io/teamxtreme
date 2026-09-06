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

test('every response carries baseline hardening headers', async () => {
  const client = new ApiClient(baseUrl);
  const res = await client.get('/api/health');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('content-security-policy'), "frame-ancestors 'none'");
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});
