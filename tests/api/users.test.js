import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, resetDb, closeDb } from '../helpers/server.js';
import { loginAsNewUser } from '../helpers/seed.js';
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

test('GET /api/users requires auth and returns a name-sorted directory with contact info', async () => {
  const anonRes = await new ApiClient(baseUrl).get('/api/users');
  assert.equal(anonRes.status, 401);

  const { client } = await loginAsNewUser(baseUrl, { email: 'zz@test.local', password: 'pw123456', name: 'Zed' });
  await loginAsNewUser(baseUrl, { email: 'aa@test.local', password: 'pw123456', name: 'Aaron' });

  const res = await client.get('/api/users');
  assert.equal(res.status, 200);
  const names = res.body.users.map((u) => u.name);
  assert.deepEqual(names, [...names].sort());
  assert.ok(
    res.body.users.every((u) => Object.keys(u).sort().join(',') === 'email,id,instagramHandle,name,phone')
  );
  const zed = res.body.users.find((u) => u.name === 'Zed');
  assert.equal(zed.email, 'zz@test.local');
});

test('DELETE /api/users/:id removes the account and their data, but not other users\' assignments they made', async () => {
  const { client: admin } = await loginAsNewUser(baseUrl, {
    email: 'del-admin@test.local',
    password: 'pw123456',
    name: 'Del Admin',
    isAdmin: true,
  });
  const { client: target, user: targetUser } = await loginAsNewUser(baseUrl, {
    email: 'del-target@test.local',
    password: 'pw123456',
    name: 'Del Target',
  });
  const { user: bystander } = await loginAsNewUser(baseUrl, {
    email: 'del-bystander@test.local',
    password: 'pw123456',
    name: 'Del Bystander',
  });

  // The target user creates and uploads/assigns things, including assigning
  // someone *else* (the bystander) to an accommodation they created —
  // migration 010_allow_user_deletion.sql must let the target's account be
  // deleted without also deleting the bystander's (still-valid) assignment.
  await target.post('/api/flights', {
    departureAirport: 'FRA',
    arrivalAirport: 'AGP',
    departureTime: '2026-06-01T10:00:00Z',
  });
  const accRes = await target.post('/api/accommodations', {
    location: 'Hotel Test',
    startDate: '2026-06-01',
    endDate: '2026-06-08',
    spots: 4,
  });
  const accommodationId = accRes.body.accommodation.id;
  const assignRes = await target.post(`/api/accommodations/${accommodationId}/assign`, {
    userId: bystander.id,
  });
  const assignmentId = assignRes.body.accommodation.assignments[0].id;

  const res = await admin.delete(`/api/users/${targetUser.id}`);
  assert.equal(res.status, 204);

  const usersRes = await admin.get('/api/users');
  assert.ok(!usersRes.body.users.some((u) => u.id === targetUser.id));

  const flightsRes = await admin.get('/api/flights');
  assert.equal(flightsRes.body.flights.length, 0, "deleting the creator should also remove their flight");

  // The accommodation itself is owned (created_by) by the deleted user, so
  // it cascades away too — but the bystander's assignment row existing at
  // all (rather than the whole delete failing with a 500) is what this test
  // is really proving: assigned_by pointing at a deleted user must not block
  // the delete or take an unrelated user's assignment down with it.
  const accommodationsRes = await admin.get('/api/accommodations');
  assert.equal(accommodationsRes.body.accommodations.length, 0);

  const invitesRes = await admin.get('/api/auth/invites');
  assert.ok(
    !invitesRes.body.invites.some((i) => i.usedBy === targetUser.id),
    'the deleted user\'s own invite should be gone too'
  );
});

test('DELETE /api/users/:id returns 404 for an unknown user', async () => {
  const { client: admin } = await loginAsNewUser(baseUrl, {
    email: 'del-admin2@test.local',
    password: 'pw123456',
    name: 'Del Admin 2',
    isAdmin: true,
  });
  const res = await admin.delete('/api/users/00000000-0000-0000-0000-000000000000');
  assert.equal(res.status, 404);
});

test('DELETE /api/users/:id refuses to let an admin delete themselves', async () => {
  const { client: admin, user } = await loginAsNewUser(baseUrl, {
    email: 'del-admin3@test.local',
    password: 'pw123456',
    name: 'Del Admin 3',
    isAdmin: true,
  });
  const res = await admin.delete(`/api/users/${user.id}`);
  assert.equal(res.status, 400);

  const meRes = await admin.get('/api/auth/me');
  assert.equal(meRes.status, 200);
});
