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

const futureRide = () => ({
  startingPoint: 'Karlsruhe',
  endingPoint: 'Málaga',
  departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
});

test('creating a vehicle requires a positive seats number', async () => {
  const { client } = await seedUser('veh1@test.local');
  const missingRes = await client.post('/api/vehicles', { ...futureRide(), details: 'Van' });
  assert.equal(missingRes.status, 400);

  const zeroRes = await client.post('/api/vehicles', { ...futureRide(), seats: 0 });
  assert.equal(zeroRes.status, 400);
});

test('creating a vehicle requires startingPoint, endingPoint and departureTime', async () => {
  const { client } = await seedUser('veh5@test.local');

  const missingStart = await client.post('/api/vehicles', { ...futureRide(), startingPoint: undefined, seats: 4 });
  assert.equal(missingStart.status, 400);

  const missingEnd = await client.post('/api/vehicles', { ...futureRide(), endingPoint: undefined, seats: 4 });
  assert.equal(missingEnd.status, 400);

  const missingDeparture = await client.post('/api/vehicles', {
    ...futureRide(),
    departureTime: undefined,
    seats: 4,
  });
  assert.equal(missingDeparture.status, 400);
});

test('listing vehicles returns ride fields, ordered by departure time ascending', async () => {
  const { client } = await seedUser('veh6@test.local');
  const later = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const sooner = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await client.post('/api/vehicles', { ...futureRide(), departureTime: later, seats: 2 });
  await client.post('/api/vehicles', { ...futureRide(), departureTime: sooner, seats: 3 });

  const listRes = await client.get('/api/vehicles');
  assert.equal(listRes.status, 200);
  assert.deepEqual(
    listRes.body.vehicles.map((v) => v.departureTime),
    [sooner, later]
  );
  assert.equal(listRes.body.vehicles[0].startingPoint, 'Karlsruhe');
  assert.equal(listRes.body.vehicles[0].endingPoint, 'Málaga');
});

test('free spots is seats minus the number of assignments, regardless of status', async () => {
  const { client: creator } = await seedUser('veh-free1@test.local');
  const { client: other } = await seedUser('veh-free2@test.local');

  const createRes = await creator.post('/api/vehicles', { ...futureRide(), seats: 2 });
  const vehicle = createRes.body.vehicle;
  assert.equal(vehicle.seats, 2);
  assert.equal(vehicle.freeSpots, 2);

  const { user: otherUser } = await loginAsNewUser(baseUrl, {
    email: 'veh-free3@test.local',
    password: 'pw123456',
    name: 'Third',
  });

  await creator.post(`/api/vehicles/${vehicle.id}/assign`, {});
  const afterSelf = await creator.get('/api/vehicles');
  assert.equal(afterSelf.body.vehicles[0].freeSpots, 1);

  // A pending (not yet accepted) assignment still counts against free spots.
  await creator.post(`/api/vehicles/${vehicle.id}/assign`, { userId: otherUser.id });
  const afterPending = await creator.get('/api/vehicles');
  assert.equal(afterPending.body.vehicles[0].freeSpots, 0);

  // Assigning beyond capacity isn't blocked (mirrors accommodations) — free
  // spots goes negative rather than being clamped, signalling an overbooking.
  await other.post(`/api/vehicles/${vehicle.id}/assign`, {});
  const overbooked = await creator.get('/api/vehicles');
  assert.equal(overbooked.body.vehicles[0].freeSpots, -1);
});

test('self-assign is accepted; assigning another user is pending until accepted', async () => {
  const { client: creator } = await seedUser('veh2@test.local');
  const { client: assignee, user: assigneeUser } = await seedUser('veh3@test.local');

  const createRes = await creator.post('/api/vehicles', { ...futureRide(), seats: 4, details: 'Rental car' });
  assert.equal(createRes.status, 201);
  const vehicleId = createRes.body.vehicle.id;

  const selfAssignRes = await creator.post(`/api/vehicles/${vehicleId}/assign`, {});
  assert.equal(selfAssignRes.body.vehicle.assignments[0].status, 'accepted');

  const assignRes = await creator.post(`/api/vehicles/${vehicleId}/assign`, { userId: assigneeUser.id });
  const pending = assignRes.body.vehicle.assignments.find((a) => a.userId === assigneeUser.id);
  assert.equal(pending.status, 'pending');

  const acceptRes = await assignee.post(`/api/vehicles/${vehicleId}/assignments/${pending.id}/accept`);
  assert.equal(acceptRes.status, 200);
  const accepted = acceptRes.body.vehicle.assignments.find((a) => a.userId === assigneeUser.id);
  assert.equal(accepted.status, 'accepted');
});

test('assigning the same user twice returns 409', async () => {
  const { client } = await seedUser('veh4@test.local');
  const createRes = await client.post('/api/vehicles', { ...futureRide(), seats: 4 });
  const vehicleId = createRes.body.vehicle.id;

  await client.post(`/api/vehicles/${vehicleId}/assign`, {});
  const secondRes = await client.post(`/api/vehicles/${vehicleId}/assign`, {});
  assert.equal(secondRes.status, 409);
});
