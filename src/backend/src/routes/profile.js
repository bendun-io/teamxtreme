import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { updateUser, publicUser, findUserByEmail, userHasPasswordLogin } from '../db/users.js';
import { uploadMiddleware, isAcceptedMediaFile } from '../utils/scanUpload.js';

const uploadPicture = uploadMiddleware({
  fieldName: 'picture',
  maxFileSize: 5 * 1024 * 1024,
  fileFilter: (req, file, cb) => {
    if (!isAcceptedMediaFile(file, { video: false })) {
      console.warn(
        `profile picture upload rejected: type="${file.mimetype}" name="${file.originalname}" user=${req.user?.id ?? 'unknown'}`
      );
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
  const { name, email, phone, instagramHandle } = req.body || {};
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'name must not be empty' });
  }

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (req.file) updates.profilePictureUrl = `/uploads/${req.file.filename}`;

  if (email !== undefined) {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      if (await userHasPasswordLogin(req.user.id)) {
        return res.status(400).json({ error: 'email is required while password login is enabled' });
      }
      updates.email = null;
    } else {
      const existing = await findUserByEmail(trimmedEmail);
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'email already in use' });
      }
      updates.email = trimmedEmail;
    }
  }

  if (phone !== undefined) updates.phone = phone.trim() || null;
  if (instagramHandle !== undefined) {
    updates.instagramHandle = instagramHandle.trim().replace(/^@/, '') || null;
  }

  const user = await updateUser(req.user.id, updates);
  res.json({ user: publicUser(user) });
}));

export default router;
