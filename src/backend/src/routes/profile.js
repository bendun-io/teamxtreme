import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler.js';
import { updateUser, publicUser } from '../db/users.js';
import { uploadsDir } from '../utils/uploads.js';

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) {
      return cb(new Error('picture must be an image'));
    }
    cb(null, true);
  },
});

function uploadPicture(req, res, next) {
  upload.single('picture')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

const router = Router();

router.get('/', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch('/', uploadPicture, asyncHandler(async (req, res) => {
  const { name } = req.body || {};
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'name must not be empty' });
  }

  const profilePictureUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
  const user = await updateUser(req.user.id, { name: name || undefined, profilePictureUrl });
  res.json({ user: publicUser(user) });
}));

export default router;
