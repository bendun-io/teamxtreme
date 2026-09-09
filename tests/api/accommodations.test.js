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
  const res = await client.post('/api/accommodations', { location: 'Hotel X', spots: 4 });
  assert.equal(res.status, 400);
});

test('creating an accommodation requires a positive whole number of spots', async () => {
  const { client } = await seedUser('acc-spots@test.local');
  const base = { location: 'Hotel X', startDate: '2026-06-01', endDate: '2026-06-08' };

  const missing = await client.post('/api/accommodations', base);
  assert.equal(missing.status, 400);

  const zero = await client.post('/api/accommodations', { ...base, spots: 0 });
  assert.equal(zero.status, 400);

  const fractional = await client.post('/api/accommodations', { ...base, spots: 2.5 });
  assert.equal(fractional.status, 400);
});

test('free spots is spots minus the number of assignments, regardless of status', async () => {
  const { client: creator } = await seedUser('acc-free1@test.local');
  const { client: other } = await seedUser('acc-free2@test.local');

  const createRes = await creator.post('/api/accommodations', {
    location: 'Hotel Free',
    startDate: '2026-06-01',
    endDate: '2026-06-08',
    spots: 2,
  });
  const accommodation = createRes.body.accommodation;
  assert.equal(accommodation.spots, 2);
  assert.equal(accommodation.freeSpots, 2);

  const { user: otherUser } = await loginAsNewUser(baseUrl, {
    email: 'acc-free3@test.local',
    password: 'pw123456',
    name: 'Third',
  });

  await creator.post(`/api/accommodations/${accommodation.id}/assign`, {});
  const afterSelf = await creator.get('/api/accommodations');
  assert.equal(afterSelf.body.accommodations[0].freeSpots, 1);

  // A pending (not yet accepted) assignment still counts against free spots.
  await creator.post(`/api/accommodations/${accommodation.id}/assign`, { userId: otherUser.id });
  const afterPending = await creator.get('/api/accommodations');
  assert.equal(afterPending.body.accommodations[0].freeSpots, 0);

  // Assigning beyond capacity isn't blocked (mirrors vehicles) — free spots
  // goes negative rather than being clamped, signalling an overbooking.
  await other.post(`/api/accommodations/${accommodation.id}/assign`, {});
  const overbooked = await creator.get('/api/accommodations');
  assert.equal(overbooked.body.accommodations[0].freeSpots, -1);
});

test('price is optional, but must be a positive number when given', async () => {
  const { client } = await seedUser('acc-price-invalid@test.local');
  const base = { location: 'Hotel X', startDate: '2026-06-01', endDate: '2026-06-08', spots: 4 };

  const noPrice = await client.post('/api/accommodations', base);
  assert.equal(noPrice.status, 201);
  assert.equal(noPrice.body.accommodation.price, null);

  const zero = await client.post('/api/accommodations', { ...base, price: 0 });
  assert.equal(zero.status, 400);

  const negative = await client.post('/api/accommodations', { ...base, price: -10 });
  assert.equal(negative.status, 400);
});

test('price is split into a per-night and a per-person share', async () => {
  const { client: creator } = await seedUser('acc-price1@test.local');

  const createRes = await creator.post('/api/accommodations', {
    location: 'Hotel Price',
    startDate: '2026-06-01',
    endDate: '2026-06-08', // 7 nights
    spots: 4,
    price: 700,
  });
  const accommodation = createRes.body.accommodation;
  assert.equal(accommodation.price, 700);
  assert.equal(accommodation.pricePerNight, 100);
  // Nobody assigned yet — nothing to divide the total among.
  assert.equal(accommodation.pricePerPerson, null);

  await creator.post(`/api/accommodations/${accommodation.id}/assign`, {});
  const afterSelf = await creator.get('/api/accommodations');
  assert.equal(afterSelf.body.accommodations[0].pricePerPerson, 700);

  // A second (still-pending) assignment counts too, same as freeSpots.
  const { user: otherUser } = await loginAsNewUser(baseUrl, {
    email: 'acc-price3@test.local',
    password: 'pw123456',
    name: 'Third',
  });
  await creator.post(`/api/accommodations/${accommodation.id}/assign`, { userId: otherUser.id });
  const afterPending = await creator.get('/api/accommodations');
  assert.equal(afterPending.body.accommodations[0].pricePerPerson, 350);
});

test('self-assign is created already accepted', async () => {
  const { client } = await seedUser('acc2@test.local');
  const createRes = await client.post('/api/accommodations', {
    location: 'Hotel X',
    startDate: '2026-06-01',
    endDate: '2026-06-08',
    spots: 4,
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
    spots: 4,
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
    spots: 4,
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
