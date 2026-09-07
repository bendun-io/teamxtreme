// Every non-public route must reject a caller with no session cookie at all,
// and separately a caller presenting a forged/garbage session cookie.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, resetDb, closeDb } from '../helpers/server.js';
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

const fakeId = '00000000-0000-0000-0000-000000000000';

const protectedRoutes = [
  ['GET', '/api/auth/me'],
  ['GET', '/api/users'],
  ['DELETE', `/api/users/${fakeId}`],
  ['GET', '/api/profile'],
  ['PATCH', '/api/profile'],
  ['GET', '/api/flights'],
  ['POST', '/api/flights'],
  ['PATCH', `/api/flights/${fakeId}`],
  ['DELETE', `/api/flights/${fakeId}`],
  ['GET', '/api/accommodations'],
  ['POST', '/api/accommodations'],
  ['POST', `/api/accommodations/${fakeId}/assign`],
  ['POST', `/api/accommodations/${fakeId}/assignments/${fakeId}/accept`],
  ['GET', '/api/vehicles'],
  ['POST', '/api/vehicles'],
  ['POST', `/api/vehicles/${fakeId}/assign`],
  ['POST', `/api/vehicles/${fakeId}/assignments/${fakeId}/accept`],
  ['GET', '/api/activities'],
  ['POST', '/api/activities'],
  ['POST', `/api/activities/${fakeId}/stop`],
  ['POST', '/api/auth/invites'],
  ['GET', '/api/auth/invites'],
  ['GET', '/api/media'],
  ['POST', '/api/media'],
  ['GET', '/api/media/download-all'],
  ['GET', '/api/media/count'],
  ['GET', '/api/settings'],
  ['PATCH', '/api/admin/settings'],
  ['POST', '/api/admin/clear-data'],
];

for (const [method, path] of protectedRoutes) {
  test(`${method} ${path} rejects a request with no session cookie`, async () => {
    const client = new ApiClient(baseUrl);
    const res = await client.request(method, path, method === 'GET' || method === 'DELETE' ? {} : { body: {} });
    assert.equal(res.status, 401, `${method} ${path} should require auth`);
  });

  test(`${method} ${path} rejects a forged session cookie`, async () => {
    const client = new ApiClient(baseUrl);
    client.cookie = 'tx_session=not-a-real-jwt';
    const res = await client.request(method, path, method === 'GET' || method === 'DELETE' ? {} : { body: {} });
    assert.equal(res.status, 401, `${method} ${path} should reject a forged cookie`);
  });
}

test('the public invite lookup route does not require auth', async () => {
  const client = new ApiClient(baseUrl);
  const res = await client.get(`/api/auth/invites/${fakeId}`);
  // no auth required — a missing/garbage token is a 404, not a 401
  assert.equal(res.status, 404);
});
