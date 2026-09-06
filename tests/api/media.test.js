import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs, { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer, resetDb, closeDb } from '../helpers/server.js';
import { loginAsNewUser } from '../helpers/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// 1x1 transparent PNG
const pngBytes = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753' +
    'de0000000c4944415478da6360000002000100ffff03000006000557bfabd4' +
    '0000000049454e44ae426082',
  'hex'
);

// The standard ClamAV test signature — every scanner (including real
// ClamAV) flags this specific string as "infected" without being an
// actual virus, which is exactly why it exists.
const eicarBytes = Buffer.from(
  String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`
);

test('GET /api/media lists uploads ordered newest first', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'media1@test.local',
    password: 'pw123456',
    name: 'Media Person',
  });

  const form1 = new FormData();
  form1.set('file', new Blob([pngBytes], { type: 'image/png' }), 'first.png');
  await client.post('/api/media', undefined, { formData: form1 });

  const form2 = new FormData();
  form2.set('file', new Blob([pngBytes], { type: 'image/png' }), 'second.png');
  await client.post('/api/media', undefined, { formData: form2 });

  const res = await client.get('/api/media');
  assert.equal(res.status, 200);
  assert.equal(res.body.media.length, 2);
  assert.equal(res.body.media[0].originalName, 'second.png');
  assert.equal(res.body.media[0].uploadedByName, 'Media Person');
});

test('POST /api/media accepts an image and serves it back from /uploads', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'media2@test.local',
    password: 'pw123456',
    name: 'Uploader',
  });

  const form = new FormData();
  form.set('file', new Blob([pngBytes], { type: 'image/png' }), 'photo.png');
  const res = await client.post('/api/media', undefined, { formData: form });
  assert.equal(res.status, 201);
  assert.ok(res.body.media.url.startsWith('/uploads/'));

  const fileRes = await client.get(res.body.media.url);
  assert.equal(fileRes.status, 200);
});

test('POST /api/media accepts a real PWA icon and round-trips it byte-for-byte', async () => {
  // The other tests here upload a synthetic 1x1 PNG — good for exercising
  // the API shape, but a poor stand-in for what people actually share.
  // This uses one of the frontend's real icon files (a normal multi-KB
  // PNG) to confirm a realistic image survives quarantine -> ClamAV scan ->
  // uploadsDir -> GET /uploads/<filename> without being altered.
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'media6@test.local',
    password: 'pw123456',
    name: 'Icon Uploader',
  });

  const iconPath = path.join(__dirname, '../../src/frontend/public/icons/icon-192.png');
  const iconBytes = await readFile(iconPath);

  const form = new FormData();
  form.set('file', new Blob([iconBytes], { type: 'image/png' }), 'icon-192.png');
  const res = await client.post('/api/media', undefined, { formData: form });
  assert.equal(res.status, 201);
  assert.equal(res.body.media.originalName, 'icon-192.png');
  assert.equal(res.body.media.mimeType, 'image/png');
  assert.equal(res.body.media.fileSize, iconBytes.length);

  const listRes = await client.get('/api/media');
  assert.ok(listRes.body.media.some((m) => m.id === res.body.media.id));

  // The shared ApiClient decodes every response body as text/JSON, which
  // would corrupt binary data, so fetch the stored file directly instead.
  const fileRes = await fetch(`${baseUrl}${res.body.media.url}`, {
    headers: { cookie: client.cookie },
  });
  assert.equal(fileRes.status, 200);
  const downloaded = Buffer.from(await fileRes.arrayBuffer());
  assert.ok(downloaded.equals(iconBytes), 'downloaded file must match the original byte-for-byte');
});

test('POST /api/media still stores the file when quarantine and uploads dirs are on different filesystems (EXDEV)', async (t) => {
  // Reproduces a production bug: in docker-compose, uploadsDir is the
  // `uploads-data` named volume while quarantineDir is a plain directory on
  // the container's writable layer, so moving a clean file out of
  // quarantine crosses a filesystem boundary. node:fs/promises.rename()
  // can't do that and throws EXDEV — scanUpload.js must fall back to
  // copying the file instead. Simulate that boundary here (both dirs are on
  // the same disk in this test environment) by making the first rename()
  // call fail with EXDEV, same as production.
  t.mock.method(fs, 'rename', async () => {
    const err = new Error('EXDEV: cross-device link not permitted');
    err.code = 'EXDEV';
    throw err;
  });

  const { client } = await loginAsNewUser(baseUrl, {
    email: 'media7@test.local',
    password: 'pw123456',
    name: 'Cross Device Uploader',
  });

  const form = new FormData();
  form.set('file', new Blob([pngBytes], { type: 'image/png' }), 'cross-device.png');
  const res = await client.post('/api/media', undefined, { formData: form });
  assert.equal(res.status, 201);
  assert.ok(res.body.media.url.startsWith('/uploads/'));

  const fileRes = await client.get(res.body.media.url);
  assert.equal(fileRes.status, 200);
});

test('POST /api/media rejects a file type that is neither image nor video', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'media3@test.local',
    password: 'pw123456',
    name: 'Uploader',
  });

  const form = new FormData();
  form.set('file', new Blob([Buffer.from('just text')], { type: 'text/plain' }), 'notes.txt');
  const res = await client.post('/api/media', undefined, { formData: form });
  assert.equal(res.status, 400);
});

test('POST /api/media accepts a photo whose browser omitted the MIME type, based on its extension', async () => {
  // Mobile browsers sometimes send application/octet-stream (or no type at
  // all) for a camera-roll photo/video instead of image/* or video/* — a
  // real-world case that used to make a perfectly normal upload fail.
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'media5@test.local',
    password: 'pw123456',
    name: 'Uploader',
  });

  const form = new FormData();
  form.set('file', new Blob([pngBytes], { type: 'application/octet-stream' }), 'IMG_1234.jpg');
  const res = await client.post('/api/media', undefined, { formData: form });
  assert.equal(res.status, 201);
});

test('POST /api/media rejects a file that fails the malware scan and never stores it', async () => {
  const { client } = await loginAsNewUser(baseUrl, {
    email: 'media4@test.local',
    password: 'pw123456',
    name: 'Uploader',
  });

  const form = new FormData();
  form.set('file', new Blob([eicarBytes], { type: 'image/png' }), 'eicar.png');
  const res = await client.post('/api/media', undefined, { formData: form });
  // Usually 400 with isInfected: true from ClamAV. On a machine that also
  // runs a real-time host antivirus (e.g. Windows Defender), it can grab and
  // remove the on-disk EICAR fixture out from under our own scan, which
  // surfaces here as a 500 instead — still a rejection, just from a
  // different layer. Either way, nothing may end up stored or listed.
  assert.notEqual(res.status, 201);

  const list = await client.get('/api/media');
  assert.equal(list.body.media.length, 0);
});
