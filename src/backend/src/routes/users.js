import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { listUsers, findUserById, deleteUser } from '../db/users.js';
import { pool } from '../db/pool.js';
import { uploadsDir, thumbnailsDir } from '../utils/uploads.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const users = await listUsers();
  res.json({ users });
}));

// Admin-only, per docs/Spec.md's "User Management" section ("Admins should
// through their panel also have the possibilities to delete single users.
// This should be done from the invitation management"). Blocking self-delete
// avoids an admin locking themselves out mid-session. Most of a user's own
// data (flights, accommodations/vehicles/activities they created, media they
// uploaded, their own used invite — see migration
// 010_allow_user_deletion.sql) is removed automatically by the users(id)
// foreign keys' ON DELETE behavior; this handler only has to clean up files
// on disk that the DB doesn't know about.
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'cannot delete your own account' });
  }

  const target = await findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: 'user not found' });

  // Read what's on disk before the row (and its cascaded media rows) is gone.
  const { rows: mediaFiles } = await pool.query(
    'SELECT file_name, thumbnail_name FROM media WHERE uploaded_by = $1',
    [req.params.id]
  );

  let deleted;
  try {
    deleted = await deleteUser(req.params.id);
  } catch (err) {
    // Still possible for an admin who has themselves created invites
    // (invites.created_by has no ON DELETE behavior — deleting an inviter
    // shouldn't silently orphan invites other people may still be holding).
    if (err.code === '23503') {
      return res.status(409).json({ error: 'user cannot be deleted because they still have associated data' });
    }
    throw err;
  }
  if (!deleted) return res.status(404).json({ error: 'user not found' });

  // Best-effort disk cleanup — the DB rows are already gone regardless, so a
  // leftover file here is untidy, not a functional or security issue (same
  // reasoning as routes/admin.js's clear-data).
  const filesToDelete = mediaFiles.flatMap((m) => [
    path.join(uploadsDir, m.file_name),
    ...(m.thumbnail_name ? [path.join(thumbnailsDir, m.thumbnail_name)] : []),
  ]);
  if (target.profilePictureUrl?.startsWith('/uploads/')) {
    filesToDelete.push(path.join(uploadsDir, target.profilePictureUrl.slice('/uploads/'.length)));
  }
  await Promise.all(
    filesToDelete.map((file) =>
      fs.unlink(file).catch((err) => {
        if (err.code !== 'ENOENT') console.warn(`user delete: failed to remove file ${file}:`, err);
      })
    )
  );

  res.status(204).end();
}));

export default router;
