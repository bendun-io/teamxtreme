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

async function seedUser(email, isAdmin = false) {
  return loginAsNewUser(baseUrl, { email, password: 'pw123456', name: email, isAdmin });
}

test('creating an activity requires title, location and startTime', async () => {
  const { client } = await seedUser('act1@test.local');
  const res = await client.post('/api/activities', { title: 'Beach volleyball' });
  assert.equal(res.status, 400);
});

test('an activity can be created and listed', async () => {
  const { client, user } = await seedUser('act2@test.local');

  const createRes = await client.post('/api/activities', {
    title: 'Beach volleyball',
    location: 'Playa El Faro',
    startTime: '2030-01-01T15:00:00Z',
  });
  assert.equal(createRes.status, 201);
  const activity = createRes.body.activity;
  assert.equal(activity.createdBy, user.id);
  assert.equal(activity.title, 'Beach volleyball');
  assert.equal(activity.location, 'Playa El Faro');
  assert.equal(activity.endTime, null);

  const listRes = await client.get('/api/activities');
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.activities.length, 1);
});

test('only the creator or an admin can stop an activity, which sets endTime to now', async () => {
  const { client: creator } = await seedUser('act3@test.local');
  const { client: other } = await seedUser('act4@test.local');
  const { client: admin } = await seedUser('act5@test.local', true);

  const createRes = await creator.post('/api/activities', {
    title: 'Sparring',
    location: 'Gym',
    startTime: '2030-01-01T15:00:00Z',
  });
  const activityId = createRes.body.activity.id;

  const forbiddenRes = await other.post(`/api/activities/${activityId}/stop`);
  assert.equal(forbiddenRes.status, 403);

  const adminStopRes = await admin.post(`/api/activities/${activityId}/stop`);
  assert.equal(adminStopRes.status, 200);
  assert.ok(adminStopRes.body.activity.endTime);
});

test('the creator can stop their own activity', async () => {
  const { client } = await seedUser('act6@test.local');

  const createRes = await client.post('/api/activities', {
    title: 'Sparring',
    location: 'Gym',
    startTime: '2030-01-01T15:00:00Z',
  });
  const activityId = createRes.body.activity.id;

  const stopRes = await client.post(`/api/activities/${activityId}/stop`);
  assert.equal(stopRes.status, 200);
  assert.ok(stopRes.body.activity.endTime);
});

test('stopping a nonexistent activity returns 404', async () => {
  const { client } = await seedUser('act7@test.local');
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const res = await client.post(`/api/activities/${fakeId}/stop`);
  assert.equal(res.status, 404);
});

test('only ongoing or future activities are listed', async () => {
  const { client } = await seedUser('act8@test.local');

  const pastRes = await client.post('/api/activities', {
    title: 'Yesterday run',
    location: 'Beach',
    startTime: '2020-01-01T08:00:00Z',
    endTime: '2020-01-01T09:00:00Z',
  });
  assert.equal(pastRes.status, 201);

  const futureRes = await client.post('/api/activities', {
    title: 'Tomorrow run',
    location: 'Beach',
    startTime: '2030-01-01T08:00:00Z',
  });
  assert.equal(futureRes.status, 201);

  const listRes = await client.get('/api/activities');
  assert.equal(listRes.body.activities.length, 1);
  assert.equal(listRes.body.activities[0].title, 'Tomorrow run');
});
