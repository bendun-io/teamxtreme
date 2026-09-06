// Login brute-force protection (spec: "Security") — a failed-login counter
// per source IP, reset on a successful login, blocking further attempts from
// that IP for 10 minutes once it reaches 10 failures. Every request here
// sets a synthetic `Cf-Connecting-Ip` header (what `cloudflared` sets to the
// real visitor IP in production — see utils/loginRateLimit.js) so each test
// gets its own isolated counter regardless of the loopback address the test
// client actually connects from.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, resetDb, closeDb } from '../helpers/server.js';
import { createUser } from '../helpers/seed.js';
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

function loginAs(ip, body) {
  const client = new ApiClient(baseUrl);
  return client.post('/api/auth/login', body, { headers: { 'cf-connecting-ip': ip } });
}

test('blocks an IP for 10 minutes after 10 failed login attempts', async () => {
  await createUser({ email: 'victim@test.local', password: 'correct-horse', name: 'Victim' });
  const ip = '203.0.113.10';

  for (let i = 0; i < 10; i++) {
    const res = await loginAs(ip, { email: 'victim@test.local', password: 'wrong-password' });
    assert.equal(res.status, 401, `attempt ${i + 1} should still be a plain 401`);
  }

  const blockedRes = await loginAs(ip, { email: 'victim@test.local', password: 'correct-horse' });
  assert.equal(blockedRes.status, 429);
  assert.equal(blockedRes.body.error, 'too many failed login attempts');
  assert.ok(blockedRes.body.retryAfterSeconds > 0);
  assert.ok(Number(blockedRes.headers.get('retry-after')) > 0);
});

test('a blocked IP does not affect logins from a different IP', async () => {
  await createUser({ email: 'victim2@test.local', password: 'correct-horse', name: 'Victim2' });
  const attackerIp = '203.0.113.11';
  const innocentIp = '203.0.113.12';

  for (let i = 0; i < 10; i++) {
    await loginAs(attackerIp, { email: 'victim2@test.local', password: 'wrong-password' });
  }
  assert.equal((await loginAs(attackerIp, { email: 'victim2@test.local', password: 'correct-horse' })).status, 429);

  const res = await loginAs(innocentIp, { email: 'victim2@test.local', password: 'correct-horse' });
  assert.equal(res.status, 200);
});

test('a successful login resets the failed-attempt counter', async () => {
  await createUser({ email: 'victim3@test.local', password: 'correct-horse', name: 'Victim3' });
  const ip = '203.0.113.13';

  for (let i = 0; i < 9; i++) {
    await loginAs(ip, { email: 'victim3@test.local', password: 'wrong-password' });
  }
  const successRes = await loginAs(ip, { email: 'victim3@test.local', password: 'correct-horse' });
  assert.equal(successRes.status, 200);

  // Counter reset — one more wrong attempt should not trip the block.
  const res = await loginAs(ip, { email: 'victim3@test.local', password: 'wrong-password' });
  assert.equal(res.status, 401);
});
