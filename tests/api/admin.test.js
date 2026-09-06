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

// 1x1 transparent PNG, same fixture as tests/api/media.test.js
const pngBytes = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753' +
    'de0000000c4944415478da6360000002000100ffff03000006000557bfabd4' +
    '0000000049454e44ae426082',
  'hex'
);

async function seedFullTrip() {
  const { client: admin } = await loginAsNewUser(baseUrl, {
    email: 'clear-admin@test.local',
    password: 'pw123456',
    name: 'Clear Admin',
    isAdmin: true,
  });
  const { client: member } = await loginAsNewUser(baseUrl, {
    email: 'clear-member@test.local',
    password: 'pw123456',
    name: 'Clear Member',
  });

  await member.post('/api/flights', {
    departureAirport: 'FRA',
    arrivalAirport: 'AGP',
    departureTime: '2026-06-01T10:00:00Z',
  });
  await member.post('/api/accommodations', {
    location: 'Hotel Test',
    startDate: '2026-06-01',
    endDate: '2026-06-08',
    spots: 4,
  });
  await member.post('/api/vehicles', {
    startingPoint: 'Karlsruhe',
    endingPoint: 'Málaga',
    departureTime: '2026-06-01T09:00:00Z',
    seats: 4,
  });
  await member.post('/api/activities', {
    title: 'Sparring',
    location: 'Gym',
    startTime: '2030-01-01T15:00:00Z',
  });
  await admin.post('/api/auth/invites', { name: 'Future Member' });

  const form = new FormData();
  form.set('file', new Blob([pngBytes], { type: 'image/png' }), 'trip.png');
  await member.post('/api/media', undefined, { formData: form });

  return { admin, member };
}

test('POST /api/admin/clear-data rejects a wrong confirmation phrase and deletes nothing', async () => {
  const { admin } = await seedFullTrip();

  const res = await admin.post('/api/admin/clear-data', { confirm: 'delete' });
  assert.equal(res.status, 400);

  const usersRes = await admin.get('/api/users');
  assert.equal(usersRes.body.users.length, 2);
  const mediaRes = await admin.get('/api/media');
  assert.equal(mediaRes.body.media.length, 1);
});

test('POST /api/admin/clear-data wipes trip data and non-admin users but keeps admins', async () => {
  const { admin } = await seedFullTrip();

  const res = await admin.post('/api/admin/clear-data', { confirm: 'LÖSCHEN' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.cleared, {
    users: 1,
    flights: 1,
    accommodations: 1,
    vehicles: 1,
    activities: 1,
    media: 1,
  });

  const usersRes = await admin.get('/api/users');
  assert.equal(usersRes.body.users.length, 1);
  assert.equal(usersRes.body.users[0].name, 'Clear Admin');

  const flightsRes = await admin.get('/api/flights');
  assert.equal(flightsRes.body.flights.length, 0);
  const accommodationsRes = await admin.get('/api/accommodations');
  assert.equal(accommodationsRes.body.accommodations.length, 0);
  const vehiclesRes = await admin.get('/api/vehicles');
  assert.equal(vehiclesRes.body.vehicles.length, 0);
  const activitiesRes = await admin.get('/api/activities');
  assert.equal(activitiesRes.body.activities.length, 0);
  const mediaRes = await admin.get('/api/media');
  assert.equal(mediaRes.body.media.length, 0);
  const invitesRes = await admin.get('/api/auth/invites');
  assert.equal(invitesRes.body.invites.length, 0);

  // The admin's own session/account must still work afterwards.
  const meRes = await admin.get('/api/auth/me');
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.name, 'Clear Admin');
});
