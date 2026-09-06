import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadMiddleware, isAcceptedMediaFile } from '../utils/scanUpload.js';
import { listMedia, createMedia } from '../db/media.js';

const uploadMedia = uploadMiddleware({
  fieldName: 'file',
  maxFileSize: 500 * 1024 * 1024, // original quality photos/videos need real headroom
  fileFilter: (req, file, cb) => {
    if (!isAcceptedMediaFile(file)) {
      console.warn(
        `media upload rejected: type="${file.mimetype}" name="${file.originalname}" user=${req.user?.id ?? 'unknown'}`
      );
      return cb(new Error('file must be an image or video'));
    }
    cb(null, true);
  },
});

function publicMedia(m) {
  return {
    id: m.id,
    uploadedBy: m.uploaded_by,
    uploadedByName: m.uploaded_by_name,
    url: `/uploads/${m.file_name}`,
    originalName: m.original_name,
    mimeType: m.mime_type,
    fileSize: m.file_size,
    createdAt: m.created_at,
  };
}

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const media = await listMedia();
  res.json({ media: media.map(publicMedia) });
}));

router.post('/', uploadMedia, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  const media = await createMedia(req.user.id, {
    fileName: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
  });
  res.status(201).json({ media: publicMedia(media) });
}));

export default router;
