// Resource-ownership checks: users must not be able to modify data that
// belongs to someone else, or accept an assignment that isn't theirs, even
// though they're a fully authenticated member of the group.
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

test("a user cannot edit or delete another user's flight", async () => {
  const { client: owner } = await seedUser('own1@test.local');
  const { client: intruder } = await seedUser('intr1@test.local');

  const createRes = await owner.post('/api/flights', {
    departureAirport: 'FRA',
    arrivalAirport: 'AGP',
    departureTime: '2026-06-01T10:00:00Z',
  });
  const flightId = createRes.body.flight.id;

  const editRes = await intruder.patch(`/api/flights/${flightId}`, {
    departureAirport: 'HAM',
    arrivalAirport: 'AGP',
    departureTime: '2026-06-01T10:00:00Z',
  });
  assert.equal(editRes.status, 403);

  const deleteRes = await intruder.delete(`/api/flights/${flightId}`);
  assert.equal(deleteRes.status, 403);

  // the flight is untouched
  const listRes = await owner.get('/api/flights');
  assert.equal(listRes.body.flights[0].departureAirport, 'FRA');
});

test("a user cannot accept an accommodation assignment that isn't theirs", async () => {
  const { client: creator } = await seedUser('own2@test.local');
  const { client: target, user: targetUser } = await seedUser('own3@test.local');
  const { client: intruder } = await seedUser('intr2@test.local');

  const createRes = await creator.post('/api/accommodations', {
    location: 'Hotel Intrusion Test',
    startDate: '2026-06-01',
    endDate: '2026-06-08',
    spots: 4,
  });
  const accommodationId = createRes.body.accommodation.id;

  const assignRes = await creator.post(`/api/accommodations/${accommodationId}/assign`, {
    userId: targetUser.id,
  });
  const assignment = assignRes.body.accommodation.assignments.find((a) => a.userId === targetUser.id);

  const intruderAcceptRes = await intruder.post(
    `/api/accommodations/${accommodationId}/assignments/${assignment.id}/accept`
  );
  assert.equal(intruderAcceptRes.status, 403);

  // the rightful assignee can still accept it afterwards
  const legitAcceptRes = await target.post(
    `/api/accommodations/${accommodationId}/assignments/${assignment.id}/accept`
  );
  assert.equal(legitAcceptRes.status, 200);
});

test("a user cannot accept a vehicle assignment that isn't theirs", async () => {
  const { client: creator } = await seedUser('own4@test.local');
  const { user: targetUser } = await seedUser('own5@test.local');
  const { client: intruder } = await seedUser('intr3@test.local');

  const createRes = await creator.post('/api/vehicles', {
    startingPoint: 'Karlsruhe',
    endingPoint: 'Málaga',
    departureTime: '2026-06-01T09:00:00Z',
    seats: 4,
  });
  const vehicleId = createRes.body.vehicle.id;

  const assignRes = await creator.post(`/api/vehicles/${vehicleId}/assign`, { userId: targetUser.id });
  const assignment = assignRes.body.vehicle.assignments.find((a) => a.userId === targetUser.id);

  const res = await intruder.post(`/api/vehicles/${vehicleId}/assignments/${assignment.id}/accept`);
  assert.equal(res.status, 403);
});

test("a user cannot stop another user's activity", async () => {
  const { client: creator } = await seedUser('own8@test.local');
  const { client: intruder } = await seedUser('intr4@test.local');

  const createRes = await creator.post('/api/activities', {
    title: 'Sparring',
    location: 'Gym',
    startTime: '2030-01-01T15:00:00Z',
  });
  const activityId = createRes.body.activity.id;

  const stopRes = await intruder.post(`/api/activities/${activityId}/stop`);
  assert.equal(stopRes.status, 403);

  // the activity is untouched, still without an endTime
  const listRes = await creator.get('/api/activities');
  assert.equal(listRes.body.activities[0].endTime, null);
});

test('PATCH /api/profile only ever changes the caller\'s own account', async () => {
  const { client: userA } = await seedUser('own6@test.local');
  const { client: userB, user: userBBefore } = await seedUser('own7@test.local');

  const form = new FormData();
  form.set('name', 'Hijacked Name');
  await userA.patch('/api/profile', undefined, { formData: form });

  const bRes = await userB.get('/api/profile');
  assert.equal(bRes.body.user.name, userBBefore.name);
});
