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

async function seedUser(email) {
  return loginAsNewUser(baseUrl, { email, password: 'pw123456', name: email });
}

test('creating an accommodation requires location/startDate/endDate', async () => {
  const { client } = await seedUser('acc1@test.local');
  const res = await client.post('/api/accommodations', { location: 'Hotel X' });
  assert.equal(res.status, 400);
});

test('self-assign is created already accepted', async () => {
  const { client } = await seedUser('acc2@test.local');
  const createRes = await client.post('/api/accommodations', {
    location: 'Hotel X',
    startDate: '2026-06-01',
    endDate: '2026-06-08',
  });
  const accommodationId = createRes.body.accommodation.id;

  const assignRes = await client.post(`/api/accommodations/${accommodationId}/assign`, {});
  assert.equal(assignRes.status, 201);
  const [assignment] = assignRes.body.accommodation.assignments;
  assert.equal(assignment.status, 'accepted');
});

test('assigning another user is pending until they accept, and only they can accept it', async () => {
  const { client: creator } = await seedUser('acc3@test.local');
  const { client: assignee, user: assigneeUser } = await seedUser('acc4@test.local');
  const { client: stranger } = await seedUser('acc5@test.local');

  const createRes = await creator.post('/api/accommodations', {
    location: 'Hotel Y',
    startDate: '2026-06-01',
    endDate: '2026-06-08',
  });
  const accommodationId = createRes.body.accommodation.id;

  const assignRes = await creator.post(`/api/accommodations/${accommodationId}/assign`, {
    userId: assigneeUser.id,
  });
  assert.equal(assignRes.status, 201);
  const assignment = assignRes.body.accommodation.assignments.find((a) => a.userId === assigneeUser.id);
  assert.equal(assignment.status, 'pending');

  const wrongAcceptRes = await stranger.post(
    `/api/accommodations/${accommodationId}/assignments/${assignment.id}/accept`
  );
  assert.equal(wrongAcceptRes.status, 403);

  const acceptRes = await assignee.post(
    `/api/accommodations/${accommodationId}/assignments/${assignment.id}/accept`
  );
  assert.equal(acceptRes.status, 200);
  const accepted = acceptRes.body.accommodation.assignments.find((a) => a.userId === assigneeUser.id);
  assert.equal(accepted.status, 'accepted');
});

test('assigning the same user twice returns 409', async () => {
  const { client } = await seedUser('acc6@test.local');
  const createRes = await client.post('/api/accommodations', {
    location: 'Hotel Z',
    startDate: '2026-06-01',
    endDate: '2026-06-08',
  });
  const accommodationId = createRes.body.accommodation.id;

  await client.post(`/api/accommodations/${accommodationId}/assign`, {});
  const secondRes = await client.post(`/api/accommodations/${accommodationId}/assign`, {});
  assert.equal(secondRes.status, 409);
});

test('assigning to a nonexistent accommodation returns 404', async () => {
  const { client } = await seedUser('acc7@test.local');
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const res = await client.post(`/api/accommodations/${fakeId}/assign`, {});
  assert.equal(res.status, 404);
});
