import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { updateUser, publicUser } from '../db/users.js';
import { uploadMiddleware } from '../utils/scanUpload.js';

const uploadPicture = uploadMiddleware({
  fieldName: 'picture',
  maxFileSize: 5 * 1024 * 1024,
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) {
      return cb(new Error('picture must be an image'));
    }
    cb(null, true);
  },
});

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
