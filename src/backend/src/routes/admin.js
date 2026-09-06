import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pool } from '../db/pool.js';
import { updateSettings } from '../db/settings.js';
import { uploadsDir, thumbnailsDir } from '../utils/uploads.js';

const router = Router();

router.patch('/settings', asyncHandler(async (req, res) => {
  const { whatsappLink } = req.body || {};
  if (whatsappLink !== undefined && !whatsappLink.trim()) {
    return res.status(400).json({ error: 'whatsappLink must not be empty' });
  }
  const settings = await updateSettings({
    whatsappLink: whatsappLink !== undefined ? whatsappLink.trim() : undefined,
  });
  res.json({ settings });
}));

// The phrase an admin must type to confirm — per docs/Spec.md this is
// destructive ("delete all uploaded files and users") and hard to reverse,
// so a plain OK/Cancel confirm() isn't enough; the frontend gates the button
// on this same text, and the backend re-checks it so the confirmation can't
// be skipped by replaying/scripting the request.
const CLEAR_DATA_CONFIRMATION = 'LÖSCHEN';

// Resets the app for a new season: every non-admin account and all trip data
// (flights, accommodations, vehicles and their assignments, invites, shared
// media) is deleted. Admin accounts are kept — see the "Clear data scope"
// decision in DevelopmentPlan.md — so the app stays usable immediately
// afterwards instead of requiring a server restart to re-bootstrap an admin.
router.post('/clear-data', asyncHandler(async (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== CLEAR_DATA_CONFIRMATION) {
    return res.status(400).json({ error: `confirm must be exactly "${CLEAR_DATA_CONFIRMATION}"` });
  }

  // Read what's on disk before the rows referencing it are gone.
  const { rows: mediaFiles } = await pool.query('SELECT file_name, thumbnail_name FROM media');
  const { rows: nonAdminPictures } = await pool.query(
    "SELECT profile_picture_url FROM users WHERE is_admin = false AND profile_picture_url IS NOT NULL"
  );

  const client = await pool.connect();
  let counts;
  try {
    await client.query('BEGIN');
    // invites reference users(id) with no ON DELETE CASCADE, so they must go
    // before the users they were created/used by; accommodations/vehicles
    // cascade their own assignments automatically on delete.
    const media = await client.query('DELETE FROM media');
    await client.query('DELETE FROM invites');
    const accommodations = await client.query('DELETE FROM accommodations');
    const vehicles = await client.query('DELETE FROM vehicles');
    const flights = await client.query('DELETE FROM flights');
    const users = await client.query('DELETE FROM users WHERE is_admin = false');
    await client.query('COMMIT');
    counts = {
      users: users.rowCount,
      flights: flights.rowCount,
      accommodations: accommodations.rowCount,
      vehicles: vehicles.rowCount,
      media: media.rowCount,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Best-effort disk cleanup — the DB rows are already gone regardless, so a
  // leftover file here is untidy, not a functional or security issue.
  const filesToDelete = [];
  for (const m of mediaFiles) {
    filesToDelete.push(path.join(uploadsDir, m.file_name));
    if (m.thumbnail_name) filesToDelete.push(path.join(thumbnailsDir, m.thumbnail_name));
  }
  for (const u of nonAdminPictures) {
    // profile_picture_url is `/uploads/<filename>` for a locally-uploaded
    // picture, or an external URL for one prefilled from Google/Instagram
    // that was never stored locally — only unlink the former.
    if (u.profile_picture_url.startsWith('/uploads/')) {
      filesToDelete.push(path.join(uploadsDir, u.profile_picture_url.slice('/uploads/'.length)));
    }
  }
  await Promise.all(
    filesToDelete.map((file) =>
      fs.unlink(file).catch((err) => {
        if (err.code !== 'ENOENT') console.warn(`clear-data: failed to remove file ${file}:`, err);
      })
    )
  );

  res.json({ cleared: counts });
}));

export default router;
