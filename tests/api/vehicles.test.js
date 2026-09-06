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

test('creating a vehicle requires a positive seats number', async () => {
  const { client } = await seedUser('veh1@test.local');
  const missingRes = await client.post('/api/vehicles', { details: 'Van' });
  assert.equal(missingRes.status, 400);

  const zeroRes = await client.post('/api/vehicles', { seats: 0 });
  assert.equal(zeroRes.status, 400);
});

test('self-assign is accepted; assigning another user is pending until accepted', async () => {
  const { client: creator } = await seedUser('veh2@test.local');
  const { client: assignee, user: assigneeUser } = await seedUser('veh3@test.local');

  const createRes = await creator.post('/api/vehicles', { seats: 4, details: 'Rental car' });
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
  const createRes = await client.post('/api/vehicles', { seats: 4 });
  const vehicleId = createRes.body.vehicle.id;

  await client.post(`/api/vehicles/${vehicleId}/assign`, {});
  const secondRes = await client.post(`/api/vehicles/${vehicleId}/assign`, {});
  assert.equal(secondRes.status, 409);
});
