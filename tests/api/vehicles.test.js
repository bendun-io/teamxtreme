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
