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

test('creating a flight requires the required fields', async () => {
  const { client } = await seedUser('flyer1@test.local');
  const res = await client.post('/api/flights', { airline: 'X' });
  assert.equal(res.status, 400);
});

test('a flight can be created, listed, edited and deleted by its owner', async () => {
  const { client, user } = await seedUser('flyer2@test.local');

  const createRes = await client.post('/api/flights', {
    airline: 'Lufthansa',
    flightNumber: 'LH123',
    departureAirport: 'FRA',
    arrivalAirport: 'AGP',
    departureTime: '2026-06-01T10:00:00Z',
  });
  assert.equal(createRes.status, 201);
  const flight = createRes.body.flight;
  assert.equal(flight.userId, user.id);
  assert.equal(flight.departureAirport, 'FRA');

  const listRes = await client.get('/api/flights');
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.flights.length, 1);

  const editRes = await client.patch(`/api/flights/${flight.id}`, {
    departureAirport: 'MUC',
    arrivalAirport: 'AGP',
    departureTime: '2026-06-01T12:00:00Z',
  });
  assert.equal(editRes.status, 200);
  assert.equal(editRes.body.flight.departureAirport, 'MUC');

  const deleteRes = await client.delete(`/api/flights/${flight.id}`);
  assert.equal(deleteRes.status, 204);

  const listAfterRes = await client.get('/api/flights');
  assert.equal(listAfterRes.body.flights.length, 0);
});

test('only the owner can edit or delete a flight', async () => {
  const { client: owner } = await seedUser('flyer-owner@test.local');
  const { client: other } = await seedUser('flyer-other@test.local');

  const createRes = await owner.post('/api/flights', {
    departureAirport: 'FRA',
    arrivalAirport: 'AGP',
    departureTime: '2026-06-01T10:00:00Z',
  });
  const flightId = createRes.body.flight.id;

  const editRes = await other.patch(`/api/flights/${flightId}`, {
    departureAirport: 'MUC',
    arrivalAirport: 'AGP',
    departureTime: '2026-06-01T12:00:00Z',
  });
  assert.equal(editRes.status, 403);

  const deleteRes = await other.delete(`/api/flights/${flightId}`);
  assert.equal(deleteRes.status, 403);
});

test('editing or deleting a nonexistent flight returns 404', async () => {
  const { client } = await seedUser('flyer3@test.local');
  const fakeId = '00000000-0000-0000-0000-000000000000';

  const editRes = await client.patch(`/api/flights/${fakeId}`, {
    departureAirport: 'FRA',
    arrivalAirport: 'AGP',
    departureTime: '2026-06-01T10:00:00Z',
  });
  assert.equal(editRes.status, 404);

  const deleteRes = await client.delete(`/api/flights/${fakeId}`);
  assert.equal(deleteRes.status, 404);
});
