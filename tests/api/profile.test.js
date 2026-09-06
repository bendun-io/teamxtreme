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

test('GET /api/profile returns the caller\'s own account', async () => {
  const { client, user } = await loginAsNewUser(baseUrl, {
    email: 'profile1@test.local',
    password: 'pw123456',
    name: 'Original Name',
  });
  const res = await client.get('/api/profile');
  assert.equal(res.status, 200);
  assert.equal(res.body.user.id, user.id);
  assert.equal(res.body.user.name, 'Original Name');
});

test('PATCH /api/profile updates the name only', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'profile2@test.local',
    password: 'pw123456',
    name: 'Old Name',
  });

  const form = new FormData();
  form.set('name', 'New Name');
  const res = await client.patch('/api/profile', undefined, { formData: form });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.name, 'New Name');
});

test('PATCH /api/profile rejects an empty name', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'profile3@test.local',
    password: 'pw123456',
    name: 'Keep Me',
  });

  const form = new FormData();
  form.set('name', '   ');
  const res = await client.patch('/api/profile', undefined, { formData: form });
  assert.equal(res.status, 400);
});

test('PATCH /api/profile uploads a picture and rejects non-image files', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'profile4@test.local',
    password: 'pw123456',
    name: 'Picture Person',
  });

  // 1x1 transparent PNG
  const pngBytes = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753' +
      'de0000000c4944415478da6360000002000100ffff03000006000557bfabd4' +
      '0000000049454e44ae426082',
    'hex'
  );
  const imageForm = new FormData();
  imageForm.set('picture', new Blob([pngBytes], { type: 'image/png' }), 'avatar.png');
  const imageRes = await client.patch('/api/profile', undefined, { formData: imageForm });
  assert.equal(imageRes.status, 200);
  assert.ok(imageRes.body.user.profilePictureUrl.startsWith('/uploads/'));

  const textForm = new FormData();
  textForm.set('picture', new Blob([Buffer.from('not an image')], { type: 'text/plain' }), 'notes.txt');
  const textRes = await client.patch('/api/profile', undefined, { formData: textForm });
  assert.equal(textRes.status, 400);
});

test('PATCH /api/profile updates phone and Instagram handle, and clears them again', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'profile6@test.local',
    password: 'pw123456',
    name: 'Contact Person',
  });

  const form = new FormData();
  form.set('phone', '+49 151 23456789');
  form.set('instagramHandle', '@teamxtreme');
  const res = await client.patch('/api/profile', undefined, { formData: form });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.phone, '+49 151 23456789');
  assert.equal(res.body.user.instagramHandle, 'teamxtreme');

  const clearForm = new FormData();
  clearForm.set('phone', '');
  clearForm.set('instagramHandle', '');
  const clearRes = await client.patch('/api/profile', undefined, { formData: clearForm });
  assert.equal(clearRes.status, 200);
  assert.equal(clearRes.body.user.phone, null);
  assert.equal(clearRes.body.user.instagramHandle, null);
});

test('PATCH /api/profile refuses to clear the email of a password-login account', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'profile7@test.local',
    password: 'pw123456',
    name: 'Password User',
  });

  const form = new FormData();
  form.set('email', '');
  const res = await client.patch('/api/profile', undefined, { formData: form });
  assert.equal(res.status, 400);
});

test('PATCH /api/profile rejects an email already used by another account', async () => {
  await loginAsNewUser(baseUrl, { email: 'taken@test.local', password: 'pw123456', name: 'First' });
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'profile8@test.local',
    password: 'pw123456',
    name: 'Second',
  });

  const form = new FormData();
  form.set('email', 'taken@test.local');
  const res = await client.patch('/api/profile', undefined, { formData: form });
  assert.equal(res.status, 409);
});

test('PATCH /api/profile accepts a picture whose browser omitted the MIME type, based on its extension', async () => {
  // Mirrors the same real-world mobile-browser quirk covered in
  // tests/api/media.test.js.
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'profile5@test.local',
    password: 'pw123456',
    name: 'Picture Person',
  });

  const pngBytes = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753' +
      'de0000000c4944415478da6360000002000100ffff03000006000557bfabd4' +
      '0000000049454e44ae426082',
    'hex'
  );
  const form = new FormData();
  form.set('picture', new Blob([pngBytes], { type: 'application/octet-stream' }), 'IMG_5678.jpg');
  const res = await client.patch('/api/profile', undefined, { formData: form });
  assert.equal(res.status, 200);
  assert.ok(res.body.user.profilePictureUrl.startsWith('/uploads/'));
});
